import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["simulation_mode"] is True


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"
    assert data["simulation_only"] is True


def test_get_nodes():
    response = client.get("/api/network/nodes")
    assert response.status_code == 200
    nodes = response.json()
    assert len(nodes) >= 10
    # Verify field naming aligns with frontend expectations
    first_node = nodes[0]
    assert "id" in first_node
    assert "name" in first_node
    assert "type" in first_node
    assert "position3D" in first_node
    assert "position2D" in first_node


def test_get_suppliers():
    response = client.get("/api/network/suppliers")
    assert response.status_code == 200
    suppliers = response.json()
    assert len(suppliers) >= 3
    for s in suppliers:
        assert s["type"] == "supplier"


def test_get_routes():
    response = client.get("/api/network/routes")
    assert response.status_code == 200
    routes = response.json()
    assert len(routes) >= 8
    first_route = routes[0]
    assert "sourceId" in first_route
    assert "targetId" in first_route
    assert "volumeTEU" in first_route


def test_get_kpis():
    response = client.get("/api/kpis")
    assert response.status_code == 200
    kpis = response.json()
    assert "resiliencyIndex" in kpis
    assert "onTimeDeliveryRate" in kpis
    assert "criticalAlertsCount" in kpis


def test_get_inventory():
    response = client.get("/api/inventory")
    assert response.status_code == 200
    items = response.json()
    assert len(items) >= 3
    assert "hubId" in items[0]
    assert "topSKUs" in items[0]


def test_get_orders():
    response = client.get("/api/orders")
    assert response.status_code == 200
    orders = response.json()
    assert len(orders) >= 3
    assert "orderId" in orders[0]
    assert "riskTier" in orders[0]


def test_get_audit():
    response = client.get("/api/crisis/audit")
    assert response.status_code == 200
    events = response.json()
    assert len(events) >= 1
    assert "actor" in events[0]
    assert "status" in events[0]


# =========================================================================
# CRISIS WORKFLOW END-TO-END TESTS (REQUIREMENT 12)
# =========================================================================

def test_crisis_workflow_full_flow():
    # 1. Reset first to ensure clean state
    reset_res = client.post("/api/demo/reset")
    assert reset_res.status_code == 200
    state = reset_res.json()["simulation_state"]
    assert state["stage"] == "idle"

    # 2. Start Outage (idle -> detected)
    start_res = client.post("/api/crisis/outage/start", json={"supplierId": "node-sup-1"})
    assert start_res.status_code == 200
    state = start_res.json()
    assert state["stage"] == "detected"
    assert state["detectionSeverity"] == "CRITICAL"

    # 3. Assess Outage (detected -> assessing)
    assess_res = client.post("/api/crisis/outage/assess")
    assert assess_res.status_code == 200
    state = assess_res.json()
    assert state["stage"] == "assessing"
    assert len(state["affectedInventory"]) >= 3
    assert len(state["affectedProduction"]) >= 2
    assert len(state["affectedOrders"]) >= 2

    # 4. Plan Recovery (assessing -> awaiting_approval)
    plan_res = client.post("/api/crisis/outage/plan")
    assert plan_res.status_code == 200
    state = plan_res.json()
    assert state["stage"] == "awaiting_approval"
    assert state["proposedPlan"] is not None
    assert len(state["proposedPlan"]["detailedActions"]) == 5
    assert len(state["alternativeSuppliers"]) >= 3
    assert len(state["warehouseStockOptions"]) >= 2

    # 5. Security Gate Enforcement: Try executing BEFORE approval (MUST BE 403 FORBIDDEN)
    unapproved_exec = client.post("/api/crisis/outage/execute")
    assert unapproved_exec.status_code == 403
    assert "SECURITY_GATEWAY" in unapproved_exec.json()["detail"]

    # 6. Approve Plan (awaiting_approval -> approved)
    approve_res = client.post("/api/crisis/outage/approve")
    assert approve_res.status_code == 200
    state = approve_res.json()
    assert state["stage"] == "approved"

    # 7. Execute Plan (approved -> completed)
    exec_res = client.post("/api/crisis/outage/execute")
    assert exec_res.status_code == 200
    state = exec_res.json()
    assert state["stage"] == "completed"
    assert state["detectionSeverity"] == "NONE"
    for action in state["proposedPlan"]["detailedActions"]:
        assert action["executionStatus"] == "verified"

    # 8. Duplicate Execution Prevention (completed -> cannot re-execute without approved stage)
    dup_exec = client.post("/api/crisis/outage/execute")
    assert dup_exec.status_code == 403


