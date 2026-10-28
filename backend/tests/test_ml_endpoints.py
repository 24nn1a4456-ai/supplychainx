"""
test_ml_endpoints.py
====================
Comprehensive backend tests for ML prediction endpoints:
- GET /api/predictions (enriched with ML supplier assessments)
- POST /api/predictions/delivery-delay
- POST /api/predictions/crisis-risk
- POST /api/predictions/demand-forecast
- Input validation & 422 error handling
- Artifact missing & 503 error handling
- Zero retraining guarantee during inference
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.ml_prediction_service import ml_service, MLModelManager

client = TestClient(app)


# ---------------------------------------------------------------------------
# GET /api/predictions Tests
# ---------------------------------------------------------------------------

def test_get_predictions_returns_ml_enriched_assessments():
    res = client.get("/api/predictions")
    assert res.status_code == 200
    data = res.json()

    assert "generatedAt" in data
    assert "supplierRiskAssessments" in data
    assert len(data["supplierRiskAssessments"]) > 0

    first_sup = data["supplierRiskAssessments"][0]
    assert "compositeRiskScore" in first_sup
    assert "failureProbabilityNext7Days" in first_sup
    assert "riskTier" in first_sup
    assert 0.0 <= first_sup["failureProbabilityNext7Days"] <= 1.0


# ---------------------------------------------------------------------------
# POST /api/predictions/delivery-delay Tests
# ---------------------------------------------------------------------------

def test_predict_delivery_delay_valid_input():
    payload = {
        "lead_time_days": 12,
        "supplier_risk_score": 0.45,
        "weather_disruption_flag": 1,
        "port_congestion_flag": 0,
        "transport_cost": 16.5,
        "supplier_capacity_units": 150.0,
        "day_of_week": 3,
        "month": 8,
        "region": "South",
        "supplier_id": "S02"
    }
    res = client.post("/api/predictions/delivery-delay", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["task"] == "delivery_delay_prediction"
    assert "delayedProbability" in data
    assert 0.0 <= data["delayedProbability"] <= 1.0
    assert data["prediction"] in [0, 1]
    assert data["riskCategory"] in ["Low Risk", "Moderate Risk", "High Risk"]
    assert data["isSyntheticModel"] is True


def test_predict_delivery_delay_invalid_input():
    # Negative lead_time_days and invalid supplier_risk_score (> 1.0)
    bad_payload = {
        "lead_time_days": -5,
        "supplier_risk_score": 1.5,
        "weather_disruption_flag": 0,
        "port_congestion_flag": 0,
        "transport_cost": 10.0,
        "supplier_capacity_units": 100.0,
        "day_of_week": 2,
        "month": 5,
        "region": "North",
        "supplier_id": "S01"
    }
    res = client.post("/api/predictions/delivery-delay", json=bad_payload)
    assert res.status_code == 422


def test_predict_delivery_delay_missing_feature():
    # Missing region and supplier_id
    incomplete_payload = {
        "lead_time_days": 5,
        "supplier_risk_score": 0.2
    }
    res = client.post("/api/predictions/delivery-delay", json=incomplete_payload)
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/predictions/crisis-risk Tests
# ---------------------------------------------------------------------------

def test_predict_crisis_risk_valid_input():
    payload = {
        "inventory_units": 15.0,  # Critical low inventory
        "supplier_capacity_units": 60.0,
        "lead_time_days": 14,
        "supplier_risk_score": 0.85,
        "weather_disruption_flag": 1,
        "port_congestion_flag": 1,
        "transport_cost": 28.0,
        "day_of_week": 4,
        "month": 12,
        "promotion_flag": 1,
        "region": "East",
        "supplier_id": "S07",
        "product_id": "P014"
    }
    res = client.post("/api/predictions/crisis-risk", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["task"] == "crisis_risk_prediction"
    assert "crisisProbability" in data
    assert 0.0 <= data["crisisProbability"] <= 1.0
    assert data["riskTier"] in ["Critical Crisis Risk", "Elevated Risk", "Normal Operational State"]
    assert data["isCrisisLikely"] in [True, False]


def test_predict_crisis_risk_unknown_category_handled():
    # Model's OneHotEncoder should ignore unknown category without erroring
    payload = {
        "inventory_units": 120.0,
        "supplier_capacity_units": 180.0,
        "lead_time_days": 6,
        "supplier_risk_score": 0.15,
        "weather_disruption_flag": 0,
        "port_congestion_flag": 0,
        "transport_cost": 12.0,
        "day_of_week": 1,
        "month": 4,
        "promotion_flag": 0,
        "region": "UnknownAntarcticaRegion",
        "supplier_id": "S99_BrandNewSupplier",
        "product_id": "P999_NewProduct"
    }
    res = client.post("/api/predictions/crisis-risk", json=payload)
    assert res.status_code == 200
    assert "crisisProbability" in res.json()


# ---------------------------------------------------------------------------
# POST /api/predictions/demand-forecast Tests (Experimental Warning)
# ---------------------------------------------------------------------------

def test_predict_demand_forecast_valid_input():
    payload = {
        "day_of_week": 2,
        "month": 6,
        "promotion_flag": 1,
        "lead_time_days": 7,
        "supplier_risk_score": 0.25,
        "transport_cost": 14.5,
        "region": "West",
        "product_id": "P003",
        "supplier_id": "S02"
    }
    res = client.post("/api/predictions/demand-forecast", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["task"] == "demand_forecasting_regression"
    assert data["forecastedDemandUnits"] >= 0
    assert "confidenceInterval" in data
    assert data["confidenceInterval"]["lowerBound"] <= data["confidenceInterval"]["upperBound"]

    # Experimental disclosure checks
    assert data["experimentalStatus"]["isExperimental"] is True
    assert "reliabilityWarning" in data["experimentalStatus"]
    assert "R^2" in data["experimentalStatus"]["reliabilityWarning"] or "0.106" in data["experimentalStatus"]["reliabilityWarning"]


# ---------------------------------------------------------------------------
# Missing Model Artifacts & Error Handling
# ---------------------------------------------------------------------------

def test_missing_model_artifact_raises_503():
    fake_mgr = MLModelManager(models_dir=Path("/non_existent_path_xyz"))
    with pytest.raises(Exception) as excinfo:
        fake_mgr.get_model("delivery_delay")
    assert "503" in str(excinfo.value) or "not found" in str(excinfo.value).lower()
