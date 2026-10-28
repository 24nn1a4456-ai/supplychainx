"""
test_trained_pipelines.py
=========================
Unit and integration tests for trained Supply Chain X ML pipelines.
Verifies model serialization, inference behavior, pipeline schemas, and performance criteria.
"""

from __future__ import annotations

import json
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
import pytest

BASE_DIR = Path(__file__).resolve().parents[4]  # supply-chain-x-core
MODELS_DIR = BASE_DIR / "ml-optimization" / "models"
METADATA_PATH = MODELS_DIR / "training_metadata.json"
DATA_PATH = BASE_DIR / "ml-optimization" / "data" / "supply_chain_ml_synthetic_dataset.csv.xls"


class TestModelArtifactsExist:

    def test_metadata_file_exists_and_valid(self):
        assert METADATA_PATH.is_file(), f"Metadata not found at {METADATA_PATH}"
        with open(METADATA_PATH, "r", encoding="utf-8") as f:
            meta = json.load(f)
        assert meta["dataset_metadata"]["is_synthetic"] is True
        assert "synthetic_disclosure" in meta["dataset_metadata"]
        assert meta["dataset_metadata"]["total_rows"] == 5000
        assert "delivery_delay" in meta["tasks"]
        assert "crisis_risk" in meta["tasks"]
        assert "demand_forecasting" in meta["tasks"]

    def test_joblib_model_files_exist(self):
        models = [
            "delivery_delay_classifier.joblib",
            "crisis_risk_classifier.joblib",
            "demand_forecaster.joblib"
        ]
        for m in models:
            p = MODELS_DIR / m
            assert p.is_file(), f"Model artifact {m} missing at {p}"
            assert p.stat().st_size > 1000, f"Model artifact {m} is unexpectedly small"


class TestDeliveryDelayClassifier:

    @pytest.fixture(scope="class")
    def model_and_meta(self):
        model_path = MODELS_DIR / "delivery_delay_classifier.joblib"
        model = joblib.load(model_path)
        with open(METADATA_PATH, "r", encoding="utf-8") as f:
            meta = json.load(f)["tasks"]["delivery_delay"]
        return model, meta

    def test_predict_sample(self, model_and_meta):
        model, meta = model_and_meta
        sample = pd.DataFrame([{
            "lead_time_days": 10,
            "supplier_risk_score": 0.45,
            "weather_disruption_flag": 1,
            "port_congestion_flag": 0,
            "transport_cost": 15.2,
            "supplier_capacity_units": 150,
            "day_of_week": 2,
            "month": 6,
            "region": "South",
            "supplier_id": "S01"
        }])
        pred = model.predict(sample)
        prob = model.predict_proba(sample)
        assert pred[0] in [0, 1]
        assert prob.shape == (1, 2)
        assert 0.0 <= prob[0, 1] <= 1.0

    def test_beats_naive_baseline(self, model_and_meta):
        _, meta = model_and_meta
        naive_f1 = meta["evaluation"]["naive_majority"]["test"]["f1"]
        rf_f1 = meta["evaluation"]["random_forest"]["test"]["f1"]
        assert rf_f1 > naive_f1, f"RF test F1 ({rf_f1}) should beat naive majority ({naive_f1})"


class TestCrisisRiskClassifier:

    @pytest.fixture(scope="class")
    def model_and_meta(self):
        model_path = MODELS_DIR / "crisis_risk_classifier.joblib"
        model = joblib.load(model_path)
        with open(METADATA_PATH, "r", encoding="utf-8") as f:
            meta = json.load(f)["tasks"]["crisis_risk"]
        return model, meta

    def test_predict_sample(self, model_and_meta):
        model, meta = model_and_meta
        sample = pd.DataFrame([{
            "inventory_units": 20,  # very low inventory
            "supplier_capacity_units": 80,
            "lead_time_days": 12,
            "supplier_risk_score": 0.75,
            "weather_disruption_flag": 1,
            "port_congestion_flag": 1,
            "transport_cost": 22.5,
            "day_of_week": 4,
            "month": 11,
            "promotion_flag": 1,
            "region": "East",
            "supplier_id": "S07",
            "product_id": "P014"
        }])
        pred = model.predict(sample)
        prob = model.predict_proba(sample)
        assert pred[0] in [0, 1]
        assert prob.shape == (1, 2)
        assert 0.0 <= prob[0, 1] <= 1.0

    def test_evaluation_metrics_exceed_minimums(self, model_and_meta):
        _, meta = model_and_meta
        gb_eval = meta["evaluation"]["gradient_boosting"]["test"]
        assert gb_eval["f1"] > 0.70, f"Crisis risk test F1 {gb_eval['f1']} should exceed 0.70"
        assert gb_eval["roc_auc"] > 0.75, f"Crisis risk test ROC-AUC {gb_eval['roc_auc']} should exceed 0.75"


class TestDemandForecaster:

    @pytest.fixture(scope="class")
    def model_and_meta(self):
        model_path = MODELS_DIR / "demand_forecaster.joblib"
        model = joblib.load(model_path)
        with open(METADATA_PATH, "r", encoding="utf-8") as f:
            meta = json.load(f)["tasks"]["demand_forecasting"]
        return model, meta

    def test_predict_sample(self, model_and_meta):
        model, meta = model_and_meta
        sample = pd.DataFrame([{
            "day_of_week": 1,
            "month": 3,
            "promotion_flag": 1,
            "lead_time_days": 5,
            "supplier_risk_score": 0.20,
            "transport_cost": 12.0,
            "region": "West",
            "product_id": "P003",
            "supplier_id": "S02"
        }])
        pred = model.predict(sample)
        assert len(pred) == 1
        assert pred[0] > 0, f"Demand prediction {pred[0]} should be positive"

    def test_beats_naive_mean_baseline(self, model_and_meta):
        _, meta = model_and_meta
        naive_mae = meta["evaluation"]["naive_mean"]["test"]["mae"]
        gb_mae = meta["evaluation"]["gradient_boosting"]["test"]["mae"]
        assert gb_mae < naive_mae, f"GB MAE ({gb_mae}) should be lower than naive baseline ({naive_mae})"
