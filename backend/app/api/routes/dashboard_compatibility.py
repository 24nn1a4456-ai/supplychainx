import time
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.db.database import get_db
from app.services.dashboard_state_service import (
    get_dashboard_state,
    save_dashboard_state,
    reset_dashboard_state
)
from app.services.dashboard_engine import (
    run_crisis_detection,
    trigger_demo_outage,
    run_orchestration_for_crisis
)
from app.api.routes.weather_service import get_weather_disruptions
from app.services.ml_prediction_service import ml_service
from app.core.csv_security import (
    is_formula_injection,
    validate_and_sanitize_import_field,
    sanitize_cell_for_export,
    export_csv_secure
)

dashboard_router = APIRouter(tags=["Original Dashboard Compatibility"])


# -------------------------------------------------------------
# Pydantic Schemas matching supply-chain-x/src/types.ts
# -------------------------------------------------------------

class ApprovalRequest(BaseModel):
    planId: str
    decision: str
    managerName: Optional[str] = "Operations Director"
    managerRole: Optional[str] = "Operations Director"
    expectedVersion: Optional[int] = None
    comments: Optional[str] = None


class ExecutionRequest(BaseModel):
    planId: str
    managerName: Optional[str] = "Operations Director"
    managerRole: Optional[str] = "Operations Director"


class OptimizerSolveRequest(BaseModel):
    incidentId: Optional[str] = None
    weights: Optional[Dict[str, float]] = None


class PreventRequest(BaseModel):
    alertId: str
    actionType: str
    managerName: Optional[str] = "Operations Director"


class GeminiChatRequest(BaseModel):
    question: str


class CsvImportRequest(BaseModel):
    rows: List[Dict[str, Any]]
    managerRole: Optional[str] = "Supply Chain Analyst"


class DeliveryDelayPredictionRequest(BaseModel):
    lead_time_days: int = Field(..., ge=0, description="Lead time in days")
    supplier_risk_score: float = Field(..., ge=0.0, le=1.0, description="Supplier risk score (0.0 to 1.0)")
    weather_disruption_flag: int = Field(..., ge=0, le=1, description="Weather disruption (0 or 1)")
    port_congestion_flag: int = Field(..., ge=0, le=1, description="Port congestion (0 or 1)")
    transport_cost: float = Field(..., ge=0.0, description="Transport cost per unit")
    supplier_capacity_units: float = Field(..., ge=0.0, description="Daily supplier capacity in units")
    day_of_week: int = Field(..., ge=0, le=6, description="Day of week (0=Mon, 6=Sun)")
    month: int = Field(..., ge=1, le=12, description="Month of year (1-12)")
    region: str = Field(..., min_length=1, description="Operating theater/region")
    supplier_id: str = Field(..., min_length=1, description="Supplier identifier")


class CrisisRiskPredictionRequest(BaseModel):
    inventory_units: float = Field(..., ge=0.0, description="Inventory units on hand")
    supplier_capacity_units: float = Field(..., ge=0.0, description="Supplier daily capacity")
    lead_time_days: int = Field(..., ge=0, description="Lead time in days")
    supplier_risk_score: float = Field(..., ge=0.0, le=1.0, description="Supplier risk score (0.0 to 1.0)")
    weather_disruption_flag: int = Field(..., ge=0, le=1, description="Weather disruption flag (0 or 1)")
    port_congestion_flag: int = Field(..., ge=0, le=1, description="Port congestion flag (0 or 1)")
    transport_cost: float = Field(..., ge=0.0, description="Transport cost per unit")
    day_of_week: int = Field(..., ge=0, le=6, description="Day of week (0-6)")
    month: int = Field(..., ge=1, le=12, description="Month (1-12)")
    promotion_flag: int = Field(..., ge=0, le=1, description="Promotion active (0 or 1)")
    region: str = Field(..., min_length=1, description="Region")
    supplier_id: str = Field(..., min_length=1, description="Supplier identifier")
    product_id: str = Field(..., min_length=1, description="Product SKU identifier")


