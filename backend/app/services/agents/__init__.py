"""
Supply Chain X - Agentic AI Crisis Manager Module
Member 1: Autonomous Disruption Analysis & Specialist Agent Orchestration
"""

__version__ = "0.1.0"
__module_name__ = "supply_chain_x.agents"

from .schemas import (
    CrisisEvent,
    CrisisType,
    SeverityLevel,
    CrisisStatus,
    ImpactAssessment,
    SupplierOption,
    InventoryOption,
    LogisticsOption,
    TransportMode,
    RecoveryAction,
    ActionType,
    ActionStatus,
    ApprovalLevel,
    RecoveryPlan,
    PlanApprovalStatus,
    ApprovalRequest,
    ApprovalDecision,
    RecoveryResult,
    RecoveryStatus,
    SignalType,
    TelemetrySignal,
    DetectionResult,
    CustomerOrder,
    ProductionRequirement,
    ImpactAssessmentInput,
    ImpactAssessmentResult,
    SupplierEvaluationInput,
    SupplierEvaluationResult,
    RankedSupplierOption,
    RejectedSupplierOption,
    InventoryRecoveryInput,
    InventoryRecoveryResult,
    FeasibleTransferOption,
    IneligibleWarehouseOption,
    LogisticsRecoveryInput,
    LogisticsRecoveryResult,
    EvaluatedLogisticsOption,
)

from .config import AgentConfig, get_agent_config
from .detection_agent import detect_crisis_from_signal, IncidentDeduplicator
from .impact_agent import evaluate_crisis_impact
from .supplier_agent import evaluate_alternative_suppliers
from .inventory_agent import evaluate_inventory_recovery
from .logistics_agent import evaluate_logistics_recovery
from .production_agent import (
    evaluate_production_schedule,
    ProductionEvaluationInput,
    ProductionEvaluationResult,
    LineAdjustmentPlan,
)
from .crisis_manager import (
    CrisisManagerOrchestrator,
    CrisisWorkflowState,
    analyze_crisis,
    confirm_and_verify_recovery,
    authorize_and_execute_simulated_recovery,
    execute_crisis_resolution_service,
)

__all__ = [
    # Core Schemas
    "CrisisEvent",
    "CrisisType",
    "SeverityLevel",
    "CrisisStatus",
    "ImpactAssessment",
    "SupplierOption",
    "InventoryOption",
    "LogisticsOption",
    "TransportMode",
    "RecoveryAction",
    "ActionType",
    "ActionStatus",
    "ApprovalLevel",
    "RecoveryPlan",
    "PlanApprovalStatus",
    "ApprovalRequest",
    "ApprovalDecision",
    "RecoveryResult",
    "RecoveryStatus",
    # Agent 1 Schemas & Agents
    "SignalType",
    "TelemetrySignal",
    "DetectionResult",
    "detect_crisis_from_signal",
    "IncidentDeduplicator",
    # Agent 2 Schemas & Agents
    "CustomerOrder",
    "ProductionRequirement",
    "ImpactAssessmentInput",
    "ImpactAssessmentResult",
    "evaluate_crisis_impact",
    # Agent 3 Schemas & Agents
    "SupplierEvaluationInput",
    "SupplierEvaluationResult",
    "RankedSupplierOption",
    "RejectedSupplierOption",
    "evaluate_alternative_suppliers",
    # Agent 4 Schemas & Agents
    "InventoryRecoveryInput",
    "InventoryRecoveryResult",
    "FeasibleTransferOption",
    "IneligibleWarehouseOption",
    "evaluate_inventory_recovery",
    # Agent 5 Schemas & Agents
    "LogisticsRecoveryInput",
    "LogisticsRecoveryResult",
    "EvaluatedLogisticsOption",
    "evaluate_logistics_recovery",
    # Central Orchestrator & Public API
    "CrisisManagerOrchestrator",
    "CrisisWorkflowState",
    "analyze_crisis",
    "confirm_and_verify_recovery",
    "authorize_and_execute_simulated_recovery",
    "execute_crisis_resolution_service",
    # Config
    "AgentConfig",
    "get_agent_config",
]


