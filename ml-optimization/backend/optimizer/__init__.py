"""
backend.optimizer — Supply-chain recovery optimizer package.

Public API
----------
plan_recovery(
    demands: List[ComponentDemand],
    warehouses: List[WarehouseInventory] | None = None,
    suppliers: List[SupplierOption] | None = None,
    config: OptimizerConfig | None = None,
) -> RecoveryPlan

See README.md in backend/ml/ for broader context.
See optimizer.py for full docstring.
"""

from .schemas import (
    ActionType,
    ComponentDemand,
    OptimizerConfig,
    RecoveryAction,
    RecoveryPlan,
    SolverStatus,
    SupplierOption,
    WarehouseInventory,
)
from .optimizer import plan_recovery

__all__ = [
    "plan_recovery",
    "ComponentDemand",
    "WarehouseInventory",
    "SupplierOption",
    "OptimizerConfig",
    "RecoveryPlan",
    "RecoveryAction",
    "ActionType",
    "SolverStatus",
]
