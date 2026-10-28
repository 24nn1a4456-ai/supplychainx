"""
schemas.py — Input/output dataclasses for the supply-chain recovery optimizer.

All types use plain Python so the module is importable without OR-Tools.
Costs are in arbitrary monetary units (currency-agnostic).
Quantities are integers (whole units) unless noted.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class ActionType(str, Enum):
    """How the units are sourced."""
    WAREHOUSE_TRANSFER = "warehouse_transfer"
    SUPPLIER_PURCHASE  = "supplier_purchase"


class SolverStatus(str, Enum):
    """High-level solve outcome."""
    OPTIMAL    = "optimal"
    FEASIBLE   = "feasible"       # within time limit, may not be optimal
    INFEASIBLE = "infeasible"
    FALLBACK   = "fallback"       # greedy used (OR-Tools unavailable / failed)


# ---------------------------------------------------------------------------
# INPUT schemas
# ---------------------------------------------------------------------------

@dataclass
class ComponentDemand:
    """
    Demand for one component that must be fulfilled.

    Parameters
    ----------
    component_id : str
        Unique identifier (e.g. ``"COMP-PCB-01"``).
    required_qty : int
        Units needed.  Must be > 0.
    due_date_days : float
        Deadline from "now" in calendar days.  Deliveries after this incur a
        delay penalty.  Use ``math.inf`` for no deadline.
    priority : int
        Order priority (1 = highest).  Used by the greedy fallback for
        tie-breaking; does not affect the LP objective directly.
    """
    component_id: str
    required_qty: int
    due_date_days: float = math.inf
    priority: int = 1

    def __post_init__(self) -> None:
        if self.required_qty < 0:
            raise ValueError(
                f"required_qty must be >= 0, got {self.required_qty} "
                f"for component '{self.component_id}'."
            )
        if self.due_date_days < 0:
            raise ValueError("due_date_days must be >= 0.")


@dataclass
class WarehouseInventory:
    """
    Available stock at a warehouse that can be transferred.

    Parameters
    ----------
    warehouse_id : str
    component_id : str
    available_qty : int
        Units physically in stock (before safety-stock deduction).
    transfer_cost_per_unit : float
        Internal cost (handling + logistics) per transferred unit.
    transfer_lead_time_days : float
        Days until transferred goods arrive at destination.
    """
    warehouse_id: str
    component_id: str
    available_qty: int
    transfer_cost_per_unit: float
    transfer_lead_time_days: float = 0.0

    def __post_init__(self) -> None:
        if self.available_qty < 0:
            raise ValueError(
                f"available_qty must be >= 0 for warehouse '{self.warehouse_id}'."
            )
        if self.transfer_cost_per_unit < 0:
            raise ValueError("transfer_cost_per_unit must be >= 0.")


@dataclass
class SupplierOption:
    """
    A supplier that can provide units of a given component.

    Parameters
    ----------
    supplier_id  : str
    component_id : str
    capacity     : int
        Max units the supplier can deliver in the planning window.
    price_per_unit : float
        Purchase price per unit (excluding transport).
    lead_time_days : float
        Days from order placement to delivery.
    transport_cost_per_unit : float
        Freight cost per unit.  Default 0.
    is_available : bool
        Set to False to mark a supplier as currently disrupted.
    """
    supplier_id: str
    component_id: str
    capacity: int
    price_per_unit: float
    lead_time_days: float
    transport_cost_per_unit: float = 0.0
    is_available: bool = True

    def __post_init__(self) -> None:
        if self.capacity < 0:
            raise ValueError(
                f"capacity must be >= 0 for supplier '{self.supplier_id}'."
            )
        if self.price_per_unit < 0:
            raise ValueError("price_per_unit must be >= 0.")
        if self.transport_cost_per_unit < 0:
            raise ValueError("transport_cost_per_unit must be >= 0.")
        if self.lead_time_days < 0:
            raise ValueError("lead_time_days must be >= 0.")

    @property
    def effective_cost_per_unit(self) -> float:
        return self.price_per_unit + self.transport_cost_per_unit


@dataclass
class OptimizerConfig:
    """
    Configurable assumptions and penalty weights.

    Parameters
    ----------
    budget_limit : float
        Maximum total allowable spend (purchase + transfer costs combined).
        Use ``math.inf`` for no budget constraint.
    safety_stock : Dict[str, int]
        Minimum units to keep per component ID.  Warehouse transfers will
        not reduce stock below this level.
    delay_penalty_per_day : float
        Cost charged per unit per day of lateness.  Default 5.0.
    solver_timeout_seconds : float
        CP-SAT wall-clock limit.  Default 30.0 s.
    allow_partial_fulfillment : bool
        If True the solver may return a plan that doesn't fully cover demand
        (reported as violated constraints).  If False a partial plan is
        treated as infeasible.  Default True.
    """
    budget_limit: float = math.inf
    safety_stock: Dict[str, int] = field(default_factory=dict)
    delay_penalty_per_day: float = 5.0
    solver_timeout_seconds: float = 30.0
    allow_partial_fulfillment: bool = True


# ---------------------------------------------------------------------------
# OUTPUT schemas
# ---------------------------------------------------------------------------

@dataclass
class RecoveryAction:
    """
    A single sourcing action in the recovery plan.

    Parameters
    ----------
    action_type    : ActionType
    source_id      : str       Supplier or warehouse ID.
    component_id   : str
    quantity       : int
    unit_cost      : float     Effective cost per unit (price + transport or transfer).
    estimated_arrival_days : float
    subtotal_cost  : float     unit_cost * quantity
    delay_days     : float     max(0, arrival - due_date).  0 = on time.
    delay_penalty  : float     delay_days * delay_penalty_per_day * quantity
    """
    action_type: ActionType
    source_id: str
    component_id: str
    quantity: int
    unit_cost: float
    estimated_arrival_days: float
    subtotal_cost: float
    delay_days: float = 0.0
    delay_penalty: float = 0.0

    def to_dict(self) -> dict:
        return {
            "action_type": self.action_type.value,
            "source_id": self.source_id,
            "component_id": self.component_id,
            "quantity": self.quantity,
            "unit_cost": round(self.unit_cost, 4),
            "estimated_arrival_days": round(self.estimated_arrival_days, 2),
            "subtotal_cost": round(self.subtotal_cost, 4),
            "delay_days": round(self.delay_days, 2),
            "delay_penalty": round(self.delay_penalty, 4),
        }


@dataclass
class RecoveryPlan:
    """
    Structured result returned by :func:`~backend.optimizer.optimizer.plan_recovery`.

    Parameters
    ----------
    actions : List[RecoveryAction]
        Selected sourcing actions.  Empty when infeasible.
    total_procurement_cost : float
        Sum of purchase + transfer costs across all actions.
    total_delay_penalty : float
        Sum of delay penalties across all actions.
    total_cost : float
        total_procurement_cost + total_delay_penalty
    fulfilled : Dict[str, int]
        Units allocated per component ID.
    violated_constraints : List[str]
        Human-readable list of constraints that could not be satisfied,
        e.g. ``"Budget exceeded by 1200.00"`` or ``"Unmet demand: COMP-01 needs 50 more units"``.
    is_infeasible : bool
        True when no combination of available supply can meet demand.
    solver_type : str
        ``"ortools_cpsat"`` or ``"greedy_fallback"``.
    solver_status : SolverStatus
    solver_wall_time_seconds : float
    """
    actions: List[RecoveryAction]
    total_procurement_cost: float
    total_delay_penalty: float
    total_cost: float
    fulfilled: Dict[str, int]
    violated_constraints: List[str]
    is_infeasible: bool
    solver_type: str
    solver_status: SolverStatus
    solver_wall_time_seconds: float = 0.0

    def to_dict(self) -> dict:
        return {
            "actions": [a.to_dict() for a in self.actions],
            "total_procurement_cost": round(self.total_procurement_cost, 4),
            "total_delay_penalty": round(self.total_delay_penalty, 4),
            "total_cost": round(self.total_cost, 4),
            "fulfilled": self.fulfilled,
            "violated_constraints": self.violated_constraints,
            "is_infeasible": self.is_infeasible,
            "solver_type": self.solver_type,
            "solver_status": self.solver_status.value,
            "solver_wall_time_seconds": round(self.solver_wall_time_seconds, 4),
        }
