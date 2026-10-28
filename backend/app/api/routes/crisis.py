from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone
from app.db.database import get_db
from app.db.models import (
    AuditLogModel,
    SupplyNodeModel,
    SupplyRouteModel,
    KPIModel,
    InventoryTelemetryModel,
    CustomerOrderModel
)
from app.schemas.supply_chain import (
    AuditLogSchema,
    OutageSimulationStateSchema,
    StartOutageRequest,
    RejectPlanRequest
)
from app.services.agent_orchestrator import orchestrator
from app.services.crisis_service import (
    get_or_create_workflow_state,
    build_state_response,
    log_audit_event,
    SYNTHETIC_AFFECTED_INVENTORY,
    SYNTHETIC_AFFECTED_PRODUCTION,
    SYNTHETIC_AFFECTED_ORDERS,
    SYNTHETIC_ALT_SUPPLIERS,
    SYNTHETIC_WAREHOUSE_OPTIONS,
    SYNTHETIC_PROPOSED_PLAN
)

router = APIRouter(prefix="/crisis", tags=["Crisis Management"])


@router.get("/audit", response_model=List[AuditLogSchema])
def get_audit_trail(db: Session = Depends(get_db)):
    """Retrieve immutable governance and workflow audit events."""
    events = db.query(AuditLogModel).order_by(AuditLogModel.created_at.desc()).all()
    return [
        AuditLogSchema(
            id=e.id,
            timestamp=e.timestamp,
            stage=e.stage,
            actor=e.actor,
            action=e.action,
            details=e.details,
            status=e.status
        )
        for e in events
    ]


@router.get("/state", response_model=OutageSimulationStateSchema)
def get_crisis_state(db: Session = Depends(get_db)):
    """Retrieve current persisted crisis workflow state."""
    state = get_or_create_workflow_state(db)
    return build_state_response(db, state)


@router.post("/outage/start", response_model=OutageSimulationStateSchema)
def start_outage(payload: StartOutageRequest = StartOutageRequest(), db: Session = Depends(get_db)):
    """
    1. Start a deterministic synthetic supplier outage scenario (idle -> detected).
    Invokes Agent 1 (Crisis Detection Agent) to confirm and deduplicate signals.
    """
    state = get_or_create_workflow_state(db)
    if state.stage != "idle":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid workflow transition: Cannot start outage while in '{state.stage}' stage. Reset demo first."
        )

    # Agent 1: Run Crisis Detection Agent
    detection_out = orchestrator.detect_crisis(
        supplier_id=payload.supplierId or "node-sup-1",
        cause=payload.cause or "Regional Substation Meltdown & Cat-4 Typhoon Harbor Embargo"
    )

    # Update topology to reflect outage on Apex Silicon Fab 4
    sup_node = db.query(SupplyNodeModel).filter(SupplyNodeModel.id == payload.supplierId).first()
    if sup_node:
        sup_node.status = "disrupted"
        sup_node.is_critical_outage = True
        sup_node.disruption_cause = payload.cause

    routes = db.query(SupplyRouteModel).filter(SupplyRouteModel.source_id == payload.supplierId).all()
    for r in routes:
        r.state = "disrupted"

    state.stage = "detected"
    state.timestamp = datetime.now(timezone.utc).isoformat()
    state.selected_supplier_id = payload.supplierId or "node-sup-1"
    state.detection_severity = detection_out["severity"]
    state.rejection_reason = None
    state.error_message = None

    log_audit_event(
        db,
        stage="detected",
        actor="AGENT_1_CRISIS_DETECTION",
        action="Disruption Anomaly Verified",
        details=f"Detection Agent confirmed severity {detection_out['severity']}: {payload.cause}. Anomaly deduplicated.",
        status="WARNING"
    )

    db.commit()
    db.refresh(state)
    return build_state_response(db, state)


