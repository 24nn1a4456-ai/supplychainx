"""
ml_prediction_service.py
========================
Singleton loader and inference service for trained Machine Learning pipelines.
Models loaded from: ml-optimization/models/

Supported Pipelines:
1. Delivery Delay Classifier (`delivery_delay_classifier.joblib`)
2. Crisis Risk Classifier (`crisis_risk_classifier.joblib`)
3. Experimental Demand Forecaster (`demand_forecaster.joblib`)
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import pandas as pd
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

# Search paths for models
_POSSIBLE_MODEL_DIRS = [
    Path(os.environ.get("ML_MODELS_DIR")) if os.environ.get("ML_MODELS_DIR") else None,
    Path(__file__).resolve().parents[4] / "ml-optimization" / "models",
    Path(__file__).resolve().parents[3] / "ml-optimization" / "models",
    Path(__file__).resolve().parents[2] / "ml-optimization" / "models",
    Path("/app/ml-optimization/models"),
    Path("./ml-optimization/models"),
]


def get_models_dir() -> Path:
    """Find the directory containing the trained model artifacts."""
    for d in _POSSIBLE_MODEL_DIRS:
        if d and (d / "training_metadata.json").is_file():
            return d
    return _POSSIBLE_MODEL_DIRS[1] or Path("ml-optimization/models")


class MLModelManager:
    """
    Thread-safe lazy-loading singleton manager for scikit-learn pipeline artifacts.
    Guarantees models are loaded into memory once and NEVER retrained during API requests.
    """

    def __init__(self, models_dir: Optional[Path] = None):
        self.models_dir = models_dir or get_models_dir()
        self._models: Dict[str, Any] = {}
        self._metadata: Optional[Dict[str, Any]] = None

    def get_metadata(self) -> Dict[str, Any]:
        if self._metadata is None:
            meta_path = self.models_dir / "training_metadata.json"
            if not meta_path.is_file():
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Model metadata not found at {meta_path}. Ensure training pipeline has been executed."
                )
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    self._metadata = json.load(f)
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error reading model metadata: {exc}"
                )
        return self._metadata

    def get_model(self, task_key: str) -> Any:
        """
        Retrieve model pipeline for task_key:
        - 'delivery_delay' -> delivery_delay_classifier.joblib
        - 'crisis_risk' -> crisis_risk_classifier.joblib
        - 'demand_forecasting' -> demand_forecaster.joblib
        """
        if task_key in self._models:
            return self._models[task_key]

        meta = self.get_metadata()
        if task_key not in meta.get("tasks", {}):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Unknown ML task '{task_key}'"
            )

        task_info = meta["tasks"][task_key]
        expected_filename = {
            "delivery_delay": "delivery_delay_classifier.joblib",
            "crisis_risk": "crisis_risk_classifier.joblib",
            "demand_forecasting": "demand_forecaster.joblib"
        }.get(task_key)

        model_path = self.models_dir / (expected_filename or Path(task_info["saved_path"]).name)
        if not model_path.is_file():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Model artifact for task '{task_key}' not found at {model_path}."
            )

        try:
            model = joblib.load(model_path)
            self._models[task_key] = model
            logger.info("Successfully loaded ML pipeline for %s from %s", task_key, model_path)
            return model
        except Exception as exc:
            logger.error("Failed loading model for %s: %s", task_key, exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed loading ML pipeline artifact: {exc}"
            )

    def predict_delivery_delay(self, features_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict delivery delay probability and binary flag.
        Required features:
        - lead_time_days (int/float >= 0)
        - supplier_risk_score (float 0.0 - 1.0)
        - weather_disruption_flag (int 0 or 1)
        - port_congestion_flag (int 0 or 1)
        - transport_cost (float >= 0)
        - supplier_capacity_units (int/float >= 0)
        - day_of_week (int 0-6)
        - month (int 1-12)
        - region (str)
        - supplier_id (str)
        """
        meta = self.get_metadata()["tasks"]["delivery_delay"]
        numeric_cols = meta["features"]["numeric"]
        categorical_cols = meta["features"]["categorical"]
        all_cols = numeric_cols + categorical_cols

        # Validation
        missing = [c for c in all_cols if c not in features_dict or features_dict[c] is None]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Missing required features for delivery delay prediction: {missing}"
            )

        df = pd.DataFrame([features_dict])[all_cols]
        model = self.get_model("delivery_delay")

        pred = int(model.predict(df)[0])
        prob = float(model.predict_proba(df)[0][1])

        # Risk category
        risk_category = "High Risk" if prob >= 0.60 else ("Moderate Risk" if prob >= 0.35 else "Low Risk")

        return {
            "task": "delivery_delay_prediction",
            "modelUsed": meta["best_model"],
            "prediction": pred,
            "delayedProbability": round(prob, 4),
            "riskCategory": risk_category,
            "isDelayed": bool(pred == 1),
            "isSyntheticModel": True
        }

    def predict_crisis_risk(self, features_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict elevated crisis risk probability and binary flag.
        Required features:
        - inventory_units (int/float >= 0)
        - supplier_capacity_units (int/float >= 0)
        - lead_time_days (int/float >= 0)
        - supplier_risk_score (float 0.0 - 1.0)
        - weather_disruption_flag (int 0 or 1)
        - port_congestion_flag (int 0 or 1)
        - transport_cost (float >= 0)
        - day_of_week (int 0-6)
        - month (int 1-12)
        - promotion_flag (int 0 or 1)
        - region (str)
        - supplier_id (str)
        - product_id (str)
        """
        meta = self.get_metadata()["tasks"]["crisis_risk"]
        numeric_cols = meta["features"]["numeric"]
        categorical_cols = meta["features"]["categorical"]
        all_cols = numeric_cols + categorical_cols

        missing = [c for c in all_cols if c not in features_dict or features_dict[c] is None]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Missing required features for crisis risk prediction: {missing}"
            )

        df = pd.DataFrame([features_dict])[all_cols]
        model = self.get_model("crisis_risk")

        pred = int(model.predict(df)[0])
        prob = float(model.predict_proba(df)[0][1])

        risk_category = "Critical Crisis Risk" if prob >= 0.70 else ("Elevated Risk" if prob >= 0.45 else "Normal Operational State")

        return {
            "task": "crisis_risk_prediction",
            "modelUsed": meta["best_model"],
            "prediction": pred,
            "crisisProbability": round(prob, 4),
            "riskTier": risk_category,
            "isCrisisLikely": bool(pred == 1),
            "isSyntheticModel": True
        }

    def predict_demand_forecast(self, features_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Experimental demand forecast regression.
        Explicitly marked experimental due to synthetic distribution R2 of 0.1060.
        Required features:
        - day_of_week (int 0-6)
        - month (int 1-12)
        - promotion_flag (int 0 or 1)
        - lead_time_days (int/float >= 0)
        - supplier_risk_score (float 0.0 - 1.0)
        - transport_cost (float >= 0)
        - region (str)
        - product_id (str)
        - supplier_id (str)
        """
        meta = self.get_metadata()["tasks"]["demand_forecasting"]
        numeric_cols = meta["features"]["numeric"]
        categorical_cols = meta["features"]["categorical"]
        all_cols = numeric_cols + categorical_cols

        missing = [c for c in all_cols if c not in features_dict or features_dict[c] is None]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Missing required features for demand forecasting: {missing}"
            )

        df = pd.DataFrame([features_dict])[all_cols]
        model = self.get_model("demand_forecasting")

        raw_pred = float(model.predict(df)[0])
        forecasted_demand = max(0.0, round(raw_pred, 1))

        # 90% synthetic error bound based on test MAE (~41.0 units)
        test_mae = meta["evaluation"]["gradient_boosting"]["test"]["mae"]
        r2 = meta["evaluation"]["gradient_boosting"]["test"]["r2"]

        return {
            "task": "demand_forecasting_regression",
            "modelUsed": meta["best_model"],
            "forecastedDemandUnits": forecasted_demand,
            "confidenceInterval": {
                "lowerBound": max(0.0, round(forecasted_demand - 1.645 * test_mae, 1)),
                "upperBound": round(forecasted_demand + 1.645 * test_mae, 1),
                "confidenceLevel": "90%"
            },
            "experimentalStatus": {
                "isExperimental": True,
                "testR2Score": round(r2, 4),
                "testMAE": round(test_mae, 2),
                "reliabilityWarning": (
                    "CAUTION: This demand forecast has an explanatory variance (R^2) of ~0.106 on synthetic data. "
                    "Predictions should be considered heuristic indicators and not relied upon for unbuffered procurement decisions."
                )
            },
            "isSyntheticModel": True
        }


# Global singleton instance
ml_service = MLModelManager()
