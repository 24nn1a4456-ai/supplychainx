"""
agents.py — Four specialist agents for Supply Chain X crisis management.

Each agent is a deterministic, rule-based component with clear input/output.
No LLM dependency. All data is from the seeded database or scenario state.

Agents:
  SupplierAgent    — evaluate supplier disruption, find alternatives
  InventoryAgent   — assess stock levels, coverage, stockout risk
  LogisticsAgent   — assess shipping delays, route alternatives
  CrisisManager    — orchestrate all agents, call decision engine, generate proposal
"""
from __future__ import annotations

import json
import math
import traceback
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from backend.models import (
    SupplierRecord, InventoryRecord, WarehouseRecord,
    DisruptionRecord, RecoveryPlanRecord, AuditEvent,
)
from backend.engine_adapter import EngineAdapter


# ───────────────────────── Agent Result Schemas ─────────────────────

@dataclass
class AgentResult:
    agent_name: str
    status: str  # "success", "failed", "skipped"
    findings: Dict[str, Any] = field(default_factory=dict)
    recommendations: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


# ───────────────────────── Supplier Agent ───────────────────────────

class SupplierAgent:
    """
    Identifies affected suppliers, evaluates alternatives by capacity/cost/lead-time,
    and ranks them with documented rules.
    """

    NAME = "SupplierAgent"

    @staticmethod
    def assess(disruption: DisruptionRecord, db: Session) -> AgentResult:
        try:
            affected_material = disruption.affected_material or "COMP-PCB-01"
            affected_supplier_id = disruption.affected_supplier_id

            # Get all suppliers for this material
            all_suppliers = db.query(SupplierRecord).filter(
                SupplierRecord.material == affected_material
            ).all()

            affected = []
            alternatives = []

            for s in all_suppliers:
                info = {
                    "id": s.id, "name": s.name, "capacity": s.capacity,
                    "lead_time_days": s.lead_time_days, "unit_cost": s.unit_cost,
                    "transport_cost": s.transport_cost, "reliability": s.reliability_score,
                    "is_available": s.is_available, "is_primary": s.is_primary,
                }
                if s.id == affected_supplier_id or not s.is_available:
                    affected.append(info)
                else:
                    # Score for ranking: lower is better
                    # Weighted: 50% effective cost, 30% lead time, 20% inverse reliability
                    effective_cost = s.unit_cost + s.transport_cost
                    score = (effective_cost * 0.5 +
                             s.lead_time_days * 3.0 * 0.3 +
                             (1.0 - s.reliability_score) * 100 * 0.2)
                    info["ranking_score"] = round(score, 2)
                    info["effective_cost_per_unit"] = effective_cost
                    alternatives.append(info)

            # Sort by ranking score (lower = better)
            alternatives.sort(key=lambda x: x.get("ranking_score", 999))

            recommendations = []
            if alternatives:
                best = alternatives[0]
                recommendations.append(
                    f"Recommended: {best['name']} ({best['id']}) — "
                    f"${best['effective_cost_per_unit']:.2f}/unit, "
                    f"{best['lead_time_days']:.0f}d lead, "
                    f"capacity {best['capacity']} units"
                )
            warnings = []
            total_alt_capacity = sum(a["capacity"] for a in alternatives)
            if total_alt_capacity == 0:
                warnings.append("CRITICAL: No alternative suppliers available for this material.")
            elif total_alt_capacity < 100:
                warnings.append(f"WARNING: Limited alternative capacity ({total_alt_capacity} units).")

            return AgentResult(
                agent_name=SupplierAgent.NAME,
                status="success",
                findings={
                    "affected_material": affected_material,
                    "affected_suppliers": affected,
                    "alternative_suppliers": alternatives,
                    "total_alternative_capacity": total_alt_capacity,
                    "ranking_rule": "50% effective_cost + 30% lead_time + 20% unreliability",
                },
                recommendations=recommendations,
                warnings=warnings,
            )
        except Exception as e:
            return AgentResult(
                agent_name=SupplierAgent.NAME,
                status="failed",
                error=f"{type(e).__name__}: {str(e)}",
            )


# ───────────────────────── Inventory Agent ──────────────────────────

