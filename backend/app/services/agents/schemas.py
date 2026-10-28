"""
Supply Chain X - Agentic AI Crisis Manager
Core Data Schemas & Validation Models
Author: Member 1 (Agentic AI Engineer)

Validated Pydantic models for crisis events, impacts, options,
recovery plans, approvals, and simulated recovery verification.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


# =====================================================================
# ENUMS
# =====================================================================

class CrisisType(str, Enum):
    """Categorization of supply chain crisis events."""
    SUPPLIER_BANKRUPTCY = "SUPPLIER_BANKRUPTCY"
    FACTORY_FIRE = "FACTORY_FIRE"
    NATURAL_DISASTER = "NATURAL_DISASTER"
    GEOPOLITICAL_SANCTION = "GEOPOLITICAL_SANCTION"
    QUALITY_RECALL = "QUALITY_RECALL"
    TRANSPORT_BLOCKADE = "TRANSPORT_BLOCKADE"
    CYBER_ATTACK = "CYBER_ATTACK"
    RAW_MATERIAL_SHORTAGE = "RAW_MATERIAL_SHORTAGE"
    CAPACITY_SHUTDOWN = "CAPACITY_SHUTDOWN"
    OTHER = "OTHER"


class SeverityLevel(str, Enum):
    """Severity classification based on impact and lead-time pressure."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class CrisisStatus(str, Enum):
    """Lifecycle status of a crisis event."""
    DETECTED = "DETECTED"
    ASSESSING = "ASSESSING"
    PLANNING = "PLANNING"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    EXECUTING = "EXECUTING"
    RECOVERY_SIMULATED = "RECOVERY_SIMULATED"
    RESOLVED = "RESOLVED"
    DISMISSED = "DISMISSED"


class TransportMode(str, Enum):
    """Logistics transportation modes."""
    AIR_FREIGHT = "AIR_FREIGHT"
    EXPEDITED_TRUCK = "EXPEDITED_TRUCK"
    STANDARD_TRUCK = "STANDARD_TRUCK"
    RAIL_FREIGHT = "RAIL_FREIGHT"
    OCEAN_FREIGHT = "OCEAN_FREIGHT"


class ActionType(str, Enum):
    """Types of executable recovery actions."""
    SUPPLIER_REALLOCATION = "SUPPLIER_REALLOCATION"
    INVENTORY_BUFFER_RELEASE = "INVENTORY_BUFFER_RELEASE"
    EXPEDITED_LOGISTICS = "EXPEDITED_LOGISTICS"
    PRODUCTION_RESCHEDULE = "PRODUCTION_RESCHEDULE"
    SECONDARY_SOURCING = "SECONDARY_SOURCING"
    SAFETY_STOCK_TRANSFER = "SAFETY_STOCK_TRANSFER"


class ApprovalLevel(str, Enum):
    """Approval necessity for recovery actions and plans."""
    AUTONOMOUS = "AUTONOMOUS"             # Below threshold, auto-executable
    OPERATIONS_LEAD = "OPERATIONS_LEAD"   # Moderate impact / cost
    EXECUTIVE = "EXECUTIVE"               # High financial or strategic impact


class ActionStatus(str, Enum):
    """Status of an individual recovery action."""
    PROPOSED = "PROPOSED"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXECUTED = "EXECUTED"
    CANCELLED = "CANCELLED"


class PlanApprovalStatus(str, Enum):
    """Approval status of the synthesized recovery plan."""
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    READY_FOR_SIMULATION = "READY_FOR_SIMULATION"
    AUTO_APPROVED = "AUTO_APPROVED"
    HUMAN_APPROVED = "HUMAN_APPROVED"
    INFEASIBLE = "INFEASIBLE"
    REJECTED = "REJECTED"
    SUPERSEDED = "SUPERSEDED"


class ApprovalDecision(str, Enum):
    """Human decision on approval requests."""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    MODIFIED = "MODIFIED"