@router.post("/outage/assess", response_model=OutageSimulationStateSchema)
def assess_outage(db: Session = Depends(get_db)):
    """
    2. Assess affected nodes, inventory, production, and orders (detected -> assessing).
    Invokes Agent 2 (Impact Assessment Agent) for deterministic burn-rate & blast-radius evaluation.
    """
    state = get_or_create_workflow_state(db)
    if state.stage != "detected":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid workflow transition: Cannot assess outage from stage '{state.stage}'. Expected 'detected'."
        )

    # Agent 2: Run Impact Assessment Agent
    impact_out = orchestrator.assess_impact(crisis_id=f"CR-{state.selected_supplier_id}")

    state.stage = "assessing"
    state.affected_inventory = SYNTHETIC_AFFECTED_INVENTORY
    state.affected_production = SYNTHETIC_AFFECTED_PRODUCTION
    state.affected_orders = SYNTHETIC_AFFECTED_ORDERS

    log_audit_event(
        db,
        stage="assessing",
        actor="AGENT_2_IMPACT_ASSESSMENT",
        action="Blast Radius & Run-Rate Evaluated",
        details=f"Calculated {impact_out['days_to_stockout']}d stockout buffer ({impact_out['daily_burn_rate']} units/day). Exposure: ${impact_out['total_delayed_order_value_usd']:,.0f} across {len(impact_out['lines_affected'])} lines.",
        status="SUCCESS"
    )

    db.commit()
    db.refresh(state)
    return build_state_response(db, state)


@router.post("/outage/plan", response_model=OutageSimulationStateSchema)
def plan_recovery(db: Session = Depends(get_db)):
    """
    3. Generate multi-constraint recovery plan (assessing or rejected -> planning -> awaiting_approval).
    Invokes Agent 3 (Supplier Sourcing), Agent 4 (Inventory Buffers), and Agent 5 (Logistics Corridors)
    coordinated through the multi-constraint recovery solver.
    """
    state = get_or_create_workflow_state(db)
    # If a plan is already generated and awaiting approval, return existing plan idempotently
    if state.stage == "awaiting_approval" and state.proposed_plan:
        return build_state_response(db, state)

    if state.stage not in ["assessing", "rejected"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid workflow transition: Cannot generate plan from stage '{state.stage}'. Expected 'assessing' or 'rejected'."
        )

    # Run Multi-Constraint Recovery Solver (combines Agents 3, 4, 5)
    solved = orchestrator.solve_multi_constraint_recovery(
        crisis_id=f"CR-{state.selected_supplier_id}",
        required_quantity=1450,
        target_lead_time_days=14
    )

    state.stage = "awaiting_approval"
    state.alternative_suppliers = SYNTHETIC_ALT_SUPPLIERS
    state.warehouse_stock_options = SYNTHETIC_WAREHOUSE_OPTIONS
    state.proposed_plan = solved["plan"]
    state.rejection_reason = None

    w_level = solved["plan"].get("weatherRiskLevel", "low").upper()
    w_src = solved["plan"].get("weatherDataSource", "deterministic_fallback")
    w_score = solved["plan"].get("weatherRiskScore", 15.0)

    log_audit_event(
        db,
        stage="planning",
        actor="AGENT_3_4_5_MULTI_SOLVER",
        action="Multi-Constraint Recovery Synthesized",
        details=f"Solver: {solved.get('solver_type', 'greedy_fallback')} ({solved['solver_status']}). Sourced {solved['plan'].get('selectedAltSupplier', 'Tokyo Optics')} + Singapore Air-Bridge. Est. cost: {solved['plan']['estimatedTotalCostUSD']}. Route Weather: {w_score:.0f}/100 ({w_level}) via {w_src}.",
        status="SUCCESS"
    )

    log_audit_event(
        db,
        stage="awaiting_approval",
        actor="GOVERNANCE_POLICY_ENGINE",
        action="Approval Gate Enforced",
        details=f"Recovery plan cost ({solved['plan']['estimatedTotalCostUSD']}) exceeds discretionary limit ($100k). Mandatory human sign-off required.",
        status="WARNING"
    )

    db.commit()
    db.refresh(state)
    return build_state_response(db, state)


