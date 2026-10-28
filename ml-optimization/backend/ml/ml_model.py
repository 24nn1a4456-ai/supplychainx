"""
ml_model.py — Optional Scikit-learn supplier disruption classifier.

When to use
-----------
Call :func:`train_and_evaluate` **only** when you have a labelled dataset with
at least 50 rows.  With fewer samples the model is unreliable and the
baseline scorer in :mod:`risk_scorer` is preferable.

The model is a Logistic Regression pipeline:
    1. StandardScaler   — zero-mean, unit-variance normalisation
    2. LogisticRegression — linear probabilistic classifier

Why Logistic Regression?
    * Transparent coefficients align with the explainability requirement.
    * No risk of data leakage from complex feature interaction.
    * Minimal hyperparameter surface → easier to audit.

Output
------
:class:`TrainedModelResult` — evaluation metrics, per-feature coefficients,
and a predict function.  Clearly labelled as ``"ml_logistic"`` so callers
cannot confuse it with the baseline weighted scorer.

Data-leakage prevention
-----------------------
* train_test_split with stratify=y and shuffle=True is applied *before*
  any scaling or fitting.
* The StandardScaler is fit exclusively on training data; the test split
  is only transformed (never fitted).
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Optional imports — the rest of the module works without these at import
# time; they are only required when train_and_evaluate() is called.
# ---------------------------------------------------------------------------
try:
    import numpy as np
    import pandas as pd
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import (
        accuracy_score,
        classification_report,
        roc_auc_score,
    )
    from sklearn.model_selection import train_test_split
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler
    _SKLEARN_AVAILABLE = True
except ImportError:  # pragma: no cover
    _SKLEARN_AVAILABLE = False


# ---------------------------------------------------------------------------
# Feature specification
# ---------------------------------------------------------------------------

#: Ordered list of feature columns expected in the training DataFrame.
FEATURE_COLUMNS: List[str] = [
    "reliability_score",
    "lead_time_days",
    "lead_time_variability_days",
    "available_capacity_pct",
    "component_criticality",
    "alternative_supplier_count",
    "disruption_frequency",          # may be NaN → imputed with 0
    "disruption_avg_duration_days",  # may be NaN → imputed with 0
]

#: Target column — binary: 1 = disruption occurred, 0 = no disruption.
TARGET_COLUMN: str = "disruption_occurred"

#: Minimum rows required to proceed with training.
MIN_ROWS_REQUIRED: int = 50


# ---------------------------------------------------------------------------
# Output dataclass
# ---------------------------------------------------------------------------

@dataclass
class TrainedModelResult:
    """
    Output of :func:`train_and_evaluate`.

    Attributes
    ----------
    model_pipeline : Any
        Fitted ``sklearn.pipeline.Pipeline`` (scaler + classifier).
        Call ``model_pipeline.predict_proba(X)[:, 1]`` for probabilities.

    feature_names : List[str]
        Column names matching the fitted pipeline's expected input order.

    train_accuracy : float
        Accuracy on the training split.

    test_accuracy : float
        Accuracy on the held-out test split.

    test_roc_auc : float
        Area under the ROC curve on the test split.

    test_classification_report : str
        Full sklearn classification report string.

    feature_coefficients : Dict[str, float]
        Logistic regression coefficients keyed by feature name.
        Larger magnitude → stronger influence on predicted probability.

    warnings : List[str]
        Non-fatal issues encountered during training (e.g. class imbalance).

    scorer_type : str
        Always ``"ml_logistic"`` — do not mix with ``"baseline_weighted"``.
    """

    model_pipeline: Any
    feature_names: List[str]
    train_accuracy: float
    test_accuracy: float
    test_roc_auc: float
    test_classification_report: str
    feature_coefficients: Dict[str, float] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)
    scorer_type: str = "ml_logistic"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def train_and_evaluate(
    df: "pd.DataFrame",  # noqa: F821 — quoted for optional import
    test_size: float = 0.25,
    random_state: int = 42,
    class_weight: Optional[str] = "balanced",
) -> TrainedModelResult:
    """
    Train a Logistic Regression disruption classifier and evaluate it.

    Parameters
    ----------
    df : pd.DataFrame
        Must contain all columns in :data:`FEATURE_COLUMNS` plus
        :data:`TARGET_COLUMN`.  Missing values in ``disruption_frequency``
        and ``disruption_avg_duration_days`` are imputed with **0** (no
        observed disruptions).

    test_size : float, optional
        Fraction of data held out for evaluation.  Default 0.25.

    random_state : int, optional
        Seed for reproducibility.  Default 42.

    class_weight : str or None, optional
        Passed to ``LogisticRegression``.  ``"balanced"`` (default) corrects
        for class imbalance, which is common in disruption datasets.

    Returns
    -------
    TrainedModelResult
        Evaluation metrics, feature coefficients, and the fitted pipeline.

    Raises
    ------
    ImportError
        If ``scikit-learn`` or ``pandas`` is not installed.

    ValueError
        If the DataFrame has fewer than :data:`MIN_ROWS_REQUIRED` rows or is
        missing required columns.

    Notes
    -----
    * The scaler is fitted on the training split only — the test split is
      only *transformed* to prevent data leakage.
    * Results are labelled ``scorer_type = "ml_logistic"`` and must **not**
      be described as the baseline weighted score.

    Examples
    --------
    >>> import pandas as pd
    >>> from backend.ml.ml_model import train_and_evaluate, FEATURE_COLUMNS, TARGET_COLUMN
    >>> df = pd.read_csv("backend/ml/data/sample_suppliers.csv")
    >>> result = train_and_evaluate(df)
    >>> print(f"Test AUC: {result.test_roc_auc:.3f}")
    """
    if not _SKLEARN_AVAILABLE:
        raise ImportError(
            "scikit-learn and pandas are required for train_and_evaluate(). "
            "Install them with: pip install scikit-learn pandas"
        )

    # --- Validation ---
    missing_cols = [
        c for c in FEATURE_COLUMNS + [TARGET_COLUMN] if c not in df.columns
    ]
    if missing_cols:
        raise ValueError(f"DataFrame is missing required columns: {missing_cols}")

    if len(df) < MIN_ROWS_REQUIRED:
        raise ValueError(
            f"Only {len(df)} rows supplied; at least {MIN_ROWS_REQUIRED} are "
            "required for reliable training.  Use score_supplier() instead."
        )

    train_warnings: List[str] = []

    # --- Feature preparation ---
    X = df[FEATURE_COLUMNS].copy()
    y = df[TARGET_COLUMN].astype(int)

    # Impute optional columns with 0 (no historical disruptions)
    for col in ("disruption_frequency", "disruption_avg_duration_days"):
        na_count = X[col].isna().sum()
        if na_count > 0:
            X[col] = X[col].fillna(0.0)
            train_warnings.append(
                f"Imputed {na_count} missing values in '{col}' with 0.0."
            )

    # --- Train / test split — shuffled + stratified ---
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=test_size,
        random_state=random_state,
        stratify=y,
        shuffle=True,
    )

    # Class balance check
    class_counts = y_train.value_counts()
    if class_counts.min() < 5:
        train_warnings.append(
            "Minority class has fewer than 5 training examples — model "
            "predictions may be unreliable.  Collect more disruption data."
        )

    # --- Pipeline: fit on TRAIN only ---
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(
            class_weight=class_weight,
            max_iter=1000,
            random_state=random_state,
            solver="lbfgs",
        )),
    ])

    pipeline.fit(X_train, y_train)

    # --- Evaluation on held-out TEST split ---
    y_pred = pipeline.predict(X_test)
    y_prob = pipeline.predict_proba(X_test)[:, 1]

    train_acc = accuracy_score(y_train, pipeline.predict(X_train))
    test_acc = accuracy_score(y_test, y_pred)

    try:
        test_auc = roc_auc_score(y_test, y_prob)
    except ValueError:
        test_auc = float("nan")
        train_warnings.append(
            "ROC-AUC could not be computed (possibly only one class in test "
            "split).  Use a larger dataset."
        )

    report = classification_report(y_test, y_pred, zero_division=0)

    # --- Feature coefficients ---
    coefs: Dict[str, float] = dict(
        zip(FEATURE_COLUMNS, pipeline.named_steps["clf"].coef_[0].tolist())
    )

    return TrainedModelResult(
        model_pipeline=pipeline,
        feature_names=FEATURE_COLUMNS,
        train_accuracy=float(train_acc),
        test_accuracy=float(test_acc),
        test_roc_auc=float(test_auc),
        test_classification_report=report,
        feature_coefficients=coefs,
        warnings=train_warnings,
        scorer_type="ml_logistic",
    )


def predict_disruption_probability(
    model_result: TrainedModelResult,
    supplier_row: Dict[str, float],
) -> float:
    """
    Predict disruption probability for a single supplier using a trained model.

    Parameters
    ----------
    model_result : TrainedModelResult
        Output of :func:`train_and_evaluate`.

    supplier_row : dict
        Feature values keyed by column name (see :data:`FEATURE_COLUMNS`).
        Missing optional keys default to 0.0.

    Returns
    -------
    float
        Probability of disruption in [0.0, 1.0].

    Notes
    -----
    This probability is produced by a **trained ML model** (Logistic
    Regression) and must be labelled as ``scorer_type = "ml_logistic"``
    in any downstream result — never as ``"baseline_weighted"``.
    """
    if not _SKLEARN_AVAILABLE:
        raise ImportError("scikit-learn is required for ML predictions.")

    row_values = [
        float(supplier_row.get(col, 0.0))
        for col in model_result.feature_names
    ]
    arr = np.array(row_values).reshape(1, -1)
    prob = model_result.model_pipeline.predict_proba(arr)[0, 1]
    return float(prob)
