import time
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.db.models import (
    CrisisWorkflowStateModel,
    AuditLogModel,
    SupplyNodeModel,
    SupplyRouteModel,
    KPIModel
)
from app.schemas.supply_chain import (
    OutageSimulationStateSchema,
    AffectedInventoryItem,
    AffectedProductionLine,
    CustomerOrderSchema,
    AlternativeSupplierOption,
    WarehouseStockOption,
    ProposedRecoveryPlan,
    RecoveryActionItem,
    AuditLogSchema
)

# Deterministic synthetic data templates (Matching frontend specifications)
SYNTHETIC_AFFECTED_INVENTORY = [
    {
        "sku": "SKU-NEURAL-A1 (Apex Sub-3nm)",
        "description": "High-speed AI Neural Accelerator Wafers",
        "onHandUnits": 620,
        "dailyBurnRate": 413,
        "hoursOfRunwayLeft": 36
    },
    {
        "sku": "SKU-LOGIC-CORE-8",
        "description": "Micro-Logic Controller Assemblies",
        "onHandUnits": 1400,
        "dailyBurnRate": 250,
        "hoursOfRunwayLeft": 48
    },
    {
        "sku": "SKU-POWER-CONV-X",
        "description": "Power Conversion Modules",
        "onHandUnits": 4200,
        "dailyBurnRate": 220,
        "hoursOfRunwayLeft": 384
    }
]

SYNTHETIC_AFFECTED_PRODUCTION = [
    {
        "lineId": "Line 2 (Autonomous Pods)",
        "factoryName": "Giga Assembly Complex (Austin)",
        "impactStatus": "starved",
        "hoursUntilShutdown": 36,
        "affectedProducts": ["Autonomous Robotics Pods", "Enterprise AI Racks"],
        "dailyOutputLoss": "$420,000 / day"
    },
    {
        "lineId": "Line 1 (Base Chassis)",
        "factoryName": "Giga Assembly Complex (Austin)",
        "impactStatus": "throttled",
        "hoursUntilShutdown": 72,
        "affectedProducts": ["Standard Chassis Units"],
        "dailyOutputLoss": "$150,000 / day"
    }
]

SYNTHETIC_AFFECTED_ORDERS = [
    {
        "orderId": "ORD-US-8912",
        "customerName": "North America Retail Grid",
        "destination": "US Coastal Tier-1",
        "volumeUnits": 1450,
        "contractValueUSD": "$1,850,000",
        "slaDeadlineHours": 48,
        "riskTier": "CRITICAL"
    },
    {
        "orderId": "ORD-EU-4409",
        "customerName": "EMEA Enterprise Network",
        "destination": "Frankfurt Gateway",
        "volumeUnits": 820,
        "contractValueUSD": "$980,000",
        "slaDeadlineHours": 72,
        "riskTier": "HIGH"
    }
]

SYNTHETIC_ALT_SUPPLIERS = [
    {
        "supplierId": "node-sup-3",
        "supplierName": "Tokyo Precision Optics (Fab 2)",
        "location": "Yokohama High-Tech Park, Japan",
        "availableCapacityUnits": 650,
        "quotedLeadTimeDays": 3,
        "unitCostUSD": 420.0,
        "costDeltaPct": 8.5,
        "reliabilityScore": 98.2,
        "readinessStatus": "Immediate"
    },
    {
        "supplierId": "node-sup-alt-2",
        "supplierName": "Dresden Silicon Micro-Foundry",
        "location": "Silicon Saxony, Germany",
        "availableCapacityUnits": 400,
        "quotedLeadTimeDays": 5,
        "unitCostUSD": 460.0,
        "costDeltaPct": 18.0,
        "reliabilityScore": 94.7,
        "readinessStatus": "24h Spin-up"
    },
    {
        "supplierId": "node-sup-alt-3",
        "supplierName": "Hsinchu Semiconductor Line 12",
        "location": "Hsinchu, Taiwan",
        "availableCapacityUnits": 900,
        "quotedLeadTimeDays": 7,
        "unitCostUSD": 395.0,
        "costDeltaPct": 2.1,
        "reliabilityScore": 91.0,
        "readinessStatus": "Restricted"
    }
]