@router.post("/outage/approve", response_model=OutageSimulationStateSchema)
def approve_plan(db: Session = Depends(get_db)):
    """
    4. Authorize recovery plan (awaiting_approval -> approved).
    """
    state = get_or_create_workflow_state(db)
    if state.stage != "awaiting_approval":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid workflow transition: Cannot approve plan from stage '{state.stage}'. Must be 'awaiting_approval'."
        )

    state.stage = "approved"
    log_audit_event(
        db,
        stage="approved",
        actor="COMMAND_DIRECTOR",
        action="Plan CP-01 Authorized",
        details="Director approved proposed sourcing mitigation. Safety gate satisfied for simulated dispatch.",
        status="SUCCESS"
    )

    db.commit()
    db.refresh(state)
    return build_state_response(db, state)


@router.post("/outage/reject", response_model=OutageSimulationStateSchema)
def reject_plan(payload: RejectPlanRequest, db: Session = Depends(get_db)):
    """
    5. Reject recovery plan with recorded reason (awaiting_approval -> rejected).
    """
    state = get_or_create_workflow_state(db)
    if state.stage != "awaiting_approval":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid workflow transition: Cannot reject plan from stage '{state.stage}'. Must be 'awaiting_approval'."
        )

    state.stage = "rejected"
    state.rejection_reason = payload.reason

    log_audit_event(
        db,
        stage="rejected",
        actor="COMMAND_DIRECTOR",
        action="Plan CP-01 Rejected",
        details=f"Execution denied by operator. Rationale: {payload.reason}.",
        status="REJECTED"
    )

    db.commit()
    db.refresh(state)
    return build_state_response(db, state)


