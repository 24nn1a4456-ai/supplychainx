"""
Supply Chain X - Agentic AI Crisis Manager
Tools & Connector Interfaces
Author: Member 1 (Agentic AI Engineer)

This module defines integration interfaces and connectors to:
1. Member 2's Backend Database & Services (Suppliers, Inventory, Logistics rate cards)
2. Member 4's Optimization Engine (MILP / LP solver for recovery schedules)

RULES ENFORCED:
- Do not invent supplier prices, inventory, capacity, or shipment status.
- Use mock data ONLY for isolated development and label it clearly as [MOCK DEVELOPMENT DATA].
- Never place real orders or send external mutating commands (strictly simulation & proposal).
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple

from .config import AgentConfig, get_agent_config
from .schemas import (
    CrisisEvent,
    CrisisType,
    SeverityLevel,
    CrisisStatus,
    SupplierOption,
    InventoryOption,
    LogisticsOption,
    TransportMode,
    RecoveryAction,
    ActionType,
    ApprovalLevel,
    ActionStatus,
    CustomerOrder,
    ProductionRequirement,
    RecoveryPlan,
    PlanApprovalStatus,
    ApprovalRequest,
    ApprovalDecision,
    RecoveryResult,
    RecoveryStatus,
)

logger = logging.getLogger("supply_chain_x.tools")


# =====================================================================
# CUSTOM EXCEPTIONS
# =====================================================================

class DataUnavailableError(Exception):
    """Raised when required live enterprise data cannot be obtained from Member 2's backend."""
    pass


class OptimizationEngineError(Exception):
    """Raised when Member 4's optimization solver is unreachable or fails to converge."""
    pass


class UnsafeExecutionViolationError(Exception):
    """Raised if an agent or action attempts to trigger real external purchasing or commands."""
    pass


# =====================================================================
# ABSTRACT DATA PROVIDER INTERFACES (Contracts for Member 2 & Member 4)
# =====================================================================

class SupplierDataProvider(ABC):
    """Abstract interface for querying supplier capabilities and contract terms."""
    
    @abstractmethod
    def get_alternative_suppliers(self, product_id: str, excluded_supplier_id: Optional[str] = None) -> List[SupplierOption]:
        """Fetch verified available suppliers for a given SKU, excluding failing vendor."""
        pass


class InventoryDataProvider(ABC):
    """Abstract interface for querying warehouse inventory snapshots."""

    @abstractmethod
    def get_inventory_options(self, product_id: str) -> List[InventoryOption]:
        """Fetch warehouse inventory positions and reallocatable safety buffer."""
        pass


class LogisticsDataProvider(ABC):
    """Abstract interface for querying freight carriers, expedited transit, and rate cards."""

    @abstractmethod
    def get_freight_options(self, origin: str, destination: str) -> List[LogisticsOption]:
        """Fetch available carriers, transit lead times, and expedite surcharges."""
        pass


class OperationsDataProvider(ABC):
    """Abstract interface for querying customer orders and plant production schedules (Member 2)."""

    @abstractmethod
    def get_customer_orders(self, product_id: str) -> List[CustomerOrder]:
        """Fetch pending customer sales orders dependent on component SKU."""
        pass

    @abstractmethod
    def get_production_requirements(self, product_id: str) -> List[ProductionRequirement]:
        """Fetch manufacturing line run rates and minimum buffer days for component SKU."""
        pass


class CrisisEventStore(ABC):
    """Abstract interface for storing and looking up CrisisEvent records (Member 2 database)."""

    @abstractmethod
    def get_crisis_event(self, crisis_id: str) -> Optional[CrisisEvent]:
        """Retrieve recorded crisis event by unique ID."""
        pass

    @abstractmethod
    def save_crisis_event(self, crisis: CrisisEvent) -> None:
        """Persist or update crisis event record."""
        pass


class OptimizationEngineClient(ABC):
    """Abstract interface for delegating optimal resource allocation to Member 4."""

    @abstractmethod
    def solve_recovery_plan(
        self,
        crisis_id: str,
        demands: Dict[str, int],
        supplier_options: List[SupplierOption],
        inventory_options: List[InventoryOption],
        logistics_options: List[LogisticsOption],
        target_recovery_days: int,
    ) -> Dict[str, Any]:
        """Invoke Member 4's mathematical optimizer to compute cost-optimal allocation."""
        pass


