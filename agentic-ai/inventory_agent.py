"""
Supply Chain X - Agent 4: Inventory Recovery Agent
Author: Member 1 (Agentic AI Engineer)

Role: Evaluates warehouse network stock to formulate emergency inventory reallocations.
Enforces strict preservation of safety reserves (reallocatable <= available_stock - safety_stock),
calculates transfer costs and transit timelines, handles partial recoveries and shortfall states explicitly.

INTEGRATION CONTRACT:
- Input: InventoryRecoveryInput
- Output: InventoryRecoveryResult (containing feasible transfers and shortfall metrics)
- Safe: Never invents warehouse inventory; verifies safety buffer invariants.
"""

from __future__ import annotations

import logging
from typing import List, Optional

from .schemas import (
    CrisisEvent,
    InventoryOption,
    InventoryRecoveryInput,
    InventoryRecoveryResult,
    FeasibleTransferOption,
    IneligibleWarehouseOption,
)
from .tools import ToolRegistry

logger = logging.getLogger("supply_chain_x.agents.inventory")


def evaluate_inventory_recovery(
    input_data: InventoryRecoveryInput,
    tools: Optional[ToolRegistry] = None,
) -> InventoryRecoveryResult:
    """
    Computes feasible inventory transfer allocations from secondary warehouses.

    Safety Rules Enforced:
    1. Safety Reserve Preservation: Transferred units cannot dip into reserved_safety_stock.
       Max Reallocatable = max(0, available_stock - reserved_safety_stock).
    2. Lead-Time Constraints: Depots exceeding max_transfer_lead_time_days are disqualified.
    3. Deterministic Allocation: Priority given to closest facilities (lowest lead time),
       then lowest unit handling/transfer cost.
    4. Shortfall Tracking: Unmet demand is explicitly calculated and reported.

    Returns:
        InventoryRecoveryResult containing feasible transfers, disqualified depots, and shortfall.
    """
    registry = tools or ToolRegistry()
    logger.info(
        f"==> Agent 4: Evaluating inventory reallocation for SKU {input_data.product_id} "
        f"(Target units: {input_data.required_quantity:,})"
    )

    # Step 1: Query inventory positions from Member 2's WMS connector
    inventory_snapshots = registry.inventory_provider.get_inventory_options(input_data.product_id)

    viable_depots: List[InventoryOption] = []
    ineligible_depots: List[IneligibleWarehouseOption] = []
    total_reallocatable_network_stock = 0

    for inv in inventory_snapshots:
        # Calculate strictly permissible buffer above safety stock
        permissible_buffer = max(0, inv.available_stock - inv.reserved_safety_stock)
        effective_reallocatable = min(inv.reallocatable_units, permissible_buffer)

        # Check if depot has any safe reallocatable units
        if effective_reallocatable <= 0:
            ineligible_depots.append(
                IneligibleWarehouseOption(
                    warehouse_id=inv.warehouse_id,
                    warehouse_location=inv.warehouse_location,
                    reason=(
                        f"Zero reallocatable stock above safety reserve (Physical: {inv.available_stock:,}, "
                        f"Safety reserve: {inv.reserved_safety_stock:,})"
                    ),
                )
            )
            continue

        # Check lead time constraint if specified
        if input_data.max_transfer_lead_time_days is not None:
            if inv.transfer_lead_time_days > input_data.max_transfer_lead_time_days:
                ineligible_depots.append(
                    IneligibleWarehouseOption(
                        warehouse_id=inv.warehouse_id,
                        warehouse_location=inv.warehouse_location,
                        reason=(
                            f"Transfer lead time ({inv.transfer_lead_time_days} days) exceeds limit "
                            f"({input_data.max_transfer_lead_time_days} days)"
                        ),
                    )
                )
                continue

        total_reallocatable_network_stock += effective_reallocatable
        viable_depots.append(inv)

    # Step 2: Sort viable depots deterministically
    # Shortest transfer lead time first, then lowest unit transfer cost
    viable_depots.sort(key=lambda x: (x.transfer_lead_time_days, x.transfer_cost_per_unit))

    # Step 3: Greedily allocate inventory against required quantity
    feasible_transfers: List[FeasibleTransferOption] = []
    remaining_needed = input_data.required_quantity
    total_allocated = 0
    total_transfer_cost = 0.0
    critical_lead_time = 0

    for depot in viable_depots:
        if remaining_needed <= 0:
            break

        safe_buffer = max(0, depot.available_stock - depot.reserved_safety_stock)
        available_from_depot = min(depot.reallocatable_units, safe_buffer)
        alloc_units = min(remaining_needed, available_from_depot)

        if alloc_units > 0:
            cost = round(alloc_units * depot.transfer_cost_per_unit, 2)
            safety_retained = depot.available_stock - alloc_units

            feasible_transfers.append(
                FeasibleTransferOption(
                    warehouse_id=depot.warehouse_id,
                    warehouse_location=depot.warehouse_location,
                    product_id=input_data.product_id,
                    allocated_units=alloc_units,
                    unit_transfer_cost=depot.transfer_cost_per_unit,
                    total_transfer_cost=cost,
                    transfer_lead_time_days=depot.transfer_lead_time_days,
                    safety_stock_retained=safety_retained,
                )
            )

            total_allocated += alloc_units
            total_transfer_cost += cost
            critical_lead_time = max(critical_lead_time, depot.transfer_lead_time_days)
            remaining_needed -= alloc_units

    shortfall = max(0, input_data.required_quantity - total_allocated)
    is_fully_covered = (total_allocated == input_data.required_quantity)

    logger.info(
        f"Inventory Evaluation Summary: Allocated {total_allocated:,}/{input_data.required_quantity:,} units "
        f"from {len(feasible_transfers)} depot(s). Shortfall: {shortfall:,} units. Cost: ${total_transfer_cost:,.2f}"
    )

    return InventoryRecoveryResult(
        product_id=input_data.product_id,
        required_quantity=input_data.required_quantity,
        total_reallocatable_stock=total_reallocatable_network_stock,
        allocated_quantity=total_allocated,
        shortfall_quantity=shortfall,
        is_fully_covered=is_fully_covered,
        feasible_transfers=feasible_transfers,
        ineligible_warehouses=ineligible_depots,
        estimated_total_transfer_cost=round(total_transfer_cost, 2),
        critical_transfer_lead_time_days=critical_lead_time,
    )


# Backward-compatible helper for pipeline
def discover_inventory_options(
    crisis: CrisisEvent,
    tools: Optional[ToolRegistry] = None,
) -> List[InventoryOption]:
    """Retrieves viable inventory options for orchestrator pipeline."""
    registry = tools or ToolRegistry()
    options: List[InventoryOption] = []
    for product_id in crisis.affected_product_ids:
        inv_list = registry.inventory_provider.get_inventory_options(product_id)
        for inv in inv_list:
            if inv.reallocatable_units > 0:
                options.append(inv)
    return options