class RecoveryStatus(str, Enum):
    """Outcome of recovery verification & simulation."""
    VERIFIED_FEASIBLE = "VERIFIED_FEASIBLE"
    PARTIALLY_FEASIBLE = "PARTIALLY_FEASIBLE"
    INFEASIBLE = "INFEASIBLE"
    SIMULATION_FAILED = "SIMULATION_FAILED"


# =====================================================================
# MODEL 1: CrisisEvent
# =====================================================================

class CrisisEvent(BaseModel):
    """
    Primary trigger model representing an anomalous disruption event.
    Must contain a unique ID, type, severity, affected product IDs,
    creation timestamp, and status.
    """
    crisis_id: str = Field(..., description="Unique identifier for the crisis event (e.g. CR-2026-001)")
    event_type: CrisisType = Field(..., description="Classification of the disruption")
    severity: SeverityLevel = Field(..., description="Assessed disruption severity")
    affected_product_ids: List[str] = Field(..., min_length=1, description="List of affected SKU / product identifiers")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Timestamp when crisis was recorded")
    status: CrisisStatus = Field(default=CrisisStatus.DETECTED, description="Current crisis handling status")
    
    # Contextual metadata
    supplier_id: Optional[str] = Field(None, description="Identifier of the failing supplier if known")
    supplier_name: Optional[str] = Field(None, description="Name of failing supplier if available")
    facility_id: Optional[str] = Field(None, description="Affected facility / plant / warehouse")
    description: str = Field(..., description="Brief factual description of the disruption")
    source: str = Field(default="MONITORING_ALERT", description="Telemetry source or alert origin")
    raw_payload: Optional[Dict[str, Any]] = Field(default=None, description="Original raw alert or webhook payload")

    @field_validator("crisis_id")
    @classmethod
    def validate_crisis_id(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("crisis_id cannot be blank")
        return v.strip()

    @field_validator("affected_product_ids")
    @classmethod
    def validate_product_ids(cls, v: List[str]) -> List[str]:
        cleaned = [p.strip() for p in v if p and p.strip()]
        if not cleaned:
            raise ValueError("affected_product_ids must contain at least one valid product ID")
        return cleaned


# =====================================================================
# MODEL 2: ImpactAssessment
# =====================================================================

class ImpactAssessment(BaseModel):
    """
    Assessment generated by Impact Specialist Agent quantifying the disruption's
    operational, inventory, and financial blast radius.
    """
    assessment_id: str = Field(..., description="Unique identifier for this assessment")
    crisis_id: str = Field(..., description="Associated crisis event ID")
    affected_product_ids: List[str] = Field(..., min_length=1)
    production_lines_at_risk: List[str] = Field(default_factory=list, description="IDs of assembly or production lines affected")
    estimated_daily_revenue_loss: float = Field(..., ge=0.0, description="Estimated daily revenue loss in USD")
    days_to_stockout: float = Field(..., ge=0.0, description="Estimated days until zero inventory is reached")
    units_at_risk: int = Field(..., ge=0, description="Total units short or delayed across affected products")
    sla_breach_risk: bool = Field(default=False, description="True if customer SLA penalty window will be violated")
    assessed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    criticality_summary: str = Field(..., description="Concise summary of operational bottleneck")


# =====================================================================
# MODEL 3: SupplierOption
# =====================================================================

class SupplierOption(BaseModel):
    """
    Alternative supplier option evaluated by Supplier Specialist Agent.
    Values must NOT be invented; must be verified via connector tools.
    """
    option_id: str = Field(..., description="Unique identifier for this supplier candidate")
    supplier_id: str = Field(..., description="Vendor ID in ERP/Procurement system")
    supplier_name: str = Field(..., description="Vendor legal entity name")
    product_id: str = Field(..., description="SKU / component supplied")
    available_capacity: int = Field(..., ge=0, description="Verified available output quantity")
    unit_price: float = Field(..., ge=0.0, description="Unit cost in USD")
    currency: str = Field(default="USD", description="Currency code ISO 4217")
    quoted_lead_time_days: int = Field(..., ge=0, description="Lead time in calendar days")
    reliability_score: float = Field(..., ge=0.0, le=1.0, description="Historical supplier performance score [0.0 - 1.0]")
    contract_status: str = Field(..., description="Contract status (e.g. PRIMARY, BACKUP_ACTIVE, SPOT_APPROVED)")
    minimum_order_quantity: int = Field(default=1, ge=1, description="MOQ enforced by vendor")


# =====================================================================
# MODEL 4: InventoryOption
# =====================================================================

class InventoryOption(BaseModel):
    """
    Inventory reallocation option evaluated by Inventory Specialist Agent.
    Values must NOT be invented; must be retrieved from WMS/ERP inventory snapshot.
    """
    option_id: str = Field(..., description="Unique option identifier")
    warehouse_id: str = Field(..., description="Origin warehouse / depot ID")
    warehouse_location: str = Field(..., description="Geographic location or region")
    product_id: str = Field(..., description="Product SKU identifier")
    available_stock: int = Field(..., ge=0, description="Current total stock physically present")
    reserved_safety_stock: int = Field(..., ge=0, description="Reserved safety stock threshold")
    reallocatable_units: int = Field(..., ge=0, description="Units safely available for emergency redirection")
    transfer_cost_per_unit: float = Field(..., ge=0.0, description="Cost per unit to transfer/repack")
    transfer_lead_time_days: int = Field(..., ge=0, description="Days to pick, pack, and transfer to target plant")

    @model_validator(mode="after")
    def validate_reallocatable_units(self) -> "InventoryOption":
        if self.reallocatable_units > self.available_stock:
            raise ValueError("reallocatable_units cannot exceed available_stock")
        return self


# =====================================================================
# MODEL 5: LogisticsOption
# =====================================================================

class LogisticsOption(BaseModel):
    """
    Logistics expedite / reroute option evaluated by Logistics Specialist Agent.
    Values must NOT be invented; must be verified via carrier rate cards/APIs.
    """
    option_id: str = Field(..., description="Unique option identifier")
    carrier_id: str = Field(..., description="Carrier ID in TMS")
    carrier_name: str = Field(..., description="Carrier name (e.g. DHL Express, FedEx, Maersk)")
    transport_mode: TransportMode = Field(..., description="Freight mode")
    origin: str = Field(..., description="Origin port / city / warehouse")
    destination: str = Field(..., description="Destination plant / facility")
    max_weight_capacity_kg: Optional[float] = Field(None, ge=0.0, description="Maximum cargo weight capacity")
    transit_time_days: int = Field(..., ge=0, description="Transit time in calendar days")
    expedited_fee: float = Field(..., ge=0.0, description="Expedited surcharge / freight total in USD")
    co2_emission_estimate_kg: Optional[float] = Field(None, ge=0.0, description="Estimated carbon emissions for route")


# =====================================================================
# MODEL 6: RecoveryAction
# =====================================================================

class RecoveryAction(BaseModel):
    """
    Concrete actionable recovery step synthesized in a recovery plan.
    Must contain action ID, action type, description, required quantity
    when applicable, estimated cost, expected lead time, approval requirement,
    and status.
    """
    action_id: str = Field(..., description="Unique action ID (e.g. ACT-001)")
    action_type: ActionType = Field(..., description="Operational category of action")
    description: str = Field(..., description="Clear explanation of the recovery action")
    required_quantity: Optional[int] = Field(None, ge=0, description="Units needed/diverted when applicable")
    estimated_cost: float = Field(..., ge=0.0, description="Estimated total cost in USD for this action")
    expected_lead_time: int = Field(..., ge=0, description="Expected lead time in days to complete this action")
    approval_requirement: ApprovalLevel = Field(..., description="Required authorization level")
    status: ActionStatus = Field(default=ActionStatus.PROPOSED, description="Current execution lifecycle status")
    
    # Metadata for downstream execution engines
    target_entity_id: Optional[str] = Field(None, description="Target supplier_id, warehouse_id, or carrier_id")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Execution parameters passed to Member 2/4")


# =====================================================================
# MODEL 7: RecoveryPlan
# =====================================================================

class RecoveryPlan(BaseModel):
    """
    Synthesized comprehensive recovery strategy.
    Must include crisis ID, recommended actions, alternatives considered,
    estimated total cost, estimated recovery time, assumptions, and approval status.
    """
    plan_id: str = Field(..., description="Unique recovery plan identifier (e.g. PLAN-2026-001-A)")
    crisis_id: str = Field(..., description="Reference to the originating crisis event ID")
    recommended_actions: List[RecoveryAction] = Field(default_factory=list, description="Prioritized sequence of recommended actions")
    alternatives_considered: List[Dict[str, Any]] = Field(default_factory=list, description="Evaluated but rejected or fallback options")
    estimated_total_cost: float = Field(..., ge=0.0, description="Sum of all recommended action costs")
    estimated_recovery_time: int = Field(..., ge=0, description="Critical path recovery lead time in days")
    assumptions: List[str] = Field(default_factory=list, description="Explicit assumptions made by agents during synthesis")
    approval_status: PlanApprovalStatus = Field(default=PlanApprovalStatus.DRAFT, description="Approval governance status")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @model_validator(mode="after")
    def validate_plan_consistency(self) -> "RecoveryPlan":
        """Calculations validation: ensures estimated_total_cost matches recommended actions sum."""
        if self.approval_status == PlanApprovalStatus.INFEASIBLE and len(self.recommended_actions) == 0:
            if self.estimated_total_cost != 0.0:
                raise ValueError("estimated_total_cost must be 0.0 for an INFEASIBLE plan with zero actions")
            return self

        computed_cost = round(sum(action.estimated_cost for action in self.recommended_actions), 2)
        # Allow tiny float rounding tolerance (+/- $1.00)
        if abs(self.estimated_total_cost - computed_cost) > 1.0:
            raise ValueError(
                f"estimated_total_cost ({self.estimated_total_cost}) must equal the sum of "
                f"recommended_actions estimated_cost ({computed_cost})"
            )
        return self


# =====================================================================
# MODEL 8: ApprovalRequest
# =====================================================================

class ApprovalRequest(BaseModel):
    """
    Human-in-the-loop governance request generated when a plan exceeds
    cost, lead-time, or critical risk thresholds.
    """
    request_id: str = Field(..., description="Unique identifier for approval ticket")
    crisis_id: str = Field(..., description="Associated crisis event ID")
    plan_id: str = Field(..., description="Associated recovery plan ID")
    cost_threshold_exceeded: bool = Field(..., description="True if total cost exceeds autonomous budget")
    lead_time_threshold_exceeded: bool = Field(..., description="True if lead time exceeds autonomous SLA")
    requires_human_approval: bool = Field(..., description="Overall boolean requiring human intervention")
    requested_by: str = Field(default="AgenticCrisisManager", description="Agent issuing the request")
    requested_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reason: str = Field(..., description="Plain-language justification for human gatekeeping")
    actions_requiring_approval: List[str] = Field(default_factory=list, description="Action IDs requiring individual approval")
    decision: ApprovalDecision = Field(default=ApprovalDecision.PENDING, description="Human decision outcome")
    decision_notes: Optional[str] = Field(None, description="Auditor feedback or revision rationale")
    decided_by: Optional[str] = Field(None, description="User / Role who resolved this request")
    decided_at: Optional[datetime] = Field(None, description="Timestamp of human decision")


# =====================================================================
# MODEL 9: RecoveryResult
# =====================================================================

class RecoveryResult(BaseModel):
    """
    Verification model recording the simulation outcome of the recovery plan
    before any real-world commands are permitted.
    """
    result_id: str = Field(..., description="Unique simulation verification result identifier")
    crisis_id: str = Field(..., description="Associated crisis event ID")
    plan_id: str = Field(..., description="Associated recovery plan ID")
    simulation_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: RecoveryStatus = Field(..., description="Outcome of simulated recovery check")
    demand_coverage_percent: float = Field(..., ge=0.0, le=100.0, description="Percentage of lost demand restored by plan")
    lead_time_slack_days: float = Field(..., description="Slack days before stockout/SLA breach (positive = safe buffer)")
    cost_delta_vs_baseline: float = Field(..., description="Cost difference in USD compared to pre-crisis operational baseline")
    unmitigated_risk_summary: List[str] = Field(default_factory=list, description="Residual operational risks not fully eliminated")
    verification_notes: str = Field(..., description="Deterministic verification check notes")


# =====================================================================
# CALCULATION & GOVERNANCE UTILITIES
# Keep calculations strictly separated from AI reasoning.
# =====================================================================

def calculate_plan_total_cost(actions: List[RecoveryAction]) -> float:
    """Calculate the deterministic sum of all action costs."""
    return round(sum(action.estimated_cost for action in actions), 2)


def calculate_plan_critical_lead_time(actions: List[RecoveryAction]) -> int:
    """
    Calculate the critical path lead time in days.
    Independent parallel actions take max, dependent actions take sum.
    Default deterministic baseline: max of required actions.
    """
    if not actions:
        return 0
    return max(action.expected_lead_time for action in actions)


def assess_human_approval_required(
    total_cost: float,
    recovery_lead_time_days: int,
    severity: SeverityLevel,
    cost_limit: float = 50000.0,
    lead_time_limit_days: int = 14,
    actions: Optional[List[RecoveryAction]] = None,
) -> tuple[bool, str, bool, bool]:
    """
    Deterministic rule engine checking if human approval is mandatory.
    Returns: (requires_approval, reason, cost_exceeded, lead_time_exceeded)
    """
    cost_exceeded = total_cost > cost_limit
    lead_time_exceeded = recovery_lead_time_days > lead_time_limit_days
    critical_severity = severity in (SeverityLevel.HIGH, SeverityLevel.CRITICAL)
    
    has_exec_action = False
    if actions:
        has_exec_action = any(
            a.approval_requirement in (ApprovalLevel.OPERATIONS_LEAD, ApprovalLevel.EXECUTIVE)
            for a in actions
        )

    reasons = []
    if cost_exceeded:
        reasons.append(f"Estimated total cost (${total_cost:,.2f}) exceeds autonomous limit (${cost_limit:,.2f})")
    if lead_time_exceeded:
        reasons.append(f"Recovery time ({recovery_lead_time_days} days) exceeds autonomous SLA ({lead_time_limit_days} days)")
    if critical_severity:
        reasons.append(f"Disruption severity is {severity.value}")
    if has_exec_action:
        reasons.append("One or more individual actions mandate managerial approval")

    requires_approval = bool(cost_exceeded or lead_time_exceeded or critical_severity or has_exec_action)
    reason_str = "; ".join(reasons) if reasons else "Within autonomous resolution parameters"
    return requires_approval, reason_str, cost_exceeded, lead_time_exceeded


# =====================================================================
# AGENT 1: CRISIS DETECTION SCHEMAS
# =====================================================================

class SignalType(str, Enum):
    """Categorization of operational alerts that may trigger a crisis."""
    SUPPLIER_OUTAGE = "SUPPLIER_OUTAGE"
    LOW_STOCK = "LOW_STOCK"
    SHIPMENT_DELAY = "SHIPMENT_DELAY"
    DEMAND_SPIKE = "DEMAND_SPIKE"
    ANOMALY = "ANOMALY"


class TelemetrySignal(BaseModel):
    """Input schema for Agent 1 (Crisis Detection)."""
    signal_id: str = Field(..., description="Unique event or telemetry signal identifier")
    signal_type: SignalType = Field(..., description="Type of operational signal")
    entity_id: str = Field(..., description="ID of affected entity (supplier, warehouse, shipment, etc.)")
    product_ids: List[str] = Field(..., min_length=1, description="Affected product/component SKUs")
    source: str = Field(default="MONITORING_ALERT", description="Data source or sensor origin")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    data: Dict[str, Any] = Field(default_factory=dict, description="Signal-specific metrics and payload")


class DetectionResult(BaseModel):
    """Output schema for Agent 1 (Crisis Detection)."""
    crisis_detected: bool = Field(..., description="Whether a valid crisis threshold was breached")
    crisis_event: Optional[CrisisEvent] = Field(None, description="Structured CrisisEvent if detected")
    is_duplicate: bool = Field(default=False, description="True if identical active incident was already recorded")
    detection_rule: Optional[str] = Field(None, description="Name of rule that triggered detection")
    reason: str = Field(..., description="Factual explanation of detection evaluation")


# =====================================================================
# AGENT 2: IMPACT ASSESSMENT SCHEMAS
# =====================================================================

class CustomerOrder(BaseModel):
    """Customer order details for blast radius estimation."""
    order_id: str = Field(..., description="Sales order ID")
    customer_name: str = Field(..., description="Customer enterprise name")
    product_id: str = Field(..., description="Finished good or component SKU")
    quantity: int = Field(..., ge=1, description="Ordered quantity")
    revenue_value_usd: float = Field(..., ge=0.0, description="Order value in USD")
    delivery_due_date: datetime = Field(..., description="Promised fulfillment SLA timestamp")
    is_critical: bool = Field(default=False, description="Key strategic customer or tier-1 SLA")


class ProductionRequirement(BaseModel):
    """Manufacturing requirement for affected components."""
    line_id: str = Field(..., description="Production / assembly line identifier")
    product_id: str = Field(..., description="Required input SKU")
    daily_run_rate_units: int = Field(..., ge=1, description="Units consumed per 24 hours of operation")
    min_buffer_days: int = Field(default=3, ge=1, description="Minimum days of stock required for safe operation")


class ImpactAssessmentInput(BaseModel):
    """Input schema for Agent 2 (Impact Assessment)."""
    crisis: CrisisEvent = Field(..., description="Originating crisis event")
    customer_orders: Optional[List[CustomerOrder]] = Field(default=None, description="Active customer orders; queried if None")
    production_requirements: Optional[List[ProductionRequirement]] = Field(default=None, description="Active line schedules; queried if None")
    unit_revenue_usd: float = Field(default=120.0, ge=0.0, description="Baseline revenue impact per unit")


class ImpactAssessmentResult(BaseModel):
    """Output schema for Agent 2 (Impact Assessment)."""
    assessment: ImpactAssessment = Field(..., description="Core ImpactAssessment model")
    affected_customer_orders: List[CustomerOrder] = Field(default_factory=list, description="Orders in jeopardy")
    total_delayed_order_value_usd: float = Field(..., ge=0.0, description="Financial revenue at risk from unfulfilled orders")
    daily_burn_rate_units: int = Field(..., ge=0, description="Aggregate component consumption across active lines")
    days_to_stockout: float = Field(..., ge=0.0, description="Exact days until zero physical inventory")
    calculated_severity: SeverityLevel = Field(..., description="Computed severity from empirical risk rules")
    production_lines_affected: List[str] = Field(default_factory=list, description="Assembly lines facing shutdown")
    missing_data_warnings: List[str] = Field(default_factory=list, description="Explicit notes on missing telemetry")


# =====================================================================
# AGENT 3: SUPPLIER EVALUATION SCHEMAS
# =====================================================================

class SupplierEvaluationInput(BaseModel):
    """Input schema for Agent 3 (Supplier Evaluation)."""
    crisis_id: str = Field(..., description="Crisis event identifier")
    product_id: str = Field(..., description="Component SKU needing replacement")
    required_quantity: int = Field(..., ge=1, description="Total units required to cover disruption")
    max_acceptable_lead_time_days: Optional[int] = Field(None, ge=1, description="Upper bound on lead time")
    min_reliability_score: float = Field(default=0.70, ge=0.0, le=1.0, description="Quality/reliability filter floor")
    excluded_supplier_id: Optional[str] = Field(None, description="Failing supplier ID to exclude from consideration")
    use_optimizer_validation: bool = Field(default=False, description="Delegate ranking to Member 4 optimizer if available")


class RankedSupplierOption(BaseModel):
    """Ranked alternative supplier candidate."""
    rank: int = Field(..., ge=1, description="Ordinal priority rank (1 = best)")
    option: SupplierOption = Field(..., description="Underlying verified supplier option")
    composite_score: float = Field(..., description="Weighted evaluation score (higher = better)")
    fulfillable_quantity: int = Field(..., ge=0, description="Units this vendor can deliver within constraints")
    total_estimated_cost_usd: float = Field(..., ge=0.0, description="Cost for fulfillable units")
    meets_all_constraints: bool = Field(..., description="True if lead time and MOQ are met")
    explanation: str = Field(..., description="Deterministic reasoning based on verified fields")


class RejectedSupplierOption(BaseModel):
    """Supplier option rejected due to violated operational constraints."""
    option: SupplierOption = Field(..., description="Rejected supplier option")
    rejection_reason: str = Field(..., description="Explicit reason why vendor cannot satisfy recovery")
    failed_constraint: str = Field(..., description="Identified constraint (e.g. INSUFFICIENT_CAPACITY, LEAD_TIME_EXCEEDED)")


class SupplierEvaluationResult(BaseModel):
    """Output schema for Agent 3 (Supplier Evaluation)."""
    product_id: str = Field(..., description="Component SKU evaluated")
    required_quantity: int = Field(..., ge=1, description="Quantity demanded")
    ranked_options: List[RankedSupplierOption] = Field(default_factory=list, description="Qualified options in priority order")
    rejected_options: List[RejectedSupplierOption] = Field(default_factory=list, description="Disqualified supplier options")
    total_qualified_capacity: int = Field(..., ge=0, description="Sum of capacity across qualified vendors")
    has_sufficient_capacity: bool = Field(..., description="True if qualified vendors can fulfill required_quantity")
    optimizer_validation_status: Optional[str] = Field(None, description="Feedback from Member 4's solver if consulted")


# =====================================================================
# AGENT 4: INVENTORY RECOVERY SCHEMAS
# =====================================================================

class InventoryRecoveryInput(BaseModel):
    """Input schema for Agent 4 (Inventory Recovery)."""
    crisis_id: str = Field(..., description="Crisis event identifier")
    product_id: str = Field(..., description="Component SKU requiring buffer reallocation")
    required_quantity: int = Field(..., ge=1, description="Total units needed from inventory buffer")
    destination_facility_id: str = Field(default="PLANT-MAIN", description="Destination factory or warehouse")
    max_transfer_lead_time_days: Optional[int] = Field(None, ge=1, description="Maximum allowable transfer transit time")
    allow_partial_recovery: bool = Field(default=True, description="Allow partial allocations across warehouses")


class FeasibleTransferOption(BaseModel):
    """Feasible inventory reallocation from a specific warehouse."""
    warehouse_id: str = Field(..., description="Origin warehouse ID")
    warehouse_location: str = Field(..., description="Geographic location")
    product_id: str = Field(..., description="Component SKU")
    allocated_units: int = Field(..., ge=1, description="Units to transfer from this warehouse")
    unit_transfer_cost: float = Field(..., ge=0.0, description="Transfer / handling fee per unit")
    total_transfer_cost: float = Field(..., ge=0.0, description="Total cost for this transfer")
    transfer_lead_time_days: int = Field(..., ge=0, description="Days to pick, pack, and arrive at destination")
    safety_stock_retained: int = Field(..., ge=0, description="Safety stock preserved at origin warehouse")


class IneligibleWarehouseOption(BaseModel):
    """Warehouse disqualified from transferring inventory."""
    warehouse_id: str = Field(..., description="Warehouse ID")
    warehouse_location: str = Field(..., description="Location")
    reason: str = Field(..., description="Disqualification reason (e.g. zero buffer above safety stock)")


class InventoryRecoveryResult(BaseModel):
    """Output schema for Agent 4 (Inventory Recovery)."""
    product_id: str = Field(..., description="Product SKU")
    required_quantity: int = Field(..., ge=1, description="Target needed units")
    total_reallocatable_stock: int = Field(..., ge=0, description="Total available stock above safety reserves across network")
    allocated_quantity: int = Field(..., ge=0, description="Total units successfully allocated across feasible transfers")
    shortfall_quantity: int = Field(..., ge=0, description="Unmet units (required - allocated)")
    is_fully_covered: bool = Field(..., description="True if allocated_quantity == required_quantity")
    feasible_transfers: List[FeasibleTransferOption] = Field(default_factory=list, description="Feasible transfers")
    ineligible_warehouses: List[IneligibleWarehouseOption] = Field(default_factory=list, description="Disqualified depots")
    estimated_total_transfer_cost: float = Field(..., ge=0.0, description="Total handling/transfer cost in USD")
    critical_transfer_lead_time_days: int = Field(..., ge=0, description="Max lead time among chosen transfers")


# =====================================================================
# AGENT 5: LOGISTICS RECOVERY SCHEMAS
# =====================================================================

class LogisticsRecoveryInput(BaseModel):
    """Input schema for Agent 5 (Logistics Recovery)."""
    origin: str = Field(..., description="Shipment origin (city, port, or warehouse)")
    destination: str = Field(..., description="Shipment destination (plant or assembly center)")
    cargo_weight_kg: Optional[float] = Field(None, ge=0.0, description="Total shipment cargo weight in kg")
    required_delivery_days: Optional[int] = Field(None, ge=1, description="Delivery deadline in calendar days")
    product_ids: List[str] = Field(default_factory=list, description="Cargo product identifiers")


class EvaluatedLogisticsOption(BaseModel):
    """Logistics option evaluated against requirements and verified constraints."""
    option: LogisticsOption = Field(..., description="Underlying verified logistics corridor")
    is_feasible: bool = Field(..., description="True if option meets cargo weight and deadline constraints")
    total_freight_cost: float = Field(..., ge=0.0, description="Total freight and expedite charge")
    transit_time_days: int = Field(..., ge=0, description="Transit duration in days")
    meets_deadline: bool = Field(..., description="True if transit time <= required_delivery_days")
    capacity_verified: bool = Field(..., description="True if weight capacity is explicitly recorded")
    data_completeness_flag: bool = Field(..., description="False if crucial metrics are unspecified")
    evaluation_notes: str = Field(..., description="Summary of evaluation")
    weather_risk_score: float = Field(default=15.0, ge=0.0, le=100.0, description="Corridor weather risk score (0-100)")
    weather_risk_level: str = Field(default="low", description="Risk tier: low, moderate, high, severe")
    weather_explanation: str = Field(default="Verified baseline weather envelope", description="Meteorological impact explanation")
    weather_data_source: str = Field(default="deterministic_fallback", description="openweather_forecast, openweather_observed, or deterministic_fallback")
    is_forecast_used: bool = Field(default=False, description="True if real forecast was evaluated across transit window")


class LogisticsRecoveryResult(BaseModel):
    """Output schema for Agent 5 (Logistics Recovery)."""
    origin: str = Field(..., description="Origin")
    destination: str = Field(..., description="Destination")
    evaluated_options: List[EvaluatedLogisticsOption] = Field(default_factory=list, description="Evaluated carrier options")
    recommended_option: Optional[LogisticsOption] = Field(None, description="Optimal balanced logistics option")
    fastest_option: Optional[LogisticsOption] = Field(None, description="Fastest transit option regardless of cost")
    lowest_cost_option: Optional[LogisticsOption] = Field(None, description="Most economical option")
    recommended_weather_score: Optional[float] = Field(None, description="Weather risk score of recommended carrier")
    recommended_weather_level: Optional[str] = Field(None, description="Weather risk level of recommended carrier")
    recommended_weather_explanation: Optional[str] = Field(None, description="Explanation for weather impact on recommendation")
    missing_information_warnings: List[str] = Field(default_factory=list, description="Identified missing data or unverified assumptions")
    has_viable_option: bool = Field(..., description="True if at least one feasible carrier corridor exists")

