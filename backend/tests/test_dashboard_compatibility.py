from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_dashboard_state_contract():
    res = client.get("/api/state")
    assert res.status_code == 200
    data = res.json()
    assert "suppliers" in data
    assert "warehouses" in data
    assert "inventory" in data
    assert "customerOrders" in data
    assert "productionLines" in data
    assert "shipments" in data
    assert "crises" in data
    assert "recoveryPlans" in data
    assert "auditLogs" in data


def test_demo_trigger_and_reset():
    # 1. Trigger Demo
    res = client.post("/api/demo/trigger")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "incident" in data
    assert data["state"]["suppliers"][0]["operationalStatus"] == "disrupted"

    # 2. Reset Demo
    res_reset = client.post("/api/demo/reset")
    assert res_reset.status_code == 200
    reset_data = res_reset.json()
    assert reset_data["success"] is True
    assert "state" in reset_data


def test_crises_detection_and_orchestration():
    # Detect
    res_detect = client.post("/api/crises/detect")
    assert res_detect.status_code == 200
    assert "activeCrisesCount" in res_detect.json()

    # Orchestrate
    res_state = client.get("/api/state")
    crisis_id = res_state.json()["crises"][0]["id"]
    res_orch = client.post(f"/api/crises/{crisis_id}/orchestrate")
    assert res_orch.status_code == 200
    orch_data = res_orch.json()
    assert orch_data["success"] is True
    assert "plan" in orch_data
    assert orch_data["plan"]["approvalStatus"] == "pending"


def test_approval_rbac_and_decision_gates():
    # Get plan id
    state = client.get("/api/state").json()
    plan_id = state["recoveryPlans"][0]["id"]

    # 1. Reject by non-authorized role -> 403
    res_forbidden = client.post("/api/approval", json={
        "planId": plan_id,
        "decision": "approved",
        "managerRole": "Supply Chain Analyst"
    })
    assert res_forbidden.status_code == 403

    # 2. Invalid decision -> 400
    res_invalid = client.post("/api/approval", json={
        "planId": plan_id,
        "decision": "invalid_decision",
        "managerRole": "Operations Director"
    })
    assert res_invalid.status_code == 400

    # 3. Valid approval -> 200
    res_ok = client.post("/api/approval", json={
        "planId": plan_id,
        "decision": "approved",
        "managerRole": "Operations Director"
    })
    assert res_ok.status_code == 200
    assert res_ok.json()["plan"]["approvalStatus"] == "approved"


def test_execution_security_gate():
    state = client.get("/api/state").json()
    plan_id = state["recoveryPlans"][0]["id"]

    # 1. Unauthorized role -> 403
    res_role_fail = client.post("/api/execute", json={
        "planId": plan_id,
        "managerRole": "Warehouse Associate"
    })
    assert res_role_fail.status_code == 403

    # 2. Authorized execution -> 200
    res_exec = client.post("/api/execute", json={
        "planId": plan_id,
        "managerRole": "Operations Director"
    })
    assert res_exec.status_code == 200
    exec_data = res_exec.json()
    assert exec_data["success"] is True
    assert exec_data["verification"]["outcome"] == "Resolved"


def test_suppliers_crud_and_csv_import():
    # Create
    res_create = client.post("/api/suppliers", json={
        "code": "TEST-SUP",
        "name": "Test Supplier Fab",
        "dailyCapacity": 1000,
        "costPerUnit": 50,
        "reliabilityScore": 95
    })
    assert res_create.status_code == 201
    sup_id = res_create.json()["id"]

    # Update
    res_update = client.put(f"/api/suppliers/{sup_id}", json={"dailyCapacity": 1500})
    assert res_update.status_code == 200
    assert res_update.json()["dailyCapacity"] == 1500

    # Delete
    res_delete = client.delete(f"/api/suppliers/{sup_id}")
    assert res_delete.status_code == 200

    # CSV Import with injection test
    res_csv = client.post("/api/suppliers/import-csv", json={
        "rows": [
            {
                "code": "=MALICIOUS-FORMULA",
                "name": "Injected Corp",
                "dailyCapacity": 2000,
                "costPerUnit": 45,
                "reliabilityScore": 98
            }
        ]
    })
    assert res_csv.status_code == 200
    assert res_csv.json()["importedCount"] == 1

    # Check neutralization in state
    state = client.get("/api/state").json()
    injected_sup = next(s for s in state["suppliers"] if "Injected Corp" in s["name"])
    assert injected_sup["code"].startswith("'=")  # neutralized quote prepended


def test_predictions_simulation_and_gemini_chat():
    # Predictions
    res_pred = client.get("/api/predictions")
    assert res_pred.status_code == 200
    assert "earlyWarningAlerts" in res_pred.json()

    # What-If
    res_whatif = client.post("/api/simulation/what-if", json={"outageDays": 7, "assemblyLineThrottleRate": 0.8})
    assert res_whatif.status_code == 200
    assert "cascadeTrace" in res_whatif.json()

    # Prevention
    res_prev = client.post("/api/predictions/prevent", json={
        "alertId": "alert-test-1",
        "actionType": "preemptive_inter_warehouse_transfer"
    })
    assert res_prev.status_code == 200

    # Gemini Chat
    res_chat = client.post("/api/gemini/chat", json={"question": "What is the status of our MCU inventory?"})
    assert res_chat.status_code == 200
    assert "answer" in res_chat.json()
