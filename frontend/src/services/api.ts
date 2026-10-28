import type {
  SupplyNode,
  SupplyRoute,
  KPIData,
  DisruptionAlert,
  InventoryTelemetry,
  CrisisPlaybook,
  OutageSimulationState,
  AlternativeSupplierOption,
  WarehouseStockOption,
  ProposedRecoveryPlan
} from '../types/supplyChain';

export const INITIAL_NODES: SupplyNode[] = [
  // SUPPLIERS
  {
    id: 'node-sup-1',
    name: 'Apex Silicon Fab 4',
    type: 'supplier',
    status: 'disrupted',
    isCriticalOutage: true,
    region: 'Asia-Pacific',
    location: 'Shenzhen Tech Corridor',
    position3D: [-6, 3, -1],
    position2D: [18, 28],
    throughputPerDay: 450,
    capacityUtilizationPct: 12,
    inventoryLevelPct: 8,
    leadTimeDays: 28,
    activeShipmentsCount: 14,
    primaryProduct: 'Sub-3nm AI Neural Accelerators',
    disruptionCause: 'Regional Substation Meltdown & Cat-4 Typhoon Harbor Embargo',
    estimatedRecoveryHours: 148,
    contactLead: 'Dr. Ming Chen (VP Supply Ops)'
  },
  {
    id: 'node-sup-2',
    name: 'Nordic Lithium Core',
    type: 'supplier',
    status: 'operational',
    region: 'Europe-North',
    location: 'Oslo Battery Cluster',
    position3D: [-5, 1, 4],
    position2D: [26, 68],
    throughputPerDay: 1200,
    capacityUtilizationPct: 88,
    inventoryLevelPct: 74,
    leadTimeDays: 8,
    activeShipmentsCount: 32,
    primaryProduct: 'High-Density Solid-State Cells',
    contactLead: 'Elin Lindqvist'
  },
  {
    id: 'node-sup-3',
    name: 'Tokyo Precision Optics',
    type: 'supplier',
    status: 'operational',
    region: 'Asia-Pacific',
    location: 'Yokohama High-Tech Park',
    position3D: [-4, 4, 3],
    position2D: [22, 48],
    throughputPerDay: 850,
    capacityUtilizationPct: 68,
    inventoryLevelPct: 85,
    leadTimeDays: 12,
    activeShipmentsCount: 20,
    primaryProduct: 'Laser LIDAR Optical Arrays',
    contactLead: 'Kenji Takahashi'
  },

  // FACTORIES
  {
    id: 'node-fac-1',
    name: 'Giga Assembly Complex',
    type: 'factory',
    status: 'delayed',
    region: 'Americas-Central',
    location: 'Austin Industrial Park',
    position3D: [-1, 2, -3],
    position2D: [44, 25],
    throughputPerDay: 2800,
    capacityUtilizationPct: 62,
    inventoryLevelPct: 34,
    leadTimeDays: 4,
    activeShipmentsCount: 48,
    primaryProduct: 'Autonomous Robotics & Power Units',
    disruptionCause: 'Starved for Apex Silicon Sub-Components (Line 2 Stalled)',
    estimatedRecoveryHours: 48,
    contactLead: 'Sarah Jenkins (Plant Director)'
  },
  {
    id: 'node-fac-2',
    name: 'Rhine Advanced Mechatronics',
    type: 'factory',
    status: 'operational',
    region: 'Europe-Central',
    location: 'Stuttgart Production Campus',
    position3D: [-1, 1, 3],
    position2D: [48, 70],
    throughputPerDay: 1950,
    capacityUtilizationPct: 91,
    inventoryLevelPct: 79,
    leadTimeDays: 5,
    activeShipmentsCount: 38,
    primaryProduct: 'Heavy Actuators & Drive Trains',
    contactLead: 'Markus Weber'
  },

  // WAREHOUSES
  {
    id: 'node-wh-1',
    name: 'Euro-Gateway Logistics Hub',
    type: 'warehouse',
    status: 'delayed',
    region: 'Europe-West',
    location: 'Port of Rotterdam',
    position3D: [2, 0, 4],
    position2D: [66, 65],
    throughputPerDay: 5400,
    capacityUtilizationPct: 94,
    inventoryLevelPct: 82,
    leadTimeDays: 2,
    activeShipmentsCount: 65,
    primaryProduct: 'Multi-SKU Transit Reserve',
    disruptionCause: 'Automated Container Crane Bottleneck (24h Queue)',
    estimatedRecoveryHours: 26,
    contactLead: 'Hans Van Dijk'
  },
  {
    id: 'node-wh-2',
    name: 'Pacific Straits Buffer Depot',
    type: 'warehouse',
    status: 'operational',
    region: 'Asia-South',
    location: 'Singapore Tuas Mega Port',
    position3D: [1, 2, -2],
    position2D: [60, 32],
    throughputPerDay: 7200,
    capacityUtilizationPct: 81,
    inventoryLevelPct: 90,
    leadTimeDays: 1,
    activeShipmentsCount: 88,
    primaryProduct: 'Global Fast-Ship Microelectronics',
    contactLead: 'Li Wei Tan'
  },

  // DISTRIBUTION CENTERS
  {
    id: 'node-dc-1',
    name: 'Midwest Intermodal Terminal',
    type: 'distribution_center',
    status: 'operational',
    region: 'Americas-East',
    location: 'Chicago Freight Gateway',
    position3D: [4, 1, -3],
    position2D: [78, 22],
    throughputPerDay: 4100,
    capacityUtilizationPct: 77,
    inventoryLevelPct: 69,
    leadTimeDays: 2,
    activeShipmentsCount: 52,
    primaryProduct: 'Regional Fulfillment Batches',
    contactLead: 'Marcus Reed'
  },
  {
    id: 'node-dc-2',
    name: 'Nordic Central Dispatch',
    type: 'distribution_center',
    status: 'operational',
    region: 'Europe-North',
    location: 'Copenhagen Cargo City',
    position3D: [4, 0, 2],
    position2D: [80, 58],
    throughputPerDay: 3100,
    capacityUtilizationPct: 83,
    inventoryLevelPct: 75,
    leadTimeDays: 1,
    activeShipmentsCount: 40,
    primaryProduct: 'High-Priority Clean Energy Kits',
    contactLead: 'Astrid Nielsen'
  },

  // CUSTOMER NODES
  {
    id: 'node-cust-1',
    name: 'North America Retail Grid',
    type: 'customer',
    status: 'delayed',
    region: 'Americas',
    location: 'US Coastal Tier-1 Demand Clusters',
    position3D: [7, 0, -2],
    position2D: [94, 30],
    throughputPerDay: 6200,
    capacityUtilizationPct: 96,
    inventoryLevelPct: 41,
    leadTimeDays: 0,
    activeShipmentsCount: 110,
    primaryProduct: 'End-Consumer Smart Units',
    disruptionCause: '4-Day Delivery Lag on Apex-Dependent Finished Goods',
    contactLead: 'Commercial Logistics Group'
  },
  {
    id: 'node-cust-2',
    name: 'EMEA Enterprise Network',
    type: 'customer',
    status: 'operational',
    region: 'Europe',
    location: 'Frankfurt / Zurich Industrial Base',
    position3D: [7, -1, 3],
    position2D: [92, 72],
    throughputPerDay: 4800,
    capacityUtilizationPct: 90,
    inventoryLevelPct: 80,
    leadTimeDays: 0,
    activeShipmentsCount: 84,
    primaryProduct: 'Enterprise Industrial Systems',
    contactLead: 'Continental Supply Consortium'
  }
];