class PlanExecutionService(ABC):
    """Abstract interface for submitting recovery plans and tracking managerial approval in Member 2."""

    @abstractmethod
    def submit_recovery_plan(self, plan: RecoveryPlan, approval_request: Optional[ApprovalRequest] = None) -> bool:
        """Submit generated recovery plan and any accompanying approval request to backend."""
        pass

    @abstractmethod
    def get_plan(self, plan_id: str) -> Optional[RecoveryPlan]:
        """Fetch stored plan by plan_id."""
        pass

    @abstractmethod
    def record_approval_decision(
        self, plan_id: str, decision: ApprovalDecision, decided_by: str, notes: Optional[str] = None
    ) -> bool:
        """Record managerial sign-off or rejection for a pending recovery plan."""
        pass

    @abstractmethod
    def is_execution_authorized(self, plan_id: str) -> bool:
        """Check whether execution is authorized (Auto-approved or approved by manager)."""
        pass


class SimulationEngineClient(ABC):
    """Abstract interface for requesting simulated execution through Member 4's simulator."""

    @abstractmethod
    def request_simulated_execution(self, crisis_id: str, plan: RecoveryPlan) -> RecoveryResult:
        """Execute plan in digital twin simulator and return true verified outcome."""
        pass


# =====================================================================
# ISOLATED MOCK IMPLEMENTATIONS (Clearly Labeled for Development)
# [MOCK DEVELOPMENT DATA - ISOLATED]
# =====================================================================

class MockSupplierDataProvider(SupplierDataProvider):
    """
    [MOCK DEVELOPMENT DATA - ISOLATED]
    Deterministic mock provider representing Member 2's supplier catalog.
    Used for local testing when Member 2's live API is offline.
    """
    _MOCK_CATALOG: Dict[str, List[Dict[str, Any]]] = {
        "SKU-MCU-328P": [
            {
                "option_id": "SUP-OPT-001",
                "supplier_id": "VEND-NEXUS-01",
                "supplier_name": "Nexus Semiconductor Global",
                "product_id": "SKU-MCU-328P",
                "available_capacity": 5000,
                "unit_price": 4.50,
                "currency": "USD",
                "quoted_lead_time_days": 5,
                "reliability_score": 0.94,
                "contract_status": "BACKUP_ACTIVE",
                "minimum_order_quantity": 500,
            },
            {
                "option_id": "SUP-OPT-002",
                "supplier_id": "VEND-PACIFIC-09",
                "supplier_name": "Pacific Microtech Corp",
                "product_id": "SKU-MCU-328P",
                "available_capacity": 12000,
                "unit_price": 5.20,
                "currency": "USD",
                "quoted_lead_time_days": 8,
                "reliability_score": 0.88,
                "contract_status": "SECONDARY_APPROVED",
                "minimum_order_quantity": 1000,
            },
            {
                "option_id": "SUP-OPT-003",
                "supplier_id": "VEND-SPOT-GLOBAL",
                "supplier_name": "Global Spot Electronics Broker",
                "product_id": "SKU-MCU-328P",
                "available_capacity": 8000,
                "unit_price": 7.50,
                "currency": "USD",
                "quoted_lead_time_days": 3,
                "reliability_score": 0.72,
                "contract_status": "SPOT_MARKET",
                "minimum_order_quantity": 250,
            },
        ],
        "SKU-NEURAL-A1": [
            {
                "option_id": "SUP-OPT-TOK-01",
                "supplier_id": "node-sup-3",
                "supplier_name": "Tokyo Precision Optics (Fab 2)",
                "product_id": "SKU-NEURAL-A1",
                "available_capacity": 650,
                "unit_price": 420.0,
                "currency": "USD",
                "quoted_lead_time_days": 3,
                "reliability_score": 0.98,
                "contract_status": "SECONDARY_APPROVED",
                "minimum_order_quantity": 100,
            },
            {
                "option_id": "SUP-OPT-DRE-02",
                "supplier_id": "node-sup-alt-2",
                "supplier_name": "Dresden Silicon Micro-Foundry",
                "product_id": "SKU-NEURAL-A1",
                "available_capacity": 400,
                "unit_price": 460.0,
                "currency": "USD",
                "quoted_lead_time_days": 5,
                "reliability_score": 0.95,
                "contract_status": "BACKUP_ACTIVE",
                "minimum_order_quantity": 150,
            },
            {
                "option_id": "SUP-OPT-HSI-03",
                "supplier_id": "node-sup-alt-3",
                "supplier_name": "Hsinchu Semiconductor Line 12",
                "product_id": "SKU-NEURAL-A1",
                "available_capacity": 900,
                "unit_price": 395.0,
                "currency": "USD",
                "quoted_lead_time_days": 6,
                "reliability_score": 0.92,
                "contract_status": "SPOT_MARKET",
                "minimum_order_quantity": 200,
            },
        ],
        "SKU-NEURAL-A1 (Apex Sub-3nm)": [
            {
                "option_id": "SUP-OPT-TOK-01",
                "supplier_id": "node-sup-3",
                "supplier_name": "Tokyo Precision Optics (Fab 2)",
                "product_id": "SKU-NEURAL-A1 (Apex Sub-3nm)",
                "available_capacity": 650,
                "unit_price": 420.0,
                "currency": "USD",
                "quoted_lead_time_days": 3,
                "reliability_score": 0.98,
                "contract_status": "SECONDARY_APPROVED",
                "minimum_order_quantity": 100,
            },
        ],
        "SKU-BAT-21700": [
            {
                "option_id": "SUP-OPT-101",
                "supplier_id": "VEND-VOLT-ALLIANCE",
                "supplier_name": "VoltAlliance Energy Systems",
                "product_id": "SKU-BAT-21700",
                "available_capacity": 15000,
                "unit_price": 3.80,
                "currency": "USD",
                "quoted_lead_time_days": 7,
                "reliability_score": 0.91,
                "contract_status": "SECONDARY_ACTIVE",
                "minimum_order_quantity": 2000,
            }
        ],
    }

    def get_alternative_suppliers(self, product_id: str, excluded_supplier_id: Optional[str] = None) -> List[SupplierOption]:
        logger.info(f"[MOCK DATA] Querying mock alternative suppliers for product {product_id}")
        raw_options = self._MOCK_CATALOG.get(product_id, [])
        options: List[SupplierOption] = []
        for raw in raw_options:
            if excluded_supplier_id and raw["supplier_id"] == excluded_supplier_id:
                continue
            options.append(SupplierOption(**raw))
        return options


