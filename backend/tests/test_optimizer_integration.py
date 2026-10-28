"""
test_optimizer_integration.py — Integration test suite for CP-SAT Recovery Optimizer in Main Backend.

Covers all 12 Stage 4 test requirements:
1. Adapter maps supplier and inventory data correctly.
2. CP-SAT is invoked when available.
3. Solver metadata accurately reports CP-SAT versus fallback.
4. CP-SAT failure triggers a safe, observable fallback.
5. Infeasible and partial-fulfillment cases are handled correctly.
6. Supplier capacity, stock limits, and budget constraints are respected.
7. Weather and production agent outputs remain present in the synthesized playbook.
8. The final plan cost agrees with the actions and optimizer allocations.
9. API plan generation remains compatible with the frontend schema.
10. Execution before approval returns HTTP 403.
11. Approved simulated execution persists changes and verification evidence.
12. Demo reset restores the expected initial state.
"""

from __future__ import annotations

import math
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.agent_orchestrator import orchestrator
from app.services.agents.optimizer_adapter import CPSATRecoveryOptimizerClient
from app.services.agents.schemas import (
    InventoryOption,
    SupplierOption,
    ActionType,
)

client = TestClient(app)


# ---------------------------------------------------------------------------
# Test 1 & 2: Adapter data mapping and CP-SAT invocation
# ---------------------------------------------------------------------------
def test_adapter_maps_data_and_invokes_cpsat():
    opt_client = CPSATRecoveryOptimizerClient()
    sup = SupplierOption(
        option_id="SUP-TEST-01",
        supplier_id="node-sup-3",
        supplier_name="Tokyo Precision Optics (Fab 2)",
        product_id="SKU-NEURAL-A1",
        available_capacity=650,
        unit_price=420.0,
        quoted_lead_time_days=3,
        reliability_score=0.98,
        contract_status="SECONDARY_APPROVED",
        minimum_order_quantity=100,
    )
    inv = InventoryOption(
        option_id="INV-TEST-01",
        warehouse_id="node-wh-2",
        warehouse_location="Singapore Tuas Mega Port",
        product_id="SKU-NEURAL-A1",
        available_stock=1000,
        reserved_safety_stock=200,
        reallocatable_units=800,
        transfer_cost_per_unit=1.5,
        transfer_lead_time_days=2,
    )

    res = opt_client.solve_recovery_plan(
        crisis_id="CR-TEST",
        demands={"SKU-NEURAL-A1": 1450},
        supplier_options=[sup],
        inventory_options=[inv],
        logistics_options=[],
        target_recovery_days=14,
    )

    assert res["solver_type"] == "ortools_cpsat"
    assert res["solver_status"] in ["optimal", "feasible"]
    assert res["fulfilled_quantities"]["SKU-NEURAL-A1"] == 1450
    assert len(res["recommended_actions"]) == 2


# ---------------------------------------------------------------------------
# Test 3 & 4: Metadata reporting & observable fallback when CP-SAT fails
# ---------------------------------------------------------------------------
def test_fallback_behavior_and_metadata_transparency(monkeypatch):
    """When CP-SAT fails or OR-Tools is simulated as missing, fallback must be observable."""
    # Access the submodule optimizer directly from sys.modules
    import sys
    from app.services.agents import optimizer_adapter

    opt_mod = optimizer_adapter._get_optimizer_module()
    # The actual _ORTOOLS_AVAILABLE flag lives in the optimizer submodule
    inner_opt = sys.modules.get("agent_ml_optimizer.optimizer")
    if inner_opt is not None:
        monkeypatch.setattr(inner_opt, "_ORTOOLS_AVAILABLE", False)
    if hasattr(opt_mod, "_ORTOOLS_AVAILABLE"):
        monkeypatch.setattr(opt_mod, "_ORTOOLS_AVAILABLE", False)

    opt_client = CPSATRecoveryOptimizerClient()
    sup = SupplierOption(
        option_id="SUP-TEST-02",
        supplier_id="node-sup-3",
        supplier_name="Tokyo Precision Optics (Fab 2)",
        product_id="SKU-NEURAL-A1",
        available_capacity=500,
        unit_price=420.0,
        quoted_lead_time_days=3,
        reliability_score=0.98,
        contract_status="SECONDARY_APPROVED",
        minimum_order_quantity=100,
    )

    res = opt_client.solve_recovery_plan(
        crisis_id="CR-FALLBACK",
        demands={"SKU-NEURAL-A1": 500},
        supplier_options=[sup],
        inventory_options=[],
        logistics_options=[],
        target_recovery_days=14,
    )

    assert res["solver_type"] == "greedy_fallback"
    assert res["solver_status"] in ["feasible", "fallback"]
    assert res["fulfilled_quantities"]["SKU-NEURAL-A1"] == 500


