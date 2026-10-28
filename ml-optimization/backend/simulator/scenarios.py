"""
scenarios.py — Fixed, reproducible disruption scenarios for Supply Chain X.

All inputs are **hard-coded constants** (no random number generation, no
database reads).  This guarantees that the same scenario name always produces
identical inputs — a requirement for repeatable simulation.

Simulated assumptions are documented per scenario and are explicitly separate
from measured test results.

Available scenario factory functions
-------------------------------------
build_supplier_outage()         Primary scenario (required).
build_low_inventory()           Optional.
build_shipment_delay()          Optional.
build_demand_spike()            Optional.
build_warehouse_outage()        Optional.

Each function returns a :class:`~backend.simulator.schemas.ScenarioState`.
"""

from __future__ import annotations

from .schemas import (
    DisruptionEvent,
    DisruptionType,
    EventSeverity,
    ScenarioState,
    SimulatedOrder,
    SimulatedSupplier,
    SimulatedWarehouse,
)

# ---------------------------------------------------------------------------
# Shared component / entity IDs
# ---------------------------------------------------------------------------
COMP_PCB    = "COMP-PCB-01"    # critical printed circuit board
COMP_FAN    = "COMP-FAN-02"    # cooling fan module
COMP_PSU    = "COMP-PSU-03"    # power supply unit

SUP_ALPHA   = "SUP-ALPHA"      # primary PCB supplier (can go down)
SUP_BETA    = "SUP-BETA"       # alternative PCB supplier (limited capacity)
SUP_GAMMA   = "SUP-GAMMA"      # secondary alternative (higher price, faster)
SUP_FAN_X   = "SUP-FAN-X"     # fan supplier
SUP_PSU_Y   = "SUP-PSU-Y"     # PSU supplier

WH_EAST     = "WH-EAST"
WH_WEST     = "WH-WEST"

ORD_001     = "ORD-001"
ORD_002     = "ORD-002"
ORD_003     = "ORD-003"
ORD_004     = "ORD-004"


# ---------------------------------------------------------------------------
# SCENARIO 1 — Primary supplier outage (REQUIRED)
# ---------------------------------------------------------------------------

def build_supplier_outage() -> ScenarioState:
    """
    Scenario: SUP-ALPHA (primary PCB supplier) is unavailable for 5 days.

    Fixed inputs
    ------------
    - Component affected: COMP-PCB-01 (critical)
    - Customer orders: 3 orders totalling 320 units, due in 4–8 days
    - Primary supplier: 0 capacity (outage)
    - Alternative SUP-BETA: 150 units capacity, $18/unit, 6-day lead time
    - Alternative SUP-GAMMA: 80 units capacity, $22/unit, 3-day lead time
    - WH-EAST: 60 usable units, $3 transfer cost, 1-day lead time

    Simulated assumptions (marked explicitly — not measured results)
    ----------------------------------------------------------------
    - Outage duration is exactly 5 days (deterministic; no probability modelled here).
    - Alternative suppliers' capacities are their allocated maximums for this buyer.
    - Transport costs are flat-rate per unit regardless of order size.
    - Customer penalty for late delivery is not modelled in this scenario state;
      it is configurable in OptimizerConfig.delay_penalty_per_day.
    """
    event = DisruptionEvent(
        event_id="SCEN-OUTAGE-EVT-001",
        disruption_type=DisruptionType.SUPPLIER_OUTAGE,
        affected_supplier=SUP_ALPHA,
        affected_component=COMP_PCB,
        outage_start_day=0,
        outage_duration_days=5,
        severity=EventSeverity.CRITICAL,
        description=(
            f"{SUP_ALPHA} (primary PCB supplier) is completely unavailable "
            "for 5 simulated days due to a factory shutdown."
        ),
        assumptions=[
            "Outage duration is fixed at 5 days (no stochastic extension modelled).",
            "All in-transit shipments from SUP-ALPHA are assumed cancelled.",
            "Alternative supplier capacities are pre-negotiated buyer allocations.",
            "No spot-market sourcing is modelled.",
        ],
    )

    orders = [
        SimulatedOrder(ORD_001, COMP_PCB, quantity=120, due_date_days=4, priority=1, customer_id="CUST-A"),
        SimulatedOrder(ORD_002, COMP_PCB, quantity=100, due_date_days=6, priority=2, customer_id="CUST-B"),
        SimulatedOrder(ORD_003, COMP_PCB, quantity=100, due_date_days=8, priority=3, customer_id="CUST-C"),
    ]

    suppliers = [
        SimulatedSupplier(SUP_ALPHA, COMP_PCB, capacity_per_window=0,
                          price_per_unit=15.0, lead_time_days=3.0,
                          is_primary=True, is_available=False),    # ← DISRUPTED
        SimulatedSupplier(SUP_BETA,  COMP_PCB, capacity_per_window=150,
                          price_per_unit=18.0, lead_time_days=6.0,
                          transport_cost_per_unit=1.5, is_available=True),
        SimulatedSupplier(SUP_GAMMA, COMP_PCB, capacity_per_window=80,
                          price_per_unit=22.0, lead_time_days=3.0,
                          transport_cost_per_unit=2.0, is_available=True),
    ]

    warehouses = [
        SimulatedWarehouse(WH_EAST, COMP_PCB,
                           on_hand_qty=100, safety_stock_qty=40,
                           transfer_cost_per_unit=3.0,
                           transfer_lead_time_days=1.0),
    ]

    total_demand = {COMP_PCB: sum(o.quantity for o in orders)}  # = 320

    return ScenarioState(
        scenario_id="SCEN-SUPPLIER-OUTAGE-001",
        scenario_name="Primary Supplier Outage — 5-Day",
        events=[event],
        orders=orders,
        suppliers=suppliers,
        warehouses=warehouses,
        total_demand=total_demand,
        metadata={
            "scenario_version": "1.0",
            "seed": "fixed-no-randomness",
            "affected_component_criticality": "critical",
        },
    )


