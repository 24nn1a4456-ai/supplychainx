#!/usr/bin/env python3
"""
evaluate.py — Reproducible evaluation script for Supply Chain X.

Compares three recovery approaches across all five disruption scenarios:
  A. Fixed-Rule Baseline         (registration-order allocation)
  B. AI-Assisted Greedy          (cost-sorted greedy, our fallback solver)
  C. Coordinated Agentic (CP-SAT) (OR-Tools integer programme, globally optimal)

Results come exclusively from actual simulation and optimizer outputs.
No numbers are invented or inferred from model explanations.

Usage
-----
    python evaluate.py                        # 1 run, charts if matplotlib available
    python evaluate.py --no-charts            # skip chart generation
    python evaluate.py --runs 3               # run 3 times, report aggregate
    python evaluate.py --runs 3 --no-charts   # 3 runs, no charts
    python evaluate.py --output-dir my_results

Outputs
-------
    results/evaluation_results.json  — machine-readable KPI data
    results/cost_breakdown.png       — procurement vs delay penalty per scenario
    results/fulfillment_rate.png     — fulfillment and on-time rate per scenario
    results/mean_arrival_day.png     — mean/last delivery day per scenario

Configuration
-------------
All scenario inputs are fixed constants in backend/simulator/scenarios.py.
Penalty weight and evaluation config are set at the top of this script.
Change them and re-run to reproduce with different assumptions.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

# Ensure project root on sys.path
sys.path.insert(0, str(Path(__file__).parent))

# ---------------------------------------------------------------------------
# Evaluation configuration — edit here to change assumptions
# ---------------------------------------------------------------------------
DELAY_PENALTY_PER_DAY = 5.0    # $ per unit per day of lateness
BUDGET_LIMIT = float("inf")    # no budget cap (set e.g. 10_000 to constrain)
OUTPUT_DIR = "results"
JSON_FILE = f"{OUTPUT_DIR}/evaluation_results.json"

SCENARIO_RUNS = 1   # default runs; override with --runs N

DISCLAIMER = """
IMPORTANT — Interpretation Notes
----------------------------------
* All data is SYNTHETIC. Results reflect the fixed scenario inputs in
  backend/simulator/scenarios.py and cannot be generalised to real operations.
* No improvement percentages, ROI figures, or real-world savings are claimed.
* MTTD = 0 in three scenarios (instantaneous detection); 1–2 days in two
  (shipment_delay: 2 days, warehouse_outage: 1 day).
* mean_arrival_day and last_delivery_day are delivery ESTIMATES (scenario
  lead-time constants), NOT measured end-to-end recovery durations.
  True MTTR requires actual disruption-start and recovery-completion timestamps.
* auto_resolution_rate_pct is binary per incident (0 or 100). For a cross-crisis
  rate take the mean across multiple scenarios.
* The CP-SAT solver (Approach C) may fall back to greedy if OR-Tools is
  unavailable — this is logged in results JSON and printed as a warning.
"""

# ---------------------------------------------------------------------------
# KPI reference card
# ---------------------------------------------------------------------------
KPI_REFERENCE = """
KPI Definitions
---------------
MTTD                Mean Time to Detect (days): detected_at_day - outage_start_day.
                    0 when detection is immediate (3 scenarios).
                    Non-zero in: shipment_delay (2 d), warehouse_outage (1 d).
Mean Arrival (d)    mean(estimated_arrival_days) across all plan actions.
                    Delivery ESTIMATE — NOT a verified end-to-end recovery time.
                    inf = infeasible plan. 0 = no actions needed.
Last Del. (d)       max(estimated_arrival_days) — worst-case delivery estimate.
Recovery Cost       plan.total_cost = procurement_cost + delay_penalty.
Fulfillment %       sum(fulfilled) / total_demand x 100.
On-Time %           Units arriving <= due date / total_fulfilled x 100.
Stockout %          100 - Fulfillment %.
Auto-Resolved       Boolean (True/False) per incident: feasible AND fulfillment >= 80%.
Auto-Res %          100 if auto-resolved, else 0 (binary per incident, NOT a rate).
                    Average across scenarios to get a cross-crisis resolution rate.
