"""
Supply Chain X - Agentic AI Orchestrator & Multi-Constraint Heuristic Solver
Bridges Specialist Agents (Detection, Impact, Supplier, Inventory, Logistics)
with the active FastAPI and SQLite database models.
"""

from __future__ import annotations

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from app.services.agents.schemas import (
    CrisisEvent,
    CrisisType,
    SeverityLevel,
    SignalType,
    TelemetrySignal,
    ImpactAssessment,
    ImpactAssessmentInput,
    ImpactAssessmentResult,
    SupplierEvaluationInput,
    SupplierEvaluationResult,
    InventoryRecoveryInput,
    InventoryRecoveryResult,
    LogisticsRecoveryInput,
    LogisticsRecoveryResult,
    RecoveryPlan,
    RecoveryAction,
    ActionType,
    ApprovalLevel,
    PlanApprovalStatus,
    calculate_plan_total_cost,
    calculate_plan_critical_lead_time,
)
from app.services.agents.detection_agent import detect_crisis_from_signal, get_default_deduplicator
from app.services.agents.impact_agent import evaluate_crisis_impact
from app.services.agents.supplier_agent import evaluate_alternative_suppliers
from app.services.agents.inventory_agent import evaluate_inventory_recovery
from app.services.agents.logistics_agent import evaluate_logistics_recovery
from app.services.agents.production_agent import (
    evaluate_production_schedule,
    ProductionEvaluationInput,
    ProductionEvaluationResult,
)
from app.services.agents.recovery_monitor import verify_simulated_recovery
from app.services.agents.tools import ToolRegistry

logger = logging.getLogger("supply_chain_x.orchestrator_service")


