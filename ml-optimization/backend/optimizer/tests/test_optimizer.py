"""Tests for the recovery optimizer — numerical cases with known feasible solutions."""
from __future__ import annotations

import math
import sys
import types
import pytest

from backend.optimizer import (
    ComponentDemand,
    OptimizerConfig,
    SupplierOption,
    WarehouseInventory,
    plan_recovery,
)
from backend.optimizer.schemas import ActionType, SolverStatus


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _demand(cid="C1", qty=100, due=math.inf, priority=1):
    return ComponentDemand(cid, qty, due, priority)


def _supplier(sid="S1", cid="C1", cap=200, price=10.0, lead=3.0, transport=0.0):
    return SupplierOption(sid, cid, cap, price, lead, transport)


def _warehouse(wid="W1", cid="C1", avail=50, cost=2.0, lead=1.0):
    return WarehouseInventory(wid, cid, avail, cost, lead)


# ---------------------------------------------------------------------------
# 1. Simple feasible — one component, one supplier
# ---------------------------------------------------------------------------
class TestSimpleFeasible:
    def test_demand_met(self):
        plan = plan_recovery(
            demands=[_demand(qty=100)],
            suppliers=[_supplier(cap=200, price=10.0)],
        )
        assert not plan.is_infeasible
        assert plan.fulfilled["C1"] == 100

    def test_known_cost(self):
        """100 units × $10 = $1000 procurement cost, no delay (lead 3 < no deadline)."""
        plan = plan_recovery(
            demands=[_demand(qty=100, due=math.inf)],
            suppliers=[_supplier(cap=200, price=10.0, lead=3.0)],
        )
        assert plan.total_procurement_cost == pytest.approx(1000.0, rel=1e-4)
        assert plan.total_delay_penalty == pytest.approx(0.0, abs=1e-6)

    def test_action_fields(self):
        plan = plan_recovery(
            demands=[_demand(qty=50)],
            suppliers=[_supplier(cap=100, price=5.0, lead=2.0)],
        )
        assert len(plan.actions) == 1
        a = plan.actions[0]
        assert a.action_type == ActionType.SUPPLIER_PURCHASE
        assert a.quantity == 50
        assert a.estimated_arrival_days == pytest.approx(2.0)
        assert a.subtotal_cost == pytest.approx(250.0)


# ---------------------------------------------------------------------------
# 2. Warehouse preferred over expensive supplier
# ---------------------------------------------------------------------------
class TestWarehousePreferred:
    def test_warehouse_chosen_first(self):
        """Warehouse cost $1/unit vs supplier $20/unit — optimizer must prefer warehouse."""
        plan = plan_recovery(
            demands=[_demand(qty=30)],
            warehouses=[_warehouse(avail=100, cost=1.0, lead=1.0)],
            suppliers=[_supplier(cap=200, price=20.0, lead=5.0)],
        )
        assert not plan.is_infeasible
        wh_actions = [a for a in plan.actions if a.action_type == ActionType.WAREHOUSE_TRANSFER]
        assert wh_actions, "Expected at least one warehouse transfer action"
        assert wh_actions[0].quantity == 30

    def test_warehouse_cannot_exceed_available(self):
        plan = plan_recovery(
            demands=[_demand(qty=30)],
            warehouses=[_warehouse(avail=20, cost=1.0)],
            suppliers=[_supplier(cap=200, price=10.0)],
        )
        wh_qty = sum(a.quantity for a in plan.actions if a.action_type == ActionType.WAREHOUSE_TRANSFER)
        assert wh_qty <= 20


# ---------------------------------------------------------------------------
# 3. Budget constraint
# ---------------------------------------------------------------------------
class TestBudgetConstraint:
    def test_budget_violation_reported(self):
        """Budget of $500 cannot cover 100 units × $10 = $1000."""
        config = OptimizerConfig(budget_limit=500.0)
        plan = plan_recovery(
            demands=[_demand(qty=100)],
            suppliers=[_supplier(cap=200, price=10.0)],
            config=config,
        )
        assert plan.violated_constraints  # some constraint must be reported

    def test_plan_within_budget(self):
        """Budget of $2000 is sufficient for 100 × $10."""
        config = OptimizerConfig(budget_limit=2000.0)
        plan = plan_recovery(
            demands=[_demand(qty=100)],
            suppliers=[_supplier(cap=200, price=10.0)],
            config=config,
        )
        assert not plan.is_infeasible
        assert plan.total_procurement_cost <= 2000.0 + 1e-6