class DemandForecastPredictionRequest(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6, description="Day of week (0-6)")
    month: int = Field(..., ge=1, le=12, description="Month (1-12)")
    promotion_flag: int = Field(..., ge=0, le=1, description="Promotion active (0 or 1)")
    lead_time_days: int = Field(..., ge=0, description="Lead time in days")
    supplier_risk_score: float = Field(..., ge=0.0, le=1.0, description="Supplier risk score (0.0 to 1.0)")
    transport_cost: float = Field(..., ge=0.0, description="Transport cost per unit")
    region: str = Field(..., min_length=1, description="Region")
    product_id: str = Field(..., min_length=1, description="Product SKU identifier")
    supplier_id: str = Field(..., min_length=1, description="Supplier identifier")


# -------------------------------------------------------------
# Endpoints
# -------------------------------------------------------------

@dashboard_router.get("/state")
def get_state(db: Session = Depends(get_db)):
    """Retrieve full unified DatabaseState matching original dashboard."""
    return get_dashboard_state(db)


@dashboard_router.post("/demo/trigger")
def trigger_demo(db: Session = Depends(get_db)):
    """Launch master demo scenario: NanoSilicon 5-day outage + 2-day coverage."""
    state = get_dashboard_state(db)
    primary_crisis = trigger_demo_outage(state)
    save_dashboard_state(db, state)
    return {"success": True, "incident": primary_crisis, "state": state}


@dashboard_router.post("/demo/reset")
def reset_demo(db: Session = Depends(get_db)):
    """Reset database state to clean baseline seed data."""
    new_state = reset_dashboard_state(db)
    return {"success": True, "state": new_state}


@dashboard_router.post("/crises/detect")
def detect_crises(db: Session = Depends(get_db)):
    """Automated multi-point disruption detection."""
    state = get_dashboard_state(db)
    res = run_crisis_detection(state)
    save_dashboard_state(db, state)
    return res


@dashboard_router.get("/crises")
def list_crises(db: Session = Depends(get_db)):
    """List all tracked crisis incidents."""
    state = get_dashboard_state(db)
    return state.get("crises", [])


@dashboard_router.post("/crises/{crisis_id}/orchestrate")
def orchestrate_crisis(crisis_id: str, db: Session = Depends(get_db)):
    """Run Central AI Orchestrator with mathematical CP-SAT solver."""
    state = get_dashboard_state(db)
    res = run_orchestration_for_crisis(state, crisis_id)
    save_dashboard_state(db, state)
    return res


@dashboard_router.post("/optimizer/solve")
def solve_optimizer(req: OptimizerSolveRequest, db: Session = Depends(get_db)):
    """Direct OR-Tools multi-criteria optimization solver."""
    state = get_dashboard_state(db)
    incident_id = req.incidentId or (state["crises"][0]["id"] if state.get("crises") else "crisis-seed")
    res = run_orchestration_for_crisis(state, incident_id)
    save_dashboard_state(db, state)
    return res


@dashboard_router.post("/approval")
def handle_approval(req: ApprovalRequest, db: Session = Depends(get_db)):
    """
    Human Approval Center:
    Enforces RBAC (Operations Director only) and decision gates.
    """
    role = req.managerRole or "Operations Director"
    if role != "Operations Director":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f'Forbidden: Role "{role}" is not authorized to sign off on recovery plans. Authorization requires Operations Director privileges.'
        )

    if req.decision not in ["approved", "rejected", "changes_requested"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Invalid decision "{req.decision}". Must be approved, rejected, or changes_requested.'
        )

    state = get_dashboard_state(db)
    plan = next((p for p in state.get("recoveryPlans", []) if p.get("id") == req.planId), None)
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    if plan.get("approvalStatus") == "approved" and req.decision == "approved":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Plan has already been approved and cannot be re-approved.")

    now = datetime.now(timezone.utc).isoformat()
    plan["approvalStatus"] = req.decision
    plan["approvedBy"] = req.managerName or "Operations Director"
    plan["approvedAt"] = now
    plan["approvalComments"] = req.comments or ("Approved after multi-criteria review." if req.decision == "approved" else "Rejected by Operations Director.")

    # Update parent incident status
    inc = next((c for c in state.get("crises", []) if c.get("id") == plan.get("incidentId")), None)
    if inc:
        inc["status"] = "approved" if req.decision == "approved" else ("unresolved" if req.decision == "rejected" else "recovery_planned")

    state.setdefault("auditLogs", []).insert(0, {
        "id": f"aud-{int(time.time() * 1000)}",
        "timestamp": now,
        "actor": req.managerName or "Operations Director",
        "role": role,
        "action": f"PLAN_{req.decision.upper()}",
        "category": "approval",
        "details": f"Plan \"{plan.get('title')}\" marked as {req.decision}. Comments: {req.comments or 'None'}"
    })

    save_dashboard_state(db, state)
    return {"success": True, "plan": plan}