# ---------------------------------------------------------------------------
# SCENARIO 2 — Low warehouse inventory
# ---------------------------------------------------------------------------

def build_low_inventory() -> ScenarioState:
    """
    Scenario: WH-EAST has critically low PCB stock (only 20 units on hand,
    safety stock = 15), forcing heavy reliance on suppliers.

    Simulated assumptions
    ----------------------
    - Stock depletion cause is not modelled (out of scope for simulator).
    - Safety stock policy is enforced; the 5 usable units are the only
      warehouse contribution possible.
    """
    event = DisruptionEvent(
        event_id="SCEN-LOW-INV-EVT-001",
        disruption_type=DisruptionType.LOW_INVENTORY,
        affected_component=COMP_PCB,
        outage_start_day=0,
        outage_duration_days=0,
        severity=EventSeverity.HIGH,
        description="WH-EAST PCB inventory is critically low (20 units on hand, safety stock 15).",
        assumptions=[
            "No incoming replenishment is scheduled within the planning window.",
            "Safety stock of 15 units is inviolable per policy.",
        ],
    )

    orders = [
        SimulatedOrder(ORD_001, COMP_PCB, quantity=80, due_date_days=5, priority=1, customer_id="CUST-A"),
        SimulatedOrder(ORD_002, COMP_PCB, quantity=60, due_date_days=7, priority=2, customer_id="CUST-B"),
    ]

    suppliers = [
        SimulatedSupplier(SUP_ALPHA, COMP_PCB, capacity_per_window=200,
                          price_per_unit=15.0, lead_time_days=3.0, is_primary=True),
        SimulatedSupplier(SUP_BETA,  COMP_PCB, capacity_per_window=100,
                          price_per_unit=18.0, lead_time_days=6.0,
                          transport_cost_per_unit=1.5),
    ]

    warehouses = [
        SimulatedWarehouse(WH_EAST, COMP_PCB,
                           on_hand_qty=20, safety_stock_qty=15,
                           transfer_cost_per_unit=2.0,
                           transfer_lead_time_days=1.0),
    ]

    total_demand = {COMP_PCB: sum(o.quantity for o in orders)}

    return ScenarioState(
        scenario_id="SCEN-LOW-INV-001",
        scenario_name="Critical Low Inventory",
        events=[event],
        orders=orders,
        suppliers=suppliers,
        warehouses=warehouses,
        total_demand=total_demand,
        metadata={"scenario_version": "1.0", "seed": "fixed-no-randomness"},
    )


# ---------------------------------------------------------------------------
# SCENARIO 3 — Shipment delay
# ---------------------------------------------------------------------------