// Pristine baseline before any outage occurs
export const BASELINE_NODES: SupplyNode[] = INITIAL_NODES.map(n => ({
  ...n,
  status: 'operational',
  isCriticalOutage: false,
  disruptionCause: undefined,
  estimatedRecoveryHours: undefined,
  inventoryLevelPct: n.id === 'node-sup-1' ? 92 : n.inventoryLevelPct,
  capacityUtilizationPct: n.id === 'node-sup-1' ? 88 : n.capacityUtilizationPct
}));

export const INITIAL_ROUTES: SupplyRoute[] = [
  // From Critical Outage Supplier (Disrupted)
  {
    id: 'route-sup1-fac1',
    sourceId: 'node-sup-1',
    targetId: 'node-fac-1',
    state: 'disrupted',
    cargoType: 'Sub-3nm Neural Wafers',
    volumeTEU: 450,
    transitHours: 72,
    transitProgressPct: 15,
    congestedReason: 'Cargo stranded at Shenzhen Terminal B (Cat-4 Typhoon Embargo)'
  },
  {
    id: 'route-sup1-wh2',
    sourceId: 'node-sup-1',
    targetId: 'node-wh-2',
    state: 'disrupted',
    cargoType: 'Micro-Logic Chipsets',
    volumeTEU: 320,
    transitHours: 24,
    transitProgressPct: 8,
    congestedReason: 'Factory outbound halted due to grid collapse'
  },

  // Normal Supplier Routes
  {
    id: 'route-sup2-fac2',
    sourceId: 'node-sup-2',
    targetId: 'node-fac-2',
    state: 'normal',
    cargoType: 'Lithium Battery Packs',
    volumeTEU: 800,
    transitHours: 36,
    transitProgressPct: 62
  },
  {
    id: 'route-sup3-fac1',
    sourceId: 'node-sup-3',
    targetId: 'node-fac-1',
    state: 'normal',
    cargoType: 'LIDAR Optical Assemblies',
    volumeTEU: 420,
    transitHours: 52,
    transitProgressPct: 44
  },
  {
    id: 'route-sup3-fac2',
    sourceId: 'node-sup-3',
    targetId: 'node-fac-2',
    state: 'normal',
    cargoType: 'Infrared Sensor Modules',
    volumeTEU: 380,
    transitHours: 58,
    transitProgressPct: 78
  },

  // Factory to Warehouses
  {
    id: 'route-fac1-wh1',
    sourceId: 'node-fac-1',
    targetId: 'node-wh-1',
    state: 'delayed',
    cargoType: 'Finished Automation Pods',
    volumeTEU: 680,
    transitHours: 84,
    transitProgressPct: 85,
    congestedReason: 'Dock backlog at Rotterdam Berth 12'
  },
  {
    id: 'route-fac1-dc1',
    sourceId: 'node-fac-1',
    targetId: 'node-dc-1',
    state: 'normal',
    cargoType: 'Domestic Fleet Shipments',
    volumeTEU: 1100,
    transitHours: 18,
    transitProgressPct: 40
  },
  {
    id: 'route-fac2-wh1',
    sourceId: 'node-fac-2',
    targetId: 'node-wh-1',
    state: 'normal',
    cargoType: 'Mechatronic Modules',
    volumeTEU: 950,
    transitHours: 14,
    transitProgressPct: 90
  },
  {
    id: 'route-wh2-dc1',
    sourceId: 'node-wh-2',
    targetId: 'node-dc-1',
    state: 'normal',
    cargoType: 'Pacific Air-Express Spares',
    volumeTEU: 310,
    transitHours: 32,
    transitProgressPct: 50
  },

  // Distribution to Customers
  {
    id: 'route-wh1-dc2',
    sourceId: 'node-wh-1',
    targetId: 'node-dc-2',
    state: 'delayed',
    cargoType: 'Regional Assembly Bundles',
    volumeTEU: 520,
    transitHours: 16,
    transitProgressPct: 30,
    congestedReason: 'Crane queue transfer delay'
  },
  {
    id: 'route-dc1-cust1',
    sourceId: 'node-dc-1',
    targetId: 'node-cust-1',
    state: 'delayed',
    cargoType: 'Retail Final Deliveries',
    volumeTEU: 1450,
    transitHours: 12,
    transitProgressPct: 65,
    congestedReason: 'Downstream shortage caused by Apex Fab component deficit'
  },
  {
    id: 'route-dc2-cust2',
    sourceId: 'node-dc-2',
    targetId: 'node-cust-2',
    state: 'normal',
    cargoType: 'Enterprise Direct Fleet',
    volumeTEU: 980,
    transitHours: 8,
    transitProgressPct: 80
  }
];

