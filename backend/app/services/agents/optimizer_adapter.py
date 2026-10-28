"""
optimizer_adapter.py — Production adapter integrating OR-Tools CP-SAT optimizer
into the Supply Chain X multi-agent backend architecture.

Contract:
- Connects to the verified optimizer under `agent ml optimizer/backend/optimizer`
  using an isolated namespace (`agent_ml_optimizer`) to prevent collisions with
  the main backend package.
- Implements `OptimizationEngineClient` from `backend.app.services.agents.tools`.
- Provides explicit translation between backend domain schemas (SupplierOption,
  InventoryOption) and optimizer input schemas (ComponentDemand, SupplierOption,
  WarehouseInventory, OptimizerConfig).
- Exposes solver diagnostic fields: solver_type, solver_status, procurement_cost,
  delay_penalty, total_cost, fulfilled quantities, and infeasibility details.
- Returns transparent recovery actions and synthesis data without leaking internal
  paths or secrets.
"""

from __future__ import annotations

import importlib.util
import logging
import math
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.services.agents.schemas import (
    ActionStatus,
    ActionType,
    ApprovalLevel,
    InventoryOption as BackendInventoryOption,
    LogisticsOption as BackendLogisticsOption,
    RecoveryAction as BackendRecoveryAction,
    SupplierOption as BackendSupplierOption,
    TransportMode,
)
from app.services.agents.tools import OptimizationEngineClient

logger = logging.getLogger("supply_chain_x.optimizer_adapter")

# Resolve optimizer directory safely across layout structures
_PROJECT_ROOT = Path(__file__).resolve().parents[4]
_CANDIDATE_DIRS = [
    _PROJECT_ROOT / "supply-chain-x-core" / "ml-optimization" / "backend" / "optimizer",
    _PROJECT_ROOT / "ml-optimization" / "backend" / "optimizer",
    _PROJECT_ROOT.parent / "supply-chain-x-core" / "ml-optimization" / "backend" / "optimizer",
    _PROJECT_ROOT.parent / "agent ml optimizer" / "backend" / "optimizer",
    _PROJECT_ROOT / "agent ml optimizer" / "backend" / "optimizer",
]
_OPTIMIZER_DIR = next((d for d in _CANDIDATE_DIRS if (d / "__init__.py").is_file()), _CANDIDATE_DIRS[0])


def _get_optimizer_module():
    """Dynamically load optimizer package under a distinct namespace if not already loaded."""
    if "agent_ml_optimizer" in sys.modules:
        return sys.modules["agent_ml_optimizer"]

    init_file = _OPTIMIZER_DIR / "__init__.py"
    if not init_file.is_file():
        raise ImportError(f"Optimizer package not found at {_OPTIMIZER_DIR}")

    spec = importlib.util.spec_from_file_location(
        "agent_ml_optimizer",
        init_file,
        submodule_search_locations=[str(_OPTIMIZER_DIR)],
    )
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load spec for optimizer package at {_OPTIMIZER_DIR}")

    mod = importlib.util.module_from_spec(spec)
    sys.modules["agent_ml_optimizer"] = mod
    spec.loader.exec_module(mod)
    return mod


