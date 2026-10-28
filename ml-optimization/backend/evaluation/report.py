"""
report.py — Results table printer and chart generator.

Table and charts are produced from actual KPIResult objects.
No numbers are fabricated.  When matplotlib is unavailable the script
silently skips chart generation and notes it in the output.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import List, Optional

from .kpis import KPIResult
from .evaluator import ScenarioEvaluation, ALL_APPROACHES

# ---------------------------------------------------------------------------
# Terminal table
# ---------------------------------------------------------------------------

_KPI_COLS = [
    ("fulfillment_rate_pct",     "Fulfillment %",    "{:.1f}"),
    ("on_time_rate_pct",         "On-Time %",        "{:.1f}"),
    ("stockout_rate_pct",        "Stockout %",       "{:.1f}"),
    ("recovery_cost",            "Total Cost",       "{:.0f}"),
    ("procurement_cost",         "Proc. Cost",       "{:.0f}"),
    ("delay_penalty",            "Delay Penalty",    "{:.0f}"),
    ("mean_arrival_day",         "Mean Arrival (d)", "{:.1f}"),
    ("last_delivery_day",        "Last Del. (d)",    "{:.1f}"),
    ("is_auto_resolved",         "Auto-Resolved",    "{}"),
    ("auto_resolution_rate_pct", "Auto-Res %",       "{:.0f}"),
    ("infeasible_rate_pct",      "Infeasible %",     "{:.0f}"),
    ("solver_wall_time_s",       "Solve Time (s)",   "{:.3f}"),
]

_SCENARIO_W = 30
_APPROACH_W = 28
_COL_W = 14


def print_results_table(evaluations: List[ScenarioEvaluation]) -> None:
    """Print a formatted results table to stdout."""
    all_kpis: List[KPIResult] = []
    for ev in evaluations:
        all_kpis.extend(ev.all_kpis)

    # Header
    header_sep = "-" * (_SCENARIO_W + _APPROACH_W + _COL_W * len(_KPI_COLS) + 3)
    print()
    print("=" * len(header_sep))
    print("  SUPPLY CHAIN X — RECOVERY APPROACH EVALUATION RESULTS")
    print("=" * len(header_sep))
    print(f"\n{'Scenario':<{_SCENARIO_W}} {'Approach':<{_APPROACH_W}}", end="")
    for _, label, _ in _KPI_COLS:
        print(f"  {label:>{_COL_W}}", end="")
    print()
    print(header_sep)

    prev_scenario = None
    for kpi in all_kpis:
        if kpi.scenario_name != prev_scenario:
            if prev_scenario is not None:
                print()
            prev_scenario = kpi.scenario_name

        scenario_display = kpi.scenario_name[:_SCENARIO_W]
        approach_display = kpi.approach_name[:_APPROACH_W]
        print(f"{scenario_display:<{_SCENARIO_W}} {approach_display:<{_APPROACH_W}}", end="")

        for attr, _, fmt in _KPI_COLS:
            val = getattr(kpi, attr)
            if val is None or (isinstance(val, float) and val != val):  # None or NaN
                cell = "N/A"
            elif isinstance(val, float) and val == float("inf"):
                cell = "inf"
            else:
                cell = fmt.format(val)
            print(f"  {cell:>{_COL_W}}", end="")
        print()

    print(header_sep)
    print()


def print_summary_table(evaluations: List[ScenarioEvaluation]) -> None:
    """Print a cross-scenario summary comparing A vs B vs C on key KPIs."""
    import math
    key_kpis = [
        ("fulfillment_rate_pct", "Fulfillment %", "{:.1f}"),
        ("recovery_cost",        "Total Cost",    "{:.0f}"),
        ("mean_arrival_day",     "Mean Arrival (d)",   "{:.1f}"),
        ("last_delivery_day",    "Last Del. (d)",  "{:.1f}"),
        ("on_time_rate_pct",     "On-Time %",     "{:.1f}"),
        ("infeasible_rate_pct",  "Infeasible %",  "{:.0f}"),
    ]

    app_w = 30
    col_w = 14

    print()
    print("=" * (app_w + col_w * len(key_kpis) + 5))
    print("  AGGREGATE SUMMARY (mean across all scenarios)")
    print("=" * (app_w + col_w * len(key_kpis) + 5))
    print(f"{'Approach':<{app_w}}", end="")
    for _, label, _ in key_kpis:
        print(f"  {label:>{col_w}}", end="")
    print()
    print("-" * (app_w + col_w * len(key_kpis) + 5))

    for approach_idx, approach_name in enumerate(ALL_APPROACHES):
        vals_per_kpi: dict[str, list] = {attr: [] for attr, _, _ in key_kpis}

        for ev in evaluations:
            kpi = ev.all_kpis[approach_idx]
            for attr, _, _ in key_kpis:
                v = getattr(kpi, attr)
                if v is not None and not (isinstance(v, float) and math.isinf(v)):
                    vals_per_kpi[attr].append(v)

        print(f"{approach_name:<{app_w}}", end="")
        for attr, _, fmt in key_kpis:
            vals = vals_per_kpi[attr]
            if vals:
                mean = sum(vals) / len(vals)
                cell = fmt.format(mean)
            else:
                cell = "N/A"
            print(f"  {cell:>{col_w}}", end="")
        print()

    print("=" * (app_w + col_w * len(key_kpis) + 5))
    print()


# ---------------------------------------------------------------------------
# JSON export
# ---------------------------------------------------------------------------

def save_json(evaluations: List[ScenarioEvaluation], output_path: str) -> None:
    """Save all KPI results to a JSON file."""
    data = {
        "meta": {
            "description": "Supply Chain X — Three-Approach Recovery Evaluation",
            "approaches": ALL_APPROACHES,
            "kpi_source": "Computed from actual RecoveryPlan fields — no values invented.",
            "assumptions": [
                "MTTD = 0 in all scenarios (detection is instantaneous by construction).",
                "MTTR = max(estimated_arrival_days) across all plan actions.",
                "Auto-resolution threshold = 80% fulfillment AND plan feasible.",
                "All scenario inputs are fixed synthetic data — no real-world data used.",
                "Costs are in arbitrary monetary units (currency-agnostic).",
                "delay_penalty_per_day = 5.0 applied uniformly to all approaches.",
            ],
            "limitations": [
                "Single run per scenario — no confidence intervals.",
                "Synthetic dataset; results cannot be generalised to real operations.",
                "MTTD is not a discriminating metric here (always 0).",
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
                "A_fixed_rule": ev.kpi_a.to_dict(),
                "B_greedy_ai": ev.kpi_b.to_dict(),
                "C_cpsat_agentic": ev.kpi_c.to_dict(),
            },
        })

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"[report] Saved JSON results → {output_path}")


# ---------------------------------------------------------------------------
# Charts (matplotlib optional)
# ---------------------------------------------------------------------------

def _try_import_matplotlib():
    try:
        import matplotlib
        matplotlib.use("Agg")   # non-interactive backend — safe on headless systems
        import matplotlib.pyplot as plt
        return plt
    except ImportError:
        return None


def generate_charts(
    evaluations: List[ScenarioEvaluation],
    output_dir: str,
) -> bool:
    """
    Generate bar charts and save to *output_dir*.

    Returns True if charts were saved, False if matplotlib is unavailable.
    """
    import math
    plt = _try_import_matplotlib()
    if plt is None:
        print("[report] matplotlib not installed — skipping charts (pip install matplotlib).")
        return False

    Path(output_dir).mkdir(parents=True, exist_ok=True)
    scenario_names = [ev.scenario_name for ev in evaluations]
    SHORT_NAMES = [n.split("—")[0].strip()[:20] for n in scenario_names]

    COLORS = {
        0: "#e74c3c",   # A — red (baseline)
        1: "#f39c12",   # B — orange (greedy)
        2: "#2ecc71",   # C — green (agentic)
    }
    APPROACH_LABELS = ["A: Fixed-Rule", "B: Greedy AI", "C: CP-SAT"]

    n_scen = len(evaluations)
    x = list(range(n_scen))
    width = 0.25

    # --- Chart 1: Cost breakdown (procurement vs delay penalty) ---
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle(
        "Recovery Cost Breakdown by Approach and Scenario\n"
        "(synthetic data — not real-world costs)",
        fontsize=12,
    )

    for i, kpi_list in enumerate([
        [ev.kpi_a for ev in evaluations],
        [ev.kpi_b for ev in evaluations],
        [ev.kpi_c for ev in evaluations],
    ]):
        proc_costs = [k.procurement_cost for k in kpi_list]
        pen_costs  = [k.delay_penalty    for k in kpi_list]
        offsets    = [xi + (i - 1) * width for xi in x]
        axes[0].bar(offsets, proc_costs, width, label=f"{APPROACH_LABELS[i]} Procurement", color=COLORS[i], alpha=0.85)
        axes[1].bar(offsets, pen_costs,  width, label=f"{APPROACH_LABELS[i]} Delay Penalty",  color=COLORS[i], alpha=0.85)

    for ax, title in zip(axes, ["Procurement Cost", "Delay Penalty"]):
        ax.set_xticks(x)
        ax.set_xticklabels(SHORT_NAMES, rotation=20, ha="right", fontsize=8)
        ax.set_title(title)
        ax.set_ylabel("Cost (monetary units)")
        ax.legend(fontsize=7)
        ax.grid(axis="y", linestyle="--", alpha=0.5)

    plt.tight_layout()
    chart1_path = os.path.join(output_dir, "cost_breakdown.png")
    plt.savefig(chart1_path, dpi=120, bbox_inches="tight")
    plt.close()
    print(f"[report] Saved chart → {chart1_path}")

    # --- Chart 2: Fulfillment and on-time rate ---
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle(
        "Fulfillment & On-Time Delivery Rate by Approach and Scenario\n"
        "(synthetic data)",
        fontsize=12,
    )

    for i, kpi_list in enumerate([
        [ev.kpi_a for ev in evaluations],
        [ev.kpi_b for ev in evaluations],
        [ev.kpi_c for ev in evaluations],
    ]):
        fr  = [k.fulfillment_rate_pct for k in kpi_list]
        otr = [k.on_time_rate_pct     for k in kpi_list]
        offsets = [xi + (i - 1) * width for xi in x]
        axes[0].bar(offsets, fr,  width, label=APPROACH_LABELS[i], color=COLORS[i], alpha=0.85)
        axes[1].bar(offsets, otr, width, label=APPROACH_LABELS[i], color=COLORS[i], alpha=0.85)

    for ax, title in zip(axes, ["Fulfillment Rate (%)", "On-Time Delivery Rate (%)"]):
        ax.set_xticks(x)
        ax.set_xticklabels(SHORT_NAMES, rotation=20, ha="right", fontsize=8)
        ax.set_ylim(0, 110)
        ax.axhline(100, color="black", linestyle="--", linewidth=0.8, alpha=0.5)
        ax.set_title(title)
        ax.set_ylabel("Percentage (%)")
        ax.legend(fontsize=8)
        ax.grid(axis="y", linestyle="--", alpha=0.5)

    plt.tight_layout()
    chart2_path = os.path.join(output_dir, "fulfillment_rate.png")
    plt.savefig(chart2_path, dpi=120, bbox_inches="tight")
    plt.close()
    print(f"[report] Saved chart → {chart2_path}")

    # --- Chart 3: MTTR ---
    fig, ax = plt.subplots(figsize=(10, 5))
    fig.suptitle("Mean Time to Recover (MTTR) by Approach and Scenario\n(synthetic data)", fontsize=12)

    for i, kpi_list in enumerate([
        [ev.kpi_a for ev in evaluations],
        [ev.kpi_b for ev in evaluations],
        [ev.kpi_c for ev in evaluations],
    ]):
        mttr = [
            k.mean_arrival_day if (k.mean_arrival_day is not None and not math.isinf(k.mean_arrival_day)) else 0
            for k in kpi_list
        ]
        offsets = [xi + (i - 1) * width for xi in x]
        ax.bar(offsets, mttr, width, label=APPROACH_LABELS[i], color=COLORS[i], alpha=0.85)

    ax.set_xticks(x)
    ax.set_xticklabels(SHORT_NAMES, rotation=20, ha="right", fontsize=8)
    ax.set_title("Mean Arrival Day (d) — 0 for infeasible plans\n(delivery estimate, NOT verified MTTR)")
    ax.set_ylabel("Days")
    ax.legend(fontsize=8)
    ax.grid(axis="y", linestyle="--", alpha=0.5)

    plt.tight_layout()
    chart3_path = os.path.join(output_dir, "mttr.png")
    plt.savefig(chart3_path, dpi=120, bbox_inches="tight")
    plt.close()
    print(f"[report] Saved chart → {chart3_path}")

    return True