export const BASELINE_ROUTES: SupplyRoute[] = INITIAL_ROUTES.map(r => ({
  ...r,
  state: 'normal',
  congestedReason: undefined,
  isRerouted: false
}));

export const INITIAL_KPIS: KPIData = {
  resiliencyIndex: 78.4,
  resiliencyDelta: -4.2,
  activeFleetVolumeTEU: 18450,
  activeConvoysCount: 92,
  onTimeDeliveryRate: 88.6,
  deliveryRateDelta: -5.8,
  criticalAlertsCount: 1,
  activeMitigationsCount: 2,
  carbonEfficiencyScore: 93.8
};

export const BASELINE_KPIS: KPIData = {
  resiliencyIndex: 96.2,
  resiliencyDelta: 1.8,
  activeFleetVolumeTEU: 21500,
  activeConvoysCount: 104,
  onTimeDeliveryRate: 98.4,
  deliveryRateDelta: 0.9,
  criticalAlertsCount: 0,
  activeMitigationsCount: 0,
  carbonEfficiencyScore: 97.4
};

export const INITIAL_ALERTS: DisruptionAlert[] = [
  {
    id: 'alt-01',
    title: 'CRITICAL: Apex Fab 4 Outage & Port Embargo',
    severity: 'critical',
    timestamp: '14 mins ago',
    nodeId: 'node-sup-1',
    nodeName: 'Apex Silicon Fab 4',
    impactSummary: 'Total production blackout. 14 in-transit cargo pods frozen. Downstream Austin Giga Assembly Line 2 starving within 36 hours.',
    recommendedAction: 'Trigger Playbook CP-01: Divert wafer allocations to Tokyo Precision Optics and emergency air-bridge buffer from Singapore Depot.',
    playbookId: 'playbook-apex-divert'
  },
  {
    id: 'alt-02',
    title: 'WARNING: Rotterdam Terminal 4 Crane Queue',
    severity: 'warning',
    timestamp: '42 mins ago',
    nodeId: 'node-wh-1',
    nodeName: 'Euro-Gateway Logistics Hub',
    impactSummary: 'Automated crane telemetry indicates 26-hour ship unloading backlog. +18hr latency for European DC shipments.',
    recommendedAction: 'Reroute feeder vessels to Antwerp or rail bypass.'
  },
  {
    id: 'alt-03',
    title: 'INFO: Austin Giga Complex Re-Sequenced',
    severity: 'info',
    timestamp: '1 hr ago',
    nodeId: 'node-fac-1',
    nodeName: 'Giga Assembly Complex',
    impactSummary: 'Buffer stock deployed to preserve Line 1 output. Line 2 operating in reduced energy idle mode.',
    recommendedAction: 'Monitor remaining wafer shelf life (4.2 days).'
  }
];

