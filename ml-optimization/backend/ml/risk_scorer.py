"""
risk_scorer.py — Explainable, weight-based baseline supplier risk scorer.

Score Architecture
------------------
The composite risk score is split into two independent sub-scores that serve
different planning purposes:

    disruption_probability  — How *likely* is a disruption?
    impact_score            — How *severe* would a disruption be?

    composite_risk_score = 0.55 * disruption_probability
                         + 0.45 * impact_score

Sub-score weights
-----------------
disruption_probability components            weight
-----------------------------------------   ------
unreliability  (1 - reliability_score)       0.35
lead_time_risk (normalised lead time)        0.20
lt_variability_risk (normalised σ)           0.20
disruption_history_risk                      0.25   (proxy used if missing)

impact_score components                      weight
-----------------------------------------   ------
criticality    (component_criticality)       0.40
capacity_risk  (available_capacity_pct)      0.35
sourcing_risk  (no-alternative penalty)      0.25

All weights sum to 1.0 within each sub-score.  No weight was chosen by
machine-learning optimisation; they reflect supply-chain domain heuristics
and are intentionally transparent.

Public function
---------------
score_supplier(supplier_input: SupplierInput) -> SupplierRiskResult
"""

from __future__ import annotations

import math
from typing import Dict, List, Tuple

from .schemas import RiskCategory, SupplierInput, SupplierRiskResult

# ---------------------------------------------------------------------------
# Module-level constants (scoring weights — edit here to tune)
# ---------------------------------------------------------------------------

# Disruption probability weights
_W_UNRELIABILITY = 0.35
_W_LEAD_TIME = 0.20
_W_LT_VARIABILITY = 0.20
_W_DISRUPTION_HISTORY = 0.25

# Impact score weights
_W_CRITICALITY = 0.40
_W_CAPACITY = 0.35
_W_SOURCING = 0.25

# Composite blend
_W_PROBABILITY = 0.55
_W_IMPACT = 0.45

# Normalisation reference values (domain-reasonable upper bounds)
_LEAD_TIME_REF_DAYS = 90.0          # ≥ 90 days → max normalised risk
_LEAD_TIME_VAR_REF_DAYS = 30.0      # σ ≥ 30 days → max variability risk
_DISRUPTION_FREQ_REF = 4.0          # ≥ 4 disruptions/year → max freq risk
_DISRUPTION_DUR_REF_DAYS = 30.0     # ≥ 30-day outage → max duration risk
_ALT_SUPPLIER_REF = 5               # ≥ 5 alternatives → no sourcing risk