class InventoryAgent:
    """
    Evaluates stock levels, safety stock, demand coverage, and stockout risk.
    """

    NAME = "InventoryAgent"

    @staticmethod
    def assess(disruption: DisruptionRecord, db: Session) -> AgentResult:
        try:
            affected_material = disruption.affected_material or "COMP-PCB-01"

            inventory_items = db.query(InventoryRecord).filter(
                InventoryRecord.material_id == affected_material
            ).all()

            stock_analysis = []
            total_available = 0
            total_safety = 0
            total_demand = 0

            for inv in inventory_items:
                usable = max(0, inv.current_qty - inv.safety_stock)
                coverage_days = (usable / inv.daily_demand) if inv.daily_demand > 0 else float("inf")
                risk = "LOW" if coverage_days >= 7 else ("MEDIUM" if coverage_days >= 3 else "HIGH")

                stock_analysis.append({
                    "inventory_id": inv.id,
                    "warehouse_id": inv.warehouse_id,
                    "current_qty": inv.current_qty,
                    "safety_stock": inv.safety_stock,
                    "usable_qty": usable,
                    "daily_demand": inv.daily_demand,
                    "coverage_days": round(coverage_days, 1) if not math.isinf(coverage_days) else None,
                    "stockout_risk": risk,
                })
                total_available += usable
                total_safety += inv.safety_stock
                total_demand += inv.daily_demand

            total_coverage = (total_available / total_demand) if total_demand > 0 else 0
            urgency = "CRITICAL" if total_coverage < 2 else ("HIGH" if total_coverage < 5 else "NORMAL")

            recommendations = []
            warnings = []
            if urgency in ("CRITICAL", "HIGH"):
                recommendations.append(
                    f"Replenishment urgency: {urgency}. "
                    f"Available stock covers ~{total_coverage:.1f} days at current demand."
                )
            if total_available == 0:
                warnings.append("CRITICAL: Zero usable inventory. All demand must be sourced externally.")

            return AgentResult(
                agent_name=InventoryAgent.NAME,
                status="success",
                findings={
                    "affected_material": affected_material,
                    "stock_analysis": stock_analysis,
                    "total_usable_qty": total_available,
                    "total_safety_stock": total_safety,
                    "total_daily_demand": total_demand,
                    "estimated_coverage_days": round(total_coverage, 1),
                    "replenishment_urgency": urgency,
                    "data_source": "Seeded synthetic inventory data",
                },
                recommendations=recommendations,
                warnings=warnings,
            )
        except Exception as e:
            return AgentResult(
                agent_name=InventoryAgent.NAME,
                status="failed",
                error=f"{type(e).__name__}: {str(e)}",
            )


# ───────────────────────── Logistics Agent ──────────────────────────

class LogisticsAgent:
    """
    Assesses shipping disruptions, compares routes, estimates delays and costs.
    """

    NAME = "LogisticsAgent"

    @staticmethod
    def assess(disruption: DisruptionRecord, db: Session) -> AgentResult:
        try:
            warehouses = db.query(WarehouseRecord).all()
            affected_wh_id = disruption.affected_warehouse_id

            route_analysis = []
            for wh in warehouses:
                status = "BLOCKED" if (wh.id == affected_wh_id or not wh.is_operational) else "AVAILABLE"
                route_analysis.append({
                    "warehouse_id": wh.id,
                    "warehouse_name": wh.name,
                    "location": wh.location,
                    "status": status,
                    "transfer_cost_per_unit": wh.transfer_cost,
                    "transfer_lead_days": wh.transfer_lead_days,
                    "capacity": wh.capacity,
                })

            available_routes = [r for r in route_analysis if r["status"] == "AVAILABLE"]
            blocked_routes = [r for r in route_analysis if r["status"] == "BLOCKED"]

            # Estimate delay from disruption
            is_delay_scenario = disruption.type in ("shipment_delay",)
            est_delay = disruption.duration_days if is_delay_scenario else 0

            recommendations = []
            warnings = []

            if available_routes:
                best = min(available_routes, key=lambda r: r["transfer_cost_per_unit"])
                recommendations.append(
                    f"Recommended route: {best['warehouse_name']} ({best['warehouse_id']}) — "
                    f"${best['transfer_cost_per_unit']:.2f}/unit, "
                    f"{best['transfer_lead_days']:.0f}d transit"
                )
            else:
                warnings.append("CRITICAL: No available logistics routes.")

            if blocked_routes:
                for r in blocked_routes:
                    warnings.append(f"Route {r['warehouse_id']} ({r['warehouse_name']}) is BLOCKED.")

            return AgentResult(
                agent_name=LogisticsAgent.NAME,
                status="success",
                findings={
                    "route_analysis": route_analysis,
                    "available_routes": len(available_routes),
                    "blocked_routes": len(blocked_routes),
                    "estimated_delay_days": est_delay,
                    "disruption_type": disruption.type,
                    "assumptions": [
                        "Route availability based on warehouse operational status.",
                        "Transfer costs are flat-rate per unit.",
                        "No real carrier API is contacted.",
                    ],
                },
                recommendations=recommendations,
                warnings=warnings,
            )
        except Exception as e:
            return AgentResult(
                agent_name=LogisticsAgent.NAME,
                status="failed",
                error=f"{type(e).__name__}: {str(e)}",
            )