export const INITIAL_INVENTORY: InventoryTelemetry[] = [
  {
    hubId: 'node-wh-2',
    hubName: 'Pacific Straits Buffer Depot (Singapore)',
    region: 'Asia-Pacific',
    currentStockUnits: 48500,
    maxStockUnits: 60000,
    stockoutRiskDays: 24,
    healthStatus: 'healthy',
    topSKUs: [
      { sku: 'SKU-NEURAL-A1', units: 12500, daysOfSupply: 18 },
      { sku: 'SKU-LIDAR-V4', units: 8400, daysOfSupply: 32 },
      { sku: 'SKU-SOLID-CELL-9', units: 14200, daysOfSupply: 40 }
    ]
  },
  {
    hubId: 'node-wh-1',
    hubName: 'Euro-Gateway Logistics (Rotterdam)',
    region: 'Europe',
    currentStockUnits: 39400,
    maxStockUnits: 45000,
    stockoutRiskDays: 14,
    healthStatus: 'warning',
    topSKUs: [
      { sku: 'SKU-DRIVE-TRAIN-M', units: 4200, daysOfSupply: 9 },
      { sku: 'SKU-SOLID-CELL-9', units: 9800, daysOfSupply: 15 },
      { sku: 'SKU-ROBOTIC-ARM', units: 3100, daysOfSupply: 12 }
    ]
  },
  {
    hubId: 'node-fac-1',
    hubName: 'Austin Factory Staging Buffer',
    region: 'Americas',
    currentStockUnits: 14200,
    maxStockUnits: 35000,
    stockoutRiskDays: 4,
    healthStatus: 'critical',
    topSKUs: [
      { sku: 'SKU-NEURAL-A1 (Apex)', units: 620, daysOfSupply: 3.2 },
      { sku: 'SKU-POWER-CONV-X', units: 4200, daysOfSupply: 16 },
      { sku: 'SKU-CHASSIS-ALUM', units: 3100, daysOfSupply: 22 }
    ]
  }
];