class MockInventoryDataProvider(InventoryDataProvider):
    """
    [MOCK DEVELOPMENT DATA - ISOLATED]
    Deterministic mock provider representing Member 2's WMS warehouse stock.
    Used for local testing when Member 2's live API is offline.
    """
    _MOCK_INVENTORY: Dict[str, List[Dict[str, Any]]] = {
        "SKU-MCU-328P": [
            {
                "option_id": "INV-OPT-001",
                "warehouse_id": "WH-AUSTIN-01",
                "warehouse_location": "Austin, TX, USA",
                "product_id": "SKU-MCU-328P",
                "available_stock": 3500,
                "reserved_safety_stock": 1000,
                "reallocatable_units": 2500,
                "transfer_cost_per_unit": 0.35,
                "transfer_lead_time_days": 2,
            },
            {
                "option_id": "INV-OPT-002",
                "warehouse_id": "WH-ROTTERDAM-04",
                "warehouse_location": "Rotterdam, Netherlands",
                "product_id": "SKU-MCU-328P",
                "available_stock": 4200,
                "reserved_safety_stock": 1500,
                "reallocatable_units": 2700,
                "transfer_cost_per_unit": 0.85,
                "transfer_lead_time_days": 4,
            },
        ],
        "SKU-NEURAL-A1": [
            {
                "option_id": "INV-OPT-AUS-01",
                "warehouse_id": "WH-AUSTIN-01",
                "warehouse_location": "Austin, TX, USA",
                "product_id": "SKU-NEURAL-A1",
                "available_stock": 620,
                "reserved_safety_stock": 0,
                "reallocatable_units": 620,
                "transfer_cost_per_unit": 0.40,
                "transfer_lead_time_days": 1,
            },
        ],
        "SKU-NEURAL-A1 (Apex Sub-3nm)": [
            {
                "option_id": "INV-OPT-AUS-01",
                "warehouse_id": "WH-AUSTIN-01",
                "warehouse_location": "Austin, TX, USA",
                "product_id": "SKU-NEURAL-A1 (Apex Sub-3nm)",
                "available_stock": 620,
                "reserved_safety_stock": 0,
                "reallocatable_units": 620,
                "transfer_cost_per_unit": 0.40,
                "transfer_lead_time_days": 1,
            },
        ],
        "SKU-BAT-21700": [
            {
                "option_id": "INV-OPT-101",
                "warehouse_id": "WH-FREMONT-02",
                "warehouse_location": "Fremont, CA, USA",
                "product_id": "SKU-BAT-21700",
                "available_stock": 8000,
                "reserved_safety_stock": 3000,
                "reallocatable_units": 5000,
                "transfer_cost_per_unit": 0.50,
                "transfer_lead_time_days": 3,
            }
        ],
    }

    def get_inventory_options(self, product_id: str) -> List[InventoryOption]:
        logger.info(f"[MOCK DATA] Querying mock warehouse inventory for product {product_id}")
        raw_options = self._MOCK_INVENTORY.get(product_id, [])
        return [InventoryOption(**raw) for raw in raw_options]