@dashboard_router.post("/execute")
def handle_execute(req: ExecutionRequest, db: Session = Depends(get_db)):
    """
    Execution and Verification Engine:
    Guarantees execution requires prior approved plan status.
    Enforces RBAC (Operations Director or Crisis Manager).
    """
    role = req.managerRole or "Operations Director"
    allowed_roles = ["Operations Director", "Crisis Manager"]
    if role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f'Forbidden: Role "{role}" is not authorized to execute operational mutations. Requires Operations Director or Crisis Manager privileges.'
        )

    state = get_dashboard_state(db)
    plan = next((p for p in state.get("recoveryPlans", []) if p.get("id") == req.planId), None)
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Recovery plan {req.planId} not found")

    if plan.get("approvalStatus") != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Backend Authorization Failed: Plan {req.planId} is {plan.get('approvalStatus')}. Execution requires approved status."
        )

    now = datetime.now(timezone.utc).isoformat()

    # Commit simulated mutations
    for a in plan.get("proposedActions", []):
        a["status"] = "executed"

    # Add inventory movement
    state.setdefault("inventoryMovements", []).insert(0, {
        "id": f"mov-{int(time.time() * 1000)}",
        "sku": "MCU-9021",
        "productName": "Automotive Grade MCU 32-bit",
        "sourceWarehouseId": "wh-2",
        "sourceWarehouseName": "Midwest Logistics Center - Chicago",
        "destWarehouseId": "wh-1",
        "destWarehouseName": "Pacific Hub Warehouse - Oakland",
        "quantity": 1800,
        "timestamp": now,
        "type": "crisis_reallocation",
        "status": "in_transit",
        "referenceId": plan.get("id")
    })

    # Restore Oakland buffer coverage
    for inv in state.get("inventory", []):
        if inv.get("warehouseId") == "wh-1" and inv.get("sku") == "MCU-9021":
            inv["onHandQuantity"] = 4800
            inv["availableQuantity"] = 2000
            inv["coverageDays"] = 3.2

    # Protect orders
    for o in state.get("customerOrders", []):
        if o.get("orderNumber") in ["SO-89211", "SO-89212"]:
            o["fulfillmentStatus"] = "in_production"
            o["deliveryStatus"] = "on_schedule"
            o["progressPercent"] = 85

    # Verification checks
    verification = {
        "id": f"ver-{int(time.time() * 1000)}",
        "incidentId": plan.get("incidentId"),
        "recoveryPlanId": plan.get("id"),
        "verifiedAt": now,
        "outcome": "Resolved",
        "originalIncidentResolved": True,
        "checks": [
            {"checkName": "Emergency Transfer Dispatched", "passed": True, "expected": "1,800 units", "actual": "1,800 units in transit", "detail": "Chicago to Oakland freight confirmed."},
            {"checkName": "Alternative Sourcing Committed", "passed": True, "expected": "3,000 units PO", "actual": "PO Confirmed", "detail": "Apex Semiconductor order logged."},
            {"checkName": "Tier 1 Customer SLA Protection", "passed": True, "expected": "Zero SLA breach", "actual": "Protected", "detail": "Orders SO-89211 and SO-89212 secured."}
        ],
        "residualShortages": 0,
        "remainingAtRiskOrders": 0,
        "inventoryCoverageDaysAfter": 3.2,
        "supplierFulfillmentConfirmed": True,
        "recommendations": ["Maintain warm standby supplier agreements", "Review minimum buffer thresholds"]
    }
    state.setdefault("verifications", []).insert(0, verification)

    state.setdefault("auditLogs", []).insert(0, {
        "id": f"aud-{int(time.time() * 1000)}",
        "timestamp": now,
        "actor": req.managerName or "Operations Director",
        "role": role,
        "action": "PLAN_EXECUTED",
        "category": "execution",
        "details": f"Executed 5 recovery actions for plan \"{plan.get('title')}\". Stock runway restored to 3.2 days."
    })

    save_dashboard_state(db, state)
    return {
        "success": True,
        "executedActionsCount": len(plan.get("proposedActions", [])),
        "plan": plan,
        "verification": verification
    }


