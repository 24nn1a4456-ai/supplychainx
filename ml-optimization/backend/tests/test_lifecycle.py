"""
test_lifecycle.py — Full end-to-end lifecycle integration tests.

Tests the complete vertical slice:
  disruption → agents → optimizer → plan → approval → simulation → audit

Uses the real decision engine, not mocks.
"""
from __future__ import annotations

import json
import pytest
from fastapi.testclient import TestClient

from backend.api import app
from backend.database import reset_db
from backend.seed import init_and_seed


@pytest.fixture(autouse=True)
def isolated_db():
    """Reset and seed the database for each test."""
    reset_db()
    init_and_seed()
    yield
    reset_db()


client = TestClient(app)


# ─────────────────────── Helper ───────────────────────────────────

def create_and_analyze(scenario: str = "supplier_outage"):
    """Create a disruption and run full analysis."""
    r = client.post("/api/disruptions", json={
        "type": scenario,
        "description": f"Test {scenario}",
        "severity": "HIGH",
    })
    assert r.status_code == 201
    did = r.json()["id"]

    r = client.post(f"/api/disruptions/{did}/analyze")
    assert r.status_code == 200
    analysis = r.json()
    return did, analysis


# ─────────────────── Full Lifecycle Tests ─────────────────────────

class TestCompleteLifecycle:
    """Full vertical slice through the entire system."""

    def test_full_lifecycle_supplier_outage(self):
        """Create → Analyze → Approve → Simulate → Verify audit trail."""
        # 1. Create & analyze
        did, analysis = create_and_analyze("supplier_outage")
        plan_id = analysis["plan_id"]
        assert plan_id is not None
        assert analysis["plan_status"] == "pending"

        # 2. Verify agents ran
        assert analysis["agents_summary"]["total"] == 3
        assert analysis["agents_summary"]["succeeded"] >= 1

        # 3. Verify engine result
        er = analysis["engine_result"]
        assert er is not None
        assert er["plan"]["solver_type"] in ("ortools_cpsat", "greedy_fallback")
        assert er["plan"]["solver_status"] in ("optimal", "feasible", "infeasible", "fallback")

        # 4. Verify plan is pending
        r = client.get(f"/api/plans/{plan_id}")
        assert r.status_code == 200
        assert r.json()["status"] == "pending"

        # 5. Simulate blocked before approval
        r = client.post(f"/api/plans/{plan_id}/simulate")
        assert r.status_code == 409

        # 6. Approve
        r = client.post(f"/api/plans/{plan_id}/approve", json={
            "reviewer": "demo_judge", "comment": "Approved for simulation"
        })
        assert r.status_code == 200
        assert r.json()["status"] == "approved"

        # 7. Verify plan status updated
        r = client.get(f"/api/plans/{plan_id}")
        assert r.json()["status"] == "approved"

        # 8. Simulate
        r = client.post(f"/api/plans/{plan_id}/simulate")
        assert r.status_code == 200
        sim = r.json()
        assert sim["status"] == "completed"
        assert "before_state" in sim
        assert "after_state" in sim
        assert "SIMULATION ONLY" in sim["message"]

        # 9. Verify plan is now executed
        r = client.get(f"/api/plans/{plan_id}")
        assert r.json()["status"] == "executed"

        # 10. Verify audit trail
        r = client.get("/api/audit")
        assert r.status_code == 200
        event_types = [e["event_type"] for e in r.json()]
        assert "disruption_created" in event_types
        assert "plan_generated" in event_types
        assert "plan_approved" in event_types
        assert "plan_simulated" in event_types