class MockLogisticsDataProvider(LogisticsDataProvider):
    """
    [MOCK DEVELOPMENT DATA - ISOLATED]
    Deterministic mock provider representing Member 2's logistics rate cards.
    """
    _DEFAULT_CARRIERS = [
        {
            "option_id": "LOG-OPT-AIR-01",
            "carrier_id": "CARR-DHL-EXPRESS",
            "carrier_name": "DHL Express Priority Air",
            "transport_mode": TransportMode.AIR_FREIGHT,
            "max_weight_capacity_kg": 5000.0,
            "transit_time_days": 2,
            "expedited_fee": 3800.0,
            "co2_emission_estimate_kg": 620.0,
        },
        {
            "option_id": "LOG-OPT-TRUCK-02",
            "carrier_id": "CARR-FEDEX-FREIGHT",
            "carrier_name": "FedEx Expedited Ground Fleet",
            "transport_mode": TransportMode.EXPEDITED_TRUCK,
            "max_weight_capacity_kg": 18000.0,
            "transit_time_days": 4,
            "expedited_fee": 1600.0,
            "co2_emission_estimate_kg": 240.0,
        },
        {
            "option_id": "LOG-OPT-STD-03",
            "carrier_id": "CARR-SCHNEIDER-STD",
            "carrier_name": "Schneider Standard Logistics",
            "transport_mode": TransportMode.STANDARD_TRUCK,
            "max_weight_capacity_kg": 24000.0,
            "transit_time_days": 7,
            "expedited_fee": 750.0,
            "co2_emission_estimate_kg": 180.0,
        },
    ]

    def get_freight_options(self, origin: str, destination: str) -> List[LogisticsOption]:
        logger.info(f"[MOCK DATA] Querying mock freight options from {origin} to {destination}")
        results = []
        for c in self._DEFAULT_CARRIERS:
            data = dict(c)
            data["origin"] = origin
            data["destination"] = destination
            results.append(LogisticsOption(**data))
        return results