def test_crisis_rejection_flow():
    # 1. Reset
    client.post("/api/demo/reset")

    # 2. Advance to awaiting_approval
    client.post("/api/crisis/outage/start")
    client.post("/api/crisis/outage/assess")
    client.post("/api/crisis/outage/plan")

    # 3. Reject Plan with mandatory reason
    reject_res = client.post("/api/crisis/outage/reject", json={"reason": "Air charter cost exceeds emergency contingency allocation."})
    assert reject_res.status_code == 200
    state = reject_res.json()
    assert state["stage"] == "rejected"
    assert state["rejectionReason"] == "Air charter cost exceeds emergency contingency allocation."

    # 4. Execution is strictly blocked while rejected
    blocked_exec = client.post("/api/crisis/outage/execute")
    assert blocked_exec.status_code == 403

    # 5. Can re-plan from rejected state
    replan_res = client.post("/api/crisis/outage/plan")
    assert replan_res.status_code == 200
    assert replan_res.json()["stage"] == "awaiting_approval"


def test_reopen_or_revisit_plan_in_awaiting_approval_is_idempotent():
    """
    Regression test: Re-calling /api/crisis/outage/plan while already in awaiting_approval
    with an existing proposed plan returns HTTP 200 with the existing plan rather than throwing:
    'Invalid workflow transition: Cannot generate plan from stage awaiting_approval'.
    Execution remains strictly blocked before approval (HTTP 403).
    """
    # 1. Reset
    client.post("/api/demo/reset")

    # 2. Advance to assessing
    client.post("/api/crisis/outage/start")
    client.post("/api/crisis/outage/assess")

    # 3. Generate plan -> transitions to awaiting_approval
    first_plan_res = client.post("/api/crisis/outage/plan")
    assert first_plan_res.status_code == 200
    first_state = first_plan_res.json()
    assert first_state["stage"] == "awaiting_approval"
    assert first_state["proposedPlan"] is not None

    # 4. Re-calling plan endpoint (e.g. user re-clicks or re-opens plan view while awaiting approval)
    second_plan_res = client.post("/api/crisis/outage/plan")
    assert second_plan_res.status_code == 200
    second_state = second_plan_res.json()
    assert second_state["stage"] == "awaiting_approval"
    assert second_state["proposedPlan"]["planId"] == first_state["proposedPlan"]["planId"]
    assert second_state["proposedPlan"]["estimatedTotalCostUSD"] == first_state["proposedPlan"]["estimatedTotalCostUSD"]

    # 5. Security gate verification: Execution still strictly blocked before approval
    unapproved_exec = client.post("/api/crisis/outage/execute")
    assert unapproved_exec.status_code == 403
    assert "SECURITY_GATEWAY" in unapproved_exec.json()["detail"]


def test_invalid_workflow_transitions():
    # Reset to idle
    client.post("/api/demo/reset")

    # Cannot assess or approve from idle
    bad_assess = client.post("/api/crisis/outage/assess")
    assert bad_assess.status_code == 400

    bad_approve = client.post("/api/crisis/outage/approve")
    assert bad_approve.status_code == 400

    # Reject without valid reason payload
    bad_reject = client.post("/api/crisis/outage/reject", json={"reason": ""})
    assert bad_reject.status_code == 422


def test_audit_timeline_records_events():
    client.post("/api/demo/reset")
    client.post("/api/crisis/outage/start")

    audit_res = client.get("/api/crisis/audit")
    assert audit_res.status_code == 200
    events = audit_res.json()
    stages = [e["stage"] for e in events]
    assert "detected" in stages


