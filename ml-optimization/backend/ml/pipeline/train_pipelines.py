"""
train_pipelines.py
==================
Production-grade ML training and evaluation pipeline for Supply Chain X.
Trained on synthetic dataset: ml-optimization/data/supply_chain_ml_synthetic_dataset.csv.xls

Supported Tasks:
1. Delivery Delay Classification:
   - Target: `delivery_delayed_flag` (binary: 0 = on time, 1 = delayed)
   - Features: upstream operational context, environmental risks, supplier risk, lead times.
   - Leakage prevention: excludes `delay_days`, `expedite_cost_estimate`, `crisis_risk_label`.

2. Crisis Risk Classification:
   - Target: `crisis_risk_label` (binary: 0 = normal, 1 = elevated crisis risk)
   - Features: inventory, demand, supplier capacity, environmental flags, supplier risk.
   - Leakage prevention: excludes post-crisis outcomes (`delivery_delayed_flag`, `delay_days`, `shortage_units`, `suggested_reorder_units`, `expedite_cost_estimate`).

3. Demand Forecasting Regression:
   - Target: `demand_units` (continuous)
   - Features: temporal indicators (day_of_week, month), promotion_flag, region, supplier/product context.
   - Leakage prevention: excludes concurrent/post-demand outcomes (`shortage_units`, `suggested_reorder_units`, `inventory_units`, `crisis_risk_label`).

Splits:
- Chronological 70% Train (3,500 rows: 2023-01-01 to 2032-08-01), 15% Validation (750 rows), 15% Test (750 rows).
- Transformers are strictly fit ONLY on the training split.
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier, DummyRegressor
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor, RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression, Ridge
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# Paths
BASE_DIR = Path(__file__).resolve().parents[3]  # ml-optimization
DATA_PATH = BASE_DIR / "data" / "supply_chain_ml_synthetic_dataset.csv.xls"
MODELS_DIR = BASE_DIR / "models"


# ---------------------------------------------------------------------------
# Data Loading & Validation
# ---------------------------------------------------------------------------

def load_and_validate_dataset(csv_path: Path = DATA_PATH) -> pd.DataFrame:
    """Load dataset, validate schema, types, and chronological integrity."""
    if not csv_path.is_file():
        raise FileNotFoundError(f"Dataset not found at {csv_path}")

    df = pd.read_csv(csv_path)

    # Required columns
    expected_cols = [
        "date", "product_id", "supplier_id", "region", "day_of_week", "month",
        "promotion_flag", "demand_units", "inventory_units", "supplier_capacity_units",
        "lead_time_days", "supplier_risk_score", "weather_disruption_flag",
        "port_congestion_flag", "transport_cost", "delivery_delayed_flag",
        "delay_days", "shortage_units", "suggested_reorder_units",
        "expedite_cost_estimate", "crisis_risk_label"
    ]
    missing = set(expected_cols) - set(df.columns)
    if missing:
        raise ValueError(f"Dataset missing required columns: {missing}")

    # Ensure chronological order
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)

    # Validate no missing values
    null_counts = df.isnull().sum()
    if null_counts.any():
        raise ValueError(f"Dataset contains null values: {null_counts[null_counts > 0].to_dict()}")

    return df


def split_data_chronological(
    df: pd.DataFrame, train_ratio: float = 0.70, val_ratio: float = 0.15
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Strict chronological split to prevent temporal lookahead leakage."""
    n = len(df)
    train_end = int(n * train_ratio)
    val_end = int(n * (train_ratio + val_ratio))

    train_df = df.iloc[:train_end].copy().reset_index(drop=True)
    val_df = df.iloc[train_end:val_end].copy().reset_index(drop=True)
    test_df = df.iloc[val_end:].copy().reset_index(drop=True)

    return train_df, val_df, test_df


# ---------------------------------------------------------------------------
# Feature Transformer Builder
# ---------------------------------------------------------------------------

def build_preprocessor(numeric_cols: List[str], categorical_cols: List[str]) -> ColumnTransformer:
    """StandardScaler for numeric, OneHotEncoder for categorical."""
    transformers = []
    if numeric_cols:
        transformers.append(("num", StandardScaler(), numeric_cols))
    if categorical_cols:
        transformers.append(
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), categorical_cols)
        )
    return ColumnTransformer(transformers=transformers)


# ---------------------------------------------------------------------------
# Task 1: Delivery Delay Classification
# ---------------------------------------------------------------------------

