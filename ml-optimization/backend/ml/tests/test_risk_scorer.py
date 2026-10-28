"""Unit tests for the explainable baseline risk scorer."""

from __future__ import annotations

import pytest

from backend.ml.schemas import RiskCategory, SupplierInput
from backend.ml.risk_scorer import (
    _category,
    _clip,
    _normalise,
    score_supplier,
)


# ---------------------------------------------------------------------------
# Helper fixtures
# ---------------------------------------------------------------------------

def _make_input(**overrides) -> SupplierInput:
    """Return a baseline medium-risk supplier with optional field overrides."""
    defaults = dict(
        supplier_id="TEST-001",
        reliability_score=0.80,
        lead_time_days=25.0,
        lead_time_variability_days=5.0,
        available_capacity_pct=0.65,
        component_criticality=0.60,
        alternative_supplier_count=2,
        disruption_frequency=None,
        disruption_avg_duration_days=None,
    )
    defaults.update(overrides)
    return SupplierInput(**defaults)


# ---------------------------------------------------------------------------
# Unit tests — internal helpers
# ---------------------------------------------------------------------------

class TestClip:
    def test_within_range(self):
        assert _clip(0.5) == 0.5

    def test_below_range(self):
        assert _clip(-0.1) == 0.0

    def test_above_range(self):
        assert _clip(1.1) == 1.0

    def test_custom_bounds(self):
        assert _clip(5.0, lo=0, hi=10) == 5.0
        assert _clip(-1, lo=0, hi=10) == 0.0
        assert _clip(11, lo=0, hi=10) == 10.0


class TestNormalise:
    def test_zero_value(self):
        assert _normalise(0.0, 100.0) == 0.0

    def test_at_ref(self):
        assert _normalise(100.0, 100.0) == 1.0

    def test_above_ref_capped(self):
        assert _normalise(200.0, 100.0) == 1.0

    def test_half_ref(self):
        assert _normalise(50.0, 100.0) == pytest.approx(0.5)

    def test_zero_ref(self):
        assert _normalise(10.0, 0.0) == 0.0


class TestCategory:
    def test_critical(self):
        assert _category(0.80) == RiskCategory.CRITICAL

    def test_high(self):
        assert _category(0.55) == RiskCategory.HIGH

    def test_medium(self):
        assert _category(0.30) == RiskCategory.MEDIUM

    def test_low(self):
        assert _category(0.10) == RiskCategory.LOW

    def test_boundary_critical(self):
        assert _category(0.75) == RiskCategory.CRITICAL

    def test_boundary_medium(self):
        assert _category(0.25) == RiskCategory.MEDIUM


# ---------------------------------------------------------------------------
# Integration tests — score_supplier
# ---------------------------------------------------------------------------

class TestScoreSupplier:

    def test_returns_correct_type(self):
        from backend.ml.schemas import SupplierRiskResult
        result = score_supplier(_make_input())
        assert isinstance(result, SupplierRiskResult)

    def test_supplier_id_preserved(self):
        result = score_supplier(_make_input(supplier_id="SUP-XYZ"))
        assert result.supplier_id == "SUP-XYZ"

    def test_scorer_type_label(self):
        result = score_supplier(_make_input())
        assert result.scorer_type == "baseline_weighted"

    def test_scores_in_range(self):
        result = score_supplier(_make_input())
        assert 0.0 <= result.disruption_probability <= 1.0
        assert 0.0 <= result.impact_score <= 1.0
        assert 0.0 <= result.composite_risk_score <= 1.0

    def test_composite_is_blend_of_sub_scores(self):
        """composite must be close to 0.55*prob + 0.45*impact."""
        result = score_supplier(_make_input())
        expected = 0.55 * result.disruption_probability + 0.45 * result.impact_score
        assert result.composite_risk_score == pytest.approx(expected, abs=1e-6)

    def test_contributing_factors_sum_to_one(self):
        result = score_supplier(_make_input())
        total = sum(result.contributing_factors.values())
        assert total == pytest.approx(1.0, abs=1e-6)

    def test_high_reliability_lowers_prob(self):
        low_risk = score_supplier(_make_input(reliability_score=0.99))
        high_risk = score_supplier(_make_input(reliability_score=0.30))
        assert low_risk.disruption_probability < high_risk.disruption_probability

    def test_sole_source_increases_impact(self):
        one_alt = score_supplier(_make_input(alternative_supplier_count=0))
        five_alts = score_supplier(_make_input(alternative_supplier_count=5))
        assert one_alt.impact_score > five_alts.impact_score

    def test_critical_component_increases_impact(self):
        critical = score_supplier(_make_input(component_criticality=1.0))
        trivial = score_supplier(_make_input(component_criticality=0.0))
        assert critical.impact_score > trivial.impact_score

    def test_missing_disruption_history_adds_limitation(self):
        result = score_supplier(_make_input(disruption_frequency=None,
                                            disruption_avg_duration_days=None))
        assert any("proxy" in lim.lower() for lim in result.data_limitations)

    def test_with_full_disruption_history(self):
        result = score_supplier(_make_input(
            disruption_frequency=2.0,
            disruption_avg_duration_days=7.0,
        ))
        # When full history provided, no proxy limitation expected
        assert not any("proxy from reliability" in lim.lower()
                       for lim in result.data_limitations)

    def test_perfect_supplier_is_low_risk(self):
        result = score_supplier(_make_input(
            reliability_score=1.0,
            lead_time_days=7.0,
            lead_time_variability_days=0.0,
            available_capacity_pct=0.1,
            component_criticality=0.0,
            alternative_supplier_count=5,
            disruption_frequency=0.0,
            disruption_avg_duration_days=0.0,
        ))
        assert result.risk_category == RiskCategory.LOW

    def test_worst_case_supplier_is_critical(self):
        result = score_supplier(_make_input(
            reliability_score=0.0,
            lead_time_days=90.0,
            lead_time_variability_days=30.0,
            available_capacity_pct=1.0,
            component_criticality=1.0,
            alternative_supplier_count=0,
            disruption_frequency=4.0,
            disruption_avg_duration_days=30.0,
        ))
        assert result.risk_category == RiskCategory.CRITICAL

    def test_out_of_range_inputs_clipped_gracefully(self):
        # Should not raise; values are silently clipped
        result = score_supplier(_make_input(
            reliability_score=1.5,   # above max
            component_criticality=-0.2,  # below min
            lead_time_days=-5,       # negative → clipped to 0.01
        ))
        assert 0.0 <= result.composite_risk_score <= 1.0

    def test_to_dict_serialisable(self):
        import json
        result = score_supplier(_make_input())
        d = result.to_dict()
        # Must be JSON-serialisable
        serialised = json.dumps(d)
        assert "supplier_id" in serialised
        assert "risk_category" in serialised