# -------------------------------------------------------------
# Domain Feeds: Suppliers, Inventory, Orders, Production, Shipments
# -------------------------------------------------------------

@dashboard_router.get("/suppliers")
def get_suppliers(db: Session = Depends(get_db)):
    state = get_dashboard_state(db)
    return state.get("suppliers", [])


@dashboard_router.post("/suppliers", status_code=201)
def create_supplier(payload: Dict[str, Any], db: Session = Depends(get_db)):
    state = get_dashboard_state(db)
    now = datetime.now(timezone.utc).isoformat()
    new_sup = {
        **payload,
        "id": f"sup-{int(time.time() * 1000)}",
        "createdAt": now,
        "updatedAt": now
    }
    state.setdefault("suppliers", []).append(new_sup)
    state.setdefault("auditLogs", []).insert(0, {
        "id": f"aud-{int(time.time() * 1000)}",
        "timestamp": now,
        "actor": "User",
        "role": "Supply Chain Analyst",
        "action": "CREATE_SUPPLIER",
        "category": "data_mutation",
        "details": f"Created supplier {new_sup.get('name')}"
    })
    save_dashboard_state(db, state)
    return new_sup


@dashboard_router.put("/suppliers/{sup_id}")
def update_supplier(sup_id: str, payload: Dict[str, Any], db: Session = Depends(get_db)):
    state = get_dashboard_state(db)
    sup = next((s for s in state.get("suppliers", []) if s.get("id") == sup_id), None)
    if not sup:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    sup.update(payload)
    sup["updatedAt"] = datetime.now(timezone.utc).isoformat()
    save_dashboard_state(db, state)
    return sup


@dashboard_router.delete("/suppliers/{sup_id}")
def delete_supplier(sup_id: str, db: Session = Depends(get_db)):
    state = get_dashboard_state(db)
    orig_len = len(state.get("suppliers", []))
    state["suppliers"] = [s for s in state.get("suppliers", []) if s.get("id") != sup_id]
    if len(state["suppliers"]) == orig_len:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    save_dashboard_state(db, state)
    return {"success": True}


