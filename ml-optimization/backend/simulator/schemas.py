"""
schemas.py — Dataclasses for the supplier outage simulator.

These types carry all simulated state: disruption events, affected orders,
alternative suppliers, and the snapshot handed to the recovery optimizer.

Design note
-----------
These schemas are intentionally separate from the optimizer's schemas so that
the simulator can be tested and evolved independently.  The
:func:`~backend.simulator.simulator.scenario_to_optimizer_inputs` helper
converts a ``ScenarioState`` into the optimizer's input types when needed.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class DisruptionType(str, Enum):
    """Category of simulated disruption."""
    SUPPLIER_OUTAGE    = "supplier_outage"
    LOW_INVENTORY      = "low_inventory"
    SHIPMENT_DELAY     = "shipment_delay"
    DEMAND_SPIKE       = "demand_spike"
    WAREHOUSE_OUTAGE   = "warehouse_outage"


class EventSeverity(str, Enum):
    LOW      = "low"
    MEDIUM   = "medium"
    HIGH     = "high"
    CRITICAL = "critical"


# ---------------------------------------------------------------------------
# Core event record
# ---------------------------------------------------------------------------

@dataclass
class DisruptionEvent:
    """
    Immutable record of a simulated disruption.

    Parameters
    ----------
    event_id          : str   Unique, deterministic ID (scenario name + index).
    disruption_type   : DisruptionType
    affected_supplier : Optional[str]  Supplier ID made unavailable (None for warehouse events).
    affected_warehouse: Optional[str]  Warehouse ID made unavailable.
    affected_component: str   Primary component impacted.
    outage_start_day  : int   Simulation day the disruption begins (0 = now).
    outage_duration_days: int Days the disruption lasts.
    severity          : EventSeverity
    description       : str   Human-readable summary.
    assumptions       : List[str]  Explicit simulation assumptions.
    detected_at_day   : Optional[int]  Simulation day the disruption is detected.
        If None, detection is assumed immediate (detected_at_day = outage_start_day,
        MTTD = 0). Must be >= outage_start_day.

    MTTD Formula
    ------------
    MTTD (days) = detected_at_day - outage_start_day
    When detected_at_day is None: MTTD = 0 (instantaneous detection assumed).
    Units: simulation days (integer). Detection cannot precede the disruption.
    """
    event_id: str
    disruption_type: DisruptionType
    affected_component: str
    outage_start_day: int
    outage_duration_days: int
    severity: EventSeverity
    description: str
    assumptions: List[str]
    affected_supplier: Optional[str] = None
    affected_warehouse: Optional[str] = None
    detected_at_day: Optional[int] = None  # None → same as outage_start_day (MTTD=0)
    recorded_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def __post_init__(self) -> None:
        if self.detected_at_day is not None and self.detected_at_day < self.outage_start_day:
            raise ValueError(
                f"detected_at_day ({self.detected_at_day}) cannot be earlier than "
                f"outage_start_day ({self.outage_start_day}): detection cannot precede "
                "the disruption."
            )

    def mttd_days(self) -> int:
        """Mean Time to Detect in simulation days (detected_at_day - outage_start_day)."""
        effective_detection = self.detected_at_day if self.detected_at_day is not None else self.outage_start_day
        return effective_detection - self.outage_start_day

    def to_dict(self) -> dict:
        return {
            "event_id": self.event_id,
            "disruption_type": self.disruption_type.value,
            "affected_supplier": self.affected_supplier,
            "affected_warehouse": self.affected_warehouse,
            "affected_component": self.affected_component,
            "outage_start_day": self.outage_start_day,
            "outage_duration_days": self.outage_duration_days,
            "detected_at_day": self.detected_at_day,
            "mttd_days": self.mttd_days(),
            "severity": self.severity.value,
            "description": self.description,
            "assumptions": self.assumptions,
            "recorded_at": self.recorded_at,
        }


# ---------------------------------------------------------------------------
# Simulated order
# ---------------------------------------------------------------------------

@dataclass
class SimulatedOrder:
    """
    A customer order that depends on the affected component.

    Parameters
    ----------
    order_id      : str
    component_id  : str
    quantity      : int
    due_date_days : float   Days from simulation start until delivery due.
    priority      : int     1 = highest.
    customer_id   : str
    """
    order_id: str
    component_id: str
    quantity: int
    due_date_days: float
    priority: int = 1
    customer_id: str = "CUSTOMER-UNKNOWN"

    def to_dict(self) -> dict:
        return {
            "order_id": self.order_id,
            "component_id": self.component_id,
            "quantity": self.quantity,
            "due_date_days": self.due_date_days,
            "priority": self.priority,
            "customer_id": self.customer_id,
        }


# ---------------------------------------------------------------------------
# Simulated supplier option
# ---------------------------------------------------------------------------

@dataclass
class SimulatedSupplier:
    """Supplier visible in the simulation (primary or alternative)."""
    supplier_id: str
    component_id: str
    capacity_per_window: int       # max units deliverable in the recovery window
    price_per_unit: float
    lead_time_days: float
    transport_cost_per_unit: float = 0.0
    is_primary: bool = False
    is_available: bool = True      # False = disrupted in this scenario

    def to_dict(self) -> dict:
        return {
            "supplier_id": self.supplier_id,
            "component_id": self.component_id,
            "capacity_per_window": self.capacity_per_window,
            "price_per_unit": self.price_per_unit,
            "lead_time_days": self.lead_time_days,
            "transport_cost_per_unit": self.transport_cost_per_unit,
            "is_primary": self.is_primary,
            "is_available": self.is_available,
        }


# ---------------------------------------------------------------------------
# Simulated warehouse
# ---------------------------------------------------------------------------

@dataclass
class SimulatedWarehouse:
    """Warehouse with inventory available for transfer."""
    warehouse_id: str
    component_id: str
    on_hand_qty: int
    safety_stock_qty: int
    transfer_cost_per_unit: float
    transfer_lead_time_days: float
    is_available: bool = True      # False = outage scenario

    @property
    def usable_qty(self) -> int:
        return max(0, self.on_hand_qty - self.safety_stock_qty)

    def to_dict(self) -> dict:
        return {
            "warehouse_id": self.warehouse_id,
            "component_id": self.component_id,
            "on_hand_qty": self.on_hand_qty,
            "safety_stock_qty": self.safety_stock_qty,
            "usable_qty": self.usable_qty,
            "transfer_cost_per_unit": self.transfer_cost_per_unit,
            "transfer_lead_time_days": self.transfer_lead_time_days,
            "is_available": self.is_available,
        }


# ---------------------------------------------------------------------------
# Full scenario state (initial snapshot)
# ---------------------------------------------------------------------------

@dataclass
class ScenarioState:
    """
    Complete initial state for a simulated disruption scenario.

    This is the object handed to the recovery optimizer and impact assessment.
    It is a **snapshot** — it does not mutate once created.

    Parameters
    ----------
    scenario_id   : str
    scenario_name : str
    events        : List[DisruptionEvent]   One or more disruption events.
    orders        : List[SimulatedOrder]    Affected customer orders.
    suppliers     : List[SimulatedSupplier] All suppliers (primary + alternatives).
    warehouses    : List[SimulatedWarehouse]
    total_demand  : Dict[str, int]          Summed quantity per component_id.
    metadata      : Dict[str, Any]          Free-form tags (seed, scenario version, etc.)
    """
    scenario_id: str
    scenario_name: str
    events: List[DisruptionEvent]
    orders: List[SimulatedOrder]
    suppliers: List[SimulatedSupplier]
    warehouses: List[SimulatedWarehouse]
    total_demand: Dict[str, int]
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "scenario_id": self.scenario_id,
            "scenario_name": self.scenario_name,
            "events": [e.to_dict() for e in self.events],
            "orders": [o.to_dict() for o in self.orders],
            "suppliers": [s.to_dict() for s in self.suppliers],
            "warehouses": [w.to_dict() for w in self.warehouses],
            "total_demand": self.total_demand,
            "metadata": self.metadata,
        }