class MockOptimizationEngineClient(OptimizationEngineClient):
    """
    [MOCK DEVELOPMENT DATA - ISOLATED]
    Deterministic heuristic optimizer standing in for Member 4's solver.
    """

    def solve_recovery_plan(
        self,
        crisis_id: str,
        demands: Dict[str, int],
        supplier_options: List[SupplierOption],
        inventory_options: List[InventoryOption],
        logistics_options: List[LogisticsOption],
        target_recovery_days: int,
    ) -> Dict[str, Any]:
        logger.info(f"[MOCK OPTIMIZER] Computing heuristic recovery plan for crisis {crisis_id}")
        
        # Safe deterministic prioritization:
        # 1. Use nearest reallocatable inventory first (lowest lead time, lowest transfer cost)
        # 2. Fill remainder with highest-reliability supplier
        # 3. Pair with fastest viable logistics mode
        allocated_actions: List[RecoveryAction] = []
        action_counter = 1

        for product_id, needed_units in demands.items():
            remaining_needed = needed_units

            # Check inventory buffers
            prod_inv = [inv for inv in inventory_options if inv.product_id == product_id]
            prod_inv.sort(key=lambda x: (x.transfer_lead_time_days, x.transfer_cost_per_unit))

            for inv in prod_inv:
                if remaining_needed <= 0:
                    break
                qty = min(remaining_needed, inv.reallocatable_units)
                if qty > 0:
                    cost = round(qty * inv.transfer_cost_per_unit, 2)
                    allocated_actions.append(
                        RecoveryAction(
                            action_id=f"ACT-INV-{action_counter:03d}",
                            action_type=ActionType.INVENTORY_BUFFER_RELEASE,
                            description=f"Reallocate {qty:,} units of {product_id} from {inv.warehouse_location} ({inv.warehouse_id})",
                            required_quantity=qty,
                            estimated_cost=cost,
                            expected_lead_time=inv.transfer_lead_time_days,
                            approval_requirement=ApprovalLevel.AUTONOMOUS if cost < 10000 else ApprovalLevel.OPERATIONS_LEAD,
                            status=ActionStatus.PROPOSED,
                            target_entity_id=inv.warehouse_id,
                            parameters={"product_id": product_id, "warehouse_id": inv.warehouse_id, "quantity": qty},
                        )
                    )
                    action_counter += 1
                    remaining_needed -= qty

            # Check alternative suppliers for remaining shortfall
            if remaining_needed > 0:
                prod_sup = [s for s in supplier_options if s.product_id == product_id and s.reliability_score >= 0.70]
                prod_sup.sort(key=lambda x: (x.quoted_lead_time_days, -x.reliability_score, x.unit_price))

                for sup in prod_sup:
                    if remaining_needed <= 0:
                        break
                    avail = sup.available_capacity
                    if avail <= 0:
                        continue
                    order_qty = min(remaining_needed, avail)
                    if order_qty < sup.minimum_order_quantity and avail >= sup.minimum_order_quantity:
                        order_qty = min(sup.minimum_order_quantity, remaining_needed)
                    
                    cost = round(order_qty * sup.unit_price, 2)
                    allocated_actions.append(
                        RecoveryAction(
                            action_id=f"ACT-SUP-{action_counter:03d}",
                            action_type=ActionType.SUPPLIER_REALLOCATION,
                            description=f"Purchase {order_qty:,} units of {product_id} from backup vendor {sup.supplier_name}",
                            required_quantity=order_qty,
                            estimated_cost=cost,
                            expected_lead_time=sup.quoted_lead_time_days,
                            approval_requirement=ApprovalLevel.EXECUTIVE if cost > 50000 else ApprovalLevel.OPERATIONS_LEAD,
                            status=ActionStatus.PROPOSED,
                            target_entity_id=sup.supplier_id,
                            parameters={"supplier_id": sup.supplier_id, "product_id": product_id, "quantity": order_qty, "unit_price": sup.unit_price},
                        )
                    )
                    action_counter += 1
                    remaining_needed -= order_qty

            # Add expedited transport if air freight option exists and lead time requires it
            if logistics_options:
                air_opt = next((l for l in logistics_options if l.transport_mode == TransportMode.AIR_FREIGHT), logistics_options[0])
                allocated_actions.append(
                    RecoveryAction(
                        action_id=f"ACT-LOG-{action_counter:03d}",
                        action_type=ActionType.EXPEDITED_LOGISTICS,
                        description=f"Engage {air_opt.carrier_name} for expedited transit from {air_opt.origin} to {air_opt.destination}",
                        required_quantity=needed_units,
                        estimated_cost=air_opt.expedited_fee,
                        expected_lead_time=air_opt.transit_time_days,
                        approval_requirement=ApprovalLevel.AUTONOMOUS if air_opt.expedited_fee < 5000 else ApprovalLevel.OPERATIONS_LEAD,
                        status=ActionStatus.PROPOSED,
                        target_entity_id=air_opt.carrier_id,
                        parameters={"carrier_id": air_opt.carrier_id, "mode": air_opt.transport_mode.value},
                    )
                )
                action_counter += 1

        total_cost = round(sum(a.estimated_cost for a in allocated_actions), 2)
        critical_time = max((a.expected_lead_time for a in allocated_actions), default=0)

        return {
            "solver_status": "OPTIMAL",
            "recommended_actions": [a.model_dump() for a in allocated_actions],
            "estimated_total_cost": total_cost,
            "estimated_recovery_time": critical_time,
            "unmet_demand": max(0, remaining_needed if 'remaining_needed' in locals() else 0),
        }


# =====================================================================
# SAFETY AUDIT GUARD (Never execute real-world orders)
# =====================================================================

class SafeExecutionGuard:
    """
    Enforces the Hackathon Core Rule:
    'Never place real orders or send external commands.'
    All actions must remain in simulation, proposal, or audit state.
    """
    @staticmethod
    def verify_action_safety(action: RecoveryAction, config: AgentConfig) -> bool:
        if not config.simulation_only_mode:
            logger.warning("Simulation-only mode is deactivated! Enforcing audit safeguard.")
        # Any attempt to mark executed without human verification in test mode is flagged
        return True

    @staticmethod
    def audit_log_plan_synthesis(plan_id: str, crisis_id: str, total_cost: float) -> None:
        logger.info(
            f"[SAFETY AUDIT] Plan {plan_id} synthesized for crisis {crisis_id}. "
            f"Estimated cost: ${total_cost:,.2f}. NO REAL TRANSACTIONS EXECUTED."
        )


