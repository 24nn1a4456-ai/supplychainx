# Supply Chain X — Member 4: ML, Optimisation & Simulation

## Overview

This module implements three components of the Supply Chain X platform:

| Module | Path | Purpose |
|---|---|---|
| **Risk Scoring** | `backend/ml/` | Supplier risk scoring with explainable baseline and optional ML model |
| **Recovery Optimizer** | `backend/optimizer/` | OR-Tools CP-SAT + greedy fallback for recovery planning |
| **Outage Simulator** | `backend/simulator/` | 5 reproducible disruption scenarios |
| **Evaluation** | `backend/evaluation/` | Three-approach KPI comparison framework |

---

## Quick Start

### 1. Prerequisites

```bash
pip install ortools scikit-learn pandas matplotlib
```

> `ortools` and `scikit-learn` are required.<br>
> `matplotlib` is optional — evaluation script runs without it (skips charts).

### 2. Run all tests

```bash
# From the project root (agent ml optimizer/)
python -m pytest backend/ -v
```

Expected: **130+ tests, all pass**.

### 3. Run the evaluation script

```bash
python evaluate.py
```

Outputs:
- Console results table and summary
- `results/evaluation_results.json`
- `results/cost_breakdown.png`, `fulfillment_rate.png`, `mttr.png` (if matplotlib installed)

```bash
python evaluate.py --no-charts       # skip charts
python evaluate.py --output-dir out  # custom output directory
```

---

## Module Reference

### Risk Scoring (`backend/ml/`)

```python
from backend.ml import score_supplier
from backend.ml.schemas import SupplierInput

result = score_supplier(SupplierInput(
    supplier_id="SUP-01",
    reliability_score=0.7,
    lead_time_days=14.0,
    lead_time_variability_days=3.0,
    available_capacity_pct=0.6,
    component_criticality=0.9,
    alternative_supplier_count=1,
))
print(result.risk_category, result.risk_score)
```

### Recovery Optimizer (`backend/optimizer/`)

```python
from backend.optimizer import plan_recovery
from backend.optimizer.schemas import (
    ComponentDemand, SupplierOption, WarehouseInventory, OptimizerConfig
)

plan = plan_recovery(
    demands=[ComponentDemand("COMP-A", required_qty=100, due_date_days=5)],
    suppliers=[SupplierOption("SUP-1", "COMP-A", capacity=200,
                               price_per_unit=10.0, lead_time_days=3)],
    warehouses=[WarehouseInventory("WH-1", "COMP-A", available_qty=50,
                                    transfer_cost_per_unit=2.0)],
    config=OptimizerConfig(budget_limit=5000.0, delay_penalty_per_day=5.0),
)

print(plan.is_infeasible)           # False
print(plan.total_cost)              # float
print(plan.fulfilled)               # {"COMP-A": 100}
print(plan.solver_type)             # "ortools_cpsat" or "greedy_fallback"
plan.to_dict()                      # JSON-serialisable
```

**Solver auto-dispatch:** If OR-Tools is installed, the CP-SAT solver runs first.
If infeasible or OR-Tools is absent, the cost-sorted greedy fallback activates.
The output schema is identical in both cases.

### Outage Simulator (`backend/simulator/`)

```python
from backend.simulator import create_disruption, scenario_to_optimizer_inputs, reset_scenario
from backend.optimizer import plan_recovery

# Step 1: trigger scenario (records event through backend interface)
state = create_disruption("supplier_outage")   # or pass backend=my_backend

# Step 2: convert to optimizer inputs
demands, warehouses, suppliers, config = scenario_to_optimizer_inputs(state)

# Step 3: optimise
plan = plan_recovery(demands, warehouses, suppliers, config)

# Step 4: reset (clears recorded events)
reset_scenario(state.scenario_id)
```

**Available scenarios:** `supplier_outage`, `low_inventory`, `shipment_delay`,
`demand_spike`, `warehouse_outage`.

### Integration for Member 1's Agents

```python
from backend.simulator import create_disruption, list_available_scenarios
from backend.simulator import scenario_to_optimizer_inputs
from backend.optimizer import plan_recovery

# List what's available
print(list_available_scenarios())

# Full agentic recovery loop
state   = create_disruption("supplier_outage", backend=your_backend)
demands, warehouses, suppliers, config = scenario_to_optimizer_inputs(state)
plan    = plan_recovery(demands, warehouses, suppliers, config)

if plan.is_infeasible:
    # escalate for human review
    raise RuntimeError(f"No feasible plan: {plan.violated_constraints}")

for action in plan.actions:
    action.to_dict()   # structured JSON for your agent to submit
```