@dashboard_router.post("/suppliers/import-csv")
def import_suppliers_csv(req: CsvImportRequest, db: Session = Depends(get_db)):
    """
    CSV validation, sanitization against formula injection, and bulk insert.
    Neutralizes formula triggers (=, +, -, @, \\t, \\r, |) across all string fields.
    """
    if not req.rows:
        raise HTTPException(status_code=400, detail="Payload must contain non-empty array of supplier rows.")

    valid_suppliers = []
    errors = []
    now = datetime.now(timezone.utc).isoformat()

    for idx, row in enumerate(req.rows):
        raw_code = row.get("code") or row.get("Code")
        raw_name = row.get("name") or row.get("Name")
        code = validate_and_sanitize_import_field(raw_code, "code")
        name = validate_and_sanitize_import_field(raw_name, "name")

        try:
            capacity = float(row.get("dailyCapacity") or row.get("Capacity/Day") or row.get("capacity") or 0)
            cost = float(row.get("costPerUnit") or row.get("UnitCost") or row.get("cost") or 0)
            reliability = float(row.get("reliabilityScore") or row.get("Reliability") or 95)
        except (ValueError, TypeError):
            errors.append(f"Row {idx + 1}: Non-numeric values in numeric fields")
            continue

        if not code or len(code) < 2:
            errors.append(f"Row {idx + 1}: Missing or invalid code")
            continue
        if not name or len(name) < 2:
            errors.append(f"Row {idx + 1}: Missing or invalid name")
            continue
        if capacity <= 0 or cost <= 0 or reliability < 0 or reliability > 100:
            errors.append(f"Row {idx + 1}: Numeric fields out of valid range")
            continue

        valid_suppliers.append({
            "id": f"sup-csv-{int(time.time() * 1000)}-{idx}",
            "code": code,
            "name": name,
            "contactName": validate_and_sanitize_import_field(row.get("contactName") or "Procurement Desk", "contactName"),
            "email": validate_and_sanitize_import_field(row.get("email") or ("procurement@" + code.lower().replace("'", "") + ".com"), "email"),
            "phone": validate_and_sanitize_import_field(row.get("phone") or "+1-555-0199", "phone"),
            "country": validate_and_sanitize_import_field(row.get("country") or "United States", "country"),
            "city": validate_and_sanitize_import_field(row.get("city") or "Unknown", "city"),
            "coordinates": {"lat": float(row.get("lat") or 37.7749), "lng": float(row.get("lng") or -122.4194)},
            "productsSupplied": ["MCU-9021"],
            "dailyCapacity": capacity,
            "leadTimeDays": int(row.get("leadTimeDays") or 3),
            "reliabilityScore": reliability,
            "costPerUnit": cost,
            "operationalStatus": "active",
            "contractTier": validate_and_sanitize_import_field(row.get("contractTier", "Secondary"), "contractTier"),
            "createdAt": now,
            "updatedAt": now
        })

    if errors and not valid_suppliers:
        raise HTTPException(status_code=400, detail="All CSV rows failed schema validation.")

    state = get_dashboard_state(db)
    state.setdefault("suppliers", []).extend(valid_suppliers)
    state.setdefault("auditLogs", []).insert(0, {
        "id": f"aud-{int(time.time() * 1000)}",
        "timestamp": now,
        "actor": "CSV Importer",
        "role": req.managerRole or "Supply Chain Analyst",
        "action": "SUPPLIERS_CSV_IMPORTED",
        "category": "data_mutation",
        "details": f"Imported {len(valid_suppliers)} suppliers. Skipped {len(errors)} invalid rows."
    })
    save_dashboard_state(db, state)
    return {"success": True, "importedCount": len(valid_suppliers), "skippedCount": len(errors), "errors": errors or None}


@dashboard_router.get("/suppliers/export-csv")
def export_suppliers_csv(db: Session = Depends(get_db)):
    """
    Secure CSV export endpoint for suppliers directory.
    Guarantees all text cells are sanitized against spreadsheet formula injection (CWE-1236).
    """
    state = get_dashboard_state(db)
    suppliers = state.get("suppliers", [])

    headers = [
        "Code", "Name", "Country", "City", "ContractTier",
        "CapacityPerDay", "LeadTimeDays", "ReliabilityScore",
        "UnitCost", "OperationalStatus", "ProductsSupplied"
    ]
    rows = []
    for s in suppliers:
        products = ", ".join(s.get("productsSupplied", []))
        rows.append([
            s.get("code", ""),
            s.get("name", ""),
            s.get("country", ""),
            s.get("city", ""),
            s.get("contractTier", ""),
            s.get("dailyCapacity", 0),
            s.get("leadTimeDays", 0),
            s.get("reliabilityScore", 0),
            s.get("costPerUnit", 0.0),
            s.get("operationalStatus", ""),
            products
        ])

    csv_data = export_csv_secure(headers, rows)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=supply_chain_x_suppliers_secure.csv"
        }
    )


@dashboard_router.get("/inventory")
def get_inventory(db: Session = Depends(get_db)):
    state = get_dashboard_state(db)
    return state.get("inventory", [])


@dashboard_router.get("/orders")
def get_orders(db: Session = Depends(get_db)):
    state = get_dashboard_state(db)
    return state.get("customerOrders", [])


@dashboard_router.get("/production")
def get_production(db: Session = Depends(get_db)):
    state = get_dashboard_state(db)
    return state.get("productionLines", [])


@dashboard_router.get("/shipments")
def get_shipments(db: Session = Depends(get_db)):
    state = get_dashboard_state(db)
    return state.get("shipments", [])


@dashboard_router.get("/audit-logs")
def get_audit_logs(db: Session = Depends(get_db)):
    state = get_dashboard_state(db)
    return state.get("auditLogs", [])


@dashboard_router.get("/weather")
async def get_weather():
    """Live weather conditions via OpenWeather with deterministic fallback."""
    res = await get_weather_disruptions(node_id=None)
    return res.reports


# -------------------------------------------------------------
# Predictive Intelligence & What-If Simulation
# -------------------------------------------------------------