# ───────────────────────── Crisis Manager ───────────────────────────

class CrisisManager:
    """
    Orchestrates all specialist agents and the decision engine.

    1. Receive disruption
    2. Trigger all three specialist agents
    3. Collect and consolidate results
    4. Call the real decision engine via EngineAdapter
    5. Store the recovery plan
    6. Return a complete analysis

    Agent failures are handled gracefully and logged — never silently invented.
    """

    @staticmethod
    def analyze(disruption: DisruptionRecord, db: Session) -> Dict[str, Any]:
        """
        Full crisis analysis pipeline.
        
        Returns the complete analysis including agent results, plan, and KPIs.
        """
        agent_results = {}

        # ── 1. Run specialist agents ──────────────────────────────
        for AgentClass in [SupplierAgent, InventoryAgent, LogisticsAgent]:
            try:
                result = AgentClass.assess(disruption, db)
                agent_results[result.agent_name] = result.to_dict()
            except Exception as e:
                agent_results[AgentClass.NAME] = AgentResult(
                    agent_name=AgentClass.NAME,
                    status="failed",
                    error=f"Orchestrator caught: {type(e).__name__}: {str(e)}",
                ).to_dict()

        # ── 2. Determine scenario mapping ─────────────────────────
        scenario_name = disruption.scenario_name or _map_disruption_to_scenario(disruption.type)

        # ── 3. Run the real decision engine ───────────────────────
        engine_result = None
        engine_error = None
        try:
            engine_result = EngineAdapter.run_scenario(
                scenario_name=scenario_name,
                delay_penalty_per_day=5.0,
            )
        except Exception as e:
            engine_error = f"{type(e).__name__}: {str(e)}"

        # ── 4. Store recovery plan ────────────────────────────────
        plan_record = None
        if engine_result:
            plan_data = engine_result["plan"]
            plan_record = RecoveryPlanRecord(
                disruption_id=disruption.id,
                actions_json=json.dumps(plan_data["actions"]),
                solver_status=plan_data["solver_status"],
                solver_type=plan_data["solver_type"],
                total_cost=plan_data["total_cost"],
                procurement_cost=plan_data["procurement_cost"],
                delay_penalty=plan_data["delay_penalty"],
                is_feasible=plan_data["is_feasible"],
                kpi_json=json.dumps(engine_result["kpis"]),
                agent_results_json=json.dumps(agent_results),
                fulfilled_json=json.dumps(plan_data["fulfilled"]),
                violated_constraints=json.dumps(plan_data["violated_constraints"]),
                status="pending",
            )
            db.add(plan_record)
            db.flush()  # ensure plan_record.id is populated

            # Audit
            db.add(AuditEvent(
                event_type="plan_generated",
                entity_id=plan_record.id,
                actor="crisis_manager",
                details_json=json.dumps({
                    "disruption_id": disruption.id,
                    "solver_type": plan_data["solver_type"],
                    "solver_status": plan_data["solver_status"],
                    "is_feasible": plan_data["is_feasible"],
                    "total_cost": plan_data["total_cost"],
                    "agents_run": list(agent_results.keys()),
                    "agents_succeeded": [k for k, v in agent_results.items() if v["status"] == "success"],
                    "agents_failed": [k for k, v in agent_results.items() if v["status"] == "failed"],
                }),
            ))

            disruption.status = "analyzed"
            disruption.analysis_result = json.dumps(agent_results)
            db.commit()

        # ── 5. Build response ─────────────────────────────────────
        return {
            "disruption_id": disruption.id,
            "scenario_name": scenario_name,
            "agents": agent_results,
            "agents_summary": {
                "total": len(agent_results),
                "succeeded": sum(1 for v in agent_results.values() if v["status"] == "success"),
                "failed": sum(1 for v in agent_results.values() if v["status"] == "failed"),
            },
            "engine_result": engine_result,
            "engine_error": engine_error,
            "plan_id": plan_record.id if plan_record else None,
            "plan_status": plan_record.status if plan_record else None,
        }


def _map_disruption_to_scenario(disruption_type: str) -> str:
    """Map a disruption type to an existing simulator scenario name."""
    mapping = {
        "supplier_outage": "supplier_outage",
        "shipment_delay": "shipment_delay",
        "warehouse_outage": "warehouse_outage",
        "demand_spike": "demand_spike",
        "low_inventory": "low_inventory",
        "inventory_shortage": "low_inventory",
    }
    return mapping.get(disruption_type, "supplier_outage")
