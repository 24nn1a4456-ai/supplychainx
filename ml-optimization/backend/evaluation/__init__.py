"""backend.evaluation — Three-approach evaluation framework."""

from .kpis import KPIResult, compute_kpis, AUTO_THRESHOLD
from .baselines import solve_fixed_rule
from .evaluator import (
    ScenarioEvaluation,
    run_scenario,
    run_all_scenarios,
    APPROACH_A, APPROACH_B, APPROACH_C, ALL_APPROACHES,
)
from .report import print_results_table, print_summary_table, save_json, generate_charts

__all__ = [
    "KPIResult", "compute_kpis", "AUTO_THRESHOLD",
    "solve_fixed_rule",
    "ScenarioEvaluation", "run_scenario", "run_all_scenarios",
    "APPROACH_A", "APPROACH_B", "APPROACH_C", "ALL_APPROACHES",
    "print_results_table", "print_summary_table", "save_json", "generate_charts",
]
