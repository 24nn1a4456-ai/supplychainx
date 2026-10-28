from pydantic import BaseModel, Field, ConfigDict, AliasChoices
from typing import List, Optional, Tuple, Literal, Dict, Any


# ==========================================
# SUPPLY NODES & ROUTES
# ==========================================

NodeType = Literal['supplier', 'factory', 'warehouse', 'distribution_center', 'customer']
NodeStatus = Literal['operational', 'delayed', 'disrupted']
RouteState = Literal['normal', 'delayed', 'disrupted']


class SupplyNodeSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: str
    name: str
    type: NodeType
    status: NodeStatus
    isCriticalOutage: Optional[bool] = Field(default=False, validation_alias=AliasChoices("is_critical_outage", "isCriticalOutage"))
    region: str
    location: str
    position3D: Tuple[float, float, float] = Field(validation_alias=AliasChoices("position_3d", "position3D"))
    position2D: Tuple[float, float] = Field(validation_alias=AliasChoices("position_2d", "position2D"))
    throughputPerDay: int = Field(default=0, validation_alias=AliasChoices("throughput_per_day", "throughputPerDay"))
    capacityUtilizationPct: int = Field(default=0, validation_alias=AliasChoices("capacity_utilization_pct", "capacityUtilizationPct"))
    inventoryLevelPct: int = Field(default=0, validation_alias=AliasChoices("inventory_level_pct", "inventoryLevelPct"))
    leadTimeDays: int = Field(default=0, validation_alias=AliasChoices("lead_time_days", "leadTimeDays"))
    activeShipmentsCount: int = Field(default=0, validation_alias=AliasChoices("active_shipments_count", "activeShipmentsCount"))
    primaryProduct: str = Field(validation_alias=AliasChoices("primary_product", "primaryProduct"))
    disruptionCause: Optional[str] = Field(default=None, validation_alias=AliasChoices("disruption_cause", "disruptionCause"))
    estimatedRecoveryHours: Optional[int] = Field(default=None, validation_alias=AliasChoices("estimated_recovery_hours", "estimatedRecoveryHours"))
    contactLead: Optional[str] = Field(default=None, validation_alias=AliasChoices("contact_lead", "contactLead"))


class SupplyRouteSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: str
    sourceId: str = Field(validation_alias=AliasChoices("source_id", "sourceId"))
    targetId: str = Field(validation_alias=AliasChoices("target_id", "targetId"))
    state: RouteState
    cargoType: str = Field(validation_alias=AliasChoices("cargo_type", "cargoType"))
    volumeTEU: int = Field(validation_alias=AliasChoices("volume_teu", "volumeTEU"))
    transitHours: int = Field(validation_alias=AliasChoices("transit_hours", "transitHours"))
    transitProgressPct: int = Field(validation_alias=AliasChoices("transit_progress_pct", "transitProgressPct"))
    isRerouted: Optional[bool] = Field(default=False, validation_alias=AliasChoices("is_rerouted", "isRerouted"))
    congestedReason: Optional[str] = Field(default=None, validation_alias=AliasChoices("congested_reason", "congestedReason"))


# ==========================================
# KPIS & INVENTORY
# ==========================================

class KPISchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    resiliencyIndex: float = Field(validation_alias=AliasChoices("resiliency_index", "resiliencyIndex"))
    resiliencyDelta: float = Field(validation_alias=AliasChoices("resiliency_delta", "resiliencyDelta"))
    activeFleetVolumeTEU: int = Field(validation_alias=AliasChoices("active_fleet_volume_teu", "activeFleetVolumeTEU"))
    activeConvoysCount: int = Field(validation_alias=AliasChoices("active_convoys_count", "activeConvoysCount"))
    onTimeDeliveryRate: float = Field(validation_alias=AliasChoices("on_time_delivery_rate", "onTimeDeliveryRate"))
    deliveryRateDelta: float = Field(validation_alias=AliasChoices("delivery_rate_delta", "deliveryRateDelta"))
    criticalAlertsCount: int = Field(validation_alias=AliasChoices("critical_alerts_count", "criticalAlertsCount"))
    activeMitigationsCount: int = Field(validation_alias=AliasChoices("active_mitigations_count", "activeMitigationsCount"))
    carbonEfficiencyScore: float = Field(validation_alias=AliasChoices("carbon_efficiency_score", "carbonEfficiencyScore"))