@dashboard_router.get("/predictions")
def get_predictions(db: Session = Depends(get_db)):
    state = get_dashboard_state(db)
    now = datetime.now(timezone.utc).isoformat()

    # Dynamic ML evaluation for tracked suppliers using crisis_risk_classifier
    supplier_assessments = []
    suppliers = state.get("suppliers", [])
    for sup in suppliers:
        try:
            # Construct features from live supplier profile
            features = {
                "inventory_units": 3000.0,
                "supplier_capacity_units": float(sup.get("dailyCapacity", 2000)),
                "lead_time_days": int(sup.get("leadTimeDays", 4)),
                "supplier_risk_score": float(1.0 - (sup.get("reliabilityScore", 95) / 100.0)),
                "weather_disruption_flag": 1 if sup.get("operationalStatus") == "disrupted" else 0,
                "port_congestion_flag": 0,
                "transport_cost": float(sup.get("costPerUnit", 40.0)),
                "day_of_week": datetime.now(timezone.utc).weekday(),
                "month": datetime.now(timezone.utc).month,
                "promotion_flag": 0,
                "region": sup.get("country", "Taiwan"),
                "supplier_id": sup.get("id", "sup-1"),
                "product_id": (sup.get("productsSupplied") or ["MCU-9021"])[0]
            }
            ml_eval = ml_service.predict_crisis_risk(features)
            composite_score = int(ml_eval["crisisProbability"] * 100)
            supplier_assessments.append({
                "supplierId": sup.get("id"),
                "supplierCode": sup.get("code"),
                "supplierName": sup.get("name"),
                "compositeRiskScore": composite_score,
                "failureProbabilityNext7Days": ml_eval["crisisProbability"],
                "failureProbabilityNext30Days": min(0.99, round(ml_eval["crisisProbability"] * 1.05, 2)),
                "riskTier": "Critical" if composite_score >= 70 else ("Warning" if composite_score >= 40 else "Stable"),
                "factors": {
                    "singleSourceConcentration": 90 if sup.get("contractTier") == "Primary" else 40,
                    "geopoliticalRisk": 75 if sup.get("country") in ["Taiwan", "China"] else 25,
                    "historicalReliability": int(sup.get("reliabilityScore", 90)),
                    "capacityStress": int(sup.get("dailyCapacity", 2000) / 30),
                    "weatherVulnerability": 65 if ml_eval["crisisProbability"] > 0.5 else 20
                },
                "recommendedHedge": "Dual-source contract with Apex Semiconductor Singapore." if composite_score >= 70 else "Maintain standard safety buffer."
            })
        except Exception as exc:
            logger.warning("ML assessment fallback for supplier %s: %s", sup.get("id"), exc)

    if not supplier_assessments:
        supplier_assessments = [
            {
                "supplierId": "sup-1",
                "supplierCode": "NSM-TW",
                "supplierName": "NanoSilicon Microelectronics",
                "compositeRiskScore": 88,
                "failureProbabilityNext7Days": 0.92,
                "failureProbabilityNext30Days": 0.95,
                "riskTier": "Critical",
                "factors": {"singleSourceConcentration": 90, "geopoliticalRisk": 75, "historicalReliability": 85, "capacityStress": 95, "weatherVulnerability": 60},
                "recommendedHedge": "Dual-source contract with Apex Semiconductor Singapore."
            }
        ]

    return {
        "generatedAt": now,
        "overallSupplyChainHealth": 84,
        "systemRiskLevel": "Warning",
        "activeAlertsCount": 3,
        "earlyWarningAlerts": [
            {
                "id": "alert-mcu-stockout",
                "riskType": "inventory_stockout_forecast",
                "severity": "Critical",
                "riskScore": 92,
                "title": "Predicted Stockout: MCU-9021 at Pacific Hub Warehouse (Oakland)",
                "predictedTimeWindow": "Within 48 hours",
                "timeToImpactHours": 48,
                "affectedEntities": [{"entityType": "Warehouse", "entityId": "wh-1", "name": "Pacific Hub (Oakland)"}],
                "contributingFactors": [{"factor": "Daily burn exceeds replenishment", "weightPct": 85, "detail": "Burn rate 1,500/day vs 0 inbound"}],
                "dataSources": ["Inventory Velocity Telemetry", "Supplier EDI Feed"],
                "confidence": 0.98,
                "recommendedPreventiveAction": "Execute preemptive inter-warehouse transfer of 1,800 units from Chicago to Oakland.",
                "estimatedAvertedLoss": 480000,
                "preventiveActionPayload": {"actionType": "preemptive_inter_warehouse_transfer", "details": {"sku": "MCU-9021", "qty": 1800}},
                "timestamp": now
            }
        ],
        "supplierRiskAssessments": supplier_assessments,
        "inventoryForecasts": [
            {
                "sku": "MCU-9021",
                "productName": "Automotive Grade MCU 32-bit",
                "warehouseId": "wh-1",
                "warehouseName": "Pacific Hub Warehouse - Oakland",
                "currentOnHand": 3000,
                "dailyConsumptionRate": 1500,
                "projectedStockoutHours": 48,
                "stockoutProbability": 0.94,
                "suggestedAction": "Transfer 1,800 units from Chicago Center"
            }
        ]
    }


