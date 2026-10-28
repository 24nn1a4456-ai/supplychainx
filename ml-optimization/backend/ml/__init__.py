"""
backend.ml — Supplier Risk Scoring package.

Public API
----------
score_supplier(input: SupplierInput) -> SupplierRiskResult
    Explainable, weight-based baseline scorer.  Always available.

train_and_evaluate(df: pd.DataFrame) -> TrainedModelResult
    Optional Scikit-learn model trained on historical disruption data.
    Only reliable when >= 50 labelled rows are provided.

See README.md for complete function signatures and usage examples.
"""

from .schemas import SupplierInput, SupplierRiskResult, RiskCategory
from .risk_scorer import score_supplier

__all__ = [
    "SupplierInput",
    "SupplierRiskResult",
    "RiskCategory",
    "score_supplier",
]