class TopSKUItem(BaseModel):
    sku: str
    units: int
    daysOfSupply: int


class InventoryTelemetrySchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    hubId: str = Field(validation_alias=AliasChoices("hub_id", "hubId"))
    hubName: str = Field(validation_alias=AliasChoices("hub_name", "hubName"))
    region: str
    currentStockUnits: int = Field(validation_alias=AliasChoices("current_stock_units", "currentStockUnits"))
    maxStockUnits: int = Field(validation_alias=AliasChoices("max_stock_units", "maxStockUnits"))
    stockoutRiskDays: int = Field(validation_alias=AliasChoices("stockout_risk_days", "stockoutRiskDays"))
    healthStatus: Literal['healthy', 'warning', 'critical'] = Field(validation_alias=AliasChoices("health_status", "healthStatus"))
    topSKUs: List[TopSKUItem] = Field(validation_alias=AliasChoices("top_skus", "topSKUs"))


# ==========================================
# ORDERS & AUDIT EVENTS
# ==========================================

class CustomerOrderSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    orderId: str = Field(validation_alias=AliasChoices("order_id", "orderId"))
    customerName: str = Field(validation_alias=AliasChoices("customer_name", "customerName"))
    destination: str
    volumeUnits: int = Field(validation_alias=AliasChoices("volume_units", "volumeUnits"))
    contractValueUSD: str = Field(validation_alias=AliasChoices("contract_value_usd", "contractValueUSD"))
    slaDeadlineHours: int = Field(validation_alias=AliasChoices("sla_deadline_hours", "slaDeadlineHours"))
    riskTier: Literal['HIGH', 'CRITICAL', 'MEDIUM'] = Field(validation_alias=AliasChoices("risk_tier", "riskTier"))


class AuditLogSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: str
    timestamp: str
    stage: str
    actor: str
    action: str
    details: str
    status: Literal['SUCCESS', 'WARNING', 'REJECTED', 'SECURITY_BLOCKED']


# ==========================================
# CRISIS WORKFLOW SCHEMAS & ACTIONS
# ==========================================

WorkflowStage = Literal[
    'idle',
    'detected',
    'assessing',
    'planning',
    'awaiting_approval',
    'approved',
    'rejected',
    'executing',
    'completed',
    'failed'
]


class AffectedInventoryItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    sku: str
    description: str
    onHandUnits: int = Field(validation_alias=AliasChoices("on_hand_units", "onHandUnits"))
    dailyBurnRate: int = Field(validation_alias=AliasChoices("daily_burn_rate", "dailyBurnRate"))
    hoursOfRunwayLeft: int = Field(validation_alias=AliasChoices("hours_of_runway_left", "hoursOfRunwayLeft"))