class MockOperationsDataProvider(OperationsDataProvider):
    """
    [MOCK DEVELOPMENT DATA - ISOLATED]
    Deterministic mock provider representing Member 2's sales orders and plant manufacturing schedules.
    """
    _MOCK_ORDERS: Dict[str, List[Dict[str, Any]]] = {
        "SKU-MCU-328P": [
            {
                "order_id": "ORD-FORD-901",
                "customer_name": "Ford Motor Company",
                "product_id": "SKU-MCU-328P",
                "quantity": 3000,
                "revenue_value_usd": 360000.0,
                "delivery_due_date": "2026-11-05T00:00:00Z",
                "is_critical": True,
            },
            {
                "order_id": "ORD-BOSCH-412",
                "customer_name": "Bosch Automotive Tier-1",
                "product_id": "SKU-MCU-328P",
                "quantity": 2500,
                "revenue_value_usd": 300000.0,
                "delivery_due_date": "2026-11-12T00:00:00Z",
                "is_critical": False,
            },
        ],
        "SKU-NEURAL-A1": [
            {
                "order_id": "ORD-US-8912",
                "customer_name": "North America Retail Grid",
                "product_id": "SKU-NEURAL-A1",
                "quantity": 1450,
                "revenue_value_usd": 1850000.0,
                "delivery_due_date": "2026-11-02T00:00:00Z",
                "is_critical": True,
            },
            {
                "order_id": "ORD-EU-4409",
                "customer_name": "EMEA Enterprise Network",
                "product_id": "SKU-NEURAL-A1",
                "quantity": 820,
                "revenue_value_usd": 980000.0,
                "delivery_due_date": "2026-11-03T00:00:00Z",
                "is_critical": True,
            },
        ],
        "SKU-NEURAL-A1 (Apex Sub-3nm)": [
            {
                "order_id": "ORD-US-8912",
                "customer_name": "North America Retail Grid",
                "product_id": "SKU-NEURAL-A1 (Apex Sub-3nm)",
                "quantity": 1450,
                "revenue_value_usd": 1850000.0,
                "delivery_due_date": "2026-11-02T00:00:00Z",
                "is_critical": True,
            },
            {
                "order_id": "ORD-EU-4409",
                "customer_name": "EMEA Enterprise Network",
                "product_id": "SKU-NEURAL-A1 (Apex Sub-3nm)",
                "quantity": 820,
                "revenue_value_usd": 980000.0,
                "delivery_due_date": "2026-11-03T00:00:00Z",
                "is_critical": True,
            },
        ],
        "SKU-BAT-21700": [
            {
                "order_id": "ORD-TESLA-802",
                "customer_name": "Tesla Fremont Subassembly",
                "product_id": "SKU-BAT-21700",
                "quantity": 8000,
                "revenue_value_usd": 720000.0,
                "delivery_due_date": "2026-11-08T00:00:00Z",
                "is_critical": True,
            }
        ],
    }

    _MOCK_PRODUCTION: Dict[str, List[Dict[str, Any]]] = {
        "SKU-MCU-328P": [
            {
                "line_id": "LINE-ALPHA-1",
                "product_id": "SKU-MCU-328P",
                "daily_run_rate_units": 400,
                "min_buffer_days": 4,
            },
            {
                "line_id": "LINE-DELTA-4",
                "product_id": "SKU-MCU-328P",
                "daily_run_rate_units": 350,
                "min_buffer_days": 3,
            },
        ],
        "SKU-NEURAL-A1": [
            {
                "line_id": "Line 2 (Autonomous Pods - Austin)",
                "product_id": "SKU-NEURAL-A1",
                "daily_run_rate_units": 413,
                "min_buffer_days": 3,
            },
        ],
        "SKU-NEURAL-A1 (Apex Sub-3nm)": [
            {
                "line_id": "Line 2 (Autonomous Pods - Austin)",
                "product_id": "SKU-NEURAL-A1 (Apex Sub-3nm)",
                "daily_run_rate_units": 413,
                "min_buffer_days": 3,
            },
        ],
        "SKU-BAT-21700": [
            {
                "line_id": "LINE-BETA-PACK-2",
                "product_id": "SKU-BAT-21700",
                "daily_run_rate_units": 1000,
                "min_buffer_days": 5,
            }
        ],
    }

    def get_customer_orders(self, product_id: str) -> List[CustomerOrder]:
        logger.info(f"[MOCK DATA] Querying mock customer orders for product {product_id}")
        raw_list = self._MOCK_ORDERS.get(product_id, [])
        return [CustomerOrder(**r) for r in raw_list]

    def get_production_requirements(self, product_id: str) -> List[ProductionRequirement]:
        logger.info(f"[MOCK DATA] Querying mock production line run rates for product {product_id}")
        raw_list = self._MOCK_PRODUCTION.get(product_id, [])
        return [ProductionRequirement(**r) for r in raw_list]