# ---------------------------------------------------------------------------
# Test 5 & 6: Infeasible / partial cases & capacity / safety stock constraints
# ---------------------------------------------------------------------------
def test_capacity_and_safety_stock_limits_respected():
    opt_client = CPSATRecoveryOptimizerClient()
    # Warehouse: 500 available, 400 safety stock -> only 100 usable
    inv = InventoryOption(
        option_id="INV-TEST-02",
        warehouse_id="WH-LIMIT",
        warehouse_location="Rotterdam",
        product_id="SKU-MCU-328P",
        available_stock=500,
        reserved_safety_stock=400,
        reallocatable_units=100,
        transfer_cost_per_unit=2.0,
        transfer_lead_time_days=1,
    )
    # Supplier: only 150 capacity
    sup = SupplierOption(
        option_id="SUP-LIMIT",
        supplier_id="SUP-VEND-1",
        supplier_name="Limited Supplier",
        product_id="SKU-MCU-328P",
        available_capacity=150,
        unit_price=10.0,
        quoted_lead_time_days=2,
        reliability_score=0.9,
        contract_status="ACTIVE",
        minimum_order_quantity=10,
    )

    # Demand: 500 (greater than total 250 available)
    res = opt_client.solve_recovery_plan(
        crisis_id="CR-SHORTAGE",
        demands={"SKU-MCU-328P": 500},
        supplier_options=[sup],
        inventory_options=[inv],
        logistics_options=[],
        target_recovery_days=5,
    )

    # Partial allocation should be exactly 250 (100 from WH + 150 from SUP)
    assert res["fulfilled_quantities"]["SKU-MCU-328P"] == 250
    assert res["unmet_demand"] == 250
    assert len(res["violated_constraints"]) > 0

    # Verify individual actions respected limits
    wh_actions = [a for a in res["recommended_actions"] if a["action_type"] == ActionType.INVENTORY_BUFFER_RELEASE]
    sup_actions = [a for a in res["recommended_actions"] if a["action_type"] == ActionType.SUPPLIER_REALLOCATION]
    assert sum(a["required_quantity"] for a in wh_actions) <= 100
    assert sum(a["required_quantity"] for a in sup_actions) <= 150


# ---------------------------------------------------------------------------
# Test 7 & 8: Weather & production agents preserved in synthesized playbook
# ---------------------------------------------------------------------------
def test_multi_agent_playbook_synthesis_and_cost_consistency():
    res = orchestrator.solve_multi_constraint_recovery(
        crisis_id="CR-SYNTH-001",
        required_quantity=1450,
        target_lead_time_days=14,
    )

    plan = res["plan"]
    actions = plan["detailedActions"]

    # 5 actions in recovery playbook
    assert len(actions) == 5

    # Check presence of all agent contributions:
    action_types = [a["actionType"] for a in actions]
    assert "Order Diversion" in action_types  # Procurement & Supplier Agent
    assert "Air Charter" in action_types      # Logistics & Weather Agent
    assert "Line Throttle" in action_types    # Production Agent
    assert "Client Notice" in action_types    # Customer Success Agent

    # Weather fields present in plan
    assert plan["weatherRiskScore"] is not None
    assert plan["weatherRiskLevel"] in ["low", "moderate", "high", "critical", "LOW", "MODERATE", "HIGH", "CRITICAL"]
    assert len(plan["evaluatedTransportOptions"]) > 0

    # Production Agent evaluation preserved
    assert res["production_evaluation"] is not None
    assert len(res["production_evaluation"].line_adjustments) > 0

    # Cost agreement: Plan's estimatedTotalCostUSD agrees with sum of actions
    action_cost_sum = 0.0
    for a in actions:
        clean_cost = float(a["costUSD"].replace("$", "").replace(",", ""))
        action_cost_sum += clean_cost

    plan_cost_num = float(plan["estimatedTotalCostUSD"].replace("$", "").replace(",", ""))
    assert math.isclose(plan_cost_num, action_cost_sum, rel_tol=1e-3)
    assert math.isclose(res["total_cost"], action_cost_sum, rel_tol=1e-3)

    # Solver identification
    assert res["solver_type"] == "ortools_cpsat"
    assert res["solver_status"] == "FEASIBLE_OPTIMAL"