SYNTHETIC_WAREHOUSE_OPTIONS = [
    {
        "warehouseId": "node-wh-2",
        "warehouseName": "Pacific Straits Buffer Depot",
        "location": "Singapore Tuas Mega Port",
        "availableBufferUnits": 12500,
        "transportMode": "Charter Air Cargo",
        "transitHours": 18,
        "estimatedTransitCostUSD": "$64,000",
        "sufficientToCoverDays": 8.5
    },
    {
        "warehouseId": "node-wh-1",
        "warehouseName": "Euro-Gateway Logistics Hub",
        "location": "Rotterdam, Netherlands",
        "availableBufferUnits": 4800,
        "transportMode": "Express Freight",
        "transitHours": 36,
        "estimatedTransitCostUSD": "$32,000",
        "sufficientToCoverDays": 3.2
    }
]

SYNTHETIC_PROPOSED_PLAN = {
    "planId": "PLAN-SYNTH-APEX-01",
    "title": "Contingency Playbook CP-01: Apex Silicon Outage Multi-Tier Recovery",
    "syntheticConfidenceScore": 94.8,
    "estimatedTotalCostUSD": "$142,500",
    "deliveryTimeRecoveryHours": 42,
    "slaRecoveryPercentage": 8.4,
    "targetSupplier": "Apex Silicon Fab 4 (Shenzhen)",
    "selectedAltSupplier": "Tokyo Precision Optics (Fab 2)",
    "selectedWarehouseBuffer": "Pacific Straits Buffer Depot (Singapore)",
    "detailedActions": [
        {
            "id": "act-01",
            "sequence": 1,
            "title": "Quarantine Disrupted Inbound Stream",
            "department": "Procurement",
            "actionType": "Order Diversion",
            "executionStatus": "pending",
            "costUSD": "$0",
            "durationMinutes": 15,
            "description": "Halt all non-verified cargo manifests from Apex Fab 4 Shenzhen checkpoint to avoid transit gridlock.",
            "syntheticVerificationNote": "Simulated API lock dispatched to Shenzhen EDI manifest router."
        },
        {
            "id": "act-02",
            "sequence": 2,
            "title": "Shift 450 TEU Neural Wafers to Tokyo Fab 2",
            "department": "Procurement",
            "actionType": "Order Diversion",
            "executionStatus": "pending",
            "costUSD": "$78,500",
            "durationMinutes": 30,
            "description": "Activate pre-qualified secondary supplier Tokyo Precision Optics for 450 units sub-3nm neural accelerators.",
            "syntheticVerificationNote": "Verified capacity allocation: 650 units currently open on Yokohama Line B."
        },
        {
            "id": "act-03",
            "sequence": 3,
            "title": "Dispatch Emergency Air-Bridge from Singapore",
            "department": "Logistics",
            "actionType": "Air Charter",
            "executionStatus": "pending",
            "costUSD": "$64,000",
            "durationMinutes": 45,
            "description": "Charter Boeing 777-Freighter from Singapore Tuas Buffer directly to Austin Bergstrom Cargo Terminal with 12,500 wafer buffer.",
            "syntheticVerificationNote": "Simulated charter flight booked on SIA Cargo Flight SQ-9912."
        },
        {
            "id": "act-04",
            "sequence": 4,
            "title": "Throttle Giga Assembly Line 2 to Buffer Mode",
            "department": "Plant Operations",
            "actionType": "Line Throttle",
            "executionStatus": "pending",
            "costUSD": "$0",
            "durationMinutes": 20,
            "description": "Maintain Line 1 at 100% and reduce Line 2 speed by 25% until Singapore air shipment arrives in 18 hours.",
            "syntheticVerificationNote": "Prevents total factory shutdown; saves 68% of daily work-in-progress stock."
        },
        {
            "id": "act-05",
            "sequence": 5,
            "title": "Broadcast Automated Client SLA Updates",
            "department": "Customer Success",
            "actionType": "Client Notice",
            "executionStatus": "pending",
            "costUSD": "$0",
            "durationMinutes": 10,
            "description": "Transmit proactive shipment tracking updates to North America Tier-1 retail customers with revised 36h delivery window.",
            "syntheticVerificationNote": "Protects contractual SLA penalty clauses; client satisfaction index maintained at 92%."
        }
    ]
}


