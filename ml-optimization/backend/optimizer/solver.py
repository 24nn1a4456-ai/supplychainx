"""
solver.py — OR-Tools CP-SAT recovery optimizer.

Model formulation
-----------------
Decision variables (all non-negative integers):
  buy[s, c]  — units purchased from supplier s for component c
  pull[w, c] — units transferred from warehouse w for component c

Objective (minimise, in integer cents to keep CP-SAT happy):
  Σ_{s,c} (price[s,c] + transport[s,c] + delay_penalty[s,c]) * buy[s,c]
+ Σ_{w,c}  transfer_cost[w,c]                                * pull[w,c]

where delay_penalty[s,c] = max(0, lead_time[s,c] − due_date[c])
                           * delay_penalty_per_day

Constraints:
  (D) Demand:   Σ_s buy[s,c] + Σ_w pull[w,c] >= required[c]   ∀ c
  (C) Capacity: buy[s,c]  <= capacity[s,c]                      ∀ s,c
  (I) Inventory:pull[w,c] <= available[w,c] − safety_stock[c]  ∀ w,c  (≥0)
  (B) Budget:   Σ costs * quantities <= budget                  (if finite)

All floats are multiplied by SCALE = 100 (integer cents) before passing
to CP-SAT; results are divided back for the public API.

Infeasibility handling
----------------------
If the solver returns INFEASIBLE, the function analyses why:
- Per-component: checks if total available supply < required_qty
- Budget: checks if minimum-cost plan exceeds budget
These are recorded in `violated_constraints` and `is_infeasible = True`.
"""

from __future__ import annotations

import math
import time
from typing import Dict, List, Tuple

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

# Float → integer scaling factor (cent precision)
_SCALE = 100


def _to_int_cost(value: float) -> int:
    """Convert a float cost to integer cents, capped at a safe CP-SAT bound."""
    if math.isinf(value) or math.isnan(value):
        return 2**40  # large but safe for CP-SAT int64
    return int(round(value * _SCALE))


def _analyse_infeasibility(
    demands: List[ComponentDemand],
    warehouses: List[WarehouseInventory],
    suppliers: List[SupplierOption],
    config: OptimizerConfig,
) -> List[str]:
    """Return human-readable reasons why the problem is infeasible."""
    reasons: List[str] = []

    # Supply sufficiency per component
    for d in demands:
        c = d.component_id
        total_supply = 0
        for s in suppliers:
            if s.component_id == c and s.is_available:
                total_supply += s.capacity
        for w in warehouses:
            if w.component_id == c:
                usable = max(0, w.available_qty - config.safety_stock.get(c, 0))
                total_supply += usable
        if total_supply < d.required_qty:
            reasons.append(
                f"Insufficient supply for '{c}': {d.required_qty} units needed, "
                f"only {total_supply} available across all sources."
            )

    # Budget sufficiency (min-cost = cheapest option for each unit demanded)
    if not math.isinf(config.budget_limit):
        min_cost_estimate = 0.0
        for d in demands:
            c = d.component_id
            options = []
            for s in suppliers:
                if s.component_id == c and s.is_available:
                    options.append(s.effective_cost_per_unit)
            for w in warehouses:
                if w.component_id == c:
                    options.append(w.transfer_cost_per_unit)
            if options:
                min_cost_estimate += min(options) * d.required_qty
        if min_cost_estimate > config.budget_limit:
            reasons.append(
                f"Budget too tight: minimum estimated cost {min_cost_estimate:.2f} "
                f"exceeds budget {config.budget_limit:.2f}."
            )

    if not reasons:
        reasons.append("Problem is infeasible (solver could not find a feasible plan).")

    return reasons