def test_agent_orchestrator_multi_constraint_solver():
    """Verify specialist agents and multi-constraint solver."""
    from app.services.agent_orchestrator import orchestrator

    # 1. Detection Agent: Confirm anomaly and severity
    detect_res = orchestrator.detect_crisis(supplier_id="node-sup-1", cause="Substation fire")
    assert detect_res["is_confirmed"] is True
    assert detect_res["severity"] in ["CRITICAL", "HIGH"]

    # 2. Impact Assessment Agent: Verify deterministic burn rate and stockout calculation
    impact_res = orchestrator.assess_impact()
    assert impact_res["days_to_stockout"] > 0
    assert impact_res["daily_burn_rate"] > 0
    assert len(impact_res["lines_affected"]) > 0

    # 3. Multi-Constraint Recovery Solver: Sourcing, Inventory, Logistics
    solver_res = orchestrator.solve_multi_constraint_recovery(
        crisis_id="CR-TEST-001",
        required_quantity=1450,
        target_lead_time_days=14
    )
    assert solver_res["solver_status"] == "FEASIBLE_OPTIMAL"
    plan = solver_res["plan"]
    assert len(plan["detailedActions"]) == 5
    assert solver_res["total_cost"] > 0
    assert plan["selectedAltSupplier"] != ""

    # 4. Digital Twin Recovery Monitor: Demand coverage and lead time slack
    monitor_res = orchestrator.verify_execution(plan_cost=solver_res["total_cost"])
    assert monitor_res["status"].upper() in ["VERIFIED_FEASIBLE", "PARTIALLY_FEASIBLE"]
    assert monitor_res["demand_coverage_percent"] > 0


def test_weather_disruptions_endpoint():
    """Verify live/fallback weather disruptions endpoint."""
    response = client.get("/api/disruptions/weather")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "source" in data
    assert "totalMonitored" in data
    assert data["totalMonitored"] >= 5
    assert "reports" in data
    assert len(data["reports"]) == data["totalMonitored"]

    first_report = data["reports"][0]
    assert "nodeId" in first_report
    assert "city" in first_report
    assert "tempCelsius" in first_report
    assert "condition" in first_report
    assert "riskLevel" in first_report
    assert first_report["riskLevel"] in ["low", "moderate", "high", "severe"]


# =========================================================================
# WEATHER-INFORMED LOGISTICS RECOVERY TESTS (REQUIREMENTS 2, 3, 4, 5, 9)
# =========================================================================

def test_logistics_normal_weather_evaluation():
    """Requirement 9: Test logistics recovery under verified normal weather."""
    from app.services.agent_orchestrator import orchestrator

    normal_fixtures = {
        "LOG-OPT-AIR-01": {
            "origin_condition": "Clear",
            "destination_condition": "Clear",
            "origin_temp": 24.0,
            "destination_temp": 22.0,
            "origin_wind": 3.0,
            "destination_wind": 3.5,
            "is_forecast_used": True,
            "data_source": "openweather_forecast",
            "risk_score": 10.0,
            "risk_level": "low",
            "summary": "Singapore to Austin clear sky across 2-day flight window",
            "explanation": "Verified optimal meteorological window for priority air cargo."
        }
    }

    solved = orchestrator.solve_multi_constraint_recovery(
        crisis_id="CR-TEST-NORMAL",
        required_quantity=1450,
        target_lead_time_days=14,
        corridor_weather_fixtures=normal_fixtures
    )

    plan = solved["plan"]
    assert plan["weatherRiskLevel"] == "low"
    assert plan["weatherRiskScore"] <= 25.0
    assert "evaluatedTransportOptions" in plan
    assert len(plan["evaluatedTransportOptions"]) >= 3

    # Fast air option remains recommended when weather is favorable
    recommended = next(opt for opt in plan["evaluatedTransportOptions"] if opt["isRecommended"])
    assert recommended["isFeasible"] is True
    assert recommended["weatherRiskLevel"] == "low"


