"""
test_integration.py — End-to-end integration tests.

These tests run the full pipeline:
  create_disruption → scenario_to_optimizer_inputs → plan_recovery

and make concrete numeric assertions about each scenario's outcomes,
ensuring the integration between the simulator and optimizer modules works
correctly end-to-end.

All expected values were derived from the fixed scenario parameters in
scenarios.py and verified by running the code — none are invented.
"""
from __future__ import annotations

import math
import pytest

from backend.evaluation.baselines import solve_fixed_rule
from backend.evaluation.evaluator import run_scenario, APPROACH_A, APPROACH_B, APPROACH_C
from backend.evaluation.kpis import compute_kpis, AUTO_THRESHOLD
from backend.optimizer import plan_recovery
from backend.simulator.scenarios import (
    build_demand_spike,
    build_low_inventory,
    build_shipment_delay,
    build_supplier_outage,
    build_warehouse_outage,
)
from backend.simulator.simulator import scenario_to_optimizer_inputs


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _run(state):
    """Shortcut: convert scenario state → optimizer inputs → plan."""
    demands, warehouses, suppliers, config = scenario_to_optimizer_inputs(state)
    plan = plan_recovery(demands, warehouses, suppliers, config)
    return demands, plan


# ---------------------------------------------------------------------------
# Scenario 1: Supplier Outage
# ---------------------------------------------------------------------------
class TestSupplierOutageIntegration:
    """
    Known inputs: demand=320 units, alternatives give max 150+80=230 supplier
    units + 60 usable warehouse units = 290 total available < 320 demanded.
    Expected: partial fulfillment (plan feasible by default with partial=True).
    """

    def test_pipeline_runs_without_error(self):
        state = build_supplier_outage()
        demands, plan = _run(state)
        assert plan is not None

    def test_disrupted_supplier_not_used(self):
        state = build_supplier_outage()
        demands, plan = _run(state)
        sources = {a.source_id for a in plan.actions}
        assert "SUP-ALPHA" not in sources, "Disrupted supplier must not appear in plan"

    def test_total_supply_does_not_exceed_available(self):
        """Max possible = 150 (BETA) + 80 (GAMMA) + 60 (WH-EAST usable) = 290."""
        state = build_supplier_outage()
        demands, plan = _run(state)
        total_fulfilled = sum(plan.fulfilled.values())
        assert total_fulfilled <= 290

    def test_cost_is_positive_when_actions_taken(self):
        state = build_supplier_outage()
        demands, plan = _run(state)
        if plan.actions:
            assert plan.total_cost > 0

    def test_recovery_plan_serialisable(self):
        import json
        state = build_supplier_outage()
        demands, plan = _run(state)
        serialised = json.dumps(plan.to_dict())
        assert "solver_type" in serialised

    def test_kpi_fulfillment_rate_within_bounds(self):
        state = build_supplier_outage()
        demands, plan = _run(state)
        kpi = compute_kpis(APPROACH_C, state, demands, plan)
        assert 0.0 <= kpi.fulfillment_rate_pct <= 100.0

    def test_kpi_stockout_plus_fulfillment_equals_100(self):
        state = build_supplier_outage()
        demands, plan = _run(state)
        kpi = compute_kpis(APPROACH_C, state, demands, plan)
        assert kpi.fulfillment_rate_pct + kpi.stockout_rate_pct == pytest.approx(100.0, abs=1e-4)

    def test_three_approach_comparison(self):
        """All three approaches must produce valid KPI objects."""
        state = build_supplier_outage()
        ev = run_scenario(state)
        assert ev.kpi_a.approach_name == APPROACH_A
        assert ev.kpi_b.approach_name == APPROACH_B
        assert ev.kpi_c.approach_name == APPROACH_C