The `BackendInterface` protocol (in `backend/simulator/backend_interface.py`) defines
the four methods Member 2's backend must implement:
- `record_disruption_event(event_dict) → str`
- `get_current_inventory(component_id) → int`
- `reset_scenario(scenario_id) → None`
- `list_recorded_events(scenario_id=None) → List[dict]`

---

## Evaluation Framework

### Three Approaches Compared

| | A: Fixed-Rule | B: AI-Assisted Greedy | C: CP-SAT Agentic |
|---|---|---|---|
| **Strategy** | Contact suppliers in registration order | Cost-sorted greedy allocation | Integer programme (globally optimal) |
| **Solver** | `solve_fixed_rule()` | `solve_greedy()` | `solve_with_cpsat()` |
| **Budget-aware** | No | Yes | Yes |
| **Delay-optimal** | No | Partial | Yes |

### KPI Definitions

All KPIs are computed from `RecoveryPlan` fields — no values are inferred.

| KPI | Definition | Source field |
|---|---|---|
| **MTTD** | Days from disruption start to detection | `DisruptionEvent.outage_start_day` |
| **MTTR** | `max(estimated_arrival_days)` across all actions | `RecoveryAction.estimated_arrival_days` |
| **Recovery Cost** | Total spend incl. delay penalties | `RecoveryPlan.total_cost` |
| **Fulfillment %** | `fulfilled / demand × 100` | `RecoveryPlan.fulfilled` |
| **On-Time %** | Units with `delay_days == 0` / fulfilled | `RecoveryAction.delay_days` |
| **Stockout %** | `100 - Fulfillment %` | derived |
| **Auto-Resolve %** | 100 if feasible AND fulfillment ≥ 80 % | `RecoveryPlan.is_infeasible` |
| **Infeasible %** | 100 if `plan.is_infeasible` | `RecoveryPlan.is_infeasible` |

### Limitations (stated explicitly)

- All data is **synthetic** — results cannot be generalised to real operations.
- **MTTD = 0** in all scenarios (disruption detected at start_day=0 by design).
- Single run per scenario — no confidence intervals are computed.
- Costs are in arbitrary monetary units (no currency conversion).
- CP-SAT falls back to greedy if OR-Tools is unavailable (logged in JSON).

---

## Project Structure

```
agent ml optimizer/
├── evaluate.py                       ← Reproducible evaluation script
├── README.md
└── backend/
    ├── ml/
    │   ├── schemas.py                ← SupplierInput, SupplierRiskResult
    │   ├── risk_scorer.py            ← Explainable baseline scorer
    │   ├── ml_model.py               ← Optional Logistic Regression
    │   ├── data/sample_suppliers.csv
    │   └── tests/
    ├── optimizer/
    │   ├── schemas.py                ← ComponentDemand, RecoveryPlan, …
    │   ├── solver.py                 ← OR-Tools CP-SAT
    │   ├── fallback.py               ← Cost-sorted greedy
    │   ├── optimizer.py              ← plan_recovery() entry point
    │   └── tests/
    ├── simulator/
    │   ├── schemas.py                ← ScenarioState, DisruptionEvent, …
    │   ├── scenarios.py              ← 5 fixed scenario factories
    │   ├── simulator.py              ← create_disruption(), reset_scenario()
    │   ├── backend_interface.py      ← BackendInterface Protocol
    │   └── tests/
    ├── evaluation/
    │   ├── kpis.py                   ← KPI definitions + computation
    │   ├── baselines.py              ← Approach A fixed-rule baseline
    │   ├── evaluator.py              ← EvaluationRunner (A vs B vs C)
    │   └── report.py                 ← Table printer + chart generator
    └── integration_tests/
        └── test_integration.py       ← End-to-end numeric assertions
```

---

## Test Commands

```bash
# All tests
python -m pytest backend/ -v

# By module
python -m pytest backend/ml/tests/           -v   # 43 tests
python -m pytest backend/optimizer/tests/   -v   # 27 tests
python -m pytest backend/simulator/tests/   -v   # 33 tests
python -m pytest backend/integration_tests/ -v   # ~30 tests

# Quick smoke test
python -m pytest backend/ -q
```