def train_delivery_delay_pipeline(
    train_df: pd.DataFrame, val_df: pd.DataFrame, test_df: pd.DataFrame
) -> Dict[str, Any]:
    """Train and evaluate models for delivery_delayed_flag."""
    target_col = "delivery_delayed_flag"
    numeric_features = [
        "lead_time_days",
        "supplier_risk_score",
        "weather_disruption_flag",
        "port_congestion_flag",
        "transport_cost",
        "supplier_capacity_units",
        "day_of_week",
        "month",
    ]
    categorical_features = ["region", "supplier_id"]

    X_train = train_df[numeric_features + categorical_features]
    y_train = train_df[target_col]
    X_val = val_df[numeric_features + categorical_features]
    y_val = val_df[target_col]
    X_test = test_df[numeric_features + categorical_features]
    y_test = test_df[target_col]

    models = {
        "naive_majority": Pipeline([
            ("pre", build_preprocessor(numeric_features, categorical_features)),
            ("clf", DummyClassifier(strategy="most_frequent"))
        ]),
        "logistic_regression": Pipeline([
            ("pre", build_preprocessor(numeric_features, categorical_features)),
            ("clf", LogisticRegression(max_iter=1000, random_state=42, class_weight="balanced"))
        ]),
        "random_forest": Pipeline([
            ("pre", build_preprocessor(numeric_features, categorical_features)),
            ("clf", RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42, class_weight="balanced"))
        ]),
        "gradient_boosting": Pipeline([
            ("pre", build_preprocessor(numeric_features, categorical_features)),
            ("clf", GradientBoostingClassifier(n_estimators=100, max_depth=4, random_state=42))
        ])
    }

    results = {}
    best_model_name = None
    best_val_f1 = -1.0

    for name, pipeline in models.items():
        pipeline.fit(X_train, y_train)

        # Val metrics
        y_val_pred = pipeline.predict(X_val)
        y_val_prob = pipeline.predict_proba(X_val)[:, 1] if hasattr(pipeline, "predict_proba") else y_val_pred

        val_f1 = float(f1_score(y_val, y_val_pred, zero_division=0))
        val_acc = float(accuracy_score(y_val, y_val_pred))
        val_auc = float(roc_auc_score(y_val, y_val_prob)) if len(np.unique(y_val)) > 1 else 0.5

        # Test metrics
        y_test_pred = pipeline.predict(X_test)
        y_test_prob = pipeline.predict_proba(X_test)[:, 1] if hasattr(pipeline, "predict_proba") else y_test_pred

        test_f1 = float(f1_score(y_test, y_test_pred, zero_division=0))
        test_acc = float(accuracy_score(y_test, y_test_pred))
        test_auc = float(roc_auc_score(y_test, y_test_prob)) if len(np.unique(y_test)) > 1 else 0.5
        test_prec = float(precision_score(y_test, y_test_pred, zero_division=0))
        test_rec = float(recall_score(y_test, y_test_pred, zero_division=0))
        cm = confusion_matrix(y_test, y_test_pred).tolist()

        results[name] = {
            "validation": {"f1": val_f1, "accuracy": val_acc, "roc_auc": val_auc},
            "test": {
                "f1": test_f1, "accuracy": test_acc, "roc_auc": test_auc,
                "precision": test_prec, "recall": test_rec, "confusion_matrix": cm
            }
        }

        if val_f1 > best_val_f1:
            best_val_f1 = val_f1
            best_model_name = name

    # Persist best model
    best_pipeline = models[best_model_name]
    save_path = MODELS_DIR / "delivery_delay_classifier.joblib"
    joblib.dump(best_pipeline, save_path)

    return {
        "task": "delivery_delay_classification",
        "target": target_col,
        "best_model": best_model_name,
        "saved_path": str(save_path),
        "features": {"numeric": numeric_features, "categorical": categorical_features},
        "evaluation": results
    }


# ---------------------------------------------------------------------------
# Task 2: Crisis Risk Classification
# ---------------------------------------------------------------------------