# ---------------------------------------------------------------------------
# Test 9, 10, 11, 12: End-to-end API workflow, security gate, and state persistence
# ---------------------------------------------------------------------------
def test_end_to_end_api_lifecycle():
    # 1. Reset (Test 12: clean initial state)
    reset_res = client.post("/api/demo/reset")
    assert reset_res.status_code == 200
    init_state = reset_res.json()["simulation_state"]
    assert init_state["stage"] == "idle"

    # 2. Start outage
    start_res = client.post("/api/crisis/outage/start", json={"supplierId": "node-sup-1"})
    assert start_res.status_code == 200
    assert start_res.json()["stage"] == "detected"

    # 3. Assess impact
    assess_res = client.post("/api/crisis/outage/assess")
    assert assess_res.status_code == 200
    assert assess_res.json()["stage"] == "assessing"

    # 4. Plan recovery (Test 9: API plan generation compatible with schema)
    plan_res = client.post("/api/crisis/outage/plan")
    assert plan_res.status_code == 200
    state = plan_res.json()
    assert state["stage"] == "awaiting_approval"
    proposed_plan = state["proposedPlan"]
    assert proposed_plan is not None
    assert proposed_plan["planId"].startswith("PLAN-AGENTIC-")
    assert len(proposed_plan["detailedActions"]) == 5

    # Check solver info in audit event
    audit_events = state["auditTrail"]
    planning_events = [e for e in audit_events if e["stage"] == "planning"]
    assert len(planning_events) > 0
    assert "ortools_cpsat" in planning_events[-1]["details"].lower() or "solver" in planning_events[-1]["details"].lower()

    # 5. Test 10: Security Gate — Execution before approval MUST be HTTP 403 Forbidden
    blocked_res = client.post("/api/crisis/outage/execute")
    assert blocked_res.status_code == 403
    assert "SECURITY_GATEWAY" in blocked_res.json()["detail"]

    # 6. Approve plan
    approve_res = client.post("/api/crisis/outage/approve")
    assert approve_res.status_code == 200
    assert approve_res.json()["stage"] == "approved"

    # 7. Test 11: Approved simulated execution persists changes and verification evidence
    exec_res = client.post("/api/crisis/outage/execute")
    assert exec_res.status_code == 200
    completed_state = exec_res.json()
    assert completed_state["stage"] == "completed"
    assert completed_state["verificationOutcome"] == "Resolved"
    assert completed_state["verificationEvidence"] is not None
    assert completed_state["verificationEvidence"]["recovery_objectives_met"] is True
    assert completed_state["verificationEvidence"]["verified_stock_units"] > 0
    assert completed_state["verificationEvidence"]["disrupted_routes_remaining"] == 0

    # Verify actions marked verified
    for act in completed_state["proposedPlan"]["detailedActions"]:
        assert act["executionStatus"] == "verified"

    # 8. Test 12: Demo reset restores idle state
    reset_final = client.post("/api/demo/reset")
    assert reset_final.status_code == 200
    assert reset_final.json()["simulation_state"]["stage"] == "idle"
