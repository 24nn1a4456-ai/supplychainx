"""
test_api.py — API and lifecycle integration tests.

Tests the full workflow: seed → disruption → analyze → plan → approve → simulate.
Uses FastAPI TestClient (no actual server needed).
"""
from __future__ import annotations

import json
import pytest
from fastapi.testclient import TestClient

from backend.api import app
from backend.database import reset_db


@pytest.fixture(autouse=True)
def clean_db():
    """Reset database before each test for isolation."""
    reset_db()
    from backend.seed import init_and_seed
    init_and_seed()
    yield
    reset_db()


client = TestClient(app)


# ─────────────────────── Health & Summary ──────────────────────────

class TestSystemEndpoints:
    def test_health(self):
        r = client.get("/api/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert "supplier_outage" in data["scenarios_available"]

    def test_summary(self):
        r = client.get("/api/summary")
        assert r.status_code == 200
        data = r.json()
        assert "disruption_count" in data
        assert "data_disclaimer" in data


# ─────────────────────── Reference Data ───────────────────────────

class TestReferenceData:
    def test_list_suppliers(self):
        r = client.get("/api/suppliers")
        assert r.status_code == 200
        suppliers = r.json()
        assert len(suppliers) >= 3
        assert any(s["id"] == "SUP-ALPHA" for s in suppliers)

    def test_list_inventory(self):
        r = client.get("/api/inventory")
        assert r.status_code == 200
        inv = r.json()
        assert len(inv) >= 2

    def test_list_warehouses(self):
        r = client.get("/api/warehouses")
        assert r.status_code == 200
        whs = r.json()
        assert any(w["id"] == "WH-EAST" for w in whs)


# ─────────────────────── Disruptions ──────────────────────────────

class TestDisruptions:
    def test_create_disruption(self):
        r = client.post("/api/disruptions", json={
            "type": "supplier_outage",
            "description": "Test outage",
            "severity": "CRITICAL",
        })
        assert r.status_code == 201
        data = r.json()
        assert data["type"] == "supplier_outage"
        assert data["status"] == "detected"
        assert data["is_synthetic"] is True

    def test_create_invalid_type(self):
        r = client.post("/api/disruptions", json={"type": "unknown_type"})
        assert r.status_code == 400

    def test_list_disruptions(self):
        client.post("/api/disruptions", json={"type": "supplier_outage"})
        r = client.get("/api/disruptions")
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_get_disruption(self):
        r = client.post("/api/disruptions", json={"type": "supplier_outage"})
        did = r.json()["id"]
        r2 = client.get(f"/api/disruptions/{did}")
        assert r2.status_code == 200
        assert r2.json()["id"] == did

    def test_get_missing_disruption(self):
        r = client.get("/api/disruptions/nonexistent")
        assert r.status_code == 404


# ─────────────────────── Full Lifecycle ───────────────────────────

class TestFullLifecycle:
    """
    Complete vertical slice:
    create disruption → analyze → get plan → approve → simulate → verify
    """

    def _create_and_analyze(self):
        """Helper: create a disruption and analyze it."""
        r = client.post("/api/disruptions", json={
            "type": "supplier_outage",
            "description": "Primary PCB supplier down",
            "severity": "CRITICAL",
            "affected_supplier_id": "SUP-ALPHA",
            "affected_material": "COMP-PCB-01",
        })
        assert r.status_code == 201
        did = r.json()["id"]

        r = client.post(f"/api/disruptions/{did}/analyze")
        assert r.status_code == 200
        analysis = r.json()
        return did, analysis

    def test_analyze_produces_plan(self):
        did, analysis = self._create_and_analyze()
        assert analysis["agents_summary"]["total"] == 3
        assert analysis["agents_summary"]["succeeded"] >= 1
        assert analysis["plan_id"] is not None
        assert analysis["plan_status"] == "pending"
        # Verify engine was really called
        assert analysis["engine_result"] is not None
        assert analysis["engine_result"]["plan"]["solver_type"] in ("ortools_cpsat", "greedy_fallback")

    def test_agents_run_correctly(self):
        did, analysis = self._create_and_analyze()
        agents = analysis["agents"]
        assert "SupplierAgent" in agents
        assert "InventoryAgent" in agents
        assert "LogisticsAgent" in agents
        # Check supplier agent found alternatives
        sa = agents["SupplierAgent"]
        assert sa["status"] == "success"
        assert len(sa["findings"]["alternative_suppliers"]) >= 1

    def test_plan_starts_pending(self):
        did, analysis = self._create_and_analyze()
        plan_id = analysis["plan_id"]
        r = client.get(f"/api/plans/{plan_id}")
        assert r.status_code == 200
        assert r.json()["status"] == "pending"

    def test_simulate_blocked_before_approval(self):
        did, analysis = self._create_and_analyze()
        plan_id = analysis["plan_id"]
        r = client.post(f"/api/plans/{plan_id}/simulate")
        assert r.status_code == 409  # Must be approved first

    def test_approve_and_simulate(self):
        did, analysis = self._create_and_analyze()
        plan_id = analysis["plan_id"]

        # Approve
        r = client.post(f"/api/plans/{plan_id}/approve", json={
            "reviewer": "demo_judge", "comment": "Looks good"
        })
        assert r.status_code == 200
        assert r.json()["status"] == "approved"

        # Simulate
        r = client.post(f"/api/plans/{plan_id}/simulate")
        assert r.status_code == 200
        sim = r.json()
        assert sim["status"] == "completed"
        assert "before_state" in sim
        assert "after_state" in sim
        assert "SIMULATION ONLY" in sim["message"]

    def test_reject_blocks_simulation(self):
        did, analysis = self._create_and_analyze()
        plan_id = analysis["plan_id"]

        # Reject
        r = client.post(f"/api/plans/{plan_id}/reject", json={
            "reviewer": "demo_judge", "comment": "Too expensive"
        })
        assert r.status_code == 200

        # Simulate should fail
        r = client.post(f"/api/plans/{plan_id}/simulate")
        assert r.status_code == 409

    def test_idempotent_simulation(self):
        did, analysis = self._create_and_analyze()
        plan_id = analysis["plan_id"]

        # Approve
        client.post(f"/api/plans/{plan_id}/approve", json={"reviewer": "test"})

        # Simulate twice
        r1 = client.post(f"/api/plans/{plan_id}/simulate")
        assert r1.status_code == 200
        r2 = client.post(f"/api/plans/{plan_id}/simulate")
        assert r2.status_code == 200
        assert r2.json()["status"] == "already_executed"
        assert r1.json()["simulation_id"] == r2.json()["simulation_id"]

    def test_solver_type_accurately_reported(self):
        did, analysis = self._create_and_analyze()
        plan_id = analysis["plan_id"]
        r = client.get(f"/api/plans/{plan_id}")
        plan = r.json()
        # Must be real solver type, never blank
        assert plan["solver_type"] in ("ortools_cpsat", "greedy_fallback")
        assert plan["solver_status"] in ("optimal", "feasible", "infeasible", "fallback")

    def test_kpis_computed_from_real_engine(self):
        did, analysis = self._create_and_analyze()
        kpis = analysis["engine_result"]["kpis"]
        assert "fulfillment_rate_pct" in kpis
        assert "mean_arrival_day" in kpis
        assert "mttd_days" in kpis
        assert "is_auto_resolved" in kpis
        # Must be from actual engine, not hardcoded
        assert kpis["total_demand"] > 0

    def test_audit_trail_created(self):
        did, analysis = self._create_and_analyze()
        plan_id = analysis["plan_id"]

        # Approve
        client.post(f"/api/plans/{plan_id}/approve", json={"reviewer": "test"})

        # Simulate
        client.post(f"/api/plans/{plan_id}/simulate")

        # Check audit trail
        r = client.get("/api/audit")
        assert r.status_code == 200
        events = r.json()
        event_types = [e["event_type"] for e in events]
        assert "disruption_created" in event_types
        assert "plan_generated" in event_types
        assert "plan_approved" in event_types
        assert "plan_simulated" in event_types


# ─────────────────────── Edge Cases ───────────────────────────────

class TestEdgeCases:
    def test_approve_nonexistent_plan(self):
        r = client.post("/api/plans/nonexistent/approve", json={"reviewer": "test"})
        assert r.status_code == 404

    def test_simulate_nonexistent_plan(self):
        r = client.post("/api/plans/nonexistent/simulate")
        assert r.status_code == 404

    def test_double_approve(self):
        """Approving an already-approved plan returns 200 (idempotent)."""
        r = client.post("/api/disruptions", json={"type": "demand_spike"})
        did = r.json()["id"]
        r = client.post(f"/api/disruptions/{did}/analyze")
        plan_id = r.json()["plan_id"]

        client.post(f"/api/plans/{plan_id}/approve", json={"reviewer": "test"})
        r2 = client.post(f"/api/plans/{plan_id}/approve", json={"reviewer": "test"})
        assert r2.status_code == 200
        assert r2.json()["message"] == "Plan already approved"