class TestApprovalEnforcement:
    """Backend-enforced approval state machine."""

    def test_reject_blocks_simulation(self):
        did, analysis = create_and_analyze()
        plan_id = analysis["plan_id"]

        # Reject
        r = client.post(f"/api/plans/{plan_id}/reject", json={
            "reviewer": "demo_judge", "comment": "Too expensive"
        })
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"

        # Simulate should fail
        r = client.post(f"/api/plans/{plan_id}/simulate")
        assert r.status_code == 409

    def test_cannot_approve_rejected_plan(self):
        did, analysis = create_and_analyze()
        plan_id = analysis["plan_id"]

        client.post(f"/api/plans/{plan_id}/reject", json={"reviewer": "test"})

        r = client.post(f"/api/plans/{plan_id}/approve", json={"reviewer": "test"})
        assert r.status_code == 409

    def test_double_approve_is_idempotent(self):
        did, analysis = create_and_analyze()
        plan_id = analysis["plan_id"]

        r1 = client.post(f"/api/plans/{plan_id}/approve", json={"reviewer": "test"})
        assert r1.status_code == 200
        r2 = client.post(f"/api/plans/{plan_id}/approve", json={"reviewer": "test"})
        assert r2.status_code == 200
        assert r2.json()["message"] == "Plan already approved"

    def test_cannot_approve_nonexistent_plan(self):
        r = client.post("/api/plans/nonexistent/approve", json={"reviewer": "t"})
        assert r.status_code == 404

    def test_cannot_simulate_nonexistent_plan(self):
        r = client.post("/api/plans/nonexistent/simulate")
        assert r.status_code == 404

    def test_cannot_simulate_pending_plan(self):
        did, analysis = create_and_analyze()
        plan_id = analysis["plan_id"]
        r = client.post(f"/api/plans/{plan_id}/simulate")
        assert r.status_code == 409

    def test_cannot_approve_executed_plan(self):
        did, analysis = create_and_analyze()
        plan_id = analysis["plan_id"]

        client.post(f"/api/plans/{plan_id}/approve", json={"reviewer": "test"})
        client.post(f"/api/plans/{plan_id}/simulate")

        r = client.post(f"/api/plans/{plan_id}/approve", json={"reviewer": "test"})
        assert r.status_code == 409


class TestDigitalTwinIdempotency:
    """Digital twin execution rules."""

    def test_idempotent_simulation(self):
        did, analysis = create_and_analyze()
        plan_id = analysis["plan_id"]

        client.post(f"/api/plans/{plan_id}/approve", json={"reviewer": "test"})

        r1 = client.post(f"/api/plans/{plan_id}/simulate")
        assert r1.status_code == 200
        sim1 = r1.json()
        assert sim1["status"] == "completed"

        r2 = client.post(f"/api/plans/{plan_id}/simulate")
        assert r2.status_code == 200
        sim2 = r2.json()
        assert sim2["status"] == "already_executed"
        assert sim1["simulation_id"] == sim2["simulation_id"]

    def test_simulation_records_state_changes(self):
        did, analysis = create_and_analyze()
        plan_id = analysis["plan_id"]

        client.post(f"/api/plans/{plan_id}/approve", json={"reviewer": "test"})
        r = client.post(f"/api/plans/{plan_id}/simulate")
        sim = r.json()

        assert "inventory" in sim["before_state"]
        assert "inventory" in sim["after_state"]
        assert "suppliers" in sim["before_state"]
        assert "suppliers" in sim["after_state"]


class TestAllScenarios:
    """Each scenario type produces valid analysis results."""

    @pytest.mark.parametrize("scenario", [
        "supplier_outage", "shipment_delay", "warehouse_outage",
        "demand_spike", "low_inventory",
    ])
    def test_scenario_analysis(self, scenario):
        did, analysis = create_and_analyze(scenario)
        assert analysis["plan_id"] is not None
        assert analysis["engine_result"] is not None
        er = analysis["engine_result"]
        assert er["plan"]["solver_type"] in ("ortools_cpsat", "greedy_fallback")


class TestKPISemantics:
    """KPIs are accurately computed from real engine output."""

    def test_kpis_computed(self):
        did, analysis = create_and_analyze()
        kpis = analysis["engine_result"]["kpis"]
        assert "fulfillment_rate_pct" in kpis
        assert "mttd_days" in kpis
        assert "recovery_cost" in kpis
        assert "on_time_rate_pct" in kpis
        assert "total_demand" in kpis
        assert kpis["total_demand"] > 0

    def test_kpis_stored_in_plan(self):
        did, analysis = create_and_analyze()
        plan_id = analysis["plan_id"]
        r = client.get(f"/api/plans/{plan_id}")
        plan = r.json()
        assert plan["kpis"] is not None
        assert "fulfillment_rate_pct" in plan["kpis"]

    def test_solver_type_accurately_reported(self):
        did, analysis = create_and_analyze()
        plan_id = analysis["plan_id"]
        r = client.get(f"/api/plans/{plan_id}")
        plan = r.json()
        assert plan["solver_type"] in ("ortools_cpsat", "greedy_fallback")
        assert plan["solver_status"] in ("optimal", "feasible", "infeasible", "fallback")