def test_logistics_severe_weather_alternative_route_selection():
    """Requirement 9: Test that severe weather on air corridor reroutes/selects safe alternative."""
    from app.services.agent_orchestrator import orchestrator

    severe_air_fixtures = {
        "LOG-OPT-AIR-01": {
            "origin_condition": "Typhoon",
            "destination_condition": "Severe Thunderstorm",
            "origin_temp": 28.0,
            "destination_temp": 18.0,
            "origin_wind": 32.0,
            "destination_wind": 26.0,
            "is_forecast_used": True,
            "data_source": "openweather_forecast",
            "risk_score": 92.0,
            "risk_level": "severe",
            "summary": "Typhoon / severe storm groundings across air corridor",
            "explanation": "Severe meteorological hazard: Convective gale and runway closure. Flight operations suspended."
        },
        "LOG-OPT-TRUCK-02": {
            "origin_condition": "Clear",
            "destination_condition": "Clear",
            "origin_temp": 20.0,
            "destination_temp": 21.0,
            "origin_wind": 4.0,
            "destination_wind": 4.2,
            "is_forecast_used": True,
            "data_source": "openweather_forecast",
            "risk_score": 15.0,
            "risk_level": "low",
            "summary": "Inland highway corridor clear",
            "explanation": "Nominal road freight transit conditions."
        }
    }

    solved = orchestrator.solve_multi_constraint_recovery(
        crisis_id="CR-TEST-SEVERE",
        required_quantity=1450,
        target_lead_time_days=14,
        corridor_weather_fixtures=severe_air_fixtures
    )

    plan = solved["plan"]
    options = plan["evaluatedTransportOptions"]

    # The severe air option must be marked inoperable/infeasible
    air_opt = next(opt for opt in options if opt["optionId"] == "LOG-OPT-AIR-01")
    assert air_opt["isFeasible"] is False
    assert air_opt["weatherRiskLevel"] == "severe"

    # Alternative route (FedEx Expedited Ground Fleet) must be selected instead
    recommended = next(opt for opt in options if opt["isRecommended"])
    assert recommended["optionId"] != "LOG-OPT-AIR-01"
    assert recommended["isFeasible"] is True
    assert recommended["weatherRiskLevel"] == "low"
    assert "FedEx" in recommended["carrierName"]


def test_logistics_unavailable_forecast_deterministic_fallback():
    """Requirement 5 & 9: If forecast is unavailable, use existing deterministic logistics behavior without inventing delays."""
    from app.services.agent_orchestrator import orchestrator

    unavailable_fixtures = {
        "LOG-OPT-AIR-01": {
            "origin_condition": "Clear",
            "destination_condition": "Clear",
            "origin_temp": 21.0,
            "destination_temp": 21.0,
            "origin_wind": 3.0,
            "destination_wind": 3.0,
            "is_forecast_used": False,
            "data_source": "deterministic_fallback",
            "risk_score": 15.0,
            "risk_level": "low",
            "summary": "Singapore to Austin (Standard Operating Envelope)",
            "explanation": "Forecast telemetry unavailable. Proceeding with verified TMS baseline."
        }
    }

    solved = orchestrator.solve_multi_constraint_recovery(
        crisis_id="CR-TEST-FALLBACK",
        required_quantity=1450,
        target_lead_time_days=14,
        corridor_weather_fixtures=unavailable_fixtures
    )

    plan = solved["plan"]
    assert plan["weatherDataSource"] == "deterministic_fallback"
    options = plan["evaluatedTransportOptions"]
    air_opt = next(opt for opt in options if opt["optionId"] == "LOG-OPT-AIR-01")
    assert air_opt["isForecastUsed"] is False
    assert air_opt["isFeasible"] is True


def test_crisis_plan_api_returns_weather_intelligence():
    """Verify that POST /api/crisis/outage/plan endpoint exposes weather risk fields to frontend."""
    client.post("/api/demo/reset")
    client.post("/api/crisis/outage/start")
    client.post("/api/crisis/outage/assess")
    plan_res = client.post("/api/crisis/outage/plan")
    assert plan_res.status_code == 200
    state = plan_res.json()
    assert state["proposedPlan"] is not None
    plan = state["proposedPlan"]
    assert "weatherRiskScore" in plan
    assert "weatherRiskLevel" in plan
    assert "weatherExplanation" in plan
    assert "evaluatedTransportOptions" in plan
    assert len(plan["evaluatedTransportOptions"]) >= 3
    first_opt = plan["evaluatedTransportOptions"][0]
    assert "carrierName" in first_opt
    assert "weatherRiskScore" in first_opt
    assert "weatherRiskLevel" in first_opt
    assert "isRecommended" in first_opt