def build_shipment_delay() -> ScenarioState:
    """
    Scenario: An in-transit shipment from SUP-BETA is delayed by 4 extra days.
    The effective lead time for SUP-BETA rises from 6 → 10 days, causing
    order ORD-001 (due day 7) to arrive late.

    Simulated assumptions
    ----------------------
    - The delay is flat and deterministic (+4 days, no distribution).
    - No partial delivery before 10 days is possible.
    """
    event = DisruptionEvent(
        event_id="SCEN-DELAY-EVT-001",
        disruption_type=DisruptionType.SHIPMENT_DELAY,
        affected_supplier=SUP_BETA,
        affected_component=COMP_PCB,
        outage_start_day=0,
        outage_duration_days=4,   # represents the delay extension
        detected_at_day=2,        # delay confirmed 2 days after departure (MTTD = 2 days)
        severity=EventSeverity.MEDIUM,
        description=f"{SUP_BETA} shipment delayed by 4 days (lead time effectively 10 days).",
        assumptions=[
            "Delay is uniform across the entire in-transit consignment.",
            "No split delivery modelled.",
            "Delay does not affect future orders from SUP-BETA.",
            "Detection: delay confirmed 2 simulation days after shipment departure "
            "(carrier notification lag). MTTD = 2 days.",
        ],
    )

    orders = [
        SimulatedOrder(ORD_001, COMP_PCB, quantity=90, due_date_days=7,  priority=1, customer_id="CUST-A"),
        SimulatedOrder(ORD_002, COMP_PCB, quantity=60, due_date_days=12, priority=2, customer_id="CUST-B"),
    ]

    suppliers = [
        # SUP-BETA: effective lead time is 10 (6 + 4 delay) — reflected here
        SimulatedSupplier(SUP_BETA,  COMP_PCB, capacity_per_window=200,
                          price_per_unit=18.0, lead_time_days=10.0,    # delayed
                          transport_cost_per_unit=1.5),
        SimulatedSupplier(SUP_GAMMA, COMP_PCB, capacity_per_window=80,
                          price_per_unit=22.0, lead_time_days=3.0,
                          transport_cost_per_unit=2.0),
    ]

    warehouses = [
        SimulatedWarehouse(WH_EAST, COMP_PCB,
                           on_hand_qty=80, safety_stock_qty=20,
                           transfer_cost_per_unit=3.0,
                           transfer_lead_time_days=1.0),
    ]

    total_demand = {COMP_PCB: sum(o.quantity for o in orders)}

    return ScenarioState(
        scenario_id="SCEN-SHIP-DELAY-001",
        scenario_name="Shipment Delay (+4 Days)",
        events=[event],
        orders=orders,
        suppliers=suppliers,
        warehouses=warehouses,
        total_demand=total_demand,
        metadata={"scenario_version": "1.0", "seed": "fixed-no-randomness"},
    )


# ---------------------------------------------------------------------------
# SCENARIO 4 — Demand spike
# ---------------------------------------------------------------------------

def build_demand_spike() -> ScenarioState:
    """
    Scenario: A sudden 2× demand spike doubles the required PCB quantity.
    An additional large emergency order ORD-004 arrives with a tight deadline.

    Simulated assumptions
    ----------------------
    - Spike is a one-time event; future demand reverts to baseline.
    - Emergency order has highest priority (priority=1).
    """
    event = DisruptionEvent(
        event_id="SCEN-SPIKE-EVT-001",
        disruption_type=DisruptionType.DEMAND_SPIKE,
        affected_component=COMP_PCB,
        outage_start_day=0,
        outage_duration_days=1,
        severity=EventSeverity.HIGH,
        description="Unexpected 2× demand spike: emergency order for 200 extra PCBs received.",
        assumptions=[
            "Spike is a single planning-window event.",
            "No advance warning was available to pre-position stock.",
        ],
    )

    orders = [
        SimulatedOrder(ORD_001, COMP_PCB, quantity=100, due_date_days=5,  priority=2, customer_id="CUST-A"),
        SimulatedOrder(ORD_002, COMP_PCB, quantity=80,  due_date_days=7,  priority=3, customer_id="CUST-B"),
        SimulatedOrder(ORD_004, COMP_PCB, quantity=200, due_date_days=4,  priority=1, customer_id="CUST-EMERGENCY"),  # spike
    ]

    suppliers = [
        SimulatedSupplier(SUP_ALPHA, COMP_PCB, capacity_per_window=200,
                          price_per_unit=15.0, lead_time_days=3.0, is_primary=True),
        SimulatedSupplier(SUP_BETA,  COMP_PCB, capacity_per_window=150,
                          price_per_unit=18.0, lead_time_days=6.0,
                          transport_cost_per_unit=1.5),
        SimulatedSupplier(SUP_GAMMA, COMP_PCB, capacity_per_window=80,
                          price_per_unit=22.0, lead_time_days=3.0,
                          transport_cost_per_unit=2.0),
    ]

    warehouses = [
        SimulatedWarehouse(WH_EAST, COMP_PCB,
                           on_hand_qty=120, safety_stock_qty=30,
                           transfer_cost_per_unit=3.0,
                           transfer_lead_time_days=1.0),
        SimulatedWarehouse(WH_WEST, COMP_PCB,
                           on_hand_qty=80, safety_stock_qty=20,
                           transfer_cost_per_unit=4.0,
                           transfer_lead_time_days=2.0),
    ]

    total_demand = {COMP_PCB: sum(o.quantity for o in orders)}

    return ScenarioState(
        scenario_id="SCEN-DEMAND-SPIKE-001",
        scenario_name="Demand Spike 2×",
        events=[event],
        orders=orders,
        suppliers=suppliers,
        warehouses=warehouses,
        total_demand=total_demand,
        metadata={"scenario_version": "1.0", "seed": "fixed-no-randomness"},
    )


