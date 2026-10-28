"""
backend_interface.py — Protocol that Member 2's backend must satisfy.

This module defines the *interface contract* between the simulator and the
main Supply Chain X backend.  The simulator calls these methods to record
disruption events and query/reset state.

Why a Protocol?
---------------
The simulator must not import or depend on Member 2's concrete backend
implementation.  By programming against a Protocol, both sides stay
decoupled:
  - Member 2 registers their concrete backend.
  - The simulator only sees the typed interface.
  - Tests use ``InMemoryBackendAdapter`` (provided here) as a drop-in.

Usage by Member 2
-----------------
Implement the :class:`BackendInterface` Protocol on your backend class and
pass an instance to :func:`~backend.simulator.simulator.create_disruption`:

    from backend.simulator.backend_interface import BackendInterface

    class MyBackend:
        def record_disruption_event(self, event_dict: dict) -> str: ...
        def get_current_inventory(self, component_id: str) -> int: ...
        def reset_scenario(self, scenario_id: str) -> None: ...

Usage in tests / no-backend mode
---------------------------------
The ``InMemoryBackendAdapter`` shipped here stores events in memory with no
external dependencies.  Use it directly or as a reference implementation.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Protocol, runtime_checkable


# ---------------------------------------------------------------------------
# Protocol (interface contract)
# ---------------------------------------------------------------------------

@runtime_checkable
class BackendInterface(Protocol):
    """
    Typed interface every backend adapter must satisfy.

    All methods are safe to call with simulated data — no real orders,
    purchases, or inventory changes are triggered.
    """

    def record_disruption_event(self, event_dict: dict) -> str:
        """
        Persist a disruption event record.

        Parameters
        ----------
        event_dict : dict
            Serialised :class:`~backend.simulator.schemas.DisruptionEvent`
            (call ``.to_dict()`` before passing).

        Returns
        -------
        str
            Backend-assigned record ID (may equal ``event_dict["event_id"]``).
        """
        ...

    def get_current_inventory(self, component_id: str) -> int:
        """
        Query current on-hand inventory for a component.

        Returns 0 if the component is unknown.
        This method must be **read-only** — it must not modify any state.
        """
        ...

    def reset_scenario(self, scenario_id: str) -> None:
        """
        Remove all records associated with *scenario_id*.

        Used by tests and simulation harnesses to reset state between runs.
        This must **not** affect production data outside the simulation namespace.
        """
        ...

    def list_recorded_events(self, scenario_id: Optional[str] = None) -> List[dict]:
        """
        Return recorded disruption events, optionally filtered by scenario.
        """
        ...


# ---------------------------------------------------------------------------
# In-memory reference adapter (no external dependencies)
# ---------------------------------------------------------------------------

class InMemoryBackendAdapter:
    """
    Pure-Python in-memory implementation of :class:`BackendInterface`.

    Suitable for:
    - Unit tests
    - Local development without a real backend
    - Smoke-testing simulator scenarios

    Data is stored in plain Python dicts/lists and is **lost on process exit**.
    This class deliberately contains no database logic, mirroring the
    requirement not to create a second database.
    """

    def __init__(self, initial_inventory: Optional[Dict[str, int]] = None) -> None:
        self._events: List[dict] = []
        self._inventory: Dict[str, int] = dict(initial_inventory or {})

    # ---- BackendInterface implementation ----

    def record_disruption_event(self, event_dict: dict) -> str:
        record = dict(event_dict)
        self._events.append(record)
        return record.get("event_id", f"evt-{len(self._events)}")

    def get_current_inventory(self, component_id: str) -> int:
        return self._inventory.get(component_id, 0)

    def reset_scenario(self, scenario_id: str) -> None:
        self._events = [
            e for e in self._events
            if e.get("scenario_id") != scenario_id
            and not e.get("event_id", "").startswith(scenario_id)
        ]

    def list_recorded_events(self, scenario_id: Optional[str] = None) -> List[dict]:
        if scenario_id is None:
            return list(self._events)
        return [
            e for e in self._events
            if e.get("scenario_id") == scenario_id
               or str(e.get("event_id", "")).startswith(scenario_id)
        ]

    # ---- Test/debug helpers ----

    def set_inventory(self, component_id: str, qty: int) -> None:
        """Override simulated inventory for testing."""
        self._inventory[component_id] = qty

    def all_events(self) -> List[dict]:
        return list(self._events)

    def event_count(self) -> int:
        return len(self._events)