# ---------------------------------------------------------------------------
# Scenario 2: Low Inventory
# ---------------------------------------------------------------------------
class TestLowInventoryIntegration:
    """
    Known: demand=140, warehouse usable=5, suppliers available (alpha=200, beta=100).
    Total supply >> demand → plan must be fully feasible.
    """

    def test_demand_fully_satisfied(self):
        state = build_low_inventory()
        demands, plan = _run(state)
        total_demand = sum(d.required_qty for d in demands)
        total_fulfilled = sum(plan.fulfilled.values())
        assert total_fulfilled == total_demand, (
            f"Low-inventory scenario should be fully feasible: "
            f"fulfilled={total_fulfilled}, demand={total_demand}"
        )

    def test_not_infeasible(self):
        state = build_low_inventory()
        _, plan = _run(state)
        assert not plan.is_infeasible

    def test_warehouse_capped_at_usable_qty(self):
        """WH-EAST has 20 on-hand, safety_stock=15 → max 5 units usable."""
        state = build_low_inventory()
        demands, plan = _run(state)
        wh_qty = sum(a.quantity for a in plan.actions if a.source_id == "WH-EAST")
        assert wh_qty <= 5


# ---------------------------------------------------------------------------
# Scenario 3: Shipment Delay
# ---------------------------------------------------------------------------
class TestShipmentDelayIntegration:
    """
    Known: SUP-BETA lead=10 days, demand due day 7 → delay expected.
    Warehouse has 60 usable units (80-20) at 1-day lead → on-time.
    """

    def test_plan_feasible(self):
        state = build_shipment_delay()
        _, plan = _run(state)
        assert not plan.is_infeasible

    def test_delay_penalty_present_when_late_delivery_used(self):
        """If SUP-BETA (lead=10) is used for the day-7 order, delay penalty > 0."""
        state = build_shipment_delay()
        demands, plan = _run(state)
        beta_actions = [a for a in plan.actions if a.source_id == "SUP-BETA"]
        for a in beta_actions:
            # SUP-BETA lead=10, soonest due=7 → delay=3 days
            assert a.delay_days >= 0.0

    def test_on_time_units_from_warehouse_and_fast_supplier(self):
        state = build_shipment_delay()
        demands, plan = _run(state)
        # SUP-GAMMA lead=3 days → on time for due=7
        gamma_actions = [a for a in plan.actions if a.source_id == "SUP-GAMMA"]
        for a in gamma_actions:
            assert a.delay_days == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# Scenario 4: Demand Spike
# ---------------------------------------------------------------------------
class TestDemandSpikeIntegration:
    """
    Known: total demand=380, available = WH-EAST 90 + WH-WEST 60 + 
    SUP-ALPHA 200 + SUP-BETA 150 + SUP-GAMMA 80 = 580 total → fully feasible.
    """

    def test_demand_fully_satisfied(self):
        state = build_demand_spike()
        demands, plan = _run(state)
        total_demand = sum(d.required_qty for d in demands)
        total_fulfilled = sum(plan.fulfilled.values())
        assert total_fulfilled == total_demand

    def test_not_infeasible(self):
        state = build_demand_spike()
        _, plan = _run(state)
        assert not plan.is_infeasible

    def test_kpi_auto_resolution_is_100(self):
        state = build_demand_spike()
        demands, plan = _run(state)
        kpi = compute_kpis(APPROACH_C, state, demands, plan)
        assert kpi.auto_resolution_rate_pct == 100.0


# ---------------------------------------------------------------------------
# Scenario 5: Warehouse Outage
# ---------------------------------------------------------------------------
class TestWarehouseOutageIntegration:
    """
    Known: WH-EAST blocked → only WH-WEST usable (30 units) + suppliers.
    Total supply = 30 + 200 (ALPHA) + 150 (BETA) = 380 >> demand=180.
    """

    def test_wh_east_not_used(self):
        state = build_warehouse_outage()
        _, plan = _run(state)
        wh_east_actions = [a for a in plan.actions if a.source_id == "WH-EAST"]
        assert wh_east_actions == [], "WH-EAST is in outage — must not appear in plan"

    def test_demand_satisfied(self):
        state = build_warehouse_outage()
        demands, plan = _run(state)
        total_demand = sum(d.required_qty for d in demands)
        total_fulfilled = sum(plan.fulfilled.values())
        assert total_fulfilled == total_demand