Infeasible %        100 if plan.is_infeasible. Else 0.
"""


# ---------------------------------------------------------------------------
# Multi-run aggregation
# ---------------------------------------------------------------------------

def _mean(values):
    return sum(values) / len(values) if values else 0.0


def _std(values):
    if len(values) < 2:
        return 0.0
    m = _mean(values)
    variance = sum((v - m) ** 2 for v in values) / (len(values) - 1)
    return variance ** 0.5


NUMERIC_KPI_ATTRS = [
    "mttd_days", "mean_arrival_day", "last_delivery_day",
    "recovery_cost", "procurement_cost", "delay_penalty",
    "fulfillment_rate_pct", "on_time_rate_pct", "stockout_rate_pct",
    "auto_resolution_rate_pct", "infeasible_rate_pct",
    "solver_wall_time_s",
]


def aggregate_runs(all_evaluations):
    """
    Given List[List[ScenarioEvaluation]] (N runs × M scenarios × 3 approaches),
    return a list of aggregate dicts per scenario per approach with mean and std.
    """
    import math
    # all_evaluations[run_idx][scenario_idx]
    n_runs = len(all_evaluations)
    n_scenarios = len(all_evaluations[0])

    aggregates = []
    for sc_idx in range(n_scenarios):
        sc_name = all_evaluations[0][sc_idx].scenario_name
        sc_id   = all_evaluations[0][sc_idx].scenario_id
        sc_agg  = {"scenario_name": sc_name, "scenario_id": sc_id, "run_count": n_runs, "approaches": {}}

        for app_idx, app_key in enumerate(["A_fixed_rule", "B_greedy_ai", "C_cpsat_agentic"]):
            kpis = [all_evaluations[run][sc_idx].all_kpis[app_idx] for run in range(n_runs)]
            kpi_agg = {}
            for attr in NUMERIC_KPI_ATTRS:
                vals = []
                for k in kpis:
                    v = getattr(k, attr)
                    if v is not None and not (isinstance(v, float) and math.isinf(v)):
                        vals.append(v)
                kpi_agg[attr] = {
                    "mean": round(_mean(vals), 4) if vals else None,
                    "std":  round(_std(vals), 4) if vals else None,
                    "n":    len(vals),
                }
            sc_agg["approaches"][app_key] = kpi_agg

        aggregates.append(sc_agg)
    return aggregates


def main(generate_charts: bool = True, output_dir: str = OUTPUT_DIR, runs: int = 1) -> None:
    from backend.evaluation.evaluator import run_all_scenarios
    from backend.evaluation.report import (
        generate_charts as gen_charts,
        print_results_table,
        print_summary_table,
        save_json,
    )
    import json
    import math

    print("=" * 70)
    print("  Supply Chain X — Three-Approach Recovery Evaluation")
    print("=" * 70)
    print(f"  Scenarios : 5 (all registered)")
    print(f"  Approaches: A (Fixed-Rule) | B (Greedy AI) | C (CP-SAT Agentic)")
    print(f"  Runs      : {runs}")
    print(f"  Delay pen : {DELAY_PENALTY_PER_DAY} $/unit/day")
    print(f"  Budget cap: {'None' if BUDGET_LIMIT == float('inf') else BUDGET_LIMIT}")
    print()
    print(KPI_REFERENCE)

    if runs > 1:
        print(
            f"  NOTE: All 5 scenarios are DETERMINISTIC (fixed constants, no RNG).\n"
            f"  Repeated runs produce identical results. Multi-run output shows\n"
            f"  mean ± std for completeness but does NOT establish statistical\n"
            f"  variability. Std = 0.0 for all deterministic scenarios.\n"
        )
    if 1 < runs < 30:
        print(
            f"  WARNING: {runs} run(s) is insufficient to establish statistical "
            "significance. Do not report confidence intervals from this output.\n"
        )

    # ------------------------------------------------------------------
    # Run evaluation(s)
    # ------------------------------------------------------------------
    print("Running evaluations...")
    t0 = time.monotonic()

    all_evaluations = []
    for run_idx in range(runs):
        ev = run_all_scenarios(
            delay_penalty_per_day=DELAY_PENALTY_PER_DAY,
            budget_limit=BUDGET_LIMIT,
        )
        all_evaluations.append(ev)

    elapsed = time.monotonic() - t0
    print(f"  Completed {runs} run(s) × {len(all_evaluations[0])} scenarios × 3 approaches in {elapsed:.2f}s\n")

    # Use run 0 results for the per-run table (all runs are identical for deterministic scenarios)
    evaluations = all_evaluations[0]

    # ------------------------------------------------------------------
    # Print results
    # ------------------------------------------------------------------
    print_results_table(evaluations)
    print_summary_table(evaluations)

    # ------------------------------------------------------------------
    # Save JSON (includes all-runs aggregate when runs > 1)
    # ------------------------------------------------------------------
    json_path = f"{output_dir}/evaluation_results.json"

    # Build JSON manually to include aggregate
    import json as _json
    from backend.evaluation.report import ALL_APPROACHES
    data = {
        "meta": {
            "description": "Supply Chain X — Three-Approach Recovery Evaluation",
            "approaches": ALL_APPROACHES,
            "run_count": runs,
            "aggregation_method": "arithmetic mean across runs" if runs > 1 else "single run",
            "determinism_note": (
                "All scenarios are deterministic (no RNG). "
                "Multiple runs produce identical results unless stochastic scenarios are added."
            ) if runs > 1 else "Single run.",
            "kpi_source": "Computed from actual RecoveryPlan fields — no values invented.",
            "delivery_metric_note": (
                "mean_arrival_day and last_delivery_day are delivery ESTIMATES "
                "(scenario lead-time constants), NOT measured MTTR. "
                "True MTTR requires actual disruption-start and recovery-end timestamps."
            ),
            "assumptions": [
                "MTTD = 0 for 3 scenarios (instantaneous detection); non-zero for shipment_delay (2d) and warehouse_outage (1d).",
                "mean_arrival_day = mean(estimated_arrival_days) across all plan actions.",
                "last_delivery_day = max(estimated_arrival_days) — worst-case.",
                "auto_resolution_rate_pct: binary per incident (0 or 100). Average across scenarios for a cross-crisis rate.",
                "All scenario inputs are fixed synthetic data — no real-world data used.",
                f"delay_penalty_per_day = {DELAY_PENALTY_PER_DAY} applied uniformly to all approaches.",
            ],
            "limitations": [
                "Single run per scenario — no confidence intervals (deterministic scenarios).",
                "Synthetic dataset; results cannot be generalised to real operations.",
                "MTTD non-discriminating for 3 of 5 scenarios (always 0).",
                "mean_arrival_day is a forward estimate, not a measured recovery duration.",
                "Fixed-rule baseline (A) contacts warehouses before suppliers by design.",
            ],
        },
        "scenarios": [],
    }

    for ev in evaluations:
        data["scenarios"].append({
            "scenario_id": ev.scenario_id,
            "scenario_name": ev.scenario_name,
            "ortools_available": ev.ortools_available,
            "results": {
                "A_fixed_rule":    ev.kpi_a.to_dict(),
                "B_greedy_ai":     ev.kpi_b.to_dict(),
                "C_cpsat_agentic": ev.kpi_c.to_dict(),
            },
        })

    if runs > 1:
        data["aggregate_across_runs"] = aggregate_runs(all_evaluations)

    Path(output_dir).mkdir(parents=True, exist_ok=True)
    with open(json_path, "w", encoding="utf-8") as f:
        _json.dump(data, f, indent=2)
    print(f"[report] Saved JSON results → {json_path}")

    # ------------------------------------------------------------------
    # Charts
    # ------------------------------------------------------------------
    if generate_charts:
        charts_saved = gen_charts(evaluations, output_dir)
        if not charts_saved:
            print("  (Install matplotlib to enable charts: pip install matplotlib)")
    else:
        print("[evaluate] Chart generation skipped (--no-charts).")

    # ------------------------------------------------------------------
    # Disclaimer
    # ------------------------------------------------------------------
    print(DISCLAIMER)
    print(f"[evaluate] All outputs written to: {Path(output_dir).resolve()}/")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Supply Chain X Evaluation Script")
    parser.add_argument(
        "--no-charts",
        action="store_true",
        help="Skip chart generation (useful on headless systems without matplotlib).",
    )
    parser.add_argument(
        "--output-dir",
        default=OUTPUT_DIR,
        help=f"Directory for results output. Default: {OUTPUT_DIR}",
    )
    parser.add_argument(
        "--runs",
        type=int,
        default=1,
        metavar="N",
        help=(
            "Number of evaluation runs (default: 1). Must be >= 1 and <= 100. "
            "All 5 scenarios are deterministic — repeated runs produce identical results "
            "unless stochastic scenarios are added. Multi-run aggregate is reported for "
            "completeness but does NOT establish statistical variability."
        ),
    )
    args = parser.parse_args()

    # Validate --runs
    if args.runs < 1:
        parser.error(f"--runs must be >= 1, got {args.runs}")
    if args.runs > 100:
        parser.error(f"--runs must be <= 100, got {args.runs} (use a custom script for large-scale runs)")

    main(
        generate_charts=not args.no_charts,
        output_dir=args.output_dir,
        runs=args.runs,
    )
