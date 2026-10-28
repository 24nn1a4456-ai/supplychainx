"""
evaluator.py — EvaluationRunner comparing all three recovery approaches.

Approaches
----------
A. fixed_rule_baseline
   Registration-order allocation: warehouses first, then suppliers, no cost
   sorting, no optimisation.  Simulates an ad-hoc human operator response.

B. greedy_ai_assisted
   Cost-sorted greedy: cheapest effective cost per unit wins.  Simulates an
   AI-assisted but non-optimal response (our fallback solver).

C. cpsat_agentic
   OR-Tools CP-SAT integer programme: globally optimal within solver timeout.
   Simulates coordinated agentic recovery using the full optimisation engine.

All three receive *identical inputs* derived from the same ScenarioState via
`scenario_to_optimizer_inputs()`.  KPIs are computed from actual RecoveryPlan
objects — no values are inferred or estimated from model explanations.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import List, Tuple

from backend.optimizer.fallback import solve_greedy
from backend.optimizer.optimizer import _ORTOOLS_AVAILABLE, plan_recovery
from backend.optimizer.schemas import (
    ComponentDemand,
    OptimizerConfig,
    SupplierOption,
    WarehouseInventory,
)
from backend.simulator.schemas import ScenarioState
from backend.simulator.simulator import scenario_to_optimizer_inputs

from .baselines import solve_fixed_rule
from .kpis import KPIResult, compute_kpis


# ---------------------------------------------------------------------------
# Approach labels (used in results + charts)
# ---------------------------------------------------------------------------
APPROACH_A = "A: Fixed-Rule Baseline"
APPROACH_B = "B: AI-Assisted (Greedy)"
APPROACH_C = "C: Agentic Optimizer (CP-SAT)"

ALL_APPROACHES = [APPROACH_A, APPROACH_B, APPROACH_C]


@dataclass
class ScenarioEvaluation:
    """All three approach results for a single scenario."""
    scenario_name: str
    scenario_id: str
    kpi_a: KPIResult          # fixed-rule
    kpi_b: KPIResult          # greedy
    kpi_c: KPIResult          # CP-SAT
    ortools_available: bool

    @property
    def all_kpis(self) -> List[KPIResult]:
        return [self.kpi_a, self.kpi_b, self.kpi_c]


def run_scenario(
    state: ScenarioState,
    delay_penalty_per_day: float = 5.0,
    budget_limit: float = math.inf,
) -> ScenarioEvaluation:
    """
    Run all three approaches on one scenario and return KPIs.

    Parameters
    ----------
    state : ScenarioState
        Fixed scenario snapshot from the simulator.
    delay_penalty_per_day : float
        Configurable penalty weight passed to all three approaches equally.
    budget_limit : float
        Optional budget cap applied equally to all approaches.

    Returns
    -------
    ScenarioEvaluation
        KPIs for all three approaches, computed from actual plan outputs.

    Notes
    -----
    * All three approaches receive the same `demands`, `warehouses`,
      `suppliers`, and `config` objects.
    * The fixed-rule approach (A) ignores budget for allocation but the
      config is still passed so delay penalties are computed consistently.
    * If OR-Tools is unavailable, Approach C falls back to greedy and the
      `ortools_available` flag is recorded in results.
    """
    demands, warehouses, suppliers, config = scenario_to_optimizer_inputs(
        state,
        budget_limit=budget_limit,
        delay_penalty_per_day=delay_penalty_per_day,
    )

    # --- Approach A: Fixed-rule baseline ---
    plan_a = solve_fixed_rule(demands, warehouses, suppliers, config)

    # --- Approach B: Cost-sorted greedy (AI-assisted) ---
    plan_b = solve_greedy(demands, warehouses, suppliers, config)

    # --- Approach C: CP-SAT agentic optimizer ---
    plan_c = plan_recovery(demands, warehouses, suppliers, config)

    kpi_a = compute_kpis(APPROACH_A, state, demands, plan_a)
    kpi_b = compute_kpis(APPROACH_B, state, demands, plan_b)
    kpi_c = compute_kpis(APPROACH_C, state, demands, plan_c)

    return ScenarioEvaluation(
        scenario_name=state.scenario_name,
        scenario_id=state.scenario_id,
        kpi_a=kpi_a,
        kpi_b=kpi_b,
        kpi_c=kpi_c,
        ortools_available=_ORTOOLS_AVAILABLE,
    )


def run_all_scenarios(
    delay_penalty_per_day: float = 5.0,
    budget_limit: float = math.inf,
) -> List[ScenarioEvaluation]:
    """
    Run all five registered scenarios and return a list of evaluations.

    All inputs are loaded from the scenario registry — no external data
    sources are used.  Results are deterministic for the same scenario
    configuration.

    Parameters
    ----------
    delay_penalty_per_day : float
        Applied uniformly across all scenarios.
    budget_limit : float
        Applied uniformly.  Default = no budget cap.

    Returns
    -------
    List[ScenarioEvaluation]
        One entry per scenario, in registration order.
    """
    from backend.simulator.scenarios import SCENARIO_REGISTRY

    results: List[ScenarioEvaluation] = []
    for name, factory in SCENARIO_REGISTRY.items():
        state = factory()
        evaluation = run_scenario(
            state,
            delay_penalty_per_day=delay_penalty_per_day,
            budget_limit=budget_limit,
        )
        results.append(evaluation)

    return results