def test_production_agent_evaluation():
    """Requirement 2.C: Verify Production Agent assesses line schedules and computes throttling."""
    from app.services.agents.production_agent import evaluate_production_schedule, ProductionEvaluationInput

    inp = ProductionEvaluationInput(
        crisis_id="CR-TEST-PROD",
        affected_product_ids=["SKU-MCU-328P"],
        available_stock_units=650,
        target_recovery_days=14
    )
    res = evaluate_production_schedule(inp)
    assert res.is_feasible is True
    assert len(res.line_adjustments) >= 1
    assert res.baseline_daily_burn > 0
    assert res.conserved_daily_burn < res.baseline_daily_burn
    assert res.extended_runway_hours >= 12
    assert len(res.critical_orders_protected) >= 1


def test_execution_database_persistence_and_verification():
    """Requirement 2.F & 2.G: Verify real SQLite database updates upon execution and post-execution DB re-query."""
    # Reset to baseline
    reset_res = client.post("/api/demo/reset")
    assert reset_res.status_code == 200

    # Execute workflow to approved stage
    client.post("/api/crisis/outage/start")
    client.post("/api/crisis/outage/assess")
    client.post("/api/crisis/outage/plan")
    approve_res = client.post("/api/crisis/outage/approve")
    assert approve_res.status_code == 200
    assert approve_res.json()["stage"] == "approved"

    # Execute simulation
    exec_res = client.post("/api/crisis/outage/execute")
    assert exec_res.status_code == 200
    exec_data = exec_res.json()

    assert exec_data["stage"] == "completed"
    assert exec_data["verificationOutcome"] in ["Resolved", "Partially Resolved"]
    assert exec_data["verificationEvidence"] is not None
    assert exec_data["verificationEvidence"]["recovery_objectives_met"] is True
    assert exec_data["verificationEvidence"]["disrupted_routes_remaining"] == 0

    # Query DB directly to prove persistence
    inv_res = client.get("/api/inventory")
    assert inv_res.status_code == 200
    inv_data = inv_res.json()
    na_hub = next(h for h in inv_data if h["hubId"] == "hub-na-01")
    # Austin / NA Central buffer stock was replenished by 1,450 units
    assert na_hub["currentStockUnits"] >= 28400 + 1450
    assert na_hub["healthStatus"] == "healthy"


def test_crisis_assessment_consistency():
    """Verify that crisis assessment data is unified and mathematically consistent across backend response and audit records."""
    # 1. Reset
    client.post("/api/demo/reset")

    # 2. Start Outage
    start_res = client.post("/api/crisis/outage/start")
    assert start_res.status_code == 200

    # 3. Assess Outage
    assess_res = client.post("/api/crisis/outage/assess")
    assert assess_res.status_code == 200
    state = assess_res.json()

    # Verify inventory parameters
    inv = state["affectedInventory"][0]
    on_hand = inv["onHandUnits"]
    burn_rate = inv["dailyBurnRate"]
    runway_hours = inv["hoursOfRunwayLeft"]

    assert on_hand == 620
    assert burn_rate == 413
    assert runway_hours == 36
    # Runway in days = on_hand / burn_rate == 620 / 413 = 1.501 => 1.5 days
    runway_days = round(on_hand / burn_rate, 1)
    assert runway_days == 1.5

    # Verify affected orders and financial exposure
    orders = state["affectedOrders"]
    assert len(orders) == 2
    total_val = sum(int(o["contractValueUSD"].replace("$", "").replace(",", "")) for o in orders)
    assert total_val == 2830000

    # Verify audit log consistency
    audit_res = client.get("/api/crisis/audit")
    assert audit_res.status_code == 200
    events = audit_res.json()
    assess_event = next(e for e in events if e.get("actor") == "AGENT_2_IMPACT_ASSESSMENT")
    assert assess_event is not None
    # Details must reflect the 1.5d runway, 413 burn rate, and $2,830,000 exposure
    assert "1.5d" in assess_event["details"]
    assert "413" in assess_event["details"]
    assert "2,830,000" in assess_event["details"]


