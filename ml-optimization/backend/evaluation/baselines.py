"""
baselines.py — Approach A: Fixed-rule recovery baseline.

What "fixed-rule" means here
-----------------------------
A human operator working from a static contact list:
  1. Tries each warehouse in registration order — transfers whatever is
     available above safety stock, regardless of cost.
  2. Tries each supplier in registration order — orders up to capacity,
     regardless of cost or lead time.
  3. Stops when demand is met or all options are exhausted.
  4. No budget check is applied (assumes emergency spend authority).
  5. No cost sorting, no delay-penalty optimisation.

This is intentionally worse than the cost-sorted greedy (Approach B)
to create a meaningful comparison baseline.

The output is the same RecoveryPlan dataclass used by the optimizer,
so KPI computation is identical across all three approaches.
solver_type is set to "fixed_rule_baseline" to distinguish it clearly.
"""

from __future__ import annotations

import math
import time
from typing import List

from backend.optimizer.schemas import (
    ActionType,
    ComponentDemand,
    OptimizerConfig,
    RecoveryAction,
    RecoveryPlan,
    SolverStatus,
    SupplierOption,
    WarehouseInventory,
)


def solve_fixed_rule(
    demands: List[ComponentDemand],
    warehouses: List[WarehouseInventory],
    suppliers: List[SupplierOption],
    config: OptimizerConfig,
) -> RecoveryPlan:
    """
    Apply a fixed-rule (registration-order) recovery strategy.

    No cost optimisation is performed.  This represents a manual/ad-hoc
    operator response where suppliers are contacted in the order they
    appear in the input list.

    Returns
    -------
    RecoveryPlan
        solver_type = ``"fixed_rule_baseline"``
    """
    t_start = time.monotonic()

    # Mutable remaining quantities (registration order preserved)
    wh_remaining: dict[tuple, int] = {}
    for w in warehouses:
        usable = max(0, w.available_qty - config.safety_stock.get(w.component_id, 0))
        wh_remaining[(w.warehouse_id, w.component_id)] = usable

    sup_remaining: dict[tuple, int] = {}
    for s in suppliers:
        if s.is_available:
            sup_remaining[(s.supplier_id, s.component_id)] = s.capacity

    actions: List[RecoveryAction] = []
    violated: List[str] = []
    fulfilled: dict[str, int] = {d.component_id: 0 for d in demands}

    # Process demands in registration order (no priority sorting)
    for demand in demands:
        c = demand.component_id
        needed = demand.required_qty
        if needed == 0:
            continue

        # Step 1: drain warehouses in registration order, no cost check
        for w in warehouses:
            if needed <= 0:
                break
            if w.component_id != c:
                continue
            avail = wh_remaining.get((w.warehouse_id, c), 0)
            allocate = min(needed, avail)
            if allocate <= 0:
                continue

            due = demand.due_date_days
            arrival = w.transfer_lead_time_days
            delay_days = max(0.0, arrival - due) if not math.isinf(due) else 0.0
            penalty = delay_days * config.delay_penalty_per_day * allocate

            actions.append(RecoveryAction(
                action_type=ActionType.WAREHOUSE_TRANSFER,
                source_id=w.warehouse_id,
                component_id=c,
                quantity=allocate,
                unit_cost=w.transfer_cost_per_unit,
                estimated_arrival_days=arrival,
                subtotal_cost=w.transfer_cost_per_unit * allocate,
                delay_days=delay_days,
                delay_penalty=penalty,
            ))
            wh_remaining[(w.warehouse_id, c)] -= allocate
            fulfilled[c] = fulfilled.get(c, 0) + allocate
            needed -= allocate

        # Step 2: contact suppliers in registration order, no cost sorting
        for s in suppliers:
            if needed <= 0:
                break
            if s.component_id != c or not s.is_available:
                continue
            avail = sup_remaining.get((s.supplier_id, c), 0)
            allocate = min(needed, avail)
            if allocate <= 0:
                continue

            due = demand.due_date_days
            arrival = s.lead_time_days
            delay_days = max(0.0, arrival - due) if not math.isinf(due) else 0.0
            penalty = delay_days * config.delay_penalty_per_day * allocate

            actions.append(RecoveryAction(
                action_type=ActionType.SUPPLIER_PURCHASE,
                source_id=s.supplier_id,
                component_id=c,
                quantity=allocate,
                unit_cost=s.effective_cost_per_unit,
                estimated_arrival_days=arrival,
                subtotal_cost=s.effective_cost_per_unit * allocate,
                delay_days=delay_days,
                delay_penalty=penalty,
            ))
            sup_remaining[(s.supplier_id, c)] -= allocate
            fulfilled[c] = fulfilled.get(c, 0) + allocate
            needed -= allocate

        if needed > 0:
            violated.append(
                f"Fixed-rule unmet demand: '{c}' still needs {needed} units "
                f"(all sources in registration order exhausted)."
            )

    total_proc = sum(a.subtotal_cost for a in actions)
    total_pen = sum(a.delay_penalty for a in actions)
    total = total_proc + total_pen

    is_infeasible = (
        any("Unmet demand" in v or "unmet demand" in v for v in violated)
        and not config.allow_partial_fulfillment
    )
    status = SolverStatus.INFEASIBLE if is_infeasible else (
        SolverStatus.FALLBACK if violated else SolverStatus.FEASIBLE
    )

    return RecoveryPlan(
        actions=actions,
        total_procurement_cost=total_proc,
        total_delay_penalty=total_pen,
        total_cost=total,
        fulfilled=fulfilled,
        violated_constraints=violated,
        is_infeasible=is_infeasible,
        solver_type="fixed_rule_baseline",
        solver_status=status,
        solver_wall_time_seconds=time.monotonic() - t_start,
    )
