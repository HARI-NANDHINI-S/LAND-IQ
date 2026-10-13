"""
LAND-IQ Machine Learning Microservice Test Suite
Validates model info, valid inputs, high-risk inputs, edge cases, missing fields, and error handling.
"""

import pytest
import httpx

BASE_URL = "http://127.0.0.1:8001"


def test_ml_model_info():
    """Verify that model metadata, version, evaluation metrics, and ethical safeguards are accessible."""
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        response = client.get("/ml/model-info")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("model_version") == "landiq-anomaly-classifier-v1.0.0"
        assert "metrics" in data
        assert data["metrics"]["accuracy"] > 0.80
        assert data["metrics"]["roc_auc_ovr"] > 0.90
        assert "safeguards" in data
        assert data["safeguards"]["is_experimental"] is True


def test_ml_predict_nominal_record():
    """Verify inference for a clean, nominal land record (low anomaly risk)."""
    payload = {
        "ocr_avg_confidence": 94.5,
        "ocr_min_confidence": 88.0,
        "missing_fields_count": 0,
        "duplicate_similarity_score": 0.02,
        "identifier_syntax_mismatch": 0,
        "area_outlier_score": 0.05,
        "document_type": "PATTA",
        "page_count": 2,
        "text_density_ratio": 1.1,
    }
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        response = client.post("/ml/predict", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["review_priority"] == "LOW"
        assert data["anomaly_score"] < 0.25
        assert len(data["contributing_factors"]) > 0
        assert data["is_experimental"] is True


def test_ml_predict_high_anomaly_record():
    """Verify inference for an anomalous, high-risk land record with multiple red flags."""
    payload = {
        "ocr_avg_confidence": 42.0,
        "ocr_min_confidence": 28.0,
        "missing_fields_count": 3,
        "duplicate_similarity_score": 0.91,
        "identifier_syntax_mismatch": 1,
        "area_outlier_score": 3.8,
        "document_type": "SALE_DEED",
        "page_count": 5,
        "text_density_ratio": 0.4,
    }
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        response = client.post("/ml/predict", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["review_priority"] == "HIGH"
        assert data["anomaly_score"] > 0.75
        assert any("Low OCR confidence" in f for f in data["contributing_factors"])
        assert any("duplicate match" in f.lower() for f in data["contributing_factors"])
        assert "Route immediately" in data["recommended_action"]


def test_ml_predict_default_values():
    """Verify inference handles missing optional fields using Pydantic defaults."""
    payload = {
        "ocr_avg_confidence": 80.0,
    }
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        response = client.post("/ml/predict", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["review_priority"] in ["LOW", "MEDIUM", "HIGH"]
        assert 0.0 <= data["anomaly_score"] <= 1.0


def test_ml_predict_invalid_input_validation():
    """Verify input validation returns 422 for impossible out-of-bound values."""
    # ocr_avg_confidence > 100 is forbidden
    payload = {
        "ocr_avg_confidence": 150.0,
    }
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        response = client.post("/ml/predict", json=payload)
        assert response.status_code == 422


if __name__ == "__main__":
    print("Running ML test suite...")
    test_ml_model_info()
    print("[PASS] test_ml_model_info")
    test_ml_predict_nominal_record()
    print("[PASS] test_ml_predict_nominal_record")
    test_ml_predict_high_anomaly_record()
    print("[PASS] test_ml_predict_high_anomaly_record")
    test_ml_predict_default_values()
    print("[PASS] test_ml_predict_default_values")
    test_ml_predict_invalid_input_validation()
    print("[PASS] test_ml_predict_invalid_input_validation")
    print("All ML tests passed successfully!")