# ---------------------------------------------------------------------------
# 4. Infeasible — supply insufficient
# ---------------------------------------------------------------------------
class TestInfeasibleNoSupply:
    def test_infeasibility_flagged(self):
        plan = plan_recovery(
            demands=[_demand(qty=500)],
            suppliers=[_supplier(cap=100, price=10.0)],
            config=OptimizerConfig(allow_partial_fulfillment=False),
        )
        assert plan.is_infeasible

    def test_infeasibility_explanation(self):
        plan = plan_recovery(
            demands=[_demand(qty=500)],
            suppliers=[_supplier(cap=100, price=10.0)],
            config=OptimizerConfig(allow_partial_fulfillment=False),
        )
        assert plan.violated_constraints


# ---------------------------------------------------------------------------
# 5. Safety stock honoured
# ---------------------------------------------------------------------------
class TestSafetyStock:
    def test_warehouse_not_drained_below_safety_stock(self):
        """Warehouse has 100 units but safety stock = 70 → max usable = 30."""
        config = OptimizerConfig(safety_stock={"C1": 70})
        plan = plan_recovery(
            demands=[_demand(qty=30)],
            warehouses=[_warehouse(avail=100, cost=1.0)],
            config=config,
        )
        wh_qty = sum(
            a.quantity for a in plan.actions
            if a.action_type == ActionType.WAREHOUSE_TRANSFER
        )
        assert wh_qty <= 30  # cannot exceed usable = 100 - 70 = 30

    def test_safety_stock_blocks_warehouse(self):
        """Safety stock = available_qty → warehouse unusable; supplier must fill."""
        config = OptimizerConfig(safety_stock={"C1": 50})
        plan = plan_recovery(
            demands=[_demand(qty=30)],
            warehouses=[_warehouse(avail=50, cost=0.5)],
            suppliers=[_supplier(cap=100, price=5.0)],
            config=config,
        )
        wh_qty = sum(
            a.quantity for a in plan.actions
            if a.action_type == ActionType.WAREHOUSE_TRANSFER
        )
        assert wh_qty == 0  # warehouse fully locked by safety stock


# ---------------------------------------------------------------------------
# 6. Negative input rejected
# ---------------------------------------------------------------------------
class TestNegativeInputRejected:
    def test_negative_demand_raises(self):
        with pytest.raises(ValueError):
            ComponentDemand("C1", required_qty=-10)

    def test_negative_capacity_raises(self):
        with pytest.raises(ValueError):
            SupplierOption("S1", "C1", capacity=-1, price_per_unit=5.0, lead_time_days=2.0)

    def test_negative_price_raises(self):
        with pytest.raises(ValueError):
            SupplierOption("S1", "C1", capacity=100, price_per_unit=-1.0, lead_time_days=2.0)

    def test_negative_available_qty_raises(self):
        with pytest.raises(ValueError):
            WarehouseInventory("W1", "C1", available_qty=-5, transfer_cost_per_unit=1.0)

    def test_blank_component_id_raises(self):
        with pytest.raises(ValueError):
            plan_recovery(demands=[ComponentDemand("  ", required_qty=10)])


# ---------------------------------------------------------------------------
# 7. Zero demand accepted — returns empty plan cleanly
# ---------------------------------------------------------------------------
class TestZeroDemand:
    def test_zero_qty_returns_empty_plan(self):
        plan = plan_recovery(
            demands=[_demand(qty=0)],
            suppliers=[_supplier()],
        )
        assert not plan.is_infeasible
        assert plan.actions == []
        assert plan.total_cost == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# 8. Multi-component — 2 components, 3 suppliers, 2 warehouses
