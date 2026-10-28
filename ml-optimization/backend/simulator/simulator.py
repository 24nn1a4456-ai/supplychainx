"""
simulator.py — Public interface for the Supply Chain X outage simulator.

Member 1's orchestrator should call :func:`create_disruption` to obtain a
reproducible initial state for impact assessment and recovery planning.

Design principles
-----------------
* **No second database** — state is managed through the :class:`BackendInterface`
  Protocol.  The default adapter is in-memory; Member 2 can replace it with
  their concrete backend.
* **No duplicated business logic** — this module only creates simulation
  *inputs*.  All fulfillment decisions are delegated to the recovery optimizer.
* **Fixed inputs = reproducibility** — scenarios have no runtime randomness;
  calling the same function twice always returns structurally identical data.
  Timestamps in ``DisruptionEvent.recorded_at`` will differ but are not part
  of the simulation computation.

Interface for triggering and resetting a scenario
-------------------------------------------------
Trigger:

    state = create_disruption("supplier_outage", backend=my_backend)
    # → ScenarioState ready for plan_recovery()

Reset:

    reset_scenario("SCEN-SUPPLIER-OUTAGE-001", backend=my_backend)
    # → all event records for this scenario removed from the backend

Bridge to the recovery optimizer:

    demands, warehouses, suppliers = scenario_to_optimizer_inputs(state)
    plan = plan_recovery(demands, warehouses, suppliers)
"""

from __future__ import annotations

from typing import List, Optional, Tuple

from .backend_interface import BackendInterface, InMemoryBackendAdapter
from .scenarios import load_scenario, list_scenarios
from .schemas import (
    ScenarioState,
    SimulatedOrder,
    SimulatedSupplier,
    SimulatedWarehouse,
)

# Lazy import to avoid circular dependency and to keep the simulator usable
# without OR-Tools installed.
def _get_optimizer_types():
    from backend.optimizer.schemas import (
        ComponentDemand,
        WarehouseInventory,
        SupplierOption,
    )
    return ComponentDemand, WarehouseInventory, SupplierOption


# ---------------------------------------------------------------------------
# Default shared backend adapter (module-level singleton for convenience)
# ---------------------------------------------------------------------------
_default_backend: InMemoryBackendAdapter = InMemoryBackendAdapter()


def get_default_backend() -> InMemoryBackendAdapter:
    """Return the module-level in-memory backend adapter."""
    return _default_backend


# ---------------------------------------------------------------------------
# Core public functions
# ---------------------------------------------------------------------------

def create_disruption(
    scenario_name: str,
    backend: Optional[BackendInterface] = None,
) -> ScenarioState:
    """
    Create a disruption scenario and record all events through the backend.

    This is the **primary function Member 1 calls** to trigger a simulation.

    Parameters
    ----------
    scenario_name : str
        One of the registered scenario names.  Call :func:`list_scenarios`
        to see all available options.

    backend : BackendInterface, optional
        Backend adapter to record events into.  Defaults to the module-level
        :class:`InMemoryBackendAdapter`.  Member 2 should pass their concrete
        backend implementation here.

    Returns
    -------
    ScenarioState
        A frozen snapshot of:
        - All disruption events (recorded into *backend*)
        - Affected customer orders
        - All supplier options (including disrupted ones with is_available=False)
        - Warehouse inventories
        - Aggregated demand per component
        - Metadata (scenario version, assumptions)

    Raises
    ------
    ValueError
        If *scenario_name* is not registered.

    Notes
    -----
    * This function does **not** make real purchases, modify production
      inventory, or contact external APIs.
    * The ``recorded_at`` timestamp in each event reflects wall-clock time
      of the call, not a simulated clock.
    * The returned ``ScenarioState`` is immutable — pass it to
      :func:`scenario_to_optimizer_inputs` to feed the recovery optimizer.

    Examples
    --------
    >>> from backend.simulator import create_disruption, scenario_to_optimizer_inputs
    >>> from backend.optimizer import plan_recovery
    >>>
    >>> state = create_disruption("supplier_outage")
    >>> demands, warehouses, suppliers = scenario_to_optimizer_inputs(state)
    >>> plan = plan_recovery(demands, warehouses, suppliers)
    """
    if backend is None:
        backend = _default_backend

    state = load_scenario(scenario_name)

    # Record every disruption event through the backend interface
    for event in state.events:
        event_dict = event.to_dict()
        event_dict["scenario_id"] = state.scenario_id    # tag for reset
        backend.record_disruption_event(event_dict)

    return state


