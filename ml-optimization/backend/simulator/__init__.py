"""
backend.simulator — Supplier outage simulation package.

Public API (Member 1 entry points)
-----------------------------------
create_disruption(scenario_name, backend=None) -> ScenarioState
    Trigger a scenario and record events through the backend interface.

reset_scenario(scenario_id, backend=None) -> None
    Remove all records for a scenario (use between test runs).

list_available_scenarios() -> List[str]
    Names of all registered scenarios.

scenario_to_optimizer_inputs(state, ...) -> (demands, warehouses, suppliers, config)
    Convert a ScenarioState into recovery optimizer inputs.
"""

from .simulator import (
    create_disruption,
    record_event,
    reset_scenario,
    list_available_scenarios,
    scenario_to_optimizer_inputs,
    get_default_backend,
)
from .schemas import (
    DisruptionEvent,
    DisruptionType,
    EventSeverity,
    ScenarioState,
    SimulatedOrder,
    SimulatedSupplier,
    SimulatedWarehouse,
)
from .backend_interface import BackendInterface, InMemoryBackendAdapter

__all__ = [
    # functions
    "create_disruption",
    "record_event",
    "reset_scenario",
    "list_available_scenarios",
    "scenario_to_optimizer_inputs",
    "get_default_backend",
    # schemas
    "DisruptionEvent",
    "DisruptionType",
    "EventSeverity",
    "ScenarioState",
    "SimulatedOrder",
    "SimulatedSupplier",
    "SimulatedWarehouse",
    # interface
    "BackendInterface",
    "InMemoryBackendAdapter",
]