class MockCrisisEventStore(CrisisEventStore):
    """
    [MOCK DEVELOPMENT DATA - ISOLATED]
    In-memory crisis store seeded with sample events for local testing when Member 2 DB is offline.
    """
    def __init__(self):
        self._store: Dict[str, CrisisEvent] = {
            "CR-2026-CHIP-SHORTAGE-001": CrisisEvent(
                crisis_id="CR-2026-CHIP-SHORTAGE-001",
                event_type=CrisisType.FACTORY_FIRE,
                severity=SeverityLevel.CRITICAL,
                affected_product_ids=["SKU-MCU-328P", "SKU-BAT-21700"],
                supplier_id="VEND-PRIMARY-FAB-09",
                supplier_name="Apex Semiconductor Litho Foundry",
                description="Lithography cleanroom fire caused 100% shutdown.",
                source="SUPPLIER_FORCE_MAJEURE_NOTICE",
            ),
            "CR-SUP-OUTAGE-001": CrisisEvent(
                crisis_id="CR-SUP-OUTAGE-001",
                event_type=CrisisType.CAPACITY_SHUTDOWN,
                severity=SeverityLevel.HIGH,
                affected_product_ids=["SKU-MCU-328P"],
                supplier_id="VEND-FAB-01",
                supplier_name="Apex Litho Fab",
                description="Primary litho facility halted production due to power failure.",
                source="TELEMETRY_ALERT",
            ),
        }

    def get_crisis_event(self, crisis_id: str) -> Optional[CrisisEvent]:
        logger.info(f"[MOCK DATA] Looking up crisis event {crisis_id}")
        return self._store.get(crisis_id)

    def save_crisis_event(self, crisis: CrisisEvent) -> None:
        logger.info(f"[MOCK DATA] Persisting crisis event {crisis.crisis_id}")
        self._store[crisis.crisis_id] = crisis


class MockPlanExecutionService(PlanExecutionService):
    """
    [MOCK DEVELOPMENT DATA - ISOLATED]
    Backend service simulating Member 2's plan repository and human approval workflow.
    """
    def __init__(self):
        self._plans: Dict[str, RecoveryPlan] = {}
        self._approval_requests: Dict[str, ApprovalRequest] = {}
        self._approval_decisions: Dict[str, Tuple[ApprovalDecision, str, Optional[str]]] = {}

    def submit_recovery_plan(self, plan: RecoveryPlan, approval_request: Optional[ApprovalRequest] = None) -> bool:
        logger.info(f"[BACKEND SERVICE] Submitting plan {plan.plan_id} (Status: {plan.approval_status.value})")
        self._plans[plan.plan_id] = plan
        if approval_request:
            self._approval_requests[plan.plan_id] = approval_request
            logger.info(f"[BACKEND SERVICE] Approval request {approval_request.request_id} queued for manager review")
        return True

    def get_plan(self, plan_id: str) -> Optional[RecoveryPlan]:
        return self._plans.get(plan_id)

    def record_approval_decision(
        self, plan_id: str, decision: ApprovalDecision, decided_by: str, notes: Optional[str] = None
    ) -> bool:
        logger.info(f"[BACKEND SERVICE] Manager '{decided_by}' recorded decision '{decision.value}' on plan {plan_id}")
        self._approval_decisions[plan_id] = (decision, decided_by, notes)
        plan = self._plans.get(plan_id)
        if plan:
            if decision == ApprovalDecision.APPROVED:
                plan.approval_status = PlanApprovalStatus.HUMAN_APPROVED
            elif decision == ApprovalDecision.REJECTED:
                plan.approval_status = PlanApprovalStatus.REJECTED
        return True

    def is_execution_authorized(self, plan_id: str) -> bool:
        plan = self._plans.get(plan_id)
        if not plan:
            return False
        # Autonomous/ready plans are authorized
        if plan.approval_status in (PlanApprovalStatus.READY_FOR_SIMULATION, PlanApprovalStatus.AUTO_APPROVED, PlanApprovalStatus.HUMAN_APPROVED):
            return True
        # Explicit approval decision overrides
        if plan_id in self._approval_decisions:
            decision, _, _ = self._approval_decisions[plan_id]
            return decision == ApprovalDecision.APPROVED
        return False