def record_event(event_dict: dict, backend: Optional[BackendInterface] = None) -> str:
    """
    Record a single pre-built event dict through the backend.

    Useful when Member 1 constructs a custom event outside of the scenario
    registry and wants to persist it using the same interface.

    Parameters
    ----------
    event_dict : dict
        A dict representation of a :class:`~backend.simulator.schemas.DisruptionEvent`
        (call ``.to_dict()`` before passing).
    backend : BackendInterface, optional
        Defaults to module-level in-memory adapter.

    Returns
    -------
    str
        Backend-assigned record ID.
    """
    if backend is None:
        backend = _default_backend
    return backend.record_disruption_event(event_dict)


def reset_scenario(
    scenario_id: str,
    backend: Optional[BackendInterface] = None,
) -> None:
    """
    Remove all event records associated with *scenario_id* from the backend.

    Call this between test runs or simulation replays to start with a clean
    state.  Does **not** affect scenarios with a different ID.

    Parameters
    ----------
    scenario_id : str
        Must match the ``scenario_id`` field of a previously created
        :class:`ScenarioState` (e.g. ``"SCEN-SUPPLIER-OUTAGE-001"``).
    backend : BackendInterface, optional
        Defaults to module-level in-memory adapter.
    """
    if backend is None:
        backend = _default_backend
    backend.reset_scenario(scenario_id)


def list_available_scenarios() -> List[str]:
    """
    Return the names of all registered simulation scenarios.

    Returns
    -------
    List[str]
        E.g. ``["supplier_outage", "low_inventory", "shipment_delay",
        "demand_spike", "warehouse_outage"]``.
    """
    return list_scenarios()


# ---------------------------------------------------------------------------
# Bridge: ScenarioState → optimizer inputs
# ---------------------------------------------------------------------------

def scenario_to_optimizer_inputs(
    state: ScenarioState,
    budget_limit: float = float("inf"),
    delay_penalty_per_day: float = 5.0,
):
    """
    Convert a :class:`ScenarioState` into the input types expected by
    :func:`~backend.optimizer.optimizer.plan_recovery`.

    Parameters
    ----------
    state : ScenarioState
    budget_limit : float, optional
        Passed through to ``OptimizerConfig``.
    delay_penalty_per_day : float, optional
        Cost incurred per unit per day of late delivery.

    Returns
    -------
    Tuple of (demands, warehouses, suppliers, config)
        Ready to unpack directly into ``plan_recovery(*)``.

    Examples
    --------
    >>> demands, warehouses, suppliers, config = scenario_to_optimizer_inputs(state)
    >>> plan = plan_recovery(demands, warehouses, suppliers, config)
    """
    ComponentDemand, WarehouseInventory, SupplierOption = _get_optimizer_types()
    from backend.optimizer.schemas import OptimizerConfig

    # Aggregate demand per component from orders
    demand_map: dict[str, dict] = {}
    for order in state.orders:
        c = order.component_id
        if c not in demand_map:
            demand_map[c] = {
                "qty": 0,
                "due_date_days": order.due_date_days,
                "priority": order.priority,
            }
        demand_map[c]["qty"] += order.quantity
        # Use the tightest (soonest) due date as the binding deadline
        demand_map[c]["due_date_days"] = min(
            demand_map[c]["due_date_days"], order.due_date_days
        )
        demand_map[c]["priority"] = min(demand_map[c]["priority"], order.priority)

    demands = [
        ComponentDemand(
            component_id=c,
            required_qty=v["qty"],
            due_date_days=v["due_date_days"],
            priority=v["priority"],
        )
        for c, v in demand_map.items()
    ]

    # Safety stock from warehouses
    safety_stock: dict[str, int] = {
        w.component_id: w.safety_stock_qty
        for w in state.warehouses
    }

    # Warehouses — exclude unavailable ones (outage scenario)
    warehouses = [
        WarehouseInventory(
            warehouse_id=w.warehouse_id,
            component_id=w.component_id,
            available_qty=w.on_hand_qty if w.is_available else 0,
            transfer_cost_per_unit=w.transfer_cost_per_unit,
            transfer_lead_time_days=w.transfer_lead_time_days,
        )
        for w in state.warehouses
    ]

    # Suppliers
    suppliers = [
        SupplierOption(
            supplier_id=s.supplier_id,
            component_id=s.component_id,
            capacity=s.capacity_per_window,
            price_per_unit=s.price_per_unit,
            lead_time_days=s.lead_time_days,
            transport_cost_per_unit=s.transport_cost_per_unit,
            is_available=s.is_available,
        )
        for s in state.suppliers
    ]

    config = OptimizerConfig(
        budget_limit=budget_limit,
        safety_stock=safety_stock,
        delay_penalty_per_day=delay_penalty_per_day,
    )

    return demands, warehouses, suppliers, config