@dashboard_router.post("/predictions/delivery-delay")
def predict_delivery_delay_endpoint(req: DeliveryDelayPredictionRequest):
    """
    Predict delivery delay probability and binary delayed flag.
    Uses trained pipeline: ml-optimization/models/delivery_delay_classifier.joblib
    """
    return ml_service.predict_delivery_delay(req.model_dump())


@dashboard_router.post("/predictions/crisis-risk")
def predict_crisis_risk_endpoint(req: CrisisRiskPredictionRequest):
    """
    Predict crisis disruption risk using trained gradient boosting model.
    Uses trained pipeline: ml-optimization/models/crisis_risk_classifier.joblib
    """
    return ml_service.predict_crisis_risk(req.model_dump())


@dashboard_router.post("/predictions/demand-forecast")
def predict_demand_forecast_endpoint(req: DemandForecastPredictionRequest):
    """
    Experimental demand forecast regression using gradient boosting.
    Uses trained pipeline: ml-optimization/models/demand_forecaster.joblib
    Explicitly discloses experimental status and heuristic bounds.
    """
    return ml_service.predict_demand_forecast(req.model_dump())


@dashboard_router.post("/simulation/what-if")
def what_if_simulation(payload: Dict[str, Any], db: Session = Depends(get_db)):
    state = get_dashboard_state(db)
    now = datetime.now(timezone.utc).isoformat()
    outage_days = payload.get("outageDays", 5)
    throttle = payload.get("assemblyLineThrottleRate", 1.0)
    simulated_burn = int(1500 * throttle)
    coverage = round(3000 / max(1, simulated_burn), 1)

    return {
        "scenarioName": payload.get("scenarioName", "What-If Outage Analysis"),
        "simulatedAt": now,
        "baselineMetrics": {
            "criticalStockoutsCount": 1,
            "atRiskOrdersCount": 2,
            "atRiskFinancialExposure": 480000,
            "projectedLineIdleLoss": 240000,
            "resilienceScore": 78
        },
        "simulatedMetrics": {
            "criticalStockoutsCount": 1 if coverage <= 2.5 else 0,
            "atRiskOrdersCount": 2 if coverage <= 2.5 else 0,
            "atRiskFinancialExposure": 480000 if coverage <= 2.5 else 0,
            "projectedLineIdleLoss": outage_days * 120000 if coverage <= 2.0 else 0,
            "resilienceScore": 88 if coverage > 2.0 else 65,
            "oaklandMcuRunwayDays": coverage
        },
        "recoveryMitigationImpact": {
            "mitigatedRiskScore": 94,
            "estimatedMitigationCost": 52800,
            "netSavings": 667200,
            "feasiblePlansCount": 4,
            "recommendedStrategy": "Plan A: Hybrid Optimal (Chicago Truck Transfer + Singapore Air Freight)"
        },
        "cascadeTrace": [
            {"step": "1. Upstream Disruption", "entity": "NanoSilicon Taiwan", "impactDescription": f"Fab offline for {outage_days} days.", "severity": "critical"},
            {"step": "2. Warehouse Runway", "entity": "Pacific Hub Oakland", "impactDescription": f"Coverage buffer: {coverage} days under {simulated_burn} units/day burn.", "severity": "warning" if coverage > 2.0 else "critical"}
        ]
    }