def train_crisis_risk_pipeline(
    train_df: pd.DataFrame, val_df: pd.DataFrame, test_df: pd.DataFrame
) -> Dict[str, Any]:
    """Train and evaluate models for crisis_risk_label."""
    target_col = "crisis_risk_label"
    numeric_features = [
        "inventory_units",
        "supplier_capacity_units",
        "lead_time_days",
        "supplier_risk_score",
        "weather_disruption_flag",
        "port_congestion_flag",
        "transport_cost",
        "day_of_week",
        "month",
        "promotion_flag"
    ]
    categorical_features = ["region", "supplier_id", "product_id"]

    X_train = train_df[numeric_features + categorical_features]
    y_train = train_df[target_col]
    X_val = val_df[numeric_features + categorical_features]
    y_val = val_df[target_col]
    X_test = test_df[numeric_features + categorical_features]
    y_test = test_df[target_col]

    models = {
        "naive_majority": Pipeline([
            ("pre", build_preprocessor(numeric_features, categorical_features)),
            ("clf", DummyClassifier(strategy="most_frequent"))
        ]),
        "logistic_regression": Pipeline([
            ("pre", build_preprocessor(numeric_features, categorical_features)),
            ("clf", LogisticRegression(max_iter=1000, random_state=42, class_weight="balanced"))
        ]),
        "random_forest": Pipeline([
            ("pre", build_preprocessor(numeric_features, categorical_features)),
            ("clf", RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42, class_weight="balanced"))
        ]),
        "gradient_boosting": Pipeline([
            ("pre", build_preprocessor(numeric_features, categorical_features)),
            ("clf", GradientBoostingClassifier(n_estimators=100, max_depth=4, random_state=42))
        ])
    }

    results = {}
    best_model_name = None
    best_val_f1 = -1.0

    for name, pipeline in models.items():
        pipeline.fit(X_train, y_train)

        # Val metrics
        y_val_pred = pipeline.predict(X_val)
        y_val_prob = pipeline.predict_proba(X_val)[:, 1] if hasattr(pipeline, "predict_proba") else y_val_pred

        val_f1 = float(f1_score(y_val, y_val_pred, zero_division=0))
        val_acc = float(accuracy_score(y_val, y_val_pred))
        val_auc = float(roc_auc_score(y_val, y_val_prob)) if len(np.unique(y_val)) > 1 else 0.5

        # Test metrics
        y_test_pred = pipeline.predict(X_test)
        y_test_prob = pipeline.predict_proba(X_test)[:, 1] if hasattr(pipeline, "predict_proba") else y_test_pred

        test_f1 = float(f1_score(y_test, y_test_pred, zero_division=0))
        test_acc = float(accuracy_score(y_test, y_test_pred))
        test_auc = float(roc_auc_score(y_test, y_test_prob)) if len(np.unique(y_test)) > 1 else 0.5
        test_prec = float(precision_score(y_test, y_test_pred, zero_division=0))
        test_rec = float(recall_score(y_test, y_test_pred, zero_division=0))
        cm = confusion_matrix(y_test, y_test_pred).tolist()

        results[name] = {
            "validation": {"f1": val_f1, "accuracy": val_acc, "roc_auc": val_auc},
            "test": {
                "f1": test_f1, "accuracy": test_acc, "roc_auc": test_auc,
                "precision": test_prec, "recall": test_rec, "confusion_matrix": cm
            }
        }

        if val_f1 > best_val_f1:
            best_val_f1 = val_f1
            best_model_name = name

    # Persist best model
    best_pipeline = models[best_model_name]
    save_path = MODELS_DIR / "crisis_risk_classifier.joblib"
    joblib.dump(best_pipeline, save_path)

    return {
        "task": "crisis_risk_classification",
        "target": target_col,
        "best_model": best_model_name,
        "saved_path": str(save_path),
        "features": {"numeric": numeric_features, "categorical": categorical_features},
        "evaluation": results
    }


# ---------------------------------------------------------------------------
# Task 3: Demand Forecasting Regression
# ---------------------------------------------------------------------------