def log_audit_event(
    db: Session,
    stage: str,
    actor: str,
    action: str,
    details: str,
    status: str
) -> AuditLogModel:
    entry = AuditLogModel(
        id=f"audit-{int(time.time() * 1000)}-{stage}",
        timestamp=datetime.now(timezone.utc).strftime("%H:%M:%S UTC"),
        stage=stage,
        actor=actor,
        action=action,
        details=details,
        status=status
    )
    db.add(entry)
    db.flush()
    return entry


def get_or_create_workflow_state(db: Session) -> CrisisWorkflowStateModel:
    state = db.query(CrisisWorkflowStateModel).filter(CrisisWorkflowStateModel.id == "active_crisis").first()
    if not state:
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
            error_message=None
        )
        db.add(state)
        db.commit()
        db.refresh(state)
    return state


def build_state_response(db: Session, state: CrisisWorkflowStateModel) -> OutageSimulationStateSchema:
    audit_models = db.query(AuditLogModel).order_by(AuditLogModel.created_at.desc()).all()
    audit_trail = [
        AuditLogSchema(
            id=a.id,
            timestamp=a.timestamp,
            stage=a.stage,
            actor=a.actor,
            action=a.action,
            details=a.details,
            status=a.status
        )
        for a in audit_models
    ]

    plan_obj = None
    if state.proposed_plan:
        plan_dict = state.proposed_plan
        plan_obj = ProposedRecoveryPlan(
            plan_id=plan_dict["planId"],
            title=plan_dict["title"],
            synthetic_confidence_score=plan_dict["syntheticConfidenceScore"],
            estimated_total_cost_usd=plan_dict["estimatedTotalCostUSD"],
            delivery_time_recovery_hours=plan_dict["deliveryTimeRecoveryHours"],
            sla_recovery_percentage=plan_dict["slaRecoveryPercentage"],
            target_supplier=plan_dict["targetSupplier"],
            selected_alt_supplier=plan_dict["selectedAltSupplier"],
            selected_warehouse_buffer=plan_dict["selectedWarehouseBuffer"],
            detailed_actions=[RecoveryActionItem(**act) for act in plan_dict["detailedActions"]],
            weather_risk_score=plan_dict.get("weatherRiskScore"),
            weather_risk_level=plan_dict.get("weatherRiskLevel"),
            weather_explanation=plan_dict.get("weatherExplanation"),
            weather_data_source=plan_dict.get("weatherDataSource"),
            evaluated_transport_options=plan_dict.get("evaluatedTransportOptions", [])
        )

    return OutageSimulationStateSchema(
        stage=state.stage,
        timestamp=state.timestamp,
        selected_supplier_id=state.selected_supplier_id,
        detection_severity=state.detection_severity,
        affected_inventory=[AffectedInventoryItem(**item) for item in (state.affected_inventory or [])],
        affected_production=[AffectedProductionLine(**line) for line in (state.affected_production or [])],
        affected_orders=[CustomerOrderSchema(**ord) for ord in (state.affected_orders or [])],
        alternative_suppliers=[AlternativeSupplierOption(**sup) for sup in (state.alternative_suppliers or [])],
        warehouse_stock_options=[WarehouseStockOption(**wh) for wh in (state.warehouse_stock_options or [])],
        proposed_plan=plan_obj,
        is_executing=state.is_executing,
        current_executing_action_index=state.current_executing_action_index,
        rejection_reason=state.rejection_reason,
        error_message=state.error_message,
        verification_outcome=state.verification_outcome,
        verification_evidence=state.verification_evidence,
        audit_trail=audit_trail
    )
