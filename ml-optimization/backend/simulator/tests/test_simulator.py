"""Tests for the supplier outage simulator."""
from __future__ import annotations

import pytest

from backend.simulator import (
    InMemoryBackendAdapter,
    create_disruption,
    list_available_scenarios,
    record_event,
    reset_scenario,
    scenario_to_optimizer_inputs,
)
from backend.simulator.schemas import DisruptionType, EventSeverity, ScenarioState
from backend.simulator.scenarios import (
    build_demand_spike,
    build_low_inventory,
    build_shipment_delay,
    build_supplier_outage,
    build_warehouse_outage,
    load_scenario,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fresh_backend() -> InMemoryBackendAdapter:
    """Always start each test with a clean backend adapter."""
    return InMemoryBackendAdapter()


# ---------------------------------------------------------------------------
# 1. Scenario registry
# ---------------------------------------------------------------------------
class TestScenarioRegistry:
    def test_all_scenarios_listed(self):
        names = list_available_scenarios()
        assert "supplier_outage"  in names
        assert "low_inventory"    in names
        assert "shipment_delay"   in names
        assert "demand_spike"     in names
        assert "warehouse_outage" in names

    def test_load_unknown_raises(self):
        with pytest.raises(ValueError, match="Unknown scenario"):
            load_scenario("nonexistent_scenario")


# ---------------------------------------------------------------------------
# 2. Primary scenario — supplier outage
# ---------------------------------------------------------------------------
class TestSupplierOutageScenario:
    def test_returns_scenario_state(self):
        state = build_supplier_outage()
        assert isinstance(state, ScenarioState)

    def test_primary_supplier_marked_unavailable(self):
        state = build_supplier_outage()
        primary = next(s for s in state.suppliers if s.is_primary)
        assert not primary.is_available

    def test_outage_duration_five_days(self):
        state = build_supplier_outage()
        evt = state.events[0]
        assert evt.outage_duration_days == 5
        assert evt.disruption_type == DisruptionType.SUPPLIER_OUTAGE

    def test_severity_critical(self):
        state = build_supplier_outage()
        assert state.events[0].severity == EventSeverity.CRITICAL

    def test_three_orders_present(self):
        state = build_supplier_outage()
        assert len(state.orders) == 3

    def test_total_demand_correct(self):
        state = build_supplier_outage()
        expected = sum(o.quantity for o in state.orders)
        assert state.total_demand["COMP-PCB-01"] == expected  # 320

    def test_alternative_suppliers_available(self):
        state = build_supplier_outage()
        alts = [s for s in state.suppliers if not s.is_primary and s.is_available]
        assert len(alts) >= 1

    def test_assumptions_documented(self):
        state = build_supplier_outage()
        assert state.events[0].assumptions  # non-empty list

    def test_to_dict_serialisable(self):
        import json
        state = build_supplier_outage()
        serialised = json.dumps(state.to_dict())
        assert "COMP-PCB-01" in serialised


# ---------------------------------------------------------------------------
# 3. Repeatability — same inputs, identical outputs
# ---------------------------------------------------------------------------
class TestRepeatability:
    def test_supplier_outage_repeatable(self):
        s1 = build_supplier_outage()
        s2 = build_supplier_outage()
        # Structural identity (excluding timestamps)
        assert s1.scenario_id           == s2.scenario_id
        assert s1.total_demand          == s2.total_demand
        assert len(s1.orders)           == len(s2.orders)
        assert len(s1.suppliers)        == len(s2.suppliers)
        assert len(s1.warehouses)       == len(s2.warehouses)
        assert s1.events[0].outage_duration_days == s2.events[0].outage_duration_days

    def test_create_disruption_repeatable(self):
        b1, b2 = _fresh_backend(), _fresh_backend()
        st1 = create_disruption("supplier_outage", backend=b1)
        st2 = create_disruption("supplier_outage", backend=b2)
        assert st1.scenario_id    == st2.scenario_id
        assert st1.total_demand   == st2.total_demand
        assert b1.event_count()   == b2.event_count()

    @pytest.mark.parametrize("name", [
        "supplier_outage", "low_inventory", "shipment_delay",
        "demand_spike", "warehouse_outage",
    ])
    def test_every_scenario_repeatable(self, name):
        s1 = load_scenario(name)
        s2 = load_scenario(name)
        assert s1.scenario_id   == s2.scenario_id
        assert s1.total_demand  == s2.total_demand


# ---------------------------------------------------------------------------
# 4. Backend event recording
# ---------------------------------------------------------------------------
class TestEventRecording:
    def test_events_recorded_on_create(self):
        backend = _fresh_backend()
        create_disruption("supplier_outage", backend=backend)
        assert backend.event_count() >= 1

    def test_recorded_event_has_correct_type(self):
        backend = _fresh_backend()
        create_disruption("supplier_outage", backend=backend)
        events = backend.all_events()
        assert any(e["disruption_type"] == "supplier_outage" for e in events)

    def test_record_event_standalone(self):
        backend = _fresh_backend()
        evt = {"event_id": "MANUAL-001", "disruption_type": "demand_spike"}
        eid = record_event(evt, backend=backend)
        assert eid == "MANUAL-001"
        assert backend.event_count() == 1

    def test_list_recorded_events_by_scenario(self):
        backend = _fresh_backend()
        create_disruption("supplier_outage", backend=backend)
        create_disruption("low_inventory",   backend=backend)
        scen_events = backend.list_recorded_events("SCEN-SUPPLIER-OUTAGE-001")
        assert len(scen_events) >= 1


# ---------------------------------------------------------------------------
# 5. Reset scenario
# ---------------------------------------------------------------------------
class TestResetScenario:
    def test_reset_clears_events(self):
        backend = _fresh_backend()
        state = create_disruption("supplier_outage", backend=backend)
        assert backend.event_count() >= 1
        reset_scenario(state.scenario_id, backend=backend)
        remaining = backend.list_recorded_events(state.scenario_id)
        assert len(remaining) == 0

    def test_reset_does_not_affect_other_scenarios(self):
        backend = _fresh_backend()
        create_disruption("supplier_outage", backend=backend)
        create_disruption("low_inventory",   backend=backend)
        count_before = backend.event_count()
        reset_scenario("SCEN-SUPPLIER-OUTAGE-001", backend=backend)
        # low_inventory events should survive
        remaining = backend.list_recorded_events("SCEN-LOW-INV-001")
        assert len(remaining) >= 1

    def test_reset_idempotent(self):
        backend = _fresh_backend()
        state = create_disruption("supplier_outage", backend=backend)
        reset_scenario(state.scenario_id, backend=backend)
        reset_scenario(state.scenario_id, backend=backend)  # second reset is safe
        assert backend.list_recorded_events(state.scenario_id) == []


# ---------------------------------------------------------------------------
# 6. scenario_to_optimizer_inputs bridge
# ---------------------------------------------------------------------------
class TestOptimizerBridge:
    def test_returns_four_items(self):
        state = build_supplier_outage()
        result = scenario_to_optimizer_inputs(state)
        assert len(result) == 4  # demands, warehouses, suppliers, config

    def test_demand_aggregated_correctly(self):
        state = build_supplier_outage()
        demands, *_ = scenario_to_optimizer_inputs(state)
        total = sum(d.required_qty for d in demands)
        assert total == state.total_demand["COMP-PCB-01"]

    def test_disrupted_supplier_is_available_false(self):
        state = build_supplier_outage()
        _, _, suppliers, _ = scenario_to_optimizer_inputs(state)
        primary = next(s for s in suppliers if s.supplier_id == "SUP-ALPHA")
        assert not primary.is_available

    def test_warehouse_outage_zeroes_available_qty(self):
        state = build_warehouse_outage()
        _, warehouses, _, _ = scenario_to_optimizer_inputs(state)
        wh_east = next(w for w in warehouses if w.warehouse_id == "WH-EAST")
        assert wh_east.available_qty == 0  # outage → set to 0

    def test_safety_stock_passed_to_config(self):
        state = build_supplier_outage()
        _, _, _, config = scenario_to_optimizer_inputs(state)
        # WH-EAST has safety_stock_qty=40
        assert config.safety_stock.get("COMP-PCB-01", 0) == 40

    def test_end_to_end_with_optimizer(self):
        """Full pipeline: scenario → optimizer inputs → plan_recovery."""
        from backend.optimizer import plan_recovery
        state = build_supplier_outage()
        demands, warehouses, suppliers, config = scenario_to_optimizer_inputs(state)
        plan = plan_recovery(demands, warehouses, suppliers, config)
        # Plan should be returned without exception; may or may not be feasible
        assert hasattr(plan, "is_infeasible")
        assert hasattr(plan, "actions")
        assert hasattr(plan, "violated_constraints")


# ---------------------------------------------------------------------------
# 7. Optional scenarios — structural smoke tests
# ---------------------------------------------------------------------------
class TestOptionalScenarios:
    def test_low_inventory_warehouse_has_low_stock(self):
        state = build_low_inventory()
        wh = state.warehouses[0]
        assert wh.on_hand_qty <= 25  # critically low

    def test_shipment_delay_lead_time_inflated(self):
        state = build_shipment_delay()
        delayed = next(s for s in state.suppliers if s.supplier_id == "SUP-BETA")
        assert delayed.lead_time_days > 6  # delay adds to base 6 days

    def test_demand_spike_has_emergency_order(self):
        state = build_demand_spike()
        high_prio = [o for o in state.orders if o.priority == 1]
        assert any(o.quantity >= 150 for o in high_prio)

    def test_warehouse_outage_wh_east_unavailable(self):
        state = build_warehouse_outage()
        wh_east = next(w for w in state.warehouses if w.warehouse_id == "WH-EAST")
        assert not wh_east.is_available
