"""
fallback.py — Deterministic greedy recovery optimizer.

Used when OR-Tools is unavailable or returns an unusable result.

Algorithm
---------
1. For each component (sorted by priority ascending = highest first):
   a. Enumerate all available supply options (warehouse transfers +
      supplier purchases) that are not disrupted.
   b. Rank options by *effective cost per unit* (purchase price +
      transport cost, or transfer cost) ascending.
      Ties broken by lead_time_days ascending (prefer faster delivery).
   c. Greedily allocate from the cheapest option until demand is met
      or all options are exhausted.
   d. Respect safety-stock limits (warehouse), supplier capacities,
      and a rolling budget balance.
2. Record any unmet demand and budget overruns as violated constraints.
3. Return a ``RecoveryPlan`` with ``solver_type = "greedy_fallback"``.

This strategy is **not globally optimal** — it can miss solutions
that require trading a slightly higher unit cost for a lower delay
penalty.  For exact optimality use the CP-SAT solver.
"""

from __future__ import annotations

import math
import time
from typing import List

from .schemas import (
    ActionType,
    ComponentDemand,
    OptimizerConfig,
    RecoveryAction,
    RecoveryPlan,
    SolverStatus,
    SupplierOption,
    WarehouseInventory,
)


def _make_infeasible_plan(
    reason: str,
    solver_wall_time: float,
    demands: List[ComponentDemand],
) -> RecoveryPlan:
    return RecoveryPlan(
        actions=[],
        total_procurement_cost=0.0,
        total_delay_penalty=0.0,
        total_cost=0.0,
        fulfilled={d.component_id: 0 for d in demands},
        violated_constraints=[reason],
        is_infeasible=True,
        solver_type="greedy_fallback",
        solver_status=SolverStatus.INFEASIBLE,
        solver_wall_time_seconds=solver_wall_time,
    )


def solve_greedy(
    demands: List[ComponentDemand],
    warehouses: List[WarehouseInventory],
    suppliers: List[SupplierOption],
    config: OptimizerConfig,
) -> RecoveryPlan:
    """
    Run the deterministic cost-sorted greedy optimizer.

    Parameters mirror :func:`~backend.optimizer.optimizer.plan_recovery`.

    Returns
    -------
    RecoveryPlan
        Always ``solver_type = "greedy_fallback"``.
    """
    t_start = time.monotonic()

    # Mutable state --------------------------------------------------------
    # Remaining inventory per (warehouse_id, component_id)
    wh_remaining: dict[tuple, int] = {}
    for w in warehouses:
        usable = max(0, w.available_qty - config.safety_stock.get(w.component_id, 0))
        wh_remaining[(w.warehouse_id, w.component_id)] = usable

    # Remaining capacity per (supplier_id, component_id)
    sup_remaining: dict[tuple, int] = {}
    for s in suppliers:
        if s.is_available:
            sup_remaining[(s.supplier_id, s.component_id)] = s.capacity

    budget_remaining = config.budget_limit

    actions: List[RecoveryAction] = []
    violated: List[str] = []
    fulfilled: dict[str, int] = {d.component_id: 0 for d in demands}

    # Sort demands by priority (1 = highest)
    sorted_demands = sorted(demands, key=lambda d: (d.priority, d.component_id))

    for demand in sorted_demands:
        c = demand.component_id
        needed = demand.required_qty

        if needed == 0:
            continue

        # Build candidate supply options for this component
        candidates = []

        for w in warehouses:
            if w.component_id != c:
                continue
            avail = wh_remaining.get((w.warehouse_id, c), 0)
            if avail <= 0:
                continue
            candidates.append({
                "type": "warehouse",
                "source_id": w.warehouse_id,
                "unit_cost": w.transfer_cost_per_unit,
                "lead_time": w.transfer_lead_time_days,
                "available": avail,
                "key": (w.warehouse_id, c),
            })

        for s in suppliers:
            if s.component_id != c or not s.is_available:
                continue
            avail = sup_remaining.get((s.supplier_id, c), 0)
            if avail <= 0:
                continue
            candidates.append({
                "type": "supplier",
                "source_id": s.supplier_id,
                "unit_cost": s.effective_cost_per_unit,
                "lead_time": s.lead_time_days,
                "available": avail,
                "key": (s.supplier_id, c),
            })

        # Sort: cheapest first, then fastest on ties
        candidates.sort(key=lambda x: (x["unit_cost"], x["lead_time"]))

        for opt in candidates:
            if needed <= 0:
                break

            allocate = min(needed, opt["available"])
            if allocate <= 0:
                continue

            # Budget check
            spend = allocate * opt["unit_cost"]
            if not math.isinf(budget_remaining):
                if spend > budget_remaining:
                    # Partial allocation within budget
                    if opt["unit_cost"] > 0:
                        allocate = int(budget_remaining // opt["unit_cost"])
                    else:
                        allocate = 0
                    if allocate <= 0:
                        violated.append(
                            f"Budget exhausted; could not source {needed} more "
                            f"units of '{c}' from '{opt['source_id']}'."
                        )
                        break
                    spend = allocate * opt["unit_cost"]

            # Delay penalty
            arrival = opt["lead_time"]
            due = demand.due_date_days
            delay_days = max(0.0, arrival - due) if not math.isinf(due) else 0.0
            penalty = delay_days * config.delay_penalty_per_day * allocate

            action_type = (
                ActionType.WAREHOUSE_TRANSFER
                if opt["type"] == "warehouse"
                else ActionType.SUPPLIER_PURCHASE
            )
            actions.append(RecoveryAction(
                action_type=action_type,
                source_id=opt["source_id"],
                component_id=c,
                quantity=allocate,
                unit_cost=opt["unit_cost"],
                estimated_arrival_days=arrival,
                subtotal_cost=spend,
                delay_days=delay_days,
                delay_penalty=penalty,
            ))

            # Update state
            if opt["type"] == "warehouse":
                wh_remaining[opt["key"]] -= allocate
            else:
                sup_remaining[opt["key"]] -= allocate

            budget_remaining = budget_remaining - spend if not math.isinf(budget_remaining) else budget_remaining
            fulfilled[c] = fulfilled.get(c, 0) + allocate
            needed -= allocate

        if needed > 0:
            violated.append(
                f"Unmet demand: '{c}' still needs {needed} units "
                f"(supply exhausted or budget insufficient)."
            )

    # Aggregate totals
    total_proc = sum(a.subtotal_cost for a in actions)
    total_pen = sum(a.delay_penalty for a in actions)
    total = total_proc + total_pen

    is_infeasible = any("Unmet demand" in v for v in violated) and not config.allow_partial_fulfillment
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
        solver_type="greedy_fallback",
        solver_status=status,
        solver_wall_time_seconds=time.monotonic() - t_start,
    )
