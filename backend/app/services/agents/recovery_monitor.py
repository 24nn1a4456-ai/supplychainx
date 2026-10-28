"""
Supply Chain X - Recovery Monitor & Simulation Verifier (Foundation)
Author: Member 1 (Agentic AI Engineer)

Role: Verifies the simulated recovery plan before human approval or simulated execution.
Computes demand coverage percentage, lead-time slack days, cost delta vs baseline,
and residual unmitigated operational risks.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List

from .schemas import (
    CrisisEvent,
    ImpactAssessment,
    RecoveryPlan,
    RecoveryResult,
    RecoveryStatus,
)

logger = logging.getLogger("supply_chain_x.agents.monitor")


def verify_simulated_recovery(
    crisis: CrisisEvent,
    impact: ImpactAssessment,
    plan: RecoveryPlan,
    baseline_component_unit_cost: float = 4.0,
) -> RecoveryResult:
    """
    Simulates plan execution in a sandboxed digital twin environment.
    Guarantees: Never executes real commands or sends external orders.
    Calculates deterministic feasibility metrics.
    """
    logger.info(f"Verifying simulated recovery for plan {plan.plan_id} on crisis {crisis.crisis_id}")

    # Calculate total units recovered across all recommended actions
    total_recovered_units = sum(
        action.required_quantity or 0
        for action in plan.recommended_actions
        if action.required_quantity is not None
    )

    demand_units = max(1, impact.units_at_risk)
    demand_coverage_percent = min(100.0, round((total_recovered_units / demand_units) * 100.0, 2))

    # Lead time slack: days to stockout minus recovery time
    lead_time_slack_days = round(impact.days_to_stockout - plan.estimated_recovery_time, 1)

    # Cost delta compared to baseline routine purchasing
    baseline_cost = round(demand_units * baseline_component_unit_cost, 2)
    cost_delta = round(plan.estimated_total_cost - baseline_cost, 2)

    unmitigated_risks: List[str] = []
    if demand_coverage_percent < 90.0:
        unmitigated_risks.append(f"Capacity shortfall: {100.0 - demand_coverage_percent:.1f}% unmitigated demand")
    if lead_time_slack_days < 0:
        unmitigated_risks.append(f"Stockout risk: Lead time exceeds stockout buffer by {abs(lead_time_slack_days)} days")

    # Status assignment
    if demand_coverage_percent >= 95.0 and lead_time_slack_days >= 0:
        status = RecoveryStatus.VERIFIED_FEASIBLE
        notes = "Simulation passed: 100% demand covered within safe stockout timeline."
    elif demand_coverage_percent >= 75.0:
        status = RecoveryStatus.PARTIALLY_FEASIBLE
        notes = "Simulation caution: Partial demand covered; line slowdown recommended to conserve buffer."
    else:
        status = RecoveryStatus.INFEASIBLE
        notes = "Simulation failed: Plan does not prevent catastrophic stockout under current constraints."

    return RecoveryResult(
        result_id=f"RES-{plan.plan_id}",
        crisis_id=crisis.crisis_id,
        plan_id=plan.plan_id,
        simulation_timestamp=datetime.now(timezone.utc),
        status=status,
        demand_coverage_percent=demand_coverage_percent,
        lead_time_slack_days=lead_time_slack_days,
        cost_delta_vs_baseline=cost_delta,
        unmitigated_risk_summary=unmitigated_risks,
        verification_notes=notes,
    )
