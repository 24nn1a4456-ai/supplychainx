from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.db.database import get_db, Base, engine
from app.db.seed_data import seed_database
from app.db.models import (
    SupplyNodeModel,
    SupplyRouteModel,
    KPIModel,
    InventoryTelemetryModel,
    CustomerOrderModel,
    AuditLogModel,
    CrisisWorkflowStateModel
)
from app.schemas.supply_chain import ResetDemoResponse
from app.services.agent_orchestrator import orchestrator
from app.services.crisis_service import (
    get_or_create_workflow_state,
    build_state_response,
    log_audit_event
)


router = APIRouter(prefix="/demo", tags=["Demo Controls"])


@router.post("/reset", response_model=ResetDemoResponse)
def reset_demo(db: Session = Depends(get_db)):
    """
    10. Reset demo safely and deterministically to pristine baseline operational state.
    Restores nodes, routes, KPIs, inventory, orders, and workflow state.
    """
    # Reset agent deduplicator cache
    orchestrator.reset()

    # Clear and re-seed all tables
    db.query(CrisisWorkflowStateModel).delete()
    db.query(SupplyRouteModel).delete()
    db.query(SupplyNodeModel).delete()
    db.query(KPIModel).delete()
    db.query(InventoryTelemetryModel).delete()
    db.query(CustomerOrderModel).delete()
    db.query(AuditLogModel).delete()
    db.commit()

    # Re-seed baseline records
    seed_database(db)

    # Re-initialize clean crisis workflow state in 'idle'
    state = CrisisWorkflowStateModel(
        id="active_crisis",
        stage="idle",
        timestamp=datetime.now(timezone.utc).isoformat(),
        selected_supplier_id="node-sup-1",
        detection_severity="NONE",
        affected_inventory=[],
        affected_production=[],
        affected_orders=[],
        alternative_suppliers=[],
        warehouse_stock_options=[],
        proposed_plan=None,
        is_executing=False,
        current_executing_action_index=None,
        rejection_reason=None,
        error_message=None,
        verification_outcome=None,
        verification_evidence=None
    )
    db.add(state)

    # Log audit event for reset
    log_audit_event(
        db,
        stage="idle",
        actor="COMMAND_DIRECTOR",
        action="Demo Reset Triggered",
        details="Restored supply chain to pristine baseline operational state. Zero real transactions executed.",
        status="SUCCESS"
    )

    db.commit()
    db.refresh(state)

    from app.services.dashboard_state_service import reset_dashboard_state
    dash_state = reset_dashboard_state(db)

    return ResetDemoResponse(
        status="success",
        message="Supply Chain X demo reset to pristine baseline operational state.",
        simulation_state=build_state_response(db, state),
        success=True,
        state=dash_state
    )
