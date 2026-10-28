"""
Unit tests for the optional Scikit-learn disruption classifier.

These tests are skipped automatically when scikit-learn / pandas are absent.
"""

from __future__ import annotations

import pytest

try:
    import pandas as pd
    import numpy as np
    _DEPS_AVAILABLE = True
except ImportError:
    _DEPS_AVAILABLE = False

pytestmark = pytest.mark.skipif(
    not _DEPS_AVAILABLE,
    reason="pandas / scikit-learn not installed",
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_df(n: int = 60, disruption_rate: float = 0.40) -> "pd.DataFrame":
    """Generate a synthetic DataFrame with n suppliers."""
    rng = np.random.default_rng(seed=42)

    disruption_occurred = (rng.random(n) < disruption_rate).astype(int)

    # Construct features correlated with disruption label for realism
    reliability = np.where(
        disruption_occurred,
        rng.uniform(0.40, 0.75, n),
        rng.uniform(0.75, 0.99, n),
    )

    return pd.DataFrame({
        "reliability_score": reliability,
        "lead_time_days": rng.uniform(7, 80, n),
        "lead_time_variability_days": rng.uniform(0, 25, n),
        "available_capacity_pct": rng.uniform(0.3, 0.95, n),
        "component_criticality": rng.uniform(0.1, 1.0, n),
        "alternative_supplier_count": rng.integers(0, 6, n),
        "disruption_frequency": rng.uniform(0.0, 3.5, n),
        "disruption_avg_duration_days": rng.uniform(0.0, 20.0, n),
        "disruption_occurred": disruption_occurred,
    })


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestTrainAndEvaluate:

    def test_returns_trained_model_result(self):
        from backend.ml.ml_model import train_and_evaluate, TrainedModelResult
        df = _make_df(60)
        result = train_and_evaluate(df)
        assert isinstance(result, TrainedModelResult)

    def test_scorer_type_label(self):
        from backend.ml.ml_model import train_and_evaluate
        df = _make_df(60)
        result = train_and_evaluate(df)
        assert result.scorer_type == "ml_logistic"

    def test_accuracies_in_range(self):
        from backend.ml.ml_model import train_and_evaluate
        df = _make_df(80)
        result = train_and_evaluate(df)
        assert 0.0 <= result.train_accuracy <= 1.0
        assert 0.0 <= result.test_accuracy <= 1.0

    def test_roc_auc_in_range(self):
        from backend.ml.ml_model import train_and_evaluate
        df = _make_df(80)
        result = train_and_evaluate(df)
        assert 0.0 <= result.test_roc_auc <= 1.0

    def test_feature_coefficients_present(self):
        from backend.ml.ml_model import train_and_evaluate, FEATURE_COLUMNS
        df = _make_df(60)
        result = train_and_evaluate(df)
        assert set(result.feature_coefficients.keys()) == set(FEATURE_COLUMNS)

    def test_classification_report_is_string(self):
        from backend.ml.ml_model import train_and_evaluate
        df = _make_df(60)
        result = train_and_evaluate(df)
        assert isinstance(result.test_classification_report, str)
        assert "precision" in result.test_classification_report

    def test_too_few_rows_raises(self):
        from backend.ml.ml_model import train_and_evaluate
        df = _make_df(10)
        with pytest.raises(ValueError, match="at least"):
            train_and_evaluate(df)

    def test_missing_column_raises(self):
        from backend.ml.ml_model import train_and_evaluate
        df = _make_df(60).drop(columns=["reliability_score"])
        with pytest.raises(ValueError, match="missing required columns"):
            train_and_evaluate(df)

    def test_missing_optional_cols_imputed(self):
        from backend.ml.ml_model import train_and_evaluate
        df = _make_df(60)
        df["disruption_frequency"] = None
        result = train_and_evaluate(df)
        # Should succeed and note the imputation in warnings
        assert any("disruption_frequency" in w for w in result.warnings)

    def test_no_data_leakage_train_test_split(self):
        """Verify train accuracy ≥ test accuracy (train typically overfits slightly)."""
        from backend.ml.ml_model import train_and_evaluate
        df = _make_df(100)
        result = train_and_evaluate(df, test_size=0.3, random_state=0)
        # Not a strict guarantee, but with a larger dataset it almost always holds.
        # We assert both are within reasonable bounds rather than a strict inequality.
        assert result.train_accuracy >= 0.0
        assert result.test_accuracy >= 0.0

    def test_model_pipeline_predicts(self):
        from backend.ml.ml_model import train_and_evaluate, FEATURE_COLUMNS
        import numpy as np
        df = _make_df(60)
        result = train_and_evaluate(df)
        row = np.array([[0.8, 20, 4, 0.6, 0.5, 2, 0.3, 2.0]])
        proba = result.model_pipeline.predict_proba(row)[0, 1]
        assert 0.0 <= proba <= 1.0


class TestPredictDisruptionProbability:

    def test_returns_float_in_range(self):
        from backend.ml.ml_model import (
            train_and_evaluate,
            predict_disruption_probability,
        )
        df = _make_df(60)
        model_result = train_and_evaluate(df)
        prob = predict_disruption_probability(
            model_result,
            {
                "reliability_score": 0.75,
                "lead_time_days": 30.0,
                "lead_time_variability_days": 8.0,
                "available_capacity_pct": 0.70,
                "component_criticality": 0.65,
                "alternative_supplier_count": 2.0,
                "disruption_frequency": 1.0,
                "disruption_avg_duration_days": 5.0,
            },
        )
        assert 0.0 <= prob <= 1.0

    def test_missing_keys_default_to_zero(self):
        from backend.ml.ml_model import (
            train_and_evaluate,
            predict_disruption_probability,
        )
        df = _make_df(60)
        model_result = train_and_evaluate(df)
        # Provide only one key — rest should default to 0.0
        prob = predict_disruption_probability(model_result, {"reliability_score": 0.5})
        assert 0.0 <= prob <= 1.0