class AffectedProductionLine(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    lineId: str = Field(validation_alias=AliasChoices("line_id", "lineId"))
    factoryName: str = Field(validation_alias=AliasChoices("factory_name", "factoryName"))
    impactStatus: Literal['starved', 'critical', 'throttled', 'operational'] = Field(
        validation_alias=AliasChoices("impact_status", "impactStatus")
    )
    hoursUntilShutdown: int = Field(validation_alias=AliasChoices("hours_until_shutdown", "hoursUntilShutdown"))
    affectedProducts: List[str] = Field(validation_alias=AliasChoices("affected_products", "affectedProducts"))
    dailyOutputLoss: str = Field(validation_alias=AliasChoices("daily_output_loss", "dailyOutputLoss"))


class AlternativeSupplierOption(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    supplierId: str = Field(validation_alias=AliasChoices("supplier_id", "supplierId"))
    supplierName: str = Field(validation_alias=AliasChoices("supplier_name", "supplierName"))
    location: str
    availableCapacityUnits: int = Field(validation_alias=AliasChoices("available_capacity_units", "availableCapacityUnits"))
    quotedLeadTimeDays: int = Field(validation_alias=AliasChoices("quoted_lead_time_days", "quotedLeadTimeDays"))
    unitCostUSD: float = Field(validation_alias=AliasChoices("unit_cost_usd", "unitCostUSD"))
    costDeltaPct: float = Field(validation_alias=AliasChoices("cost_delta_pct", "costDeltaPct"))
    reliabilityScore: float = Field(validation_alias=AliasChoices("reliability_score", "reliabilityScore"))
    readinessStatus: Literal['Immediate', '24h Spin-up', 'Restricted'] = Field(
        validation_alias=AliasChoices("readiness_status", "readinessStatus")
    )


class WarehouseStockOption(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    warehouseId: str = Field(validation_alias=AliasChoices("warehouse_id", "warehouseId"))
    warehouseName: str = Field(validation_alias=AliasChoices("warehouse_name", "warehouseName"))
    location: str
    availableBufferUnits: int = Field(validation_alias=AliasChoices("available_buffer_units", "availableBufferUnits"))
    transportMode: Literal['Charter Air Cargo', 'Express Freight', 'Standard Rail'] = Field(
        validation_alias=AliasChoices("transport_mode", "transportMode")
    )
    transitHours: int = Field(validation_alias=AliasChoices("transit_hours", "transitHours"))
    estimatedTransitCostUSD: str = Field(validation_alias=AliasChoices("estimated_transit_cost_usd", "estimatedTransitCostUSD"))
    sufficientToCoverDays: float = Field(validation_alias=AliasChoices("sufficient_to_cover_days", "sufficientToCoverDays"))


class RecoveryActionItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: str
    sequence: int
    title: str
    department: Literal['Procurement', 'Logistics', 'Plant Operations', 'Customer Success']
    actionType: Literal['Order Diversion', 'Air Charter', 'Line Throttle', 'Client Notice'] = Field(
        validation_alias=AliasChoices("action_type", "actionType")
    )
    executionStatus: Literal['pending', 'in_progress', 'verified', 'rejected'] = Field(
        validation_alias=AliasChoices("execution_status", "executionStatus")
    )
    costUSD: str = Field(validation_alias=AliasChoices("cost_usd", "costUSD"))
    durationMinutes: int = Field(validation_alias=AliasChoices("duration_minutes", "durationMinutes"))
    description: str
    syntheticVerificationNote: str = Field(validation_alias=AliasChoices("synthetic_verification_note", "syntheticVerificationNote"))


class EvaluatedTransportOptionSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    optionId: str = Field(validation_alias=AliasChoices("option_id", "optionId"))
    carrierName: str = Field(validation_alias=AliasChoices("carrier_name", "carrierName"))
    transportMode: str = Field(validation_alias=AliasChoices("transport_mode", "transportMode"))
    transitDays: int = Field(validation_alias=AliasChoices("transit_days", "transitDays"))
    freightCostUSD: str = Field(validation_alias=AliasChoices("freight_cost_usd", "freightCostUSD"))
    isFeasible: bool = Field(validation_alias=AliasChoices("is_feasible", "isFeasible"))
    weatherRiskScore: float = Field(validation_alias=AliasChoices("weather_risk_score", "weatherRiskScore"))
    weatherRiskLevel: str = Field(validation_alias=AliasChoices("weather_risk_level", "weatherRiskLevel"))
    weatherExplanation: str = Field(validation_alias=AliasChoices("weather_explanation", "weatherExplanation"))
    weatherDataSource: str = Field(validation_alias=AliasChoices("weather_data_source", "weatherDataSource"))
    isForecastUsed: bool = Field(validation_alias=AliasChoices("is_forecast_used", "isForecastUsed"))
    isRecommended: bool = Field(validation_alias=AliasChoices("is_recommended", "isRecommended"))


class ProposedRecoveryPlan(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    planId: str = Field(validation_alias=AliasChoices("plan_id", "planId"))
    title: str
    syntheticConfidenceScore: float = Field(validation_alias=AliasChoices("synthetic_confidence_score", "syntheticConfidenceScore"))
    estimatedTotalCostUSD: str = Field(validation_alias=AliasChoices("estimated_total_cost_usd", "estimatedTotalCostUSD"))
    deliveryTimeRecoveryHours: int = Field(validation_alias=AliasChoices("delivery_time_recovery_hours", "deliveryTimeRecoveryHours"))
    slaRecoveryPercentage: float = Field(validation_alias=AliasChoices("sla_recovery_percentage", "slaRecoveryPercentage"))
    targetSupplier: str = Field(validation_alias=AliasChoices("target_supplier", "targetSupplier"))
    selectedAltSupplier: str = Field(validation_alias=AliasChoices("selected_alt_supplier", "selectedAltSupplier"))
    selectedWarehouseBuffer: str = Field(validation_alias=AliasChoices("selected_warehouse_buffer", "selectedWarehouseBuffer"))
    detailedActions: List[RecoveryActionItem] = Field(validation_alias=AliasChoices("detailed_actions", "detailedActions"))
    weatherRiskScore: Optional[float] = Field(default=None, validation_alias=AliasChoices("weather_risk_score", "weatherRiskScore"))
    weatherRiskLevel: Optional[str] = Field(default=None, validation_alias=AliasChoices("weather_risk_level", "weatherRiskLevel"))
    weatherExplanation: Optional[str] = Field(default=None, validation_alias=AliasChoices("weather_explanation", "weatherExplanation"))
    weatherDataSource: Optional[str] = Field(default=None, validation_alias=AliasChoices("weather_data_source", "weatherDataSource"))
    evaluatedTransportOptions: List[EvaluatedTransportOptionSchema] = Field(
        default_factory=list,
        validation_alias=AliasChoices("evaluated_transport_options", "evaluatedTransportOptions")
    )


class OutageSimulationStateSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    stage: WorkflowStage
    timestamp: str
    selectedSupplierId: str = Field(validation_alias=AliasChoices("selected_supplier_id", "selectedSupplierId"))
    detectionSeverity: Literal['CRITICAL', 'SEVERE', 'MODERATE', 'NONE'] = Field(
        validation_alias=AliasChoices("detection_severity", "detectionSeverity")
    )
    affectedInventory: List[AffectedInventoryItem] = Field(validation_alias=AliasChoices("affected_inventory", "affectedInventory"))
    affectedProduction: List[AffectedProductionLine] = Field(validation_alias=AliasChoices("affected_production", "affectedProduction"))
    affectedOrders: List[CustomerOrderSchema] = Field(validation_alias=AliasChoices("affected_orders", "affectedOrders"))
    alternativeSuppliers: List[AlternativeSupplierOption] = Field(validation_alias=AliasChoices("alternative_suppliers", "alternativeSuppliers"))
    warehouseStockOptions: List[WarehouseStockOption] = Field(validation_alias=AliasChoices("warehouse_stock_options", "warehouseStockOptions"))
    proposedPlan: Optional[ProposedRecoveryPlan] = Field(default=None, validation_alias=AliasChoices("proposed_plan", "proposedPlan"))
    isExecuting: Optional[bool] = Field(default=False, validation_alias=AliasChoices("is_executing", "isExecuting"))
    currentExecutingActionIndex: Optional[int] = Field(default=None, validation_alias=AliasChoices("current_executing_action_index", "currentExecutingActionIndex"))
    rejectionReason: Optional[str] = Field(default=None, validation_alias=AliasChoices("rejection_reason", "rejectionReason"))
    errorMessage: Optional[str] = Field(default=None, validation_alias=AliasChoices("error_message", "errorMessage"))
    verificationOutcome: Optional[Literal['Resolved', 'Partially Resolved', 'Unresolved']] = Field(
        default=None, validation_alias=AliasChoices("verification_outcome", "verificationOutcome")
    )
    verificationEvidence: Optional[Dict[str, Any]] = Field(
        default=None, validation_alias=AliasChoices("verification_evidence", "verificationEvidence")
    )
    auditTrail: List[AuditLogSchema] = Field(default_factory=list, validation_alias=AliasChoices("audit_trail", "auditTrail"))


# Request payloads
class StartOutageRequest(BaseModel):
    supplierId: Optional[str] = Field(default="node-sup-1")
    cause: Optional[str] = Field(default="Regional Substation Meltdown & Cat-4 Typhoon Harbor Embargo")


class RejectPlanRequest(BaseModel):
    reason: str = Field(min_length=1, description="Operator rejection rationale is mandatory")


class ResetDemoResponse(BaseModel):
    status: str
    message: str
    simulation_state: OutageSimulationStateSchema
    success: Optional[bool] = True
    state: Optional[Dict[str, Any]] = None


# ==========================================
# HEALTH & METADATA RESPONSES
# ==========================================

class HealthResponse(BaseModel):
    status: str
    version: str
    database: str
    mode: str
    simulation_only: bool = True