class TestReferenceDataAPIs:
    """Reference data endpoints return seeded records."""

    def test_suppliers(self):
        r = client.get("/api/suppliers")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 3
        ids = [s["id"] for s in data]
        assert "SUP-ALPHA" in ids

    def test_inventory(self):
        r = client.get("/api/inventory")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 2
        assert all("usable_qty" in inv for inv in data)

    def test_warehouses(self):
        r = client.get("/api/warehouses")
        assert r.status_code == 200
        data = r.json()
        assert any(w["id"] == "WH-EAST" for w in data)

    def test_health(self):
        r = client.get("/api/health")
        assert r.status_code == 200
        h = r.json()
        assert h["status"] == "ok"
        assert "supplier_outage" in h["scenarios_available"]

    def test_summary(self):
        r = client.get("/api/summary")
        assert r.status_code == 200
        s = r.json()
        assert "disruption_count" in s
        assert "data_disclaimer" in s


class TestDisruptionAPIs:
    """Disruption CRUD endpoints."""

    def test_create_and_get(self):
        r = client.post("/api/disruptions", json={"type": "demand_spike"})
        assert r.status_code == 201
        d = r.json()
        assert d["type"] == "demand_spike"
        assert d["status"] == "detected"

        r2 = client.get(f"/api/disruptions/{d['id']}")
        assert r2.status_code == 200
        assert r2.json()["id"] == d["id"]

    def test_invalid_type_rejected(self):
        r = client.post("/api/disruptions", json={"type": "invalid_type"})
        assert r.status_code == 400

    def test_list_disruptions(self):
        client.post("/api/disruptions", json={"type": "supplier_outage"})
        r = client.get("/api/disruptions")
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_missing_disruption_404(self):
        r = client.get("/api/disruptions/nonexistent")
        assert r.status_code == 404


class TestAuditTrail:
    """Audit events are created for all key operations."""

    def test_seed_creates_audit(self):
        r = client.get("/api/audit")
        assert r.status_code == 200
        events = r.json()
        types = [e["event_type"] for e in events]
        assert "database_seeded" in types

    def test_full_lifecycle_audit_chain(self):
        did, analysis = create_and_analyze()
        plan_id = analysis["plan_id"]

        client.post(f"/api/plans/{plan_id}/approve", json={"reviewer": "test"})
        client.post(f"/api/plans/{plan_id}/simulate")

        r = client.get("/api/audit")
        events = r.json()
        types = [e["event_type"] for e in events]

        # Every audit event should have a non-None entity_id
        for e in events:
            assert e["entity_id"] is not None, f"Audit event {e['event_type']} has None entity_id"

        assert "disruption_created" in types
        assert "plan_generated" in types
        assert "plan_approved" in types
        assert "plan_simulated" in types


class TestSimulationAPIs:
    """Simulation list and detail endpoints."""

    def test_list_simulations_empty(self):
        r = client.get("/api/simulations")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_simulation_after_execute(self):
        did, analysis = create_and_analyze()
        plan_id = analysis["plan_id"]

        client.post(f"/api/plans/{plan_id}/approve", json={"reviewer": "test"})
        sim_r = client.post(f"/api/plans/{plan_id}/simulate")
        sim_id = sim_r.json()["simulation_id"]

        r = client.get(f"/api/simulations/{sim_id}")
        assert r.status_code == 200
        assert r.json()["plan_id"] == plan_id

    def test_get_nonexistent_simulation(self):
        r = client.get("/api/simulations/nonexistent")
        assert r.status_code == 404