export const CRISIS_PLAYBOOKS: CrisisPlaybook[] = [
  {
    id: 'playbook-apex-divert',
    title: 'Playbook CP-01: Apex Silicon Outage Contingency',
    triggerCondition: 'Critical Supplier Outage on Apex Fab 4 (Sub-3nm neural wafers)',
    targetNodeId: 'node-sup-1',
    alternateNodeId: 'node-sup-3',
    impactMetrics: {
      slaRecoveryPct: 7.8,
      delayReductionHours: 42,
      costImpactUSD: '+$142,000 (Air Priority)',
      reroutedTEU: 450
    },
    steps: [
      'Lock remaining intact inventory at Apex Fab 4 Shenzhen checkpoint.',
      'Shift 450 TEU neural wafer batch orders to Tokyo Precision Optics secondary line.',
      'Dispatch charter air-bridge from Singapore Buffer Depot directly to Austin Giga Factory.',
      'Notify downstream tier-1 distribution hubs of revised 36hr ETA delivery window.'
    ],
    executed: false
  },
  {
    id: 'playbook-rotterdam-bypass',
    title: 'Playbook CP-02: Port of Rotterdam Congestion Rail Bypass',
    triggerCondition: 'Crane backlog > 20 hours at Euro-Gateway Hub',
    targetNodeId: 'node-wh-1',
    alternateNodeId: 'node-dc-2',
    impactMetrics: {
      slaRecoveryPct: 3.2,
      delayReductionHours: 18,
      costImpactUSD: '+$38,000',
      reroutedTEU: 520
    },
    steps: [
      'Divert inbound feeder vessels from Rotterdam to Antwerp North.',
      'Activate high-speed freight rail link direct to Copenhagen Central Dispatch.',
      'Update customer delivery commitments in EMEA Enterprise Network.'
    ],
    executed: false
  }
];

// -------------------------------------------------------------
// DEMO SIMULATION DATASET (Items 2-6 Requirement)
// Explicitly labeled synthetic demo data for supplier outage workflow
// -------------------------------------------------------------

export const DEMO_ALTERNATIVE_SUPPLIERS: AlternativeSupplierOption[] = [
  {
    supplierId: 'node-sup-3',
    supplierName: 'Tokyo Precision Optics (Fab 2)',
    location: 'Yokohama, Japan',
    availableCapacityUnits: 650,
    quotedLeadTimeDays: 3,
    unitCostUSD: 420,
    costDeltaPct: 8.5,
    reliabilityScore: 98.2,
    readinessStatus: 'Immediate'
  },
  {
    supplierId: 'node-sup-alt-2',
    supplierName: 'Dresden Silicon Micro-Foundry',
    location: 'Silicon Saxony, Germany',
    availableCapacityUnits: 400,
    quotedLeadTimeDays: 5,
    unitCostUSD: 460,
    costDeltaPct: 18.0,
    reliabilityScore: 94.7,
    readinessStatus: '24h Spin-up'
  },
  {
    supplierId: 'node-sup-alt-3',
    supplierName: 'Hsinchu Semiconductor Line 12',
    location: 'Hsinchu, Taiwan',
    availableCapacityUnits: 900,
    quotedLeadTimeDays: 7,
    unitCostUSD: 395,
    costDeltaPct: 2.1,
    reliabilityScore: 91.0,
    readinessStatus: 'Restricted'
  }
];

export const DEMO_WAREHOUSE_OPTIONS: WarehouseStockOption[] = [
  {
    warehouseId: 'node-wh-2',
    warehouseName: 'Pacific Straits Buffer Depot',
    location: 'Singapore Tuas Mega Port',
    availableBufferUnits: 12500,
    transportMode: 'Charter Air Cargo',
    transitHours: 18,
    estimatedTransitCostUSD: '$64,000',
    sufficientToCoverDays: 8.5
  },
  {
    warehouseId: 'node-wh-1',
    warehouseName: 'Euro-Gateway Logistics Hub',
    location: 'Rotterdam, Netherlands',
    availableBufferUnits: 4800,
    transportMode: 'Express Freight',
    transitHours: 36,
    estimatedTransitCostUSD: '$32,000',
    sufficientToCoverDays: 3.2
  }
];