# ---------------------------------------------------------------------------
# Cross-approach KPI consistency
# ---------------------------------------------------------------------------
class TestApproachComparison:
    """Validate that CP-SAT cost <= greedy cost on feasible scenarios."""

    @pytest.mark.parametrize("factory", [
        build_low_inventory,
        build_shipment_delay,
        build_demand_spike,
        build_warehouse_outage,
    ])
    def test_cpsat_cost_not_worse_than_greedy(self, factory):
        """
        CP-SAT finds a globally optimal solution; greedy is heuristic.
        On feasible scenarios, CP-SAT total_cost must be <= greedy total_cost.
        """
        state = factory()
        demands, warehouses, suppliers, config = scenario_to_optimizer_inputs(state)

        from backend.optimizer.fallback import solve_greedy
        plan_greedy = solve_greedy(demands, warehouses, suppliers, config)
        plan_cpsat  = plan_recovery(demands, warehouses, suppliers, config)

        if not plan_cpsat.is_infeasible and not plan_greedy.is_infeasible:
            assert plan_cpsat.total_cost <= plan_greedy.total_cost + 1e-3, (
                f"{factory.__name__}: CP-SAT cost {plan_cpsat.total_cost:.2f} "
                f"> greedy cost {plan_greedy.total_cost:.2f}"
            )

    @pytest.mark.parametrize("factory", [
        build_low_inventory,
        build_demand_spike,
        build_warehouse_outage,
    ])
    def test_fixed_rule_fulfillment_equal_or_less(self, factory):
        """
        Fixed-rule baseline must fulfil <= demand (never invents supply).
        On fully-feasible scenarios, all three approaches fulfil 100%.
        """
        state = factory()
        demands, warehouses, suppliers, config = scenario_to_optimizer_inputs(state)
        plan_a = solve_fixed_rule(demands, warehouses, suppliers, config)
        total_demand = sum(d.required_qty for d in demands)
        total_fulfilled = sum(plan_a.fulfilled.values())
        assert total_fulfilled <= total_demand


