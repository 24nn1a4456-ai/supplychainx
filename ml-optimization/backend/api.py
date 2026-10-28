"""
api.py — FastAPI REST API for Supply Chain X.

All data is synthetic/demo. No external operations are performed.
CORS enabled for local frontend development.
"""
from __future__ import annotations

import json
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db, init_db
from backend.seed import init_and_seed
from backend.models import (
    SupplierRecord, InventoryRecord, WarehouseRecord,
    DisruptionRecord, RecoveryPlanRecord, ApprovalRecord,
    SimulationRecord, AuditEvent,
)
from backend.agents import CrisisManager
from backend.services import ApprovalService, DigitalTwinService
from backend.engine_adapter import EngineAdapter


# ───────────────────── App Setup ────────────────────────────────────

app = FastAPI(
    title="Supply Chain X — Autonomous Crisis Manager",
    description=(
        "REST API for the Supply Chain X hackathon demo. "
        "All data is SYNTHETIC. No real operations are performed."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    """Initialize database and seed synthetic data on startup."""
    init_and_seed()


# ───────────────────── Request/Response Schemas ─────────────────────

class DisruptionCreate(BaseModel):
    type: str = Field(..., description="supplier_outage | shipment_delay | warehouse_outage | demand_spike | low_inventory")
    description: str = Field("", description="Human-readable description")
    severity: str = Field("HIGH", description="LOW | MEDIUM | HIGH | CRITICAL")
    affected_supplier_id: Optional[str] = None
    affected_warehouse_id: Optional[str] = None
    affected_material: Optional[str] = Field("COMP-PCB-01", description="Material ID")
    scenario_name: Optional[str] = Field(None, description="Scenario from simulator registry")

class ApprovalAction(BaseModel):
    reviewer: str = Field("demo_user", description="Reviewer identifier (demo)")
    comment: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    version: str
    scenarios_available: List[str]
    data_disclaimer: str


# ───────────────────── System Endpoints ─────────────────────────────

@app.get("/api/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        status="ok",
        version="1.0.0",
        scenarios_available=EngineAdapter.available_scenarios(),
        data_disclaimer="All data is SYNTHETIC. No real operations.",
    )


@app.get("/api/summary")
def summary(db: Session = Depends(get_db)):
    disruptions = db.query(DisruptionRecord).count()
    plans = db.query(RecoveryPlanRecord).count()
    pending = db.query(RecoveryPlanRecord).filter(RecoveryPlanRecord.status == "pending").count()
    approved = db.query(RecoveryPlanRecord).filter(RecoveryPlanRecord.status == "approved").count()
    executed = db.query(RecoveryPlanRecord).filter(RecoveryPlanRecord.status == "executed").count()
    sims = db.query(SimulationRecord).count()

    # Aggregate KPIs from the latest plans
    latest_plans = db.query(RecoveryPlanRecord).order_by(RecoveryPlanRecord.created_at.desc()).limit(5).all()
    total_cost = sum(p.total_cost for p in latest_plans)
    avg_cost = total_cost / len(latest_plans) if latest_plans else 0

    # Inventory at risk
    inv_items = db.query(InventoryRecord).all()
    at_risk = sum(1 for inv in inv_items if inv.current_qty <= inv.safety_stock)

    return {
        "disruption_count": disruptions,
        "recovery_plans": plans,
        "pending_approvals": pending,
        "approved_plans": approved,
        "executed_plans": executed,
        "simulations": sims,
        "estimated_recovery_cost": round(total_cost, 2),
        "avg_plan_cost": round(avg_cost, 2),
        "inventory_at_risk": at_risk,
        "total_inventory_items": len(inv_items),
        "data_disclaimer": "All values are from SYNTHETIC demo data",
    }


# ───────────────────── Reference Data ───────────────────────────────

@app.get("/api/suppliers")
def list_suppliers(db: Session = Depends(get_db)):
    suppliers = db.query(SupplierRecord).all()
    return [
        {
            "id": s.id, "name": s.name, "material": s.material,
            "capacity": s.capacity, "lead_time_days": s.lead_time_days,
            "unit_cost": s.unit_cost, "transport_cost": s.transport_cost,
            "reliability_score": s.reliability_score,
            "is_available": s.is_available, "is_primary": s.is_primary,
            "is_synthetic": s.is_synthetic,
        }
        for s in suppliers
    ]


@app.get("/api/inventory")
def list_inventory(db: Session = Depends(get_db)):
    inventory = db.query(InventoryRecord).all()
    return [
        {
            "id": inv.id, "material_id": inv.material_id,
            "warehouse_id": inv.warehouse_id,
            "current_qty": inv.current_qty,
            "safety_stock": inv.safety_stock,
            "daily_demand": inv.daily_demand,
            "reorder_threshold": inv.reorder_threshold,
            "usable_qty": max(0, inv.current_qty - inv.safety_stock),
            "is_synthetic": inv.is_synthetic,
        }
        for inv in inventory
    ]


@app.get("/api/warehouses")
def list_warehouses(db: Session = Depends(get_db)):
    warehouses = db.query(WarehouseRecord).all()
    return [
        {
            "id": w.id, "name": w.name, "location": w.location,
            "capacity": w.capacity, "transfer_cost": w.transfer_cost,
            "transfer_lead_days": w.transfer_lead_days,
            "is_operational": w.is_operational, "is_synthetic": w.is_synthetic,
        }
        for w in warehouses
    ]


# ───────────────────── Disruptions ──────────────────────────────────

@app.get("/api/disruptions")
def list_disruptions(db: Session = Depends(get_db)):
    items = db.query(DisruptionRecord).order_by(DisruptionRecord.created_at.desc()).all()
    return [_disruption_dict(d) for d in items]


@app.post("/api/disruptions", status_code=201)
def create_disruption(req: DisruptionCreate, db: Session = Depends(get_db)):
    # Validate type
    valid_types = ["supplier_outage", "shipment_delay", "warehouse_outage", "demand_spike", "low_inventory"]
    if req.type not in valid_types:
        raise HTTPException(400, f"Invalid type. Must be one of: {valid_types}")

    # Map defaults
    scenario = req.scenario_name or req.type
    detected_day = None
    duration = 5
    if req.type == "shipment_delay":
        detected_day = 2
        duration = 4
    elif req.type == "warehouse_outage":
        detected_day = 1
    elif req.type == "demand_spike":
        duration = 1

    record = DisruptionRecord(
        type=req.type,
        description=req.description or f"{req.type.replace('_', ' ').title()} — seeded scenario",
        severity=req.severity,
        affected_supplier_id=req.affected_supplier_id or (
            "SUP-ALPHA" if req.type == "supplier_outage" else None
        ),
        affected_warehouse_id=req.affected_warehouse_id or (
            "WH-EAST" if req.type == "warehouse_outage" else None
        ),
        affected_material=req.affected_material or "COMP-PCB-01",
        start_day=0,
        detected_day=detected_day,
        duration_days=duration,
        scenario_name=scenario,
        status="detected",
    )
    db.add(record)
    db.flush()  # ensure record.id is populated before referencing it

    # Audit
    db.add(AuditEvent(
        event_type="disruption_created",
        entity_id=record.id,
        actor="api",
        details_json=json.dumps({"type": req.type, "severity": req.severity}),
    ))
    db.commit()

    return _disruption_dict(record)


@app.get("/api/disruptions/{disruption_id}")
def get_disruption(disruption_id: str, db: Session = Depends(get_db)):
    d = db.get(DisruptionRecord, disruption_id)
    if not d:
        raise HTTPException(404, "Disruption not found")
    return _disruption_dict(d)


@app.post("/api/disruptions/{disruption_id}/analyze")
def analyze_disruption(disruption_id: str, db: Session = Depends(get_db)):
    d = db.get(DisruptionRecord, disruption_id)
    if not d:
        raise HTTPException(404, "Disruption not found")

    result = CrisisManager.analyze(d, db)

    if result.get("engine_error"):
        raise HTTPException(500, f"Engine error: {result['engine_error']}")

    return result


# ───────────────────── Recovery Plans ───────────────────────────────

@app.get("/api/plans")
def list_plans(db: Session = Depends(get_db)):
    plans = db.query(RecoveryPlanRecord).order_by(RecoveryPlanRecord.created_at.desc()).all()
    return [_plan_dict(p) for p in plans]


@app.get("/api/plans/{plan_id}")
def get_plan(plan_id: str, db: Session = Depends(get_db)):
    p = db.get(RecoveryPlanRecord, plan_id)
    if not p:
        raise HTTPException(404, "Plan not found")
    return _plan_dict(p)


@app.post("/api/plans/{plan_id}/approve")
def approve_plan(plan_id: str, body: ApprovalAction, db: Session = Depends(get_db)):
    result = ApprovalService.approve(plan_id, db, reviewer=body.reviewer, comment=body.comment)
    status_code = result.pop("status_code", 200)
    if status_code >= 400:
        raise HTTPException(status_code, result.get("error", "Unknown error"))
    return result


@app.post("/api/plans/{plan_id}/reject")
def reject_plan(plan_id: str, body: ApprovalAction, db: Session = Depends(get_db)):
    result = ApprovalService.reject(plan_id, db, reviewer=body.reviewer, comment=body.comment)
    status_code = result.pop("status_code", 200)
    if status_code >= 400:
        raise HTTPException(status_code, result.get("error", "Unknown error"))
    return result


@app.post("/api/plans/{plan_id}/simulate")
def simulate_plan(plan_id: str, db: Session = Depends(get_db)):
    result = DigitalTwinService.execute(plan_id, db)
    status_code = result.pop("status_code", 200)
    if status_code >= 400:
        raise HTTPException(status_code, result.get("error", "Unknown error"))
    return result


# ───────────────────── Audit & Simulations ──────────────────────────

@app.get("/api/audit")
def list_audit(limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    events = db.query(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(limit).all()
    return [
        {
            "id": e.id,
            "event_type": e.event_type,
            "entity_id": e.entity_id,
            "actor": e.actor,
            "details": json.loads(e.details_json) if e.details_json else {},
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in events
    ]


@app.get("/api/simulations")
def list_simulations(db: Session = Depends(get_db)):
    sims = db.query(SimulationRecord).order_by(SimulationRecord.created_at.desc()).all()
    return [_sim_dict(s) for s in sims]


@app.get("/api/simulations/{sim_id}")
def get_simulation(sim_id: str, db: Session = Depends(get_db)):
    s = db.get(SimulationRecord, sim_id)
    if not s:
        raise HTTPException(404, "Simulation not found")
    return _sim_dict(s)


# ───────────────────── Serialization Helpers ────────────────────────

def _disruption_dict(d: DisruptionRecord) -> dict:
    return {
        "id": d.id, "type": d.type, "description": d.description,
        "severity": d.severity,
        "affected_supplier_id": d.affected_supplier_id,
        "affected_warehouse_id": d.affected_warehouse_id,
        "affected_material": d.affected_material,
        "start_day": d.start_day, "detected_day": d.detected_day,
        "duration_days": d.duration_days,
        "status": d.status, "scenario_name": d.scenario_name,
        "analysis_result": json.loads(d.analysis_result) if d.analysis_result else None,
        "is_synthetic": d.is_synthetic,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


def _plan_dict(p: RecoveryPlanRecord) -> dict:
    return {
        "id": p.id, "disruption_id": p.disruption_id,
        "actions": p.actions, "solver_status": p.solver_status,
        "solver_type": p.solver_type,
        "total_cost": p.total_cost,
        "procurement_cost": p.procurement_cost,
        "delay_penalty": p.delay_penalty,
        "is_feasible": p.is_feasible,
        "kpis": p.kpis, "fulfilled": p.fulfilled,
        "violated_constraints": json.loads(p.violated_constraints) if p.violated_constraints else [],
        "agent_results": json.loads(p.agent_results_json) if p.agent_results_json else None,
        "status": p.status,
        "is_synthetic": p.is_synthetic,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def _sim_dict(s: SimulationRecord) -> dict:
    return {
        "id": s.id, "plan_id": s.plan_id,
        "before_state": json.loads(s.before_state_json),
        "after_state": json.loads(s.after_state_json),
        "actions_applied": json.loads(s.actions_applied_json),
        "result_status": s.result_status,
        "is_synthetic": s.is_synthetic,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }
