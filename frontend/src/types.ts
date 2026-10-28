/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  coordinates: { lat: number; lng: number };
  productsSupplied: string[];
  dailyCapacity: number;
  leadTimeDays: number;
  reliabilityScore: number;
  costPerUnit: number;
  operationalStatus: 'active' | 'disrupted' | 'warning' | 'offline';
  outageReason?: string;
  outageRemainingDays?: number;
  contractTier: 'Primary' | 'Secondary' | 'Spot';
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  city: string;
  country: string;
  coordinates: { lat: number; lng: number };
  capacityUnits: number;
  utilizedUnits: number;
  status: 'operational' | 'congested' | 'shut_down';
  tempControlled: boolean;
  dockDoors: number;
}

export interface InventoryItem {
  id: string;
  warehouseId: string;
  warehouseName: string;
  sku: string;
  productName: string;
  category: string;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  safetyStock: number;
  reorderThreshold: number;
  unitCost: number;
  dailyConsumptionRate: number;
  coverageDays: number;
  lastAudited: string;
}

export interface InventoryMovement {
  id: string;
  sku: string;
  productName: string;
  sourceWarehouseId?: string;
  sourceWarehouseName?: string;
  destWarehouseId: string;
  destWarehouseName: string;
  quantity: number;
  timestamp: string;
  type: 'transfer' | 'inbound' | 'production_use' | 'adjustment' | 'crisis_reallocation';
  status: 'pending' | 'in_transit' | 'completed';
  referenceId?: string;
}

export interface OrderItem {
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  tier: 'Tier 1 Critical' | 'Tier 2 Strategic' | 'Tier 3 Standard';
  priority: 'critical' | 'high' | 'medium' | 'low';
  items: OrderItem[];
  totalValue: number;
  orderDate: string;
  deadline: string;
  fulfillmentStatus: 'fulfilled' | 'in_production' | 'at_risk' | 'delayed' | 'cancelled';
  deliveryStatus: 'on_schedule' | 'delayed' | 'delivered';
  progressPercent: number;
  riskReason?: string;
  destinationCity: string;
  destinationCountry: string;
}

export interface ProductionLine {
  id: string;
  code: string;
  lineName: string;
  facilityName: string;
  facilityLocation: { lat: number; lng: number };
  productSku: string;
  productName: string;
  dailyCapacity: number;
  plannedOutput: number;
  currentDailyOutput: number;
  status: 'operational' | 'halted' | 'reduced_capacity' | 'maintenance';
  requiredMaterials: { sku: string; unitsPerProduct: number }[];
  bottleneckReason?: string;
}

export interface Shipment {
  id: string;
  trackingNumber: string;
  carrier: string;
  originName: string;
  originCoords: { lat: number; lng: number };
  destName: string;
  destCoords: { lat: number; lng: number };
  transportMode: 'Air Freight' | 'Ocean Cargo' | 'Express Road' | 'Standard Rail';
  status: 'in_transit' | 'delayed' | 'delivered' | 'diverted' | 'customs_hold';
  departedAt: string;
  estimatedArrival: string;
  originalEta: string;
  delayHours: number;
  cargoValue: number;
  transportCost: number;
  weatherRiskAlert?: string;
  items: { sku: string; quantity: number }[];
}

export interface CrisisIncident {
  id: string;
  incidentCode: string;
  title: string;
  type:
    | 'supplier_failure'
    | 'supplier_delay'
    | 'inventory_shortage'
    | 'warehouse_disruption'
    | 'weather_risk'
    | 'transport_delay'
    | 'demand_surge'
    | 'production_bottleneck'
    | 'order_delivery_risk';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  status:
    | 'detected'
    | 'analyzing'
    | 'recovery_planned'
    | 'pending_approval'
    | 'approved'
    | 'executing'
    | 'verified_resolved'
    | 'verified_partial'
    | 'unresolved';
  detectedAt: string;
  source: string;
  affectedEntities: { entityType: string; entityId: string; name: string }[];
  evidence: string;
  estimatedFinancialImpact: number;
  confidence: number;
  deduplicationKey: string;
  rootCauseSummary?: string;
  resolvedAt?: string;
  isSimulated: boolean;
}

export interface AgentRun {
  id: string;
  incidentId: string;
  timestamp: string;
  agentName:
    | 'Supplier Agent'
    | 'Inventory Agent'
    | 'Logistics Agent'
    | 'Production Agent'
    | 'Demand & Order Agent'
    | 'Risk Analysis Agent'
    | 'Recovery Planning Agent'
    | 'Verification Agent'
    | 'Central Orchestrator';
  status: 'running' | 'completed' | 'failed';
  executionTimeMs: number;
  findings: Record<string, any>;
  reasoning: string;
  recommendations: string[];
}

export interface ProposedAction {
  id: string;
  actionType:
    | 'switch_supplier'
    | 'split_purchase_order'
    | 'inter_warehouse_transfer'
    | 'expedite_air_freight'
    | 'reschedule_production'
    | 'reallocate_inventory_priority';
  description: string;
  estimatedCost: number;
  targetEntity: string;
  details: Record<string, any>;
  status: 'proposed' | 'approved' | 'executing' | 'executed' | 'failed' | 'verified';
}

export interface RecoveryPlan {
  id: string;
  incidentId: string;
  planVersion: number;
  title: string;
  strategyType:
    | 'hybrid_optimal'
    | 'supplier_switch'
    | 'split_procurement'
    | 'warehouse_transfer'
    | 'air_freight_expedite'
    | 'production_reroute';
  optimizationEngine: string;
  objectiveScores: {
    totalRecoveryCost: number;
    estimatedLeadTimeDays: number;
    affectedOrdersResolved: number;
    serviceLevelScore: number;
    feasibilityIndex: number;
  };
  weights: {
    costWeight: number;
    speedWeight: number;
    serviceWeight: number;
  };
  proposedActions: ProposedAction[];
  tradeOffSummary: string;
  geminiExplanation?: string;
  pros: string[];
  cons: string[];
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  approvedBy?: string;
  approvedAt?: string;
  approvalComments?: string;
  createdAt: string;
}

export interface VerificationCheck {
  checkName: string;
  passed: boolean;
  expected: string;
  actual: string;
  detail: string;
}

export interface VerificationResult {
  id: string;
  incidentId: string;
  recoveryPlanId: string;
  verifiedAt: string;
  outcome: 'Resolved' | 'Partially Resolved' | 'Unresolved';
  originalIncidentResolved: boolean;
  checks: VerificationCheck[];
  residualShortages: number;
  remainingAtRiskOrders: number;
  inventoryCoverageDaysAfter: number;
  supplierFulfillmentConfirmed: boolean;
  recommendations: string[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  category:
    | 'crisis'
    | 'agent'
    | 'optimization'
    | 'approval'
    | 'execution'
    | 'verification'
    | 'data_mutation'
    | 'learning'
    | 'system';
  details: string;
  diff?: any;
}

export interface WeatherCondition {
  locationName: string;
  country: string;
  coordinates: { lat: number; lng: number };
  tempC: number;
  condition: string;
  windSpeedKmh: number;
  visibilityKm: number;
  riskSeverity: 'nominal' | 'warning' | 'severe' | 'critical';
  hazardAlert?: string;
  affectedShipmentRoutes: string[];
  lastUpdated: string;
}

export interface DatabaseState {
  suppliers: Supplier[];
  warehouses: Warehouse[];
  inventory: InventoryItem[];
  inventoryMovements: InventoryMovement[];
  customerOrders: CustomerOrder[];
  productionLines: ProductionLine[];
  shipments: Shipment[];
  crises: CrisisIncident[];
  agentRuns: AgentRun[];
  recoveryPlans: RecoveryPlan[];
  verifications: VerificationResult[];
  auditLogs: AuditLog[];
}

export type UserRole =
  | 'Operations Director'
  | 'Crisis Manager'
  | 'Supply Chain Analyst'
  | 'Logistics Specialist'
  | 'Auditor / Compliance';

export interface EarlyWarningAlert {
  id: string;
  riskType:
    | 'supplier_outage_risk'
    | 'inventory_stockout_forecast'
    | 'shipment_delay_prediction'
    | 'sla_breach_prediction'
    | 'production_halt_risk'
    | 'demand_surge_risk'
    | 'weather_maritime_risk';
  severity: 'Advisory' | 'Warning' | 'High' | 'Critical';
  riskScore: number;
  title: string;
  predictedTimeWindow: string;
  timeToImpactHours: number;
  affectedEntities: { entityType: string; entityId: string; name: string }[];
  contributingFactors: { factor: string; weightPct: number; detail: string }[];
  dataSources: string[];
  confidence: number;
  recommendedPreventiveAction: string;
  estimatedAvertedLoss: number;
  preventiveActionPayload?: {
    actionType: string;
    details: Record<string, any>;
  };
  timestamp: string;
}

export interface SupplierRiskAssessment {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  compositeRiskScore: number;
  failureProbabilityNext7Days: number;
  failureProbabilityNext30Days: number;
  riskTier: 'Low' | 'Moderate' | 'Elevated' | 'Critical';
  factors: {
    singleSourceConcentration: number;
    geopoliticalRisk: number;
    historicalReliability: number;
    capacityStress: number;
    weatherVulnerability: number;
  };
  recommendedHedge: string;
}

export interface InventoryStockoutForecast {
  sku: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  currentOnHand: number;
  dailyConsumptionRate: number;
  projectedRunoutDate: string;
  hoursUntilRunout: number;
  safetyBufferBreachDate: string;
  projectedStockTrajectory30Days: { day: number; date: string; onHandUnits: number; isStockout: boolean }[];
  riskSeverity: 'Nominal' | 'Advisory' | 'High' | 'Critical';
  suggestedReorderQuantity: number;
}

export interface PredictiveAnalysisResult {
  generatedAt: string;
  overallNetworkResilienceIndex: number;
  earlyWarningAlerts: EarlyWarningAlert[];
  supplierRiskScores: SupplierRiskAssessment[];
  stockoutForecasts: InventoryStockoutForecast[];
  slaBreachPredictions: {
    orderNumber: string;
    customerName: string;
    tier: string;
    breachProbability: number;
    penaltyRisk: number;
    componentShortfall: string;
    hoursUntilPointOfNoReturn: number;
  }[];
}

export interface WhatIfSimulationInput {
  scenarioName: string;
  disruptedSupplierId?: string;
  outageDays?: number;
  oceanFreightDelayHours?: number;
  demandSurgePercent?: number;
  assemblyLineThrottleRate?: number;
}

export interface WhatIfSimulationOutput {
  scenarioName: string;
  simulatedAt: string;
  baselineMetrics: {
    criticalStockoutsCount: number;
    atRiskOrdersCount: number;
    atRiskFinancialExposure: number;
    projectedLineIdleLoss: number;
    resilienceScore: number;
  };
  simulatedMetrics: {
    criticalStockoutsCount: number;
    atRiskOrdersCount: number;
    atRiskFinancialExposure: number;
    projectedLineIdleLoss: number;
    resilienceScore: number;
    oaklandMcuRunwayDays: number;
  };
  recoveryMitigationImpact: {
    mitigatedRiskScore: number;
    estimatedMitigationCost: number;
    netSavings: number;
    feasiblePlansCount: number;
    recommendedStrategy: string;
  };
  cascadeTrace: {
    step: string;
    entity: string;
    impactDescription: string;
    severity: 'info' | 'warning' | 'critical';
  }[];
}