def train_demand_forecasting_pipeline(
    train_df: pd.DataFrame, val_df: pd.DataFrame, test_df: pd.DataFrame
) -> Dict[str, Any]:
    """Train and evaluate models for continuous demand_units."""
    target_col = "demand_units"
    numeric_features = [
        "day_of_week",
        "month",
        "promotion_flag",
        "lead_time_days",
        "supplier_risk_score",
        "transport_cost"
    ]
    categorical_features = ["region", "product_id", "supplier_id"]

    X_train = train_df[numeric_features + categorical_features]
    y_train = train_df[target_col]
    X_val = val_df[numeric_features + categorical_features]
    y_val = val_df[target_col]
    X_test = test_df[numeric_features + categorical_features]
    y_test = test_df[target_col]

    models = {
        "naive_mean": Pipeline([
            ("pre", build_preprocessor(numeric_features, categorical_features)),
            ("reg", DummyRegressor(strategy="mean"))
        ]),
        "linear_regression": Pipeline([
            ("pre", build_preprocessor(numeric_features, categorical_features)),
            ("reg", LinearRegression())
        ]),
        "ridge_regression": Pipeline([
            ("pre", build_preprocessor(numeric_features, categorical_features)),
            ("reg", Ridge(alpha=10.0, random_state=42))
        ]),
        "gradient_boosting": Pipeline([
            ("pre", build_preprocessor(numeric_features, categorical_features)),
            ("reg", GradientBoostingRegressor(n_estimators=100, max_depth=4, random_state=42))
        ])
    }

    results = {}
    best_model_name = None
    best_val_mae = float("inf")

    for name, pipeline in models.items():
        pipeline.fit(X_train, y_train)

        # Val metrics
        y_val_pred = pipeline.predict(X_val)
        val_mae = float(mean_absolute_error(y_val, y_val_pred))
        val_rmse = float(np.sqrt(mean_squared_error(y_val, y_val_pred)))
        val_r2 = float(r2_score(y_val, y_val_pred))

        # Test metrics
        y_test_pred = pipeline.predict(X_test)
        test_mae = float(mean_absolute_error(y_test, y_test_pred))
        test_rmse = float(np.sqrt(mean_squared_error(y_test, y_test_pred)))
        test_r2 = float(r2_score(y_test, y_test_pred))

        results[name] = {
            "validation": {"mae": val_mae, "rmse": val_rmse, "r2": val_r2},
            "test": {"mae": test_mae, "rmse": test_rmse, "r2": test_r2}
        }

        if val_mae < best_val_mae:
            best_val_mae = val_mae
            best_model_name = name

    # Persist best model
    best_pipeline = models[best_model_name]
    save_path = MODELS_DIR / "demand_forecaster.joblib"
    joblib.dump(best_pipeline, save_path)

    return {
        "task": "demand_forecasting_regression",
        "target": target_col,
        "best_model": best_model_name,
        "saved_path": str(save_path),
        "features": {"numeric": numeric_features, "categorical": categorical_features},
        "evaluation": results
    }


# ---------------------------------------------------------------------------
# Master Runner & Metadata Generator
# ---------------------------------------------------------------------------

def run_all_training_pipelines() -> Dict[str, Any]:
    """Execute full training, evaluation, and artifact serialization."""
    os.makedirs(MODELS_DIR, exist_ok=True)

    df = load_and_validate_dataset()
    train_df, val_df, test_df = split_data_chronological(df)

    metadata: Dict[str, Any] = {
        "dataset_metadata": {
            "file_name": "supply_chain_ml_synthetic_dataset.csv.xls",
            "file_format": "ASCII Text / Standard CSV (despite .csv.xls extension)",
            "is_synthetic": True,
            "synthetic_disclosure": (
                "DISCLOSURE: This dataset is entirely synthetically generated for supply chain "
                "risk modeling simulation. It does not represent live customer operational data. "
                "Reported metrics demonstrate model capacity and pipeline validity on this synthetic distribution "
                "and must not be construed as real-world production performance guarantees."
            ),
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "columns": list(df.columns),
            "date_range": {
                "start": str(df["date"].min().date()),
                "end": str(df["date"].max().date())
            },
            "splits": {
                "train_rows": len(train_df),
                "val_rows": len(val_df),
                "test_rows": len(test_df),
                "split_type": "chronological",
                "train_date_range": [str(train_df["date"].min().date()), str(train_df["date"].max().date())],
                "val_date_range": [str(val_df["date"].min().date()), str(val_df["date"].max().date())],
                "test_date_range": [str(test_df["date"].min().date()), str(test_df["date"].max().date())]
            }
        },
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "tasks": {}
    }

    # Run Task 1
    delay_res = train_delivery_delay_pipeline(train_df, val_df, test_df)
    metadata["tasks"]["delivery_delay"] = delay_res

    # Run Task 2
    crisis_res = train_crisis_risk_pipeline(train_df, val_df, test_df)
    metadata["tasks"]["crisis_risk"] = crisis_res

    # Run Task 3
    demand_res = train_demand_forecasting_pipeline(train_df, val_df, test_df)
    metadata["tasks"]["demand_forecasting"] = demand_res

    # Save metadata JSON
    meta_path = MODELS_DIR / "training_metadata.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    return metadata


if __name__ == "__main__":
    print("Starting ML Training Pipelines...")
    meta = run_all_training_pipelines()
    print("Training finished successfully.")
    print("Metadata written to:", MODELS_DIR / "training_metadata.json")
    for task_name, task_info in meta["tasks"].items():
        print(f"Task [{task_name}]: Best Model = {task_info['best_model']}")
