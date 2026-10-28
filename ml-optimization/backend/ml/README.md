# Supplier Risk Scoring Module — Developer Reference

**Package path:** `backend/ml/`  
**Owner:** Member 4 (ML / Optimisation)  
**Consumers:** Member 1 (backend API integration)

---

## Quick Start

```python
from backend.ml import SupplierInput, score_supplier

inp = SupplierInput(
    supplier_id="SUP-001",
    reliability_score=0.85,        # [0, 1]  — 1 = perfectly reliable
    lead_time_days=20,             # days
    lead_time_variability_days=5,  # σ in days
    available_capacity_pct=0.70,   # fraction of capacity used by this buyer
    component_criticality=0.90,    # [0, 1]  — 1 = mission-critical
    alternative_supplier_count=1,  # integer >= 0
    # Optional historical data (improves accuracy when available):
    disruption_frequency=1.5,      # disruptions per year
    disruption_avg_duration_days=4.0,
)

result = score_supplier(inp)
print(result.to_dict())
```

---

## Public API

### 1. `score_supplier` — Explainable Baseline Scorer

```python
def score_supplier(supplier_input: SupplierInput) -> SupplierRiskResult
```

**Always available.** No external dependencies.  
Returns a transparent, weight-based risk score suitable for any planning context.

> **Important:** This is a *formula-based heuristic*, not a trained ML prediction.  
> The `scorer_type` field will always be `"baseline_weighted"`.

---

### 2. `train_and_evaluate` — Optional ML Model

```python
from backend.ml.ml_model import train_and_evaluate, FEATURE_COLUMNS, TARGET_COLUMN

result = train_and_evaluate(
    df,                   # pd.DataFrame with FEATURE_COLUMNS + TARGET_COLUMN
    test_size=0.25,       # held-out fraction
    random_state=42,
    class_weight="balanced",
)
print(f"Test AUC: {result.test_roc_auc:.3f}")
```

**Requires:** `pip install scikit-learn pandas`  
**Minimum rows:** 50 labelled examples (raises `ValueError` otherwise).  
Returns a `TrainedModelResult` with `scorer_type = "ml_logistic"`.

#### Training a single-supplier prediction

```python
from backend.ml.ml_model import predict_disruption_probability

prob = predict_disruption_probability(
    model_result,
    {
        "reliability_score": 0.75,
        "lead_time_days": 30.0,
        "lead_time_variability_days": 8.0,
        "available_capacity_pct": 0.70,
        "component_criticality": 0.65,
        "alternative_supplier_count": 2,
        "disruption_frequency": 1.0,
        "disruption_avg_duration_days": 5.0,
    },
)
```

---

## Input Schema — `SupplierInput`

| Field | Type | Range | Required | Description |
|---|---|---|---|---|
| `supplier_id` | `str` | — | ✅ | Unique supplier identifier |
| `reliability_score` | `float` | [0, 1] | ✅ | Historical on-time delivery rate |
| `lead_time_days` | `float` | > 0 | ✅ | Average lead time (days) |
| `lead_time_variability_days` | `float` | ≥ 0 | ✅ | Std deviation of lead time (days) |
| `available_capacity_pct` | `float` | [0, 1] | ✅ | Fraction of capacity allocated to buyer |
| `component_criticality` | `float` | [0, 1] | ✅ | Business-impact weight of component |
| `alternative_supplier_count` | `int` | ≥ 0 | ✅ | Qualified alternative suppliers |
| `disruption_frequency` | `float` | ≥ 0 | ❌ | Disruptions per year (historical) |
| `disruption_avg_duration_days` | `float` | ≥ 0 | ❌ | Mean disruption duration (days) |

Out-of-range values are silently clipped.

---

## Output Schema — `SupplierRiskResult`

| Field | Type | Description |
|---|---|---|
| `supplier_id` | `str` | Echoes input |
| `disruption_probability` | `float [0,1]` | Likelihood sub-score |
| `impact_score` | `float [0,1]` | Severity sub-score |
| `composite_risk_score` | `float [0,1]` | `0.55·prob + 0.45·impact` |
| `risk_category` | `RiskCategory` | LOW / MEDIUM / HIGH / CRITICAL |
| `contributing_factors` | `Dict[str, float]` | Normalised share of each input |
| `data_limitations` | `List[str]` | Caveats (e.g. missing history) |
| `scorer_type` | `str` | `"baseline_weighted"` or `"ml_logistic"` |

Call `.to_dict()` for a JSON-serialisable representation.

### Risk Category Thresholds

| Score Range | Category |
|---|---|
| 0.75 – 1.00 | CRITICAL |
| 0.50 – 0.75 | HIGH |
| 0.25 – 0.50 | MEDIUM |
| 0.00 – 0.25 | LOW |

---

## Scoring Weights (Baseline Scorer)

### Disruption Probability sub-score
| Component | Weight |
|---|---|
| Unreliability (1 − reliability_score) | 0.35 |
| Lead time risk (normalised, ref = 90 d) | 0.20 |
| Lead time variability (ref = 30 d) | 0.20 |
| Disruption history risk | 0.25 |

### Impact sub-score
| Component | Weight |
|---|---|
| Component criticality | 0.40 |
| Capacity risk | 0.35 |
| Sourcing risk (no-alternative penalty) | 0.25 |

### Composite blend
`composite = 0.55 × disruption_probability + 0.45 × impact_score`

All weights are in `risk_scorer.py` as named module constants and can be adjusted without changing function signatures.

---

## Sample Dataset

`backend/ml/data/sample_suppliers.csv` — 75 synthetic suppliers with realistic features and binary `disruption_occurred` labels.  
Use it for ML model prototyping and smoke-testing:

```python
import pandas as pd
df = pd.read_csv("backend/ml/data/sample_suppliers.csv")
```

---

## Running Tests

```bash
# From project root
pip install pytest scikit-learn pandas
pytest backend/ml/tests/ -v
```

Tests cover:
- Internal helper correctness (`_clip`, `_normalise`, `_category`)
- Baseline scorer edge cases and boundary conditions
- Composite score formula verification
- JSON serialisation
- ML model training, evaluation, leakage prevention
- Missing column and too-few-rows error handling

---

## Design Notes

- `disruption_probability` and `impact_score` are **kept separate** so supply planners can distinguish *likelihood* from *severity*.
- When optional historical fields are absent, a proxy is used and flagged in `data_limitations`.
- The ML model (`ml_logistic`) is deliberately kept distinct from the baseline scorer (`baseline_weighted`) so neither can be misrepresented as the other.
- No real-world disruption data or accuracy figures are claimed; all sample data is synthetic.