class CPSATRecoveryOptimizerClient(OptimizationEngineClient):
    """
    Production adapter implementing OptimizationEngineClient using OR-Tools CP-SAT
    with deterministic fallback.
    """

    def __init__(self, delay_penalty_per_day: float = 5.0, solver_timeout_seconds: float = 30.0):
        self.delay_penalty_per_day = delay_penalty_per_day
        self.solver_timeout_seconds = solver_timeout_seconds

    def solve_recovery_plan(
        self,
        crisis_id: str,
        demands: Dict[str, int],
        supplier_options: List[BackendSupplierOption],
        inventory_options: List[BackendInventoryOption],
        logistics_options: List[BackendLogisticsOption],
        target_recovery_days: int,
    ) -> Dict[str, Any]:
        """
        Invoke the CP-SAT recovery optimizer.
        Maps inputs into optimizer schemas, executes plan_recovery(), and translates
        the result back into backend-compatible structures.
        """
        logger.info(
            f"[OPTIMIZER ADAPTER] Solving recovery for crisis {crisis_id} with {len(demands)} demand items, "
            f"{len(supplier_options)} suppliers, {len(inventory_options)} warehouses."
        )

        try:
            opt = _get_optimizer_module()
        except Exception as exc:
            logger.error(f"[OPTIMIZER ADAPTER] Failed to load optimizer package: {exc}")
            return self._emergency_fallback_response(crisis_id, demands, exc)

        # 1. Map demands
        opt_demands = []
        for component_id, qty in demands.items():
            if qty > 0:
                opt_demands.append(
                    opt.ComponentDemand(
                        component_id=component_id,
                        required_qty=qty,
                        due_date_days=float(target_recovery_days),
                        priority=1,
                    )
                )

        if not opt_demands:
            return {
                "solver_type": "none",
                "solver_status": "OPTIMAL",
                "recommended_actions": [],
                "estimated_total_cost": 0.0,
                "procurement_cost": 0.0,
                "delay_penalty": 0.0,
                "estimated_recovery_time": 0,
                "fulfilled_quantities": {cid: 0 for cid in demands},
                "unmet_demand": 0,
                "violated_constraints": [],
                "is_infeasible": False,
            }

        # 2. Map warehouses
        # Note: Backend inventory defines available_stock and reserved_safety_stock.
        # The optimizer expects available_qty and safety_stock deduction via config.
        # We pass available_qty = inv.available_stock and register safety_stock in config.
        opt_warehouses = []
        safety_stock_map: Dict[str, int] = {}
        warehouse_ref_map: Dict[str, BackendInventoryOption] = {}

        for inv in inventory_options:
            warehouse_ref_map[inv.warehouse_id] = inv
            # Aggregate or track maximum safety stock per component
            curr_ss = safety_stock_map.get(inv.product_id, 0)
            safety_stock_map[inv.product_id] = max(curr_ss, inv.reserved_safety_stock)

            opt_warehouses.append(
                opt.WarehouseInventory(
                    warehouse_id=inv.warehouse_id,
                    component_id=inv.product_id,
                    available_qty=inv.available_stock,
                    transfer_cost_per_unit=inv.transfer_cost_per_unit,
                    transfer_lead_time_days=float(inv.transfer_lead_time_days),
                )
            )

        # 3. Map suppliers
        opt_suppliers = []
        supplier_ref_map: Dict[str, BackendSupplierOption] = {}

        for sup in supplier_options:
            supplier_ref_map[sup.supplier_id] = sup
            opt_suppliers.append(
                opt.SupplierOption(
                    supplier_id=sup.supplier_id,
                    component_id=sup.product_id,
                    capacity=sup.available_capacity,
                    price_per_unit=sup.unit_price,
                    lead_time_days=float(sup.quoted_lead_time_days),
                    transport_cost_per_unit=0.0,
                    is_available=True,
                )
            )

        # 4. Configure optimizer
        opt_config = opt.OptimizerConfig(
            budget_limit=float("inf"),
            safety_stock=safety_stock_map,
            delay_penalty_per_day=self.delay_penalty_per_day,
            solver_timeout_seconds=self.solver_timeout_seconds,
            allow_partial_fulfillment=True,
        )

        # 5. Execute optimization
        plan = opt.plan_recovery(
            demands=opt_demands,
            warehouses=opt_warehouses,
            suppliers=opt_suppliers,
            config=opt_config,
        )

        logger.info(
            f"[OPTIMIZER ADAPTER] Result: solver_type={plan.solver_type}, "
            f"status={plan.solver_status.value if hasattr(plan.solver_status, 'value') else plan.solver_status}, "
            f"total_cost=${plan.total_cost:,.2f}, fulfilled={plan.fulfilled}"
        )

        # 6. Map actions back to BackendRecoveryAction
        allocated_actions: List[BackendRecoveryAction] = []
        action_counter = 1

        for act in plan.actions:
            if act.action_type.value == "warehouse_transfer":
                wh_meta = warehouse_ref_map.get(act.source_id)
                loc = wh_meta.warehouse_location if wh_meta else act.source_id
                action_cost = round(act.subtotal_cost, 2)
                allocated_actions.append(
                    BackendRecoveryAction(
                        action_id=f"ACT-INV-{action_counter:03d}",
                        action_type=ActionType.INVENTORY_BUFFER_RELEASE,
                        description=f"Reallocate {act.quantity:,} units of {act.component_id} from {loc} ({act.source_id})",
                        required_quantity=act.quantity,
                        estimated_cost=action_cost,
                        expected_lead_time=int(round(act.estimated_arrival_days)),
                        approval_requirement=ApprovalLevel.AUTONOMOUS if action_cost < 10000 else ApprovalLevel.OPERATIONS_LEAD,
                        status=ActionStatus.PROPOSED,
                        target_entity_id=act.source_id,
                        parameters={
                            "component_id": act.component_id,
                            "warehouse_id": act.source_id,
                            "quantity": act.quantity,
                            "unit_cost": act.unit_cost,
                        },
                    )
                )
                action_counter += 1

            elif act.action_type.value == "supplier_purchase":
                sup_meta = supplier_ref_map.get(act.source_id)
                sname = sup_meta.supplier_name if sup_meta else act.source_id
                action_cost = round(act.subtotal_cost, 2)
                allocated_actions.append(
                    BackendRecoveryAction(
                        action_id=f"ACT-SUP-{action_counter:03d}",
                        action_type=ActionType.SUPPLIER_REALLOCATION,
                        description=f"Purchase {act.quantity:,} units of {act.component_id} from backup vendor {sname}",
                        required_quantity=act.quantity,
                        estimated_cost=action_cost,
                        expected_lead_time=int(round(act.estimated_arrival_days)),
                        approval_requirement=ApprovalLevel.EXECUTIVE if action_cost > 50000 else ApprovalLevel.OPERATIONS_LEAD,
                        status=ActionStatus.PROPOSED,
                        target_entity_id=act.source_id,
                        parameters={
                            "supplier_id": act.source_id,
                            "component_id": act.component_id,
                            "quantity": act.quantity,
                            "unit_cost": act.unit_cost,
                        },
                    )
                )
                action_counter += 1

        # Calculate metrics
        critical_time = max((a.expected_lead_time for a in allocated_actions), default=0)
        total_demanded = sum(demands.values())
        total_fulfilled = sum(plan.fulfilled.values())
        unmet_demand = max(0, total_demanded - total_fulfilled)

        status_str = plan.solver_status.value if hasattr(plan.solver_status, "value") else str(plan.solver_status)

        return {
            "solver_type": plan.solver_type,
            "solver_status": status_str,
            "recommended_actions": [a.model_dump() for a in allocated_actions],
            "optimizer_actions": [a.to_dict() for a in plan.actions],
            "estimated_total_cost": round(plan.total_cost, 2),
            "procurement_cost": round(plan.total_procurement_cost, 2),
            "delay_penalty": round(plan.total_delay_penalty, 2),
            "estimated_recovery_time": critical_time,
            "fulfilled_quantities": plan.fulfilled,
            "unmet_demand": unmet_demand,
            "violated_constraints": plan.violated_constraints,
            "is_infeasible": plan.is_infeasible,
            "wall_time_seconds": round(plan.solver_wall_time_seconds, 4),
        }

    def _emergency_fallback_response(self, crisis_id: str, demands: Dict[str, int], exc: Exception) -> Dict[str, Any]:
        """Emergency safe return structure if optimizer loading completely fails."""
        return {
            "solver_type": "greedy_fallback",
            "solver_status": "FALLBACK_ERROR",
            "recommended_actions": [],
            "optimizer_actions": [],
            "estimated_total_cost": 0.0,
            "procurement_cost": 0.0,
            "delay_penalty": 0.0,
            "estimated_recovery_time": 0,
            "fulfilled_quantities": {cid: 0 for cid in demands},
            "unmet_demand": sum(demands.values()),
            "violated_constraints": [f"Optimizer loading failure: {exc}"],
            "is_infeasible": True,
            "wall_time_seconds": 0.0,
        }