export const DEMO_PROPOSED_PLAN: ProposedRecoveryPlan = {
  planId: 'PLAN-SYNTH-APEX-01',
  title: 'Contingency Playbook CP-01: Apex Silicon Outage Multi-Tier Recovery',
  syntheticConfidenceScore: 94.8, // Clearly labeled synthetic
  estimatedTotalCostUSD: '$142,000',
  deliveryTimeRecoveryHours: 42,
  slaRecoveryPercentage: 8.4,
  targetSupplier: 'Apex Silicon Fab 4 (Shenzhen)',
  selectedAltSupplier: 'Tokyo Precision Optics (Fab 2)',
  selectedWarehouseBuffer: 'Pacific Straits Buffer Depot (Singapore)',
  detailedActions: [
    {
      id: 'act-01',
      sequence: 1,
      title: 'Quarantine Disrupted Inbound Stream',
      department: 'Procurement',
      actionType: 'Order Diversion',
      executionStatus: 'pending',
      costUSD: '$0',
      durationMinutes: 15,
      description: 'Halt all non-verified cargo manifests from Apex Fab 4 Shenzhen checkpoint to avoid transit gridlock.',
      syntheticVerificationNote: 'Simulated API lock dispatched to Shenzhen EDI manifest router.'
    },
    {
      id: 'act-02',
      sequence: 2,
      title: 'Shift 450 TEU Neural Wafers to Tokyo Fab 2',
      department: 'Procurement',
      actionType: 'Order Diversion',
      executionStatus: 'pending',
      costUSD: '$78,000',
      durationMinutes: 30,
      description: 'Activate pre-qualified secondary supplier Tokyo Precision Optics for 450 units sub-3nm neural accelerators.',
      syntheticVerificationNote: 'Verified capacity allocation: 650 units currently open on Yokohama Line B.'
    },
    {
      id: 'act-03',
      sequence: 3,
      title: 'Dispatch Emergency Air-Bridge from Singapore',
      department: 'Logistics',
      actionType: 'Air Charter',
      executionStatus: 'pending',
      costUSD: '$64,000',
      durationMinutes: 45,
      description: 'Charter Boeing 777-Freighter from Singapore Tuas Buffer directly to Austin Bergstrom Cargo Terminal with 12,500 wafer buffer.',
      syntheticVerificationNote: 'Simulated charter flight booked on SIA Cargo Flight SQ-9912.'
    },
    {
      id: 'act-04',
      sequence: 4,
      title: 'Throttle Giga Assembly Line 2 to Buffer Mode',
      department: 'Plant Operations',
      actionType: 'Line Throttle',
      executionStatus: 'pending',
      costUSD: '$0',
      durationMinutes: 20,
      description: 'Maintain Line 1 at 100% and reduce Line 2 speed by 25% until Singapore air shipment arrives in 18 hours.',
      syntheticVerificationNote: 'Prevents total factory shutdown; saves 68% of daily work-in-progress stock.'
    },
    {
      id: 'act-05',
      sequence: 5,
      title: 'Broadcast Automated Client SLA Updates',
      department: 'Customer Success',
      actionType: 'Client Notice',
      executionStatus: 'pending',
      costUSD: '$0',
      durationMinutes: 10,
      description: 'Transmit proactive shipment tracking updates to North America Tier-1 retail customers with revised 36h delivery window.',
      syntheticVerificationNote: 'Protects contractual SLA penalty clauses; client satisfaction index maintained at 92%.'
    }
  ]
};

export const INITIAL_OUTAGE_SIMULATION_STATE: OutageSimulationState = {
  stage: 'idle',
  timestamp: new Date().toISOString(),
  selectedSupplierId: 'node-sup-1',
  detectionSeverity: 'NONE',
  affectedInventory: [],
  affectedProduction: [],
  affectedOrders: [],
  alternativeSuppliers: [],
  warehouseStockOptions: [],
  proposedPlan: null,
  auditTrail: [
    {
      id: 'audit-00',
      timestamp: new Date().toLocaleTimeString(),
      stage: 'idle',
      actor: 'SYSTEM_AUTONOMOUS',
      action: 'Baseline Telemetry Calibrated',
      details: 'All 10 multi-echelon network nodes operational. Resiliency index 96.2%.',
      status: 'SUCCESS'
    }
  ]
};
