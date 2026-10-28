"""
schemas.py — Input/output dataclasses for the supplier risk scoring module.

All fields use plain Python types so the module has zero mandatory
third-party dependencies beyond the standard library.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class RiskCategory(str, Enum):
    """
    Qualitative risk bucket derived from the composite risk score.

    Score → Category mapping
    -------------------------
    0.00 – 0.25  : LOW
    0.25 – 0.50  : MEDIUM
    0.50 – 0.75  : HIGH
    0.75 – 1.00  : CRITICAL
    """
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


# ---------------------------------------------------------------------------
# Input schema
# ---------------------------------------------------------------------------

@dataclass
class SupplierInput:
    """
    All information needed to score a single supplier.

    Parameters
    ----------
    supplier_id : str
        Unique identifier for the supplier (e.g. "SUP-001").

    reliability_score : float
        Historical on-time / in-full delivery rate, range [0.0, 1.0].
        1.0 = perfectly reliable.  Required.

    lead_time_days : float
        Average lead time in calendar days.  Must be > 0.  Required.

    lead_time_variability_days : float
        Standard deviation of lead time in calendar days.  Must be >= 0.
        Required.

    available_capacity_pct : float
        Fraction of total capacity currently allocated to *this* buyer,
        range [0.0, 1.0].  Higher utilisation → less buffer.  Required.

    component_criticality : float
        Business-impact weight of the component sourced from this supplier,
        range [0.0, 1.0].  1.0 = single-source, mission-critical.  Required.

    alternative_supplier_count : int
        Number of qualified alternative suppliers for the same component.
        0 = sole-source risk.  Required.

    disruption_frequency : Optional[float]
        Average disruptions per year observed historically.  Optional.
        When None, the model falls back to reliability_score as a proxy.

    disruption_avg_duration_days : Optional[float]
        Average duration of past disruptions in days.  Optional.

    Notes
    -----
    * All float inputs are validated and clipped to their documented ranges.
    * Optional fields, when absent, are noted in `data_limitations` of the
      output.
    """

    supplier_id: str

    # --- required fields ---
    reliability_score: float           # [0, 1]
    lead_time_days: float              # > 0
    lead_time_variability_days: float  # >= 0
    available_capacity_pct: float      # [0, 1]
    component_criticality: float       # [0, 1]
    alternative_supplier_count: int    # >= 0

    # --- optional historical fields ---
    disruption_frequency: Optional[float] = None        # disruptions/year
    disruption_avg_duration_days: Optional[float] = None  # days


# ---------------------------------------------------------------------------
# Output schema
# ---------------------------------------------------------------------------

@dataclass
class SupplierRiskResult:
    """
    Structured result returned by :func:`~backend.ml.risk_scorer.score_supplier`.

    Parameters
    ----------
    supplier_id : str
        Echoes the input supplier identifier.

    disruption_probability : float
        Estimated probability of a supply disruption occurring in the next
        planning period, range [0.0, 1.0].  Derived from weighted input
        features — **not** a trained ML prediction unless produced by the
        optional Scikit-learn pipeline.

    impact_score : float
        Severity of impact *if* a disruption occurs, range [0.0, 1.0].
        Combines component criticality, capacity buffer, and alternative
        supplier availability.

    composite_risk_score : float
        Overall risk score in [0.0, 1.0].
        Formula: composite = 0.55 * disruption_probability + 0.45 * impact_score

    risk_category : RiskCategory
        Qualitative label (LOW / MEDIUM / HIGH / CRITICAL).

    contributing_factors : Dict[str, float]
        Mapping of {factor_name: normalised_contribution} so the caller can
        explain which inputs drove the score.  Values sum to approximately 1.

    data_limitations : List[str]
        Human-readable list of caveats, e.g. missing historical data fields.

    scorer_type : str
        Either ``"baseline_weighted"`` (rule-based) or ``"ml_logistic"``
        (Scikit-learn model).  Never mix both labels.
    """

    supplier_id: str
    disruption_probability: float
    impact_score: float
    composite_risk_score: float
    risk_category: RiskCategory
    contributing_factors: Dict[str, float] = field(default_factory=dict)
    data_limitations: List[str] = field(default_factory=list)
    scorer_type: str = "baseline_weighted"

    def to_dict(self) -> dict:
        """Return a plain-dict representation suitable for JSON serialisation."""
        return {
            "supplier_id": self.supplier_id,
            "disruption_probability": round(self.disruption_probability, 4),
            "impact_score": round(self.impact_score, 4),
            "composite_risk_score": round(self.composite_risk_score, 4),
            "risk_category": self.risk_category.value,
            "contributing_factors": {
                k: round(v, 4) for k, v in self.contributing_factors.items()
            },
            "data_limitations": self.data_limitations,
            "scorer_type": self.scorer_type,
        }
