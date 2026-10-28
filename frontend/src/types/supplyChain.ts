export type NodeType = 'supplier' | 'factory' | 'warehouse' | 'distribution_center' | 'customer';

export type NodeStatus = 'operational' | 'delayed' | 'disrupted';

export type RouteState = 'normal' | 'delayed' | 'disrupted';

export interface SupplyNode {
  id: string;
  name: string;
  type: NodeType;
  status: NodeStatus;
  isCriticalOutage?: boolean;
  region: string;
  location: string;
  position3D: [number, number, number];
  position2D: [number, number]; // Percentage coords for 2D fallback
  throughputPerDay: number;
  capacityUtilizationPct: number;
  inventoryLevelPct: number;
  leadTimeDays: number;
  activeShipmentsCount: number;
  primaryProduct: string;
  disruptionCause?: string;
  estimatedRecoveryHours?: number;
  contactLead?: string;
}

export interface SupplyRoute {
  id: string;
  sourceId: string;
  targetId: string;
  state: RouteState;
  cargoType: string;
  volumeTEU: number;
  transitHours: number;
  transitProgressPct: number;
  isRerouted?: boolean;
  congestedReason?: string;
}

export interface KPIData {
  resiliencyIndex: number; // e.g. 78.4%
  resiliencyDelta: number; // -4.2%
  activeFleetVolumeTEU: number; // e.g. 18,450
  activeConvoysCount: number; // 92
  onTimeDeliveryRate: number; // e.g. 89.6%
  deliveryRateDelta: number; // -5.8%
  criticalAlertsCount: number; // 2
  activeMitigationsCount: number; // 4
  carbonEfficiencyScore: number; // 94.2
}

export interface DisruptionAlert {
  id: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
  timestamp: string;
  nodeId?: string;
  nodeName?: string;
  impactSummary: string;
  recommendedAction: string;
  playbookId?: string;
}

export interface InventoryTelemetry {
  hubId: string;
  hubName: string;
  region: string;
  currentStockUnits: number;
  maxStockUnits: number;
  stockoutRiskDays: number;
  healthStatus: 'healthy' | 'warning' | 'critical';
  topSKUs: { sku: string; units: number; daysOfSupply: number }[];
}

export interface CrisisPlaybook {
  id: string;
  title: string;
  triggerCondition: string;
  targetNodeId: string;
  alternateNodeId: string;
  impactMetrics: {
    slaRecoveryPct: number;
    delayReductionHours: number;
    costImpactUSD: string;
    reroutedTEU: number;
  };
  steps: string[];
  executed: boolean;
}

// -------------------------------------------------------------
// SUPPLIER-OUTAGE WORKFLOW DEMO & AUDIT TYPES
// -------------------------------------------------------------

export type WorkflowStage =
  | 'idle'
  | 'detected'
  | 'assessing'
  | 'planning'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'completed'
  | 'failed';

export interface AffectedProductionLine {
  lineId: string;
  factoryName: string;
  impactStatus: 'starved' | 'critical' | 'throttled' | 'operational';
  hoursUntilShutdown: number;
  affectedProducts: string[];
  dailyOutputLoss: string;
}

export interface AffectedCustomerOrder {
  orderId: string;
  customerName: string;
  destination: string;
  volumeUnits: number;
  contractValueUSD: string;
  slaDeadlineHours: number;
  riskTier: 'HIGH' | 'CRITICAL' | 'MEDIUM';
}

export type CustomerOrder = AffectedCustomerOrder;

export interface AlternativeSupplierOption {
  supplierId: string;
  supplierName: string;
  location: string;
  availableCapacityUnits: number;
  quotedLeadTimeDays: number;
  unitCostUSD: number;
  costDeltaPct: number;
  reliabilityScore: number;
  readinessStatus: 'Immediate' | '24h Spin-up' | 'Restricted';
}

export interface WarehouseStockOption {
  warehouseId: string;
  warehouseName: string;
  location: string;
  availableBufferUnits: number;
  transportMode: 'Charter Air Cargo' | 'Express Freight' | 'Standard Rail';
  transitHours: number;
  estimatedTransitCostUSD: string;
  sufficientToCoverDays: number;
}