@router.post("/outage/execute", response_model=OutageSimulationStateSchema)
def execute_plan(db: Session = Depends(get_db)):
    """
    6. Execute recovery actions in simulation mode (approved -> executing -> completed).
    CRITICAL POLICY: Execution is strictly blocked if plan is NOT approved!
    Rejects duplicate execution.
    """
    state = get_or_create_workflow_state(db)

    # SECURITY GATE: Enforce approval rule
    if state.stage != "approved":
        log_audit_event(
            db,
            stage=state.stage,
            actor="SECURITY_GATEWAY",
            action="Execution Blocked: Approval Missing",
            details=f"Attempted simulated execution while in stage '{state.stage}'. Policy mandates explicit approval.",
            status="SECURITY_BLOCKED"
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"SECURITY_GATEWAY: Execution blocked. Plan must be explicitly 'approved' before dispatch. Current stage: '{state.stage}'."
        )

    # DUPLICATE EXECUTION PREVENTION
    if state.is_executing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Duplicate execution blocked: Simulation dispatch is already in progress."
        )

    state.is_executing = True
    log_audit_event(
        db,
        stage="executing",
        actor="SYSTEM_AUTONOMOUS",
        action="Simulated Execution Dispatched",
        details="Safety constraints validated. Commencing simulated dispatch across telemetry nodes.",
        status="SUCCESS"
    )

    # 1. Update Supply Routes: restore normal transit, mark re-routed bypass
    for r in db.query(SupplyRouteModel).all():
        if r.id in ['route-sup1-fac1', 'route-sup1-wh2']:
            r.state = 'normal'
            r.is_rerouted = True
            r.congested_reason = 'Diverted via Tokyo Optics Line 2 & Singapore Air-Bridge'
        elif r.id in ['route-fac1-wh1', 'route-dc1-cust1']:
            r.state = 'normal'
            r.congested_reason = None

    # 2. Update Supply Nodes: mark mitigation active
    sup_node = db.query(SupplyNodeModel).filter(SupplyNodeModel.id == 'node-sup-1').first()
    if sup_node:
        sup_node.disruption_cause = 'Mitigation Active: Diverted to Tokyo Precision Optics Fab 2'

    # 3. Update Inventory Telemetry: replenish Austin/NA Buffer stock, adjust Singapore stock
    na_hub = db.query(InventoryTelemetryModel).filter(InventoryTelemetryModel.hub_id == 'hub-na-01').first()
    if na_hub:
        na_hub.current_stock_units += 1450
        na_hub.stockout_risk_days = 28
        na_hub.health_status = 'healthy'
        # Update top SKUs list in DB
        skus = list(na_hub.top_skus or [])
        for s in skus:
            if 'SKU-NEURAL-A1' in s.get('sku', ''):
                s['units'] = s.get('units', 620) + 1450
                s['daysOfSupply'] = 21
        na_hub.top_skus = skus

    # 4. Update Customer Orders: protect at-risk orders
    orders = db.query(CustomerOrderModel).all()
    for o in orders:
        if o.risk_tier == 'CRITICAL':
            o.risk_tier = 'HIGH'
            o.sla_deadline_hours += 48  # SLA window extended and protected

    # 5. Update KPIs
    kpi = db.query(KPIModel).order_by(KPIModel.id.desc()).first()
    if kpi:
        kpi.resiliency_index = 86.8
        kpi.resiliency_delta = 4.2
        kpi.on_time_delivery_rate = 94.1
        kpi.delivery_rate_delta = 1.5
        kpi.critical_alerts_count = 0
        kpi.active_mitigations_count += 1

    db.flush()

    # 6. Post-Execution Database Verification: Re-query persisted tables
    verified_na_hub = db.query(InventoryTelemetryModel).filter(InventoryTelemetryModel.hub_id == 'hub-na-01').first()
    verified_routes = db.query(SupplyRouteModel).filter(SupplyRouteModel.id.in_(['route-sup1-fac1', 'route-dc1-cust1'])).all()
    verified_kpi = db.query(KPIModel).order_by(KPIModel.id.desc()).first()
    verified_orders = db.query(CustomerOrderModel).all()

    disrupted_route_count = sum(1 for r in verified_routes if r.state == 'disrupted')
    recovered_units = verified_na_hub.current_stock_units if verified_na_hub else 0
    sla_protected_count = sum(1 for o in verified_orders if o.sla_deadline_hours >= 72)

    # Classify outcome based on actual verified DB state
    if disrupted_route_count == 0 and verified_kpi and verified_kpi.resiliency_index >= 85.0:
        verification_outcome = "Resolved"
    elif verified_kpi and verified_kpi.resiliency_index >= 70.0:
        verification_outcome = "Partially Resolved"
    else:
        verification_outcome = "Unresolved"

    evidence = {
        "verified_stock_units": recovered_units,
        "verified_resiliency_index": verified_kpi.resiliency_index if verified_kpi else 0.0,
        "disrupted_routes_remaining": disrupted_route_count,
        "sla_protected_orders_count": sla_protected_count,
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "database_engine": "SQLite persistent transaction",
        "recovery_objectives_met": True if verification_outcome == "Resolved" else False,
    }

    # Verify recovery plan with digital twin recovery monitor
    verification = orchestrator.verify_execution(plan_cost=142500.0)

    # Mark plan actions as verified in simulation
    if state.proposed_plan:
        updated_plan = dict(state.proposed_plan)
        updated_plan["detailedActions"] = [
            {**a, "executionStatus": "verified"} for a in updated_plan.get("detailedActions", [])
        ]
        state.proposed_plan = updated_plan

    state.stage = "completed"
    state.is_executing = False
    state.detection_severity = "NONE"
    state.verification_outcome = verification_outcome
    state.verification_evidence = evidence

    log_audit_event(
        db,
        stage="completed",
        actor="RECOVERY_MONITOR_AGENT",
        action=f"Simulation Verified: {verification_outcome}",
        details=f"DB re-query verified: {verification_outcome}. Resiliency: {verified_kpi.resiliency_index if verified_kpi else 0}%. Stock replenished (+1,450 units). Zero real transactions.",
        status="SUCCESS"
    )

    db.commit()
    db.refresh(state)
    return build_state_response(db, state)

