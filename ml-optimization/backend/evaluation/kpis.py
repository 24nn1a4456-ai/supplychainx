"""
kpis.py — Precise KPI definitions and computation for Supply Chain X evaluation.

Every KPI is computed **exclusively from actual simulation outputs**
(RecoveryPlan, ScenarioState).  No numbers are invented or inferred
from model explanations.

KPI Definitions
---------------
All definitions apply to a single (scenario, approach) pair.

MTTD — Mean Time to Detect (days)
    Simulation days between disruption occurrence and detection.
    Formula: DisruptionEvent.detected_at_day - DisruptionEvent.outage_start_day.
    When detected_at_day is None, MTTD = 0 (instantaneous detection assumed).
    Units: simulation days (integer). Detection cannot precede the disruption.
    Source: DisruptionEvent.mttd_days().

MEAN_ARRIVAL_DAY — Mean Delivery Day (days)
    The **arithmetic mean** of estimated_arrival_days across all actions in the
    recovery plan.  This is NOT a verified recovery time (no wall-clock timestamps
    are captured); it is a forward-looking estimate based on scenario constants.
    Formula: mean(RecoveryAction.estimated_arrival_days for all actions).
    Value is math.inf when the plan is infeasible; 0.0 when no actions exist.
    Source: RecoveryAction.estimated_arrival_days.

LAST_DELIVERY_DAY — Last Delivery Day (days)
    The worst-case (maximum) estimated_arrival_days across all actions.
    Formula: max(RecoveryAction.estimated_arrival_days for all actions).
    Value is math.inf when infeasible; 0.0 when no actions.
    Source: RecoveryAction.estimated_arrival_days.

    NOTE: Neither mean_arrival_day nor last_delivery_day equals true MTTR
    (which requires actual disruption-start and recovery-completion timestamps).
    These are delivery estimates, not measured end-to-end recovery durations.
    Use them for relative comparison between approaches only.

RECOVERY_COST — Total Recovery Cost
    plan.total_cost = procurement_cost + delay_penalty.
    Source: RecoveryPlan.total_cost.

FULFILLMENT_RATE — Order Fulfillment Rate (%)
    (sum of fulfilled quantities) / (total required quantity) × 100.
    Source: RecoveryPlan.fulfilled, ComponentDemand.required_qty.

ON_TIME_RATE — On-Time Delivery Rate (%)
    Units arriving on or before their due date / total fulfilled units × 100.
    A unit is "on time" when RecoveryAction.delay_days == 0.
    Source: RecoveryAction.delay_days, RecoveryAction.quantity.

STOCKOUT_RATE — Stockout Rate (%)
    (total unmet demand) / (total required demand) × 100 = 100 - FULFILLMENT_RATE.

IS_AUTO_RESOLVED — Auto-Resolved (boolean, per incident)
    True when the plan is feasible AND fulfillment_rate >= AUTO_THRESHOLD (80%).
    Interpretation: this single incident was handled automatically without
    manual intervention.  This is a per-incident boolean, not a cross-crisis rate.

AUTO_RESOLUTION_RATE_PCT — Auto-Resolved % (binary per incident)
    100.0 when is_auto_resolved is True, 0.0 otherwise.
    Denominator: 1 incident (this scenario run).
    For a cross-crisis rate, average this field across multiple scenarios.
    Retained for JSON backward compatibility.

INFEASIBLE_RATE — Failed / Infeasible Recovery Rate (%)
    100.0 when plan.is_infeasible is True, else 0.0.

Limitations
-----------
- mean_arrival_day and last_delivery_day are delivery estimates, NOT measured
  recovery durations.  True MTTR requires actual start/end timestamps.
- MTTD is 0 in three scenarios (instantaneous detection) and non-zero in two
  (shipment_delay=2 days, warehouse_outage=1 day).
- On-time rate counts units, not orders.
- Costs are in scenario monetary units — no currency conversion.
- All inputs are synthetic; results cannot be extrapolated to real operations.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from backend.optimizer.schemas import ComponentDemand, RecoveryPlan
from backend.simulator.schemas import DisruptionEvent, ScenarioState


# Fulfillment threshold above which a case counts as auto-resolved.
AUTO_THRESHOLD = 0.80


@dataclass
class KPIResult:
    """All KPIs for one (scenario, approach) evaluation run."""

    approach_name: str
    scenario_name: str

    # --- actual computed values ---
    mttd_days: float                  # MTTD: detected_at_day - outage_start_day (0 when immediate)
    mean_arrival_day: float           # mean(estimated_arrival_days); inf if infeasible
    last_delivery_day: float          # max(estimated_arrival_days); inf if infeasible
    recovery_cost: float              # procurement + delay penalty
    procurement_cost: float
    delay_penalty: float
    fulfillment_rate_pct: float       # [0, 100]
    on_time_rate_pct: float           # [0, 100] of fulfilled units
    stockout_rate_pct: float          # [0, 100]
    is_auto_resolved: bool            # True if feasible AND fulfillment >= AUTO_THRESHOLD
    auto_resolution_rate_pct: float   # 100.0 if is_auto_resolved else 0.0 (backward compat)
    infeasible_rate_pct: float        # 0 or 100

    # --- raw counts for transparency ---
    total_demand: int
    total_fulfilled: int
    total_unmet: int
    on_time_units: int
    late_units: int

    # --- metadata ---
    solver_type: str
    solver_status: str
    solver_wall_time_s: float
    violated_constraints: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "approach": self.approach_name,
            "scenario": self.scenario_name,
            "mttd_days": round(self.mttd_days, 4),
            # delivery-estimate metrics (NOT verified MTTR)
            "mean_arrival_day": round(self.mean_arrival_day, 4) if not math.isinf(self.mean_arrival_day) else None,
            "last_delivery_day": round(self.last_delivery_day, 4) if not math.isinf(self.last_delivery_day) else None,
            # backward-compat alias for mean_arrival_day
            "mttr_days": round(self.mean_arrival_day, 4) if not math.isinf(self.mean_arrival_day) else None,
            "recovery_cost": round(self.recovery_cost, 2),
            "procurement_cost": round(self.procurement_cost, 2),
            "delay_penalty": round(self.delay_penalty, 2),
            "fulfillment_rate_pct": round(self.fulfillment_rate_pct, 2),
            "on_time_rate_pct": round(self.on_time_rate_pct, 2),
            "stockout_rate_pct": round(self.stockout_rate_pct, 2),
            "is_auto_resolved": self.is_auto_resolved,
            "auto_resolution_rate_pct": round(self.auto_resolution_rate_pct, 2),
            "infeasible_rate_pct": round(self.infeasible_rate_pct, 2),
            "total_demand": self.total_demand,
            "total_fulfilled": self.total_fulfilled,
            "total_unmet": self.total_unmet,
            "on_time_units": self.on_time_units,
            "late_units": self.late_units,
            "solver_type": self.solver_type,
            "solver_status": self.solver_status,
            "solver_wall_time_s": round(self.solver_wall_time_s, 4),
            "violated_constraints": self.violated_constraints,
        }


def compute_kpis(
    approach_name: str,
    state: ScenarioState,
    demands: List[ComponentDemand],
    plan: RecoveryPlan,
) -> KPIResult:
    """
    Compute all KPIs from actual simulation outputs.

    Parameters are the raw objects — no heuristic inference is performed.
    Every value is read directly from the plan or scenario data.

    MTTD source: DisruptionEvent.mttd_days() = detected_at_day - outage_start_day.
    Delivery metrics source: RecoveryAction.estimated_arrival_days (forward estimates).
    """
    # ------------------------------------------------------------------ MTTD
    # Formula: detected_at_day - outage_start_day (0 when detection is immediate)
    mttd = 0.0
    if state.events:
        mttd = float(state.events[0].mttd_days())

    # ------------------------------------------------------------------ Delivery estimates
    # NOTE: These are scenario constants (lead times), not measured wall-clock times.
    # mean_arrival_day = mean of all action arrival estimates
    # last_delivery_day = worst-case (max) across all actions
    if plan.is_infeasible:
        mean_arrival_day = math.inf
        last_delivery_day = math.inf
    elif not plan.actions:
        mean_arrival_day = 0.0
        last_delivery_day = 0.0
    else:
        arrivals = [a.estimated_arrival_days for a in plan.actions]
        mean_arrival_day = sum(arrivals) / len(arrivals)
        last_delivery_day = max(arrivals)

    # ------------------------------------------------------------------ Demand / fulfillment
    total_demand = sum(d.required_qty for d in demands)
    total_fulfilled = sum(plan.fulfilled.get(d.component_id, 0) for d in demands)
    total_unmet = max(0, total_demand - total_fulfilled)
    fulfillment_rate = (total_fulfilled / total_demand * 100) if total_demand > 0 else 0.0

    # ------------------------------------------------------------------ On-time / late
    on_time_units = sum(a.quantity for a in plan.actions if a.delay_days == 0.0)
    late_units = sum(a.quantity for a in plan.actions if a.delay_days > 0.0)
    on_time_rate = (on_time_units / total_fulfilled * 100) if total_fulfilled > 0 else 0.0

    # ------------------------------------------------------------------ Stockout
    stockout_rate = 100.0 - fulfillment_rate

    # ------------------------------------------------------------------ Auto-resolution
    # Per-incident boolean: True if this single scenario was resolved automatically
    # (plan feasible AND fulfillment >= 80 %).
    # auto_resolution_rate_pct = 100.0 when True, 0.0 when False (binary per incident).
    # To compute a cross-crisis rate, average auto_resolution_rate_pct across scenarios.
    is_auto_resolved = (not plan.is_infeasible) and (fulfillment_rate >= AUTO_THRESHOLD * 100)
    auto_resolution_rate_pct = 100.0 if is_auto_resolved else 0.0

    # ------------------------------------------------------------------ Infeasible
    infeasible_rate = 100.0 if plan.is_infeasible else 0.0

    return KPIResult(
        approach_name=approach_name,
        scenario_name=state.scenario_name,
        mttd_days=mttd,
        mean_arrival_day=mean_arrival_day,
        last_delivery_day=last_delivery_day,
        recovery_cost=plan.total_cost,
        procurement_cost=plan.total_procurement_cost,
        delay_penalty=plan.total_delay_penalty,
        fulfillment_rate_pct=fulfillment_rate,
        on_time_rate_pct=on_time_rate,
        stockout_rate_pct=stockout_rate,
        is_auto_resolved=is_auto_resolved,
        auto_resolution_rate_pct=auto_resolution_rate_pct,
        infeasible_rate_pct=infeasible_rate,
        total_demand=total_demand,
        total_fulfilled=total_fulfilled,
        total_unmet=total_unmet,
        on_time_units=on_time_units,
        late_units=late_units,
        solver_type=plan.solver_type,
        solver_status=plan.solver_status.value,
        solver_wall_time_s=plan.solver_wall_time_seconds,
        violated_constraints=list(plan.violated_constraints),
    )