export interface EvaluatedTransportOption {
  optionId: string;
  carrierName: string;
  transportMode: string;
  transitDays: number;
  freightCostUSD: string;
  isFeasible: boolean;
  weatherRiskScore: number;
  weatherRiskLevel: 'low' | 'moderate' | 'high' | 'severe';
  weatherExplanation: string;
  weatherDataSource: 'openweather_forecast' | 'openweather_observed' | 'deterministic_fallback';
  isForecastUsed: boolean;
  isRecommended: boolean;
}

export interface ProposedRecoveryPlan {
  planId: string;
  title: string;
  syntheticConfidenceScore: number; // Clearly simulated
  estimatedTotalCostUSD: string;
  deliveryTimeRecoveryHours: number;
  slaRecoveryPercentage: number;
  targetSupplier: string;
  selectedAltSupplier: string;
  selectedWarehouseBuffer: string;
  detailedActions: RecoveryActionItem[];
  weatherRiskScore?: number;
  weatherRiskLevel?: 'low' | 'moderate' | 'high' | 'severe';
  weatherExplanation?: string;
  weatherDataSource?: 'openweather_forecast' | 'openweather_observed' | 'deterministic_fallback';
  evaluatedTransportOptions?: EvaluatedTransportOption[];
}

export interface RecoveryActionItem {
  id: string;
  sequence: number;
  title: string;
  department: 'Procurement' | 'Logistics' | 'Plant Operations' | 'Customer Success';
  actionType: 'Order Diversion' | 'Air Charter' | 'Line Throttle' | 'Client Notice';
  executionStatus: 'pending' | 'in_progress' | 'verified' | 'rejected';
  costUSD: string;
  durationMinutes: number;
  description: string;
  syntheticVerificationNote: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  stage: WorkflowStage;
  actor:
    | 'SYSTEM_AUTONOMOUS'
    | 'COMMAND_DIRECTOR'
    | 'AUDIT_POLICY'
    | 'AI_TELEMETRY_ENGINE'
    | 'AI_AGENT_EVALUATOR'
    | 'GOVERNANCE_POLICY_ENGINE'
    | 'SECURITY_GATEWAY'
    | 'AGENT_1_CRISIS_DETECTION'
    | 'AGENT_2_IMPACT_ASSESSMENT'
    | 'AGENT_3_SUPPLIER_EVAL'
    | 'AGENT_4_INVENTORY_BUFFER'
    | 'AGENT_5_LOGISTICS_WEATHER'
    | 'AGENT_6_PRODUCTION_THROTTLE'
    | (string & {});
  action: string;
  details: string;
  status: 'SUCCESS' | 'WARNING' | 'REJECTED' | 'SECURITY_BLOCKED';
}

export interface OutageSimulationState {
  stage: WorkflowStage;
  timestamp: string;
  selectedSupplierId: string;
  detectionSeverity: 'CRITICAL' | 'SEVERE' | 'MODERATE' | 'NONE';
  affectedInventory: {
    sku: string;
    description: string;
    onHandUnits: number;
    dailyBurnRate: number;
    hoursOfRunwayLeft: number;
  }[];
  affectedProduction: AffectedProductionLine[];
  affectedOrders: AffectedCustomerOrder[];
  alternativeSuppliers: AlternativeSupplierOption[];
  warehouseStockOptions: WarehouseStockOption[];
  proposedPlan: ProposedRecoveryPlan | null;
  isExecuting?: boolean;
  currentExecutingActionIndex?: number;
  rejectionReason?: string;
  errorMessage?: string;
  verificationOutcome?: 'Resolved' | 'Partially Resolved' | 'Unresolved';
  verificationEvidence?: Record<string, any>;
  auditTrail: AuditLogEntry[];
}

export interface WeatherReport {
  nodeId: string;
  facilityName: string;
  city: string;
  country: string;
  region: string;
  tempCelsius: number | null;
  condition: string;
  description: string;
  windSpeedMps: number | null;
  humidityPct: number | null;
  pressureHpa: number | null;
  riskLevel: 'low' | 'moderate' | 'high' | 'severe';
  riskDetails?: string | null;
  source: 'openweather_live' | 'fallback_telemetry';
}

export interface WeatherSummaryResponse {
  status: string;
  source: string;
  totalMonitored: number;
  severeRisksCount: number;
  moderateRisksCount: number;
  reports: WeatherReport[];
}