@dashboard_router.post("/predictions/prevent")
def execute_prevention(req: PreventRequest, db: Session = Depends(get_db)):
    state = get_dashboard_state(db)
    now = datetime.now(timezone.utc).isoformat()
    if req.actionType == "preemptive_inter_warehouse_transfer":
        chi = next((i for i in state.get("inventory", []) if i.get("warehouseId") == "wh-2" and i.get("sku") == "MCU-9021"), None)
        oak = next((i for i in state.get("inventory", []) if i.get("warehouseId") == "wh-1" and i.get("sku") == "MCU-9021"), None)
        if chi and oak:
            qty = 1800
            chi["onHandQuantity"] = max(0, chi.get("onHandQuantity", 4200) - qty)
            chi["coverageDays"] = round(chi["onHandQuantity"] / max(1, chi.get("dailyConsumptionRate", 600)), 1)
            oak["onHandQuantity"] = oak.get("onHandQuantity", 3000) + qty
            oak["coverageDays"] = round(oak["onHandQuantity"] / max(1, oak.get("dailyConsumptionRate", 1500)), 1)

            state.setdefault("inventoryMovements", []).insert(0, {
                "id": f"mov-prev-{int(time.time() * 1000)}",
                "sku": "MCU-9021",
                "productName": "Automotive Grade MCU 32-bit",
                "sourceWarehouseId": "wh-2",
                "sourceWarehouseName": "Midwest Logistics Center - Chicago",
                "destWarehouseId": "wh-1",
                "destWarehouseName": "Pacific Hub Warehouse - Oakland",
                "quantity": qty,
                "timestamp": now,
                "type": "crisis_reallocation",
                "status": "in_transit",
                "referenceId": req.alertId
            })

            state.setdefault("auditLogs", []).insert(0, {
                "id": f"aud-{int(time.time() * 1000)}",
                "timestamp": now,
                "actor": req.managerName or "Operations Director",
                "role": "Preventive Controller",
                "action": "PREVENTIVE_ACTION_EXECUTED",
                "category": "execution",
                "details": f"Executed proactive mitigation for alert {req.alertId}: Transferred 1,800 MCU-9021 units from Chicago to Oakland."
            })
            save_dashboard_state(db, state)

    return {"success": True, "message": "Preventive mitigation committed to database."}


@dashboard_router.post("/gemini/chat")
def gemini_chat(req: GeminiChatRequest, db: Session = Depends(get_db)):
    """Grounded Supply Chain Assistant Q&A using live state."""
    state = get_dashboard_state(db)
    q = req.question.lower()
    sup_count = len(state.get("suppliers", []))
    disrupted = [s.get("name") for s in state.get("suppliers", []) if s.get("operationalStatus") != "active"]

    if "supplier" in q or "outage" in q or "nanosilicon" in q:
        ans = f"Supplier Status Briefing: Currently tracking {sup_count} global suppliers. Disrupted suppliers: {', '.join(disrupted) if disrupted else 'None (All Nominal)'}. NanoSilicon Taiwan has an ongoing 5-day fabrication outage affecting MCU-9021."
    elif "inventory" in q or "mcu" in q or "stock" in q:
        mcu_items = [f"{i.get('warehouseName')}: {i.get('onHandQuantity')} units ({i.get('coverageDays')}d runway)" for i in state.get("inventory", []) if i.get("sku") == "MCU-9021"]
        ans = f"Inventory Status for MCU-9021: {'; '.join(mcu_items)}. Oakland buffer is at critical threshold (2.0 days)."
    elif "order" in q or "risk" in q:
        at_risk = [o.get("orderNumber") for o in state.get("customerOrders", []) if o.get("fulfillmentStatus") == "at_risk"]
        ans = f"Customer Orders at Risk: {', '.join(at_risk) if at_risk else 'Zero customer orders currently flagged at risk'}. Mitigation plan protects 100% of Tier 1 contracts."
    else:
        ans = f"Supply Chain X Telemetry: Tracking {sup_count} suppliers, {len(state.get('warehouses', []))} distribution hubs, and {len(state.get('crises', []))} crisis incidents. System operational in simulation mode."

    return {"answer": ans}