# Risk category thresholds (lower bound inclusive)
_RISK_THRESHOLDS = [
    (0.75, RiskCategory.CRITICAL),
    (0.50, RiskCategory.HIGH),
    (0.25, RiskCategory.MEDIUM),
    (0.00, RiskCategory.LOW),
]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _clip(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    """Clip *value* to [lo, hi]."""
    return max(lo, min(hi, value))


def _normalise(value: float, ref: float) -> float:
    """Linear normalisation capped at 1.0: value / ref."""
    if ref <= 0:
        return 0.0
    return _clip(value / ref)


def _category(score: float) -> RiskCategory:
    for threshold, category in _RISK_THRESHOLDS:
        if score >= threshold:
            return category
    return RiskCategory.LOW


def _disruption_history_component(
    reliability_score: float,
    disruption_frequency: float | None,
    disruption_avg_duration: float | None,
) -> Tuple[float, List[str]]:
    """
    Compute a [0, 1] disruption-history risk component.

    When historical disruption data is absent, falls back to a proxy derived
    from reliability_score and records a limitation note.
    """
    limitations: List[str] = []

    if disruption_frequency is None and disruption_avg_duration is None:
        # Proxy: low reliability → high latent disruption history risk
        proxy = _clip(1.0 - reliability_score)
        limitations.append(
            "No historical disruption data provided; disruption history risk "
            "estimated as a proxy from reliability_score."
        )
        return proxy, limitations

    freq_risk = 0.0
    dur_risk = 0.0

    if disruption_frequency is not None:
        freq_risk = _normalise(disruption_frequency, _DISRUPTION_FREQ_REF)
    else:
        freq_risk = _clip(1.0 - reliability_score)
        limitations.append(
            "disruption_frequency not provided; frequency risk proxied from "
            "reliability_score."
        )

    if disruption_avg_duration is not None:
        dur_risk = _normalise(disruption_avg_duration, _DISRUPTION_DUR_REF_DAYS)
    else:
        dur_risk = 0.0
        limitations.append(
            "disruption_avg_duration_days not provided; duration component "
            "set to zero — impact may be underestimated."
        )

    combined = 0.6 * freq_risk + 0.4 * dur_risk
    return _clip(combined), limitations


def _compute_disruption_probability(
    inp: SupplierInput,
) -> Tuple[float, Dict[str, float], List[str]]:
    """
    Return (disruption_probability, factor_contributions, limitations).
    """
    unreliability = _clip(1.0 - inp.reliability_score)
    lead_time_risk = _normalise(inp.lead_time_days, _LEAD_TIME_REF_DAYS)
    lt_var_risk = _normalise(
        inp.lead_time_variability_days, _LEAD_TIME_VAR_REF_DAYS
    )
    hist_risk, hist_limitations = _disruption_history_component(
        inp.reliability_score,
        inp.disruption_frequency,
        inp.disruption_avg_duration_days,
    )

    prob = (
        _W_UNRELIABILITY * unreliability
        + _W_LEAD_TIME * lead_time_risk
        + _W_LT_VARIABILITY * lt_var_risk
        + _W_DISRUPTION_HISTORY * hist_risk
    )

    factors = {
        "unreliability": _W_UNRELIABILITY * unreliability,
        "lead_time_risk": _W_LEAD_TIME * lead_time_risk,
        "lead_time_variability_risk": _W_LT_VARIABILITY * lt_var_risk,
        "disruption_history_risk": _W_DISRUPTION_HISTORY * hist_risk,
    }

    return _clip(prob), factors, hist_limitations


def _compute_impact_score(
    inp: SupplierInput,
) -> Tuple[float, Dict[str, float]]:
    """
    Return (impact_score, factor_contributions).
    """
    criticality = _clip(inp.component_criticality)

    # High utilisation leaves no capacity buffer → higher impact
    capacity_risk = _clip(inp.available_capacity_pct)

    # Fewer alternatives → harder to absorb disruption
    alt_count = max(0, inp.alternative_supplier_count)
    sourcing_risk = _clip(1.0 - _normalise(float(alt_count), float(_ALT_SUPPLIER_REF)))

    impact = (
        _W_CRITICALITY * criticality
        + _W_CAPACITY * capacity_risk
        + _W_SOURCING * sourcing_risk
    )

    factors = {
        "component_criticality": _W_CRITICALITY * criticality,
        "capacity_risk": _W_CAPACITY * capacity_risk,
        "sourcing_risk": _W_SOURCING * sourcing_risk,
    }

    return _clip(impact), factors


def _normalise_contributions(factors: Dict[str, float]) -> Dict[str, float]:
    """Rescale factor values so they sum to 1.0 (share-of-total)."""
    total = sum(factors.values())
    if total == 0:
        return {k: 0.0 for k in factors}
    return {k: v / total for k, v in factors.items()}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def score_supplier(supplier_input: SupplierInput) -> SupplierRiskResult:
    """
    Compute an explainable, weight-based risk score for a single supplier.

    This function uses a **transparent scoring formula**, not a trained
    machine-learning model.  All weights are documented in this module's
    docstring and are intentionally auditable.

    Parameters
    ----------
    supplier_input : SupplierInput
        Validated supplier features.  See :class:`~backend.ml.schemas.SupplierInput`
        for field descriptions and valid ranges.

    Returns
    -------
    SupplierRiskResult
        Contains:
        - ``disruption_probability`` — likelihood sub-score [0, 1]
        - ``impact_score``           — severity sub-score [0, 1]
        - ``composite_risk_score``   — blended overall score [0, 1]
        - ``risk_category``          — LOW / MEDIUM / HIGH / CRITICAL
        - ``contributing_factors``   — normalised share of each input feature
        - ``data_limitations``       — caveats when optional fields are absent
        - ``scorer_type``            — always ``"baseline_weighted"``

    Examples
    --------
    >>> from backend.ml import SupplierInput, score_supplier
    >>> inp = SupplierInput(
    ...     supplier_id="SUP-001",
    ...     reliability_score=0.85,
    ...     lead_time_days=20,
    ...     lead_time_variability_days=5,
    ...     available_capacity_pct=0.70,
    ...     component_criticality=0.90,
    ...     alternative_supplier_count=1,
    ... )
    >>> result = score_supplier(inp)
    >>> result.risk_category
    <RiskCategory.HIGH: 'HIGH'>

    Notes
    -----
    * Input values outside their documented ranges are silently clipped.
    * ``disruption_probability`` and ``impact_score`` are intentionally kept
      separate so planners can distinguish *likelihood* from *severity*.
    * Do **not** report ``composite_risk_score`` as a trained ML prediction
      probability.
    """
    # Validate / coerce lead time
    lead_days = max(0.01, float(supplier_input.lead_time_days))
    lead_var = max(0.0, float(supplier_input.lead_time_variability_days))

    # Patch coerced values back into a temporary copy to avoid mutation
    coerced = SupplierInput(
        supplier_id=supplier_input.supplier_id,
        reliability_score=_clip(supplier_input.reliability_score),
        lead_time_days=lead_days,
        lead_time_variability_days=lead_var,
        available_capacity_pct=_clip(supplier_input.available_capacity_pct),
        component_criticality=_clip(supplier_input.component_criticality),
        alternative_supplier_count=max(0, supplier_input.alternative_supplier_count),
        disruption_frequency=supplier_input.disruption_frequency,
        disruption_avg_duration_days=supplier_input.disruption_avg_duration_days,
    )

    prob, prob_factors, limitations = _compute_disruption_probability(coerced)
    impact, impact_factors = _compute_impact_score(coerced)

    composite = _clip(_W_PROBABILITY * prob + _W_IMPACT * impact)

    # Merge and normalise contributions for explainability
    all_factors: Dict[str, float] = {}
    for k, v in prob_factors.items():
        all_factors[k] = v * _W_PROBABILITY        # scale to composite share
    for k, v in impact_factors.items():
        all_factors[k] = v * _W_IMPACT

    normalised_factors = _normalise_contributions(all_factors)

    return SupplierRiskResult(
        supplier_id=coerced.supplier_id,
        disruption_probability=prob,
        impact_score=impact,
        composite_risk_score=composite,
        risk_category=_category(composite),
        contributing_factors=normalised_factors,
        data_limitations=limitations,
        scorer_type="baseline_weighted",
    )
