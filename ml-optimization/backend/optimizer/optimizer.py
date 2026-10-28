"""
optimizer.py — Public entry point for the supply-chain recovery optimizer.

Member 1 should import and call only :func:`plan_recovery` from here.

The function:
  1. Validates all inputs (rejects negatives, missing IDs, etc.).
  2. Filters out disrupted / zero-capacity suppliers.
  3. Attempts the OR-Tools CP-SAT solver.
  4. Falls back to the deterministic greedy solver if CP-SAT is unavailable
     or returns an unusable result.
  5. Returns a fully structured :class:`~backend.optimizer.schemas.RecoveryPlan`.
"""

from __future__ import annotations

import math
import warnings
from typing import List, Optional

from .fallback import solve_greedy
from .schemas import (
    ComponentDemand,
    OptimizerConfig,
    RecoveryPlan,
    SolverStatus,
    SupplierOption,
    WarehouseInventory,
)

# Is OR-Tools importable?
try:
    from ortools.sat.python import cp_model as _cp_model_probe  # noqa: F401
    _ORTOOLS_AVAILABLE = True
except ImportError:
    _ORTOOLS_AVAILABLE = False


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------

def _validate_inputs(
    demands: List[ComponentDemand],
    warehouses: List[WarehouseInventory],
    suppliers: List[SupplierOption],
    config: OptimizerConfig,
) -> None:
    """Raise ValueError if any inputs are logically invalid."""
    if not demands:
        raise ValueError("'demands' must not be empty.")

    seen_demand_ids: set[str] = set()
    for d in demands:
        if not d.component_id.strip():
            raise ValueError("ComponentDemand.component_id must not be blank.")
        if d.component_id in seen_demand_ids:
            raise ValueError(
                f"Duplicate component_id '{d.component_id}' in demands list. "
                "Merge duplicate entries before calling plan_recovery()."
            )
        seen_demand_ids.add(d.component_id)
        # required_qty < 0 is already caught by __post_init__; 0 is allowed.

    for w in warehouses:
        if not w.warehouse_id.strip():
            raise ValueError("WarehouseInventory.warehouse_id must not be blank.")
        if not w.component_id.strip():
            raise ValueError("WarehouseInventory.component_id must not be blank.")
        # available_qty < 0 caught by __post_init__

    for s in suppliers:
        if not s.supplier_id.strip():
            raise ValueError("SupplierOption.supplier_id must not be blank.")
        if not s.component_id.strip():
            raise ValueError("SupplierOption.component_id must not be blank.")
        # capacity < 0 caught by __post_init__

    if config.budget_limit < 0:
        raise ValueError("config.budget_limit must be >= 0.")
    for cid, ss in config.safety_stock.items():
        if ss < 0:
            raise ValueError(
                f"config.safety_stock['{cid}'] must be >= 0, got {ss}."
            )
    if config.delay_penalty_per_day < 0:
        raise ValueError("config.delay_penalty_per_day must be >= 0.")
    if config.solver_timeout_seconds <= 0:
        raise ValueError("config.solver_timeout_seconds must be > 0.")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def plan_recovery(
    demands: List[ComponentDemand],
    warehouses: Optional[List[WarehouseInventory]] = None,
    suppliers: Optional[List[SupplierOption]] = None,
    config: Optional[OptimizerConfig] = None,
) -> RecoveryPlan:
    """
    Compute an optimal (or near-optimal) supply-chain recovery plan.

    This is the **single function Member 1's orchestrator should call**.

    Parameters
    ----------
    demands : List[ComponentDemand]
        Components to be procured and their quantities / deadlines.
        Required.  Must be non-empty with unique component IDs.

    warehouses : List[WarehouseInventory], optional
        Warehouse stocks eligible for transfer.  Defaults to empty list.

    suppliers : List[SupplierOption], optional
        Supplier purchase options.  Disrupted suppliers (is_available=False)
        are automatically excluded.  Defaults to empty list.

    config : OptimizerConfig, optional
        Penalty weights, budget cap, safety stock, solver timeout.
        Defaults to ``OptimizerConfig()`` (no budget, no safety stock,
        delay penalty = 5.0/day, 30 s timeout).

    Returns
    -------
    RecoveryPlan
        Contains:
        - ``actions`` — list of sourcing actions (supplier / warehouse)
        - ``total_cost`` — procurement cost + delay penalties
        - ``fulfilled`` — units allocated per component
        - ``violated_constraints`` — human-readable list of unmet constraints
        - ``is_infeasible`` — True when demand cannot be satisfied
        - ``solver_type`` — ``"ortools_cpsat"`` or ``"greedy_fallback"``

    Raises
    ------
    ValueError
        For invalid inputs (negative quantities, blank IDs, etc.).

    Notes
    -----
    * This function **does not make real purchases** or contact external APIs.
    * A plan with ``is_infeasible=True`` and ``allow_partial_fulfillment=True``
      still returns what *could* be fulfilled — check ``violated_constraints``
      for gaps.
    * All monetary values are in the same unit as the input costs (no
      currency conversion is performed).

    Examples
    --------
    >>> from backend.optimizer import plan_recovery
    >>> from backend.optimizer.schemas import ComponentDemand, SupplierOption
    >>> plan = plan_recovery(
    ...     demands=[ComponentDemand("COMP-A", required_qty=100, due_date_days=5)],
    ...     suppliers=[
    ...         SupplierOption("SUP-1", "COMP-A", capacity=200,
    ...                        price_per_unit=10.0, lead_time_days=3),
    ...     ],
    ... )
    >>> plan.is_infeasible
    False
    >>> plan.actions[0].quantity
    100
    """
    if warehouses is None:
        warehouses = []
    if suppliers is None:
        suppliers = []
    if config is None:
        config = OptimizerConfig()

    _validate_inputs(demands, warehouses, suppliers, config)

    # Skip zero-demand components (nothing to source)
    active_demands = [d for d in demands if d.required_qty > 0]
    if not active_demands:
        return RecoveryPlan(
            actions=[],
            total_procurement_cost=0.0,
            total_delay_penalty=0.0,
            total_cost=0.0,
            fulfilled={d.component_id: 0 for d in demands},
            violated_constraints=[],
            is_infeasible=False,
            solver_type="ortools_cpsat" if _ORTOOLS_AVAILABLE else "greedy_fallback",
            solver_status=SolverStatus.OPTIMAL,
            solver_wall_time_seconds=0.0,
        )

    # Filter disrupted suppliers
    active_suppliers = [s for s in suppliers if s.is_available]

    if _ORTOOLS_AVAILABLE:
        try:
            from .solver import solve_with_cpsat
            plan = solve_with_cpsat(active_demands, warehouses, active_suppliers, config)
            # If the CP-SAT plan is infeasible and partial fulfillment is
            # allowed, run greedy to salvage what it can
            if plan.is_infeasible and config.allow_partial_fulfillment:
                fallback = solve_greedy(active_demands, warehouses, active_suppliers, config)
                # Prefer the greedy partial plan over an empty INFEASIBLE plan
                if sum(fallback.fulfilled.values()) > 0:
                    fallback.violated_constraints = plan.violated_constraints + (
                        fallback.violated_constraints or []
                    )
                    return fallback
            return plan
        except Exception as exc:
            # CP-SAT raised unexpectedly — warn with context, then fall back to greedy.
            # The returned plan will have solver_type='greedy_fallback', never
            # 'ortools_cpsat', so the fallback is always distinguishable from an
            # optimal or feasible CP-SAT solution.
            warnings.warn(
                f"CP-SAT solver raised {type(exc).__name__}: {exc!s} — "
                "falling back to greedy solver. "
                "The recovery plan will use solver_type='greedy_fallback'.",
                stacklevel=2,
            )

    return solve_greedy(active_demands, warehouses, active_suppliers, config)