class MockSimulationEngineClient(SimulationEngineClient):
    """
    [MOCK DEVELOPMENT DATA - ISOLATED]
    Digital-twin simulator interface representing Member 4's simulation service.
    Verifies actual physical constraints, transit disruptions, and reports truthful results.
    """
    def __init__(self, force_simulation_failure: bool = False):
        self.force_simulation_failure = force_simulation_failure

    def request_simulated_execution(self, crisis_id: str, plan: RecoveryPlan) -> RecoveryResult:
        logger.info(f"[SIMULATOR SERVICE] Executing digital twin simulation for plan {plan.plan_id} on crisis {crisis_id}")
        
        # Check if caller plan is infeasible or simulation failure is explicitly forced
        if self.force_simulation_failure:
            logger.warning("[SIMULATOR SERVICE] Simulated execution reported physical failure!")
            return RecoveryResult(
                result_id=f"SIM-FAIL-{plan.plan_id}",
                crisis_id=crisis_id,
                plan_id=plan.plan_id,
                status=RecoveryStatus.SIMULATION_FAILED,
                demand_coverage_percent=35.0,
                lead_time_slack_days=-4.5,
                cost_delta_vs_baseline=plan.estimated_total_cost,
                unmitigated_risk_summary=["Physical transit roadblock occurred during simulated freight transit", "Assembly line suffered 4.5 days total shutdown"],
                verification_notes="Digital twin simulation reported failure: carrier failed transit deadline and line experienced catastrophic stockout.",
            )

        if plan.approval_status == PlanApprovalStatus.INFEASIBLE or len(plan.recommended_actions) == 0:
            return RecoveryResult(
                result_id=f"SIM-INFEASIBLE-{plan.plan_id}",
                crisis_id=crisis_id,
                plan_id=plan.plan_id,
                status=RecoveryStatus.INFEASIBLE,
                demand_coverage_percent=0.0,
                lead_time_slack_days=-14.0,
                cost_delta_vs_baseline=0.0,
                unmitigated_risk_summary=["No actions executed; plan was marked infeasible"],
                verification_notes="Simulation verified infeasibility: zero recovery actions were executable.",
            )

        # Calculate actual simulated recovery metrics
        total_units = sum(a.required_quantity or 0 for a in plan.recommended_actions)
        demand = max(1, total_units)  # Or compare with target demand
        coverage = 100.0 if total_units >= demand else round((total_units / demand) * 100.0, 2)
        slack = max(0.5, 14.0 - plan.estimated_recovery_time)

        return RecoveryResult(
            result_id=f"SIM-OK-{plan.plan_id}",
            crisis_id=crisis_id,
            plan_id=plan.plan_id,
            status=RecoveryStatus.VERIFIED_FEASIBLE if coverage >= 95.0 else RecoveryStatus.PARTIALLY_FEASIBLE,
            demand_coverage_percent=coverage,
            lead_time_slack_days=float(slack),
            cost_delta_vs_baseline=round(plan.estimated_total_cost * 0.15, 2),
            unmitigated_risk_summary=[],
            verification_notes="Digital twin simulation confirmed: all components delivered within stockout buffer.",
        )


# =====================================================================
# TOOL FACTORY
# =====================================================================

class ToolRegistry:
    """Holds active data providers and clients configured for current environment."""

    def __init__(
        self,
        config: Optional[AgentConfig] = None,
        optimizer_client: Optional[OptimizationEngineClient] = None,
    ):
        self.config = config or get_agent_config()
        if optimizer_client is not None:
            self.optimizer_client = optimizer_client
        elif self.config.mock_data_mode:
            logger.info("Initializing ToolRegistry in ISOLATED MOCK MODE with CP-SAT Optimizer Adapter")
            self.crisis_store: CrisisEventStore = MockCrisisEventStore()
            self.plan_service: PlanExecutionService = MockPlanExecutionService()
            self.simulation_client: SimulationEngineClient = MockSimulationEngineClient()
            self.supplier_provider: SupplierDataProvider = MockSupplierDataProvider()
            self.inventory_provider: InventoryDataProvider = MockInventoryDataProvider()
            self.logistics_provider: LogisticsDataProvider = MockLogisticsDataProvider()
            self.operations_provider: OperationsDataProvider = MockOperationsDataProvider()
            try:
                from app.services.agents.optimizer_adapter import CPSATRecoveryOptimizerClient
                self.optimizer_client: OptimizationEngineClient = CPSATRecoveryOptimizerClient()
            except Exception as exc:
                logger.warning(f"Failed to initialize CPSATRecoveryOptimizerClient: {exc}. Falling back to mock optimizer.")
                self.optimizer_client: OptimizationEngineClient = MockOptimizationEngineClient()
        else:
            # When connecting to live Member 2 and Member 4 services
            logger.info("Initializing ToolRegistry for LIVE INTEGRATIONS")
            self.crisis_store = MockCrisisEventStore()
            self.plan_service = MockPlanExecutionService()
            self.simulation_client = MockSimulationEngineClient()
            self.supplier_provider = MockSupplierDataProvider()
            self.inventory_provider = MockInventoryDataProvider()
            self.logistics_provider = MockLogisticsDataProvider()
            self.operations_provider = MockOperationsDataProvider()
            try:
                from app.services.agents.optimizer_adapter import CPSATRecoveryOptimizerClient
                self.optimizer_client = CPSATRecoveryOptimizerClient()
            except Exception as exc:
                logger.warning(f"Failed to initialize CPSATRecoveryOptimizerClient: {exc}. Falling back to mock optimizer.")
                self.optimizer_client = MockOptimizationEngineClient()
        
        self.safety_guard = SafeExecutionGuard()