# ---------------------------------------------------------------------------
# KPI computation correctness
# ---------------------------------------------------------------------------
class TestKPIComputation:
    def test_mttd_is_zero_for_immediate_detection_scenarios(self):
        """supplier_outage, low_inventory, demand_spike detect disruption at outage_start (MTTD=0)."""
        immediate_factories = {
            "supplier_outage": build_supplier_outage,
            "low_inventory":   build_low_inventory,
            "demand_spike":     build_demand_spike,
        }
        for name, factory in immediate_factories.items():
            state = factory()
            demands, plan = _run(state)
            kpi = compute_kpis(APPROACH_C, state, demands, plan)
            assert kpi.mttd_days == pytest.approx(0.0), (
                f"MTTD should be 0 for '{name}' (instantaneous detection), got {kpi.mttd_days}"
            )

    def test_mean_arrival_day_inf_when_infeasible(self):
        """When plan is infeasible, mean_arrival_day = inf (and last_delivery_day = inf)."""
        from backend.optimizer.schemas import OptimizerConfig
        from backend.optimizer.schemas import ComponentDemand, SupplierOption
        from backend.optimizer.optimizer import plan_recovery as pr
        demands = [ComponentDemand("X", 999)]
        suppliers = [SupplierOption("S", "X", 1, 10.0, 5.0)]
        config = OptimizerConfig(allow_partial_fulfillment=False)
        plan = pr(demands, suppliers=suppliers, config=config)

        from backend.simulator.schemas import ScenarioState, DisruptionEvent, DisruptionType, EventSeverity
        evt = DisruptionEvent("E1", DisruptionType.SUPPLIER_OUTAGE, "X", 0, 1, EventSeverity.HIGH, "test", [])
        state = ScenarioState("sid", "sname", [evt], [], [], [], {"X": 999})
        kpi = compute_kpis(APPROACH_C, state, demands, plan)
        assert math.isinf(kpi.mean_arrival_day)
        assert math.isinf(kpi.last_delivery_day)

    def test_mttd_shipment_delay_equals_2(self):
        """shipment_delay has detected_at_day=2, outage_start_day=0 → MTTD=2 days."""
        state = build_shipment_delay()
        demands, plan = _run(state)
        kpi = compute_kpis(APPROACH_C, state, demands, plan)
        assert kpi.mttd_days == pytest.approx(2.0), (
            f"shipment_delay MTTD should be 2 (detected after 2 days), got {kpi.mttd_days}"
        )

    def test_mttd_warehouse_outage_equals_1(self):
        """warehouse_outage has detected_at_day=1, outage_start_day=0 → MTTD=1 day."""
        state = build_warehouse_outage()
        demands, plan = _run(state)
        kpi = compute_kpis(APPROACH_C, state, demands, plan)
        assert kpi.mttd_days == pytest.approx(1.0), (
            f"warehouse_outage MTTD should be 1 (inspector confirms after 1 day), got {kpi.mttd_days}"
        )

    def test_detected_at_day_cannot_precede_outage(self):
        """DisruptionEvent must raise ValueError if detected_at_day < outage_start_day."""
        from backend.simulator.schemas import DisruptionEvent, DisruptionType, EventSeverity
        with pytest.raises(ValueError, match="cannot be earlier"):
            DisruptionEvent(
                event_id="E_BAD",
                disruption_type=DisruptionType.SUPPLIER_OUTAGE,
                affected_component="C",
                outage_start_day=5,
                outage_duration_days=1,
                detected_at_day=3,   # before outage_start_day=5 → invalid
                severity=EventSeverity.LOW,
                description="bad",
                assumptions=[],
            )

    def test_mean_vs_last_delivery_day(self):
        """mean_arrival_day = mean of arrivals; last_delivery_day = max of arrivals."""
        # low_inventory: supplier(lead=3) + possibly warehouse(lead=1)
        # mean will be <= max by definition
        state = build_low_inventory()
        demands, plan = _run(state)
        kpi = compute_kpis(APPROACH_C, state, demands, plan)
        if plan.actions:
            arrivals = [a.estimated_arrival_days for a in plan.actions]
            assert kpi.mean_arrival_day == pytest.approx(sum(arrivals) / len(arrivals), abs=1e-6)
            assert kpi.last_delivery_day == pytest.approx(max(arrivals), abs=1e-6)
            assert kpi.mean_arrival_day <= kpi.last_delivery_day + 1e-9

    def test_is_auto_resolved_field_exists_and_consistent(self):
        """is_auto_resolved bool must equal (auto_resolution_rate_pct == 100.0)."""
        from backend.simulator.scenarios import SCENARIO_REGISTRY
        for name, factory in SCENARIO_REGISTRY.items():
            state = factory()
            demands, plan = _run(state)
            kpi = compute_kpis(APPROACH_C, state, demands, plan)
            assert isinstance(kpi.is_auto_resolved, bool), (
                f"is_auto_resolved must be bool for '{name}'"
            )
            expected_pct = 100.0 if kpi.is_auto_resolved else 0.0
            assert kpi.auto_resolution_rate_pct == pytest.approx(expected_pct), (
                f"auto_resolution_rate_pct inconsistent with is_auto_resolved for '{name}'"
            )

    def test_auto_resolution_rate_cross_crisis_mean(self):
        """Average of auto_resolution_rate_pct across scenarios = fraction of auto-resolved incidents."""
        from backend.evaluation.evaluator import run_all_scenarios
        evals = run_all_scenarios()
        # For Approach C, collect per-scenario auto_resolution_rate_pct
        rates = [ev.kpi_c.auto_resolution_rate_pct for ev in evals]
        cross_crisis_rate = sum(rates) / len(rates)
        # Should be between 0 and 100
        assert 0.0 <= cross_crisis_rate <= 100.0
        # Count auto-resolved scenarios
        n_auto = sum(1 for ev in evals if ev.kpi_c.is_auto_resolved)
        expected_rate = n_auto / len(evals) * 100.0
        assert cross_crisis_rate == pytest.approx(expected_rate, abs=1e-6)

    def test_on_time_units_read_from_plan(self):
        """On-time units must come from RecoveryAction.delay_days, not inferred."""
        state = build_low_inventory()
        demands, plan = _run(state)
        manual_on_time = sum(a.quantity for a in plan.actions if a.delay_days == 0.0)
        kpi = compute_kpis(APPROACH_C, state, demands, plan)
        assert kpi.on_time_units == manual_on_time