def solve_with_cpsat(
    demands: List[ComponentDemand],
    warehouses: List[WarehouseInventory],
    suppliers: List[SupplierOption],
    config: OptimizerConfig,
) -> RecoveryPlan:
    """
    Solve the recovery optimisation problem using OR-Tools CP-SAT.

    Returns
    -------
    RecoveryPlan
        ``solver_type = "ortools_cpsat"`` with status OPTIMAL, FEASIBLE, or
        INFEASIBLE.
    """
    from ortools.sat.python import cp_model  # deferred import

    t_start = time.monotonic()
    model = cp_model.CpModel()

    # ------------------------------------------------------------------
    # Index lookups
    # ------------------------------------------------------------------
    demand_map: Dict[str, ComponentDemand] = {d.component_id: d for d in demands}

    # Safety stock per component
    ss: Dict[str, int] = config.safety_stock

    # ------------------------------------------------------------------
    # Decision variables
    # ------------------------------------------------------------------
    # buy[(supplier_id, component_id)] = IntVar
    buy: Dict[Tuple[str, str], object] = {}
    for s in suppliers:
        if not s.is_available:
            continue
        key = (s.supplier_id, s.component_id)
        d = demand_map.get(s.component_id)
        # Upper bound: can't buy more than min(capacity, demand)
        ub = s.capacity
        if d is not None:
            ub = min(ub, d.required_qty)
        buy[key] = model.new_int_var(0, ub, f"buy_{s.supplier_id}_{s.component_id}")

    # pull[(warehouse_id, component_id)] = IntVar
    pull: Dict[Tuple[str, str], object] = {}
    for w in warehouses:
        key = (w.warehouse_id, w.component_id)
        usable = max(0, w.available_qty - ss.get(w.component_id, 0))
        d = demand_map.get(w.component_id)
        ub = usable
        if d is not None:
            ub = min(ub, d.required_qty)
        pull[key] = model.new_int_var(0, ub, f"pull_{w.warehouse_id}_{w.component_id}")

    # ------------------------------------------------------------------
    # Objective coefficients (in cents per unit)
    # ------------------------------------------------------------------
    obj_terms = []

    for s in suppliers:
        if not s.is_available:
            continue
        key = (s.supplier_id, s.component_id)
        if key not in buy:
            continue
        d = demand_map.get(s.component_id)
        due = d.due_date_days if d is not None else math.inf
        delay_days = max(0.0, s.lead_time_days - due) if not math.isinf(due) else 0.0
        penalty_per_unit = config.delay_penalty_per_day * delay_days
        coeff = _to_int_cost(s.effective_cost_per_unit + penalty_per_unit)
        obj_terms.append(coeff * buy[key])

    for w in warehouses:
        key = (w.warehouse_id, w.component_id)
        if key not in pull:
            continue
        d = demand_map.get(w.component_id)
        due = d.due_date_days if d is not None else math.inf
        delay_days = max(0.0, w.transfer_lead_time_days - due) if not math.isinf(due) else 0.0
        penalty_per_unit = config.delay_penalty_per_day * delay_days
        coeff = _to_int_cost(w.transfer_cost_per_unit + penalty_per_unit)
        obj_terms.append(coeff * pull[key])

    if obj_terms:
        model.minimize(sum(obj_terms))

    # ------------------------------------------------------------------
    # Constraints
    # ------------------------------------------------------------------

    # (D) Demand satisfaction per component
    for d in demands:
        c = d.component_id
        supply_vars = []
        for s in suppliers:
            if s.component_id == c and s.is_available:
                k = (s.supplier_id, c)
                if k in buy:
                    supply_vars.append(buy[k])
        for w in warehouses:
            if w.component_id == c:
                k = (w.warehouse_id, c)
                if k in pull:
                    supply_vars.append(pull[k])
        if supply_vars:
            model.add(sum(supply_vars) >= d.required_qty)
        elif d.required_qty > 0:
            # No variables for this component → unsatisfiable
            model.add_bool_and([model.new_bool_var("_infeasible_marker_")])  # force INFEASIBLE

    # (B) Budget constraint (in cents)
    if not math.isinf(config.budget_limit):
        cost_terms = []
        for s in suppliers:
            if not s.is_available:
                continue
            k = (s.supplier_id, s.component_id)
            if k in buy:
                coeff = _to_int_cost(s.effective_cost_per_unit)
                cost_terms.append(coeff * buy[k])
        for w in warehouses:
            k = (w.warehouse_id, w.component_id)
            if k in pull:
                coeff = _to_int_cost(w.transfer_cost_per_unit)
                cost_terms.append(coeff * pull[k])
        if cost_terms:
            budget_cents = _to_int_cost(config.budget_limit)
            model.add(sum(cost_terms) <= budget_cents)

    # ------------------------------------------------------------------
    # Solve
    # ------------------------------------------------------------------
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = config.solver_timeout_seconds
    solver.parameters.log_search_progress = False

    status_code = solver.solve(model)
    wall_time = time.monotonic() - t_start

    # ------------------------------------------------------------------
    # Handle INFEASIBLE / UNKNOWN
    # ------------------------------------------------------------------
    if status_code not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        reasons = _analyse_infeasibility(demands, warehouses, suppliers, config)
        fulfilled = {d.component_id: 0 for d in demands}
        return RecoveryPlan(
            actions=[],
            total_procurement_cost=0.0,
            total_delay_penalty=0.0,
            total_cost=0.0,
            fulfilled=fulfilled,
            violated_constraints=reasons,
            is_infeasible=True,
            solver_type="ortools_cpsat",
            solver_status=SolverStatus.INFEASIBLE,
            solver_wall_time_seconds=wall_time,
        )

    # ------------------------------------------------------------------
    # Extract solution
    # ------------------------------------------------------------------
    actions: List[RecoveryAction] = []
    fulfilled: Dict[str, int] = {d.component_id: 0 for d in demands}

    # Supplier purchases
    sup_map = {(s.supplier_id, s.component_id): s for s in suppliers}
    for (sid, cid), var in buy.items():
        qty = solver.value(var)
        if qty <= 0:
            continue
        s = sup_map[(sid, cid)]
        d = demand_map.get(cid)
        due = d.due_date_days if d is not None else math.inf
        delay_days = max(0.0, s.lead_time_days - due) if not math.isinf(due) else 0.0
        penalty = delay_days * config.delay_penalty_per_day * qty
        subtotal = s.effective_cost_per_unit * qty
        actions.append(RecoveryAction(
            action_type=ActionType.SUPPLIER_PURCHASE,
            source_id=sid,
            component_id=cid,
            quantity=qty,
            unit_cost=s.effective_cost_per_unit,
            estimated_arrival_days=s.lead_time_days,
            subtotal_cost=subtotal,
            delay_days=delay_days,
            delay_penalty=penalty,
        ))
        fulfilled[cid] = fulfilled.get(cid, 0) + qty

    # Warehouse transfers
    wh_map = {(w.warehouse_id, w.component_id): w for w in warehouses}
    for (wid, cid), var in pull.items():
        qty = solver.value(var)
        if qty <= 0:
            continue
        w = wh_map[(wid, cid)]
        d = demand_map.get(cid)
        due = d.due_date_days if d is not None else math.inf
        delay_days = max(0.0, w.transfer_lead_time_days - due) if not math.isinf(due) else 0.0
        penalty = delay_days * config.delay_penalty_per_day * qty
        subtotal = w.transfer_cost_per_unit * qty
        actions.append(RecoveryAction(
            action_type=ActionType.WAREHOUSE_TRANSFER,
            source_id=wid,
            component_id=cid,
            quantity=qty,
            unit_cost=w.transfer_cost_per_unit,
            estimated_arrival_days=w.transfer_lead_time_days,
            subtotal_cost=subtotal,
            delay_days=delay_days,
            delay_penalty=penalty,
        ))
        fulfilled[cid] = fulfilled.get(cid, 0) + qty

    total_proc = sum(a.subtotal_cost for a in actions)
    total_pen = sum(a.delay_penalty for a in actions)
    total = total_proc + total_pen

    or_status = SolverStatus.OPTIMAL if status_code == cp_model.OPTIMAL else SolverStatus.FEASIBLE

    return RecoveryPlan(
        actions=actions,
        total_procurement_cost=total_proc,
        total_delay_penalty=total_pen,
        total_cost=total,
        fulfilled=fulfilled,
        violated_constraints=[],
        is_infeasible=False,
        solver_type="ortools_cpsat",
        solver_status=or_status,
        solver_wall_time_seconds=wall_time,
    )