# ---------------------------------------------------------------------------
class TestMultiComponent:
    def test_all_demand_satisfied(self):
        plan = plan_recovery(
            demands=[
                ComponentDemand("COMP-A", 80, due_date_days=7),
                ComponentDemand("COMP-B", 50, due_date_days=10),
            ],
            warehouses=[
                WarehouseInventory("WH-1", "COMP-A", 30, transfer_cost_per_unit=2.0, transfer_lead_time_days=1.0),
                WarehouseInventory("WH-2", "COMP-B", 60, transfer_cost_per_unit=3.0, transfer_lead_time_days=2.0),
            ],
            suppliers=[
                SupplierOption("SUP-1", "COMP-A", 100, price_per_unit=8.0, lead_time_days=5.0),
                SupplierOption("SUP-2", "COMP-B", 100, price_per_unit=12.0, lead_time_days=6.0),
                SupplierOption("SUP-3", "COMP-A", 200, price_per_unit=15.0, lead_time_days=3.0),
            ],
        )
        assert not plan.is_infeasible
        assert plan.fulfilled.get("COMP-A", 0) == 80
        assert plan.fulfilled.get("COMP-B", 0) == 50

    def test_to_dict_serialisable(self):
        import json
        plan = plan_recovery(
            demands=[ComponentDemand("C1", 10), ComponentDemand("C2", 20)],
            suppliers=[
                SupplierOption("S1", "C1", 50, 5.0, 2.0),
                SupplierOption("S2", "C2", 50, 7.0, 3.0),
            ],
        )
        d = plan.to_dict()
        serialised = json.dumps(d)
        assert "actions" in serialised


# ---------------------------------------------------------------------------
# 9. Greedy fallback (monkeypatch OR-Tools absent)
# ---------------------------------------------------------------------------
class TestGreedyFallback:
    def test_fallback_produces_same_schema(self, monkeypatch):
        """Simulate OR-Tools being unavailable and verify same RecoveryPlan shape."""
        import backend.optimizer.optimizer as opt_mod
        monkeypatch.setattr(opt_mod, "_ORTOOLS_AVAILABLE", False)

        plan = plan_recovery(
            demands=[_demand(qty=50)],
            suppliers=[_supplier(cap=100, price=7.0)],
        )
        assert plan.solver_type == "greedy_fallback"
        assert plan.fulfilled["C1"] == 50
        assert not plan.is_infeasible

    def test_fallback_respects_capacity(self, monkeypatch):
        import backend.optimizer.optimizer as opt_mod
        monkeypatch.setattr(opt_mod, "_ORTOOLS_AVAILABLE", False)

        plan = plan_recovery(
            demands=[_demand(qty=200)],
            suppliers=[_supplier(cap=100, price=7.0)],
            config=OptimizerConfig(allow_partial_fulfillment=False),
        )
        assert plan.is_infeasible


# ---------------------------------------------------------------------------
# 10. Delay penalty computed and included in total cost
# ---------------------------------------------------------------------------
class TestDelayPenalty:
    def test_late_delivery_incurs_penalty(self):
        """Lead time 10 days, due date 5 days → 5 days late × 100 units × $5/day = $2500."""
        config = OptimizerConfig(delay_penalty_per_day=5.0)
        plan = plan_recovery(
            demands=[_demand(qty=100, due=5.0)],
            suppliers=[_supplier(cap=200, price=10.0, lead=10.0)],
            config=config,
        )
        assert not plan.is_infeasible
        assert plan.total_delay_penalty == pytest.approx(2500.0, rel=1e-3)

    def test_on_time_delivery_no_penalty(self):
        config = OptimizerConfig(delay_penalty_per_day=5.0)
        plan = plan_recovery(
            demands=[_demand(qty=100, due=7.0)],
            suppliers=[_supplier(cap=200, price=10.0, lead=3.0)],
            config=config,
        )
        assert plan.total_delay_penalty == pytest.approx(0.0, abs=1e-6)


# ---------------------------------------------------------------------------
# 11. Deterministic — same inputs → identical plans
# ---------------------------------------------------------------------------
class TestDeterministicOutput:
    def test_same_plan_twice(self):
        kwargs = dict(
            demands=[_demand(qty=75)],
            suppliers=[_supplier(cap=200, price=9.0, lead=4.0)],
            warehouses=[_warehouse(avail=30, cost=2.0, lead=1.0)],
        )
        plan1 = plan_recovery(**kwargs)
        plan2 = plan_recovery(**kwargs)
        assert plan1.total_cost == pytest.approx(plan2.total_cost)
        assert plan1.fulfilled == plan2.fulfilled
        assert plan1.solver_type == plan2.solver_type

    def test_disrupted_supplier_excluded(self):
        """Disrupted supplier must not appear in any action."""
        plan = plan_recovery(
            demands=[_demand(qty=50)],
            suppliers=[
                SupplierOption("BAD", "C1", 200, 1.0, 1.0, is_available=False),
                _supplier("GOOD", cap=200, price=8.0),
            ],
        )
        sources = {a.source_id for a in plan.actions}
        assert "BAD" not in sources
        assert "GOOD" in sources