# ---------------------------------------------------------------------------
# SCENARIO 5 — Warehouse outage
# ---------------------------------------------------------------------------

def build_warehouse_outage() -> ScenarioState:
    """
    Scenario: WH-EAST is completely unavailable (fire / system failure).
    All 60 usable units that would have been available are blocked.
    Supply must come entirely from suppliers.

    Simulated assumptions
    ----------------------
    - WH-EAST goods are inaccessible for the entire planning window.
    - WH-WEST (smaller) is still operational.
    """
    event = DisruptionEvent(
        event_id="SCEN-WH-OUT-EVT-001",
        disruption_type=DisruptionType.WAREHOUSE_OUTAGE,
        affected_warehouse=WH_EAST,
        affected_component=COMP_PCB,
        outage_start_day=0,
        outage_duration_days=5,
        detected_at_day=1,        # failure confirmed after 1-day inspection (MTTD = 1 day)
        severity=EventSeverity.HIGH,
        description=f"{WH_EAST} is fully unavailable for 5 days — all transfers blocked.",
        assumptions=[
            "No partial access to WH-EAST stock is possible.",
            "WH-WEST stock is unaffected.",
            "Supplier capacity is unchanged.",
            "Detection: warehouse management system confirmed failure after 1-day "
            "safety inspection. MTTD = 1 day.",
        ],
    )

    orders = [
        SimulatedOrder(ORD_001, COMP_PCB, quantity=100, due_date_days=5, priority=1, customer_id="CUST-A"),
        SimulatedOrder(ORD_002, COMP_PCB, quantity=80,  due_date_days=8, priority=2, customer_id="CUST-B"),
    ]

    suppliers = [
        SimulatedSupplier(SUP_ALPHA, COMP_PCB, capacity_per_window=200,
                          price_per_unit=15.0, lead_time_days=3.0, is_primary=True),
        SimulatedSupplier(SUP_BETA,  COMP_PCB, capacity_per_window=150,
                          price_per_unit=18.0, lead_time_days=6.0,
                          transport_cost_per_unit=1.5),
    ]

    warehouses = [
        SimulatedWarehouse(WH_EAST, COMP_PCB,
                           on_hand_qty=100, safety_stock_qty=40,
                           transfer_cost_per_unit=3.0,
                           transfer_lead_time_days=1.0,
                           is_available=False),   # ← OUTAGE
        SimulatedWarehouse(WH_WEST, COMP_PCB,
                           on_hand_qty=40, safety_stock_qty=10,
                           transfer_cost_per_unit=5.0,
                           transfer_lead_time_days=2.0,
                           is_available=True),
    ]

    total_demand = {COMP_PCB: sum(o.quantity for o in orders)}

    return ScenarioState(
        scenario_id="SCEN-WH-OUTAGE-001",
        scenario_name="Warehouse Outage — WH-EAST",
        events=[event],
        orders=orders,
        suppliers=suppliers,
        warehouses=warehouses,
        total_demand=total_demand,
        metadata={"scenario_version": "1.0", "seed": "fixed-no-randomness"},
    )


# ---------------------------------------------------------------------------
# Registry — all scenarios by name
# ---------------------------------------------------------------------------

SCENARIO_REGISTRY: dict[str, callable] = {
    "supplier_outage":  build_supplier_outage,
    "low_inventory":    build_low_inventory,
    "shipment_delay":   build_shipment_delay,
    "demand_spike":     build_demand_spike,
    "warehouse_outage": build_warehouse_outage,
}


def list_scenarios() -> list[str]:
    """Return names of all registered scenarios."""
    return list(SCENARIO_REGISTRY.keys())


def load_scenario(name: str) -> ScenarioState:
    """Load a scenario by its registered name."""
    if name not in SCENARIO_REGISTRY:
        raise ValueError(
            f"Unknown scenario '{name}'. "
            f"Available: {list(SCENARIO_REGISTRY.keys())}"
        )
    return SCENARIO_REGISTRY[name]()