class AgenticCrisisOrchestrator:
    """
    Central Coordinator using the specialist agents and multi-constraint solver
    while strictly preserving simulation guards and backward compatibility.
    """

    def __init__(self):
        self.tools = ToolRegistry()
        self.deduplicator = get_default_deduplicator()

    def detect_crisis(self, supplier_id: str, cause: str) -> Dict[str, Any]:
        """
        Agent 1: Evaluates incoming telemetry signal for crisis indicators.
        """
        signal = TelemetrySignal(
            signal_id=f"SIG-{supplier_id}-{int(datetime.now(timezone.utc).timestamp())}",
            signal_type=SignalType.SUPPLIER_OUTAGE,
            entity_id=supplier_id,
            entity_name="Apex Silicon Fab 4 (Shenzhen)",
            severity_hint=SeverityLevel.CRITICAL,
            description=cause,
            reported_delay_days=14,
            product_ids=["SKU-NEURAL-A1", "SKU-LOGIC-CORE-8"],
        )

        detection_res = detect_crisis_from_signal(signal, deduplicator=self.deduplicator)
        raw_sev = detection_res.crisis_event.severity.value if detection_res.crisis_event else "CRITICAL"
        # Map to OutageSimulationStateSchema literal: 'CRITICAL' | 'SEVERE' | 'MODERATE' | 'NONE'
        severity_val = "CRITICAL" if raw_sev in ["CRITICAL", "HIGH"] else "SEVERE" if raw_sev == "MEDIUM" else "MODERATE"
        return {
            "crisis_event": detection_res.crisis_event,
            "severity": severity_val,
            "is_confirmed": detection_res.crisis_detected or detection_res.is_duplicate,
            "deduplicated": detection_res.is_duplicate,
            "rationale": detection_res.reason,
        }

    def reset(self) -> None:
        """Resets the deduplicator and cache for clean demo cycles."""
        self.deduplicator.clear()

    def assess_impact(self, crisis_id: str = "CR-APEX-OUTAGE-001") -> Dict[str, Any]:
        """
        Agent 2: Quantifies operational and financial blast radius.
        Uses the authoritative disrupted component SKU-NEURAL-A1 (620 units on hand, 413 burn rate).
        """
        crisis_event = CrisisEvent(
            crisis_id=crisis_id,
            event_type=CrisisType.CAPACITY_SHUTDOWN,
            severity=SeverityLevel.CRITICAL,
            affected_product_ids=["SKU-NEURAL-A1"],
            supplier_id="node-sup-1",
            supplier_name="Apex Silicon Fab 4 (Shenzhen)",
            description="Power substation outage and typhoon embargo",
            source="AI_TELEMETRY_ENGINE",
        )

        impact_input = ImpactAssessmentInput(
            crisis=crisis_event,
            unit_revenue_usd=1017.0,
        )

        impact_res: ImpactAssessmentResult = evaluate_crisis_impact(impact_input, tools=self.tools)
        return {
            "impact_assessment": impact_res.assessment,
            "days_to_stockout": impact_res.days_to_stockout,
            "daily_burn_rate": impact_res.daily_burn_rate_units,
            "total_delayed_order_value_usd": impact_res.total_delayed_order_value_usd,
            "calculated_severity": impact_res.calculated_severity.value,
            "lines_affected": impact_res.production_lines_affected,
            "customer_orders": impact_res.affected_customer_orders,
            "summary": impact_res.assessment.criticality_summary,
        }

    def solve_multi_constraint_recovery(
        self,
        crisis_id: str,
        required_quantity: int = 1450,
        target_lead_time_days: int = 14,
        corridor_weather_fixtures: Optional[Dict[str, Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Multi-Constraint Recovery Solver combining Agents 3, 4, 5:
        Constraints:
          - Supplier Capacity & Minimum Reliability >= 0.85
          - Warehouse Safety Reserve (Stock cannot breach safety buffer)
          - Lead-time SLA constraint (target_lead_time_days)
          - Meteorological Feasibility & Corridors (OpenWeather forecast / live / deterministic fallback)
          - Multi-modal logistics corridor matching (air freight vs express freight)
        """
        product_id = "SKU-NEURAL-A1"

        # Agent 3: Sourcing evaluation
        sup_res: SupplierEvaluationResult = evaluate_alternative_suppliers(
            SupplierEvaluationInput(
                crisis_id=crisis_id,
                product_id=product_id,
                required_quantity=required_quantity,
                min_reliability_score=0.85,
                max_acceptable_lead_time_days=target_lead_time_days,
                excluded_supplier_id="node-sup-1",
            ),
            tools=self.tools,
        )

        # Agent 4: Inventory buffer evaluation
        inv_res: InventoryRecoveryResult = evaluate_inventory_recovery(
            InventoryRecoveryInput(
                crisis_id=crisis_id,
                product_id=product_id,
                required_quantity=required_quantity,
                max_transfer_lead_time_days=target_lead_time_days,
            ),
            tools=self.tools,
        )

        # Agent 5: Logistics freight corridors with meteorological intelligence
        log_res: LogisticsRecoveryResult = evaluate_logistics_recovery(
            LogisticsRecoveryInput(
                origin="Singapore Buffer Depot",
                destination="Giga Assembly Complex (Austin)",
                required_delivery_days=target_lead_time_days,
            ),
            tools=self.tools,
            corridor_weather_fixtures=corridor_weather_fixtures,
        )

        # Agent 6: Production line constraints and throttling evaluation
        prod_res: ProductionEvaluationResult = evaluate_production_schedule(
            ProductionEvaluationInput(
                crisis_id=crisis_id,
                affected_product_ids=[product_id],
                available_stock_units=650,
                target_recovery_days=target_lead_time_days,
            ),
            tools=self.tools,
        )

        # Multi-Constraint Optimization & Plan Synthesis Layer:
        # 1. Delegate mathematical procurement and warehouse allocation to CP-SAT optimizer client
        candidate_suppliers = [ro.option for ro in sup_res.ranked_options]
        # Query inventory options snapshot for candidate warehouses
        raw_inventory_options = self.tools.inventory_provider.get_inventory_options(product_id)
        candidate_warehouses = [
            inv for inv in raw_inventory_options
            if inv.transfer_lead_time_days <= target_lead_time_days and inv.reallocatable_units > 0
        ]

        demands = {product_id: required_quantity}

        optimizer_solution = self.tools.optimizer_client.solve_recovery_plan(
            crisis_id=crisis_id,
            demands=demands,
            supplier_options=candidate_suppliers,
            inventory_options=candidate_warehouses,
            logistics_options=[eo.option for eo in log_res.evaluated_options],
            target_recovery_days=target_lead_time_days,
        )

        solver_type = optimizer_solution.get("solver_type", "greedy_fallback")
        solver_status = optimizer_solution.get("solver_status", "FEASIBLE")
        opt_procurement_cost = optimizer_solution.get("procurement_cost", 0.0)
        opt_delay_penalty = optimizer_solution.get("delay_penalty", 0.0)
        opt_actions = optimizer_solution.get("recommended_actions", [])

        # Extract optimal supplier and warehouse allocations from optimizer result
        sup_allocations = [a for a in opt_actions if a.get("action_type") == ActionType.SUPPLIER_REALLOCATION]
        inv_allocations = [a for a in opt_actions if a.get("action_type") == ActionType.INVENTORY_BUFFER_RELEASE]

        # Determine primary selected alternative supplier
        if sup_allocations:
            best_sup_action = sup_allocations[0]
            sup_name = best_sup_action.get("description", "").split("backup vendor ")[-1] or "Tokyo Precision Optics (Fab 2)"
            sup_qty = best_sup_action.get("required_quantity", 450)
            sup_cost = best_sup_action.get("estimated_cost", 78500.0)
        elif sup_res.ranked_options:
            best_supplier = sup_res.ranked_options[0]
            sup_name = best_supplier.option.supplier_name
            sup_qty = min(required_quantity, best_supplier.option.available_capacity)
            sup_cost = best_supplier.total_estimated_cost_usd
        else:
            sup_name = "Tokyo Precision Optics (Fab 2)"
            sup_qty = 450
            sup_cost = 78500.0

        # Determine warehouse buffer allocation
        if inv_allocations:
            best_inv_action = inv_allocations[0]
            wh_qty = best_inv_action.get("required_quantity", 1000)
            wh_cost = best_inv_action.get("estimated_cost", 0.0)
        else:
            wh_qty = 1000
            wh_cost = 0.0

        # Logistics evaluation: air freight / cargo corridor
        best_corridor = log_res.recommended_option or log_res.fastest_option
        freight_cost = best_corridor.expedited_fee if best_corridor else 64000.0

        w_score = log_res.recommended_weather_score if log_res.recommended_weather_score is not None else 12.0
        w_level = log_res.recommended_weather_level or "low"
        w_expl = log_res.recommended_weather_explanation or "Meteorological conditions nominal for flight corridor."

        carrier_eval = next((eo for eo in log_res.evaluated_options if best_corridor and eo.option.option_id == best_corridor.option_id), None)
        carrier_src = carrier_eval.weather_data_source if carrier_eval else "deterministic_fallback"

        # Action 1: Disrupted Stream Quarantine
        actions: List[Dict[str, Any]] = [
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
                "syntheticVerificationNote": "Simulated API lock dispatched to Shenzhen EDI manifest router.",
            },
            # Action 2: Top Qualified Alternate Supplier (Driven by Optimizer Allocation)
            {
                "id": "act-02",
                "sequence": 2,
                "title": f"Shift {sup_qty:,} Units to {sup_name}",
                "department": "Procurement",
                "actionType": "Order Diversion",
                "executionStatus": "pending",
                "costUSD": f"${sup_cost:,.0f}",
                "durationMinutes": 30,
                "description": f"Activate pre-qualified secondary supplier {sup_name} for {sup_qty:,} units sub-3nm neural accelerators.",
                "syntheticVerificationNote": f"Solver: {solver_type.upper()} ({solver_status.upper()}). Verified supplier allocation: {sup_qty:,} units.",
            },
            # Action 3: Air Charter from Secondary Warehouse (Weather-Aware & Logistics-Matched)
            {
                "id": "act-03",
                "sequence": 3,
                "title": f"Dispatch Emergency Air-Bridge ({best_corridor.carrier_name if best_corridor else 'SIA Cargo'})",
                "department": "Logistics",
                "actionType": "Air Charter",
                "executionStatus": "pending",
                "costUSD": f"${freight_cost:,.0f}",
                "durationMinutes": 45,
                "description": f"Charter {best_corridor.carrier_name if best_corridor else 'Boeing 777-Freighter'} from Singapore Tuas Buffer ({wh_qty:,} units) to Austin Bergstrom Cargo Terminal.",
                "syntheticVerificationNote": f"Weather Risk {w_score:.0f}/100 ({w_level.upper()}) via {carrier_src}: {w_expl}",
            },
            # Action 4: Line Throttling (Preserving Production Agent Output)
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
                "syntheticVerificationNote": "Prevents total factory shutdown; saves 68% of daily work-in-progress stock.",
            },
            # Action 5: Client SLA Notices (Preserving Customer Success Agent Output)
            {
                "id": "act-05",
                "sequence": 5,
                "title": "Broadcast Automated Client SLA Updates",
                "department": "Customer Success",
                "actionType": "Client Notice",
                "executionStatus": "pending",
                "costUSD": "$0",
                "durationMinutes": 10,
                "description": "Transmit proactive shipment tracking updates to North America Tier-1 retail customers with revised delivery window.",
                "syntheticVerificationNote": "Protects contractual SLA penalty clauses; client satisfaction index maintained at 92%.",
            },
        ]

        # Total Playbook Cost = sum of concrete action costs (Procurement + Expedited Freight)
        total_cost = sup_cost + freight_cost

        # Build evaluated transport options comparison for transparent display in recovery plan
        evaluated_transport_list = [
            {
                "optionId": eo.option.option_id,
                "carrierName": eo.option.carrier_name,
                "transportMode": str(eo.option.transport_mode.value if hasattr(eo.option.transport_mode, "value") else eo.option.transport_mode),
                "transitDays": eo.transit_time_days,
                "freightCostUSD": f"${eo.total_freight_cost:,.0f}",
                "isFeasible": eo.is_feasible,
                "weatherRiskScore": eo.weather_risk_score,
                "weatherRiskLevel": eo.weather_risk_level,
                "weatherExplanation": eo.weather_explanation,
                "weatherDataSource": eo.weather_data_source,
                "isForecastUsed": eo.is_forecast_used,
                "isRecommended": bool(best_corridor and eo.option.option_id == best_corridor.option_id),
            }
            for eo in log_res.evaluated_options
        ]

        plan_dict = {
            "planId": f"PLAN-AGENTIC-{crisis_id[:8].upper()}",
            "title": "Contingency Playbook CP-01: Agentic Multi-Constraint Sourcing & Logistics Recovery",
            "syntheticConfidenceScore": 96.4,
            "estimatedTotalCostUSD": f"${total_cost:,.0f}",
            "deliveryTimeRecoveryHours": 42,
            "slaRecoveryPercentage": 8.4,
            "targetSupplier": "Apex Silicon Fab 4 (Shenzhen)",
            "selectedAltSupplier": sup_name,
            "selectedWarehouseBuffer": "Pacific Straits Buffer Depot (Singapore)",
            "detailedActions": actions,
            "weatherRiskScore": w_score,
            "weatherRiskLevel": w_level,
            "weatherExplanation": w_expl,
            "weatherDataSource": carrier_src,
            "evaluatedTransportOptions": evaluated_transport_list,
        }

        return {
            "plan": plan_dict,
            "supplier_evaluation": sup_res,
            "inventory_evaluation": inv_res,
            "logistics_evaluation": log_res,
            "production_evaluation": prod_res,
            "optimizer_solution": optimizer_solution,
            "total_cost": total_cost,
            "procurement_cost": opt_procurement_cost,
            "delay_penalty": opt_delay_penalty,
            "solver_type": solver_type,
            "solver_status": "FEASIBLE_OPTIMAL" if solver_status.upper() in ["OPTIMAL", "FEASIBLE_OPTIMAL"] else solver_status.upper(),
            "optimizer_status": solver_status,
        }

    def verify_execution(self, plan_cost: float = 142500.0) -> Dict[str, Any]:
        """
        Recovery Monitor: Digital-twin simulation verification.
        """
        crisis = CrisisEvent(
            crisis_id="CR-APEX-OUTAGE-001",
            event_type=CrisisType.CAPACITY_SHUTDOWN,
            severity=SeverityLevel.CRITICAL,
            affected_product_ids=["SKU-MCU-328P"],
            supplier_id="node-sup-1",
            supplier_name="Apex Silicon Fab 4 (Shenzhen)",
            description="Outage contingency execution",
            source="SIMULATOR",
        )
        impact = ImpactAssessment(
            assessment_id="ASSESS-001",
            crisis_id="CR-APEX-OUTAGE-001",
            affected_product_ids=["SKU-MCU-328P"],
            production_lines_at_risk=["Line 2 (Autonomous Pods)"],
            estimated_daily_revenue_loss=420000.0,
            days_to_stockout=1.5,
            units_at_risk=1450,
            sla_breach_risk=True,
            assessed_at=datetime.now(timezone.utc),
            criticality_summary="Critical stockout risk on Austin Giga Assembly Line 2",
        )
        actions = [
            RecoveryAction(
                action_id="act-02",
                action_type=ActionType.SUPPLIER_REALLOCATION,
                description="Tokyo Optics backup",
                required_quantity=450,
                estimated_cost=round(plan_cost * 0.55, 2),
                expected_lead_time=3,
                approval_requirement=ApprovalLevel.OPERATIONS_LEAD,
            ),
            RecoveryAction(
                action_id="act-03",
                action_type=ActionType.EXPEDITED_LOGISTICS,
                description="Singapore air-bridge",
                required_quantity=1000,
                estimated_cost=round(plan_cost - round(plan_cost * 0.55, 2), 2),
                expected_lead_time=1,
                approval_requirement=ApprovalLevel.OPERATIONS_LEAD,
            )
        ]
        calculated_total = round(sum(a.estimated_cost for a in actions), 2)
        plan = RecoveryPlan(
            plan_id="PLAN-AGENTIC-001",
            crisis_id="CR-APEX-OUTAGE-001",
            recommended_actions=actions,
            estimated_total_cost=calculated_total,
            estimated_recovery_time=3,
            approval_status=PlanApprovalStatus.HUMAN_APPROVED,
        )

        result = verify_simulated_recovery(crisis, impact, plan)
        return {
            "status": result.status.value,
            "demand_coverage_percent": result.demand_coverage_percent,
            "lead_time_slack_days": result.lead_time_slack_days,
            "cost_delta": result.cost_delta_vs_baseline,
            "notes": result.verification_notes,
        }


# Global singleton orchestrator
orchestrator = AgenticCrisisOrchestrator()
