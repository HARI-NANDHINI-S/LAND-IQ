"""
LAND-IQ OCR Field Validator & Error Detection Test Suite
Validates:
1. Feature extraction and Shannon entropy
2. Format pattern validation and OCR confusion detection
3. Candidate correction generator (deterministic, isolated)
4. Model artifact loading and prediction
5. Clean vs corrupted field classification
6. Missing/malformed inputs and graceful degradation
7. FastAPI endpoints: /ml/field-validator/info, /ml/validate-field, /ml/validate-fields
"""

import os
import sys

# Ensure ocr-service root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from starlette.testclient import TestClient

from app.main import app
from app.ml.field_features import (
    compute_char_entropy,
    validate_format_pattern,
    check_ocr_confusion,
    extract_field_feature_dict,
    extract_field_feature_vector,
    FIELD_FEATURE_NAMES,
)
from app.ml.candidate_corrections import suggest_correction
from app.ml.field_validator_service import (
    load_field_validator_artifacts,
    validate_single_field,
    validate_batch_fields,
    SingleFieldValidationInput,
    BatchFieldValidationInput,
)

client = TestClient(app)


# =====================================================================
# 1. Feature Extraction & Domain Rules Tests
# =====================================================================

def test_entropy_computation():
    """Verify Shannon entropy is zero for empty/uniform string and positive for diverse strings."""
    assert compute_char_entropy("") == 0.0
    assert compute_char_entropy("aaaaa") == 0.0
    entropy = compute_char_entropy("TN-COI-2024-001")
    assert 2.0 < entropy < 4.0


def test_format_pattern_validation():
    """Verify domain syntax validation for Tamil Nadu / Indian land record fields."""
    # Survey numbers
    assert validate_format_pattern("survey_number", "124/3") == 1.0
    assert validate_format_pattern("survey_number", "200/1A") == 1.0
    assert validate_format_pattern("survey_number", "INVALID_SURVEY_$$$") == 0.0

    # Patta numbers
    assert validate_format_pattern("patta_number", "4521") == 1.0
    assert validate_format_pattern("patta_number", "PAT-2024-001") == 1.0
    assert validate_format_pattern("patta_number", "ABCXYZ-NOT-A-PATTA") == 0.0

    # Dates
    assert validate_format_pattern("document_date", "26/06/2015") == 1.0
    assert validate_format_pattern("document_date", "14.08.2021") == 1.0
    assert validate_format_pattern("document_date", "99/99/9999") == 0.0

    # Extent
    assert validate_format_pattern("extent", "2.50 Acres") == 1.0
    assert validate_format_pattern("extent", "1.25 Hectares") == 1.0
    assert validate_format_pattern("extent", "50 Cents") == 1.0
    assert validate_format_pattern("extent", "2.50 Kilograms") == 0.0

    # Owner Name
    assert validate_format_pattern("owner_name", "Ramesh Kumar") == 1.0
    assert validate_format_pattern("owner_name", "Ram3sh Kumar") == 0.0


def test_ocr_confusion_detection():
    """Verify detection of suspicious OCR confusion characters."""
    # O in numeric survey
    assert check_ocr_confusion("survey_number", "142/3O") == 1
    assert check_ocr_confusion("survey_number", "142/30") == 0

    # Digit in owner name
    assert check_ocr_confusion("owner_name", "Ram3sh Kumar") == 1
    assert check_ocr_confusion("owner_name", "Ramesh Kumar") == 0

    # Letter in date
    assert check_ocr_confusion("document_date", "26/O6/2O15") == 1
    assert check_ocr_confusion("document_date", "26/06/2015") == 0


def test_feature_vector_shape_and_names():
    """Ensure feature vector matches exact 16-element schema."""
    vec = extract_field_feature_vector("survey_number", "124/3", confidence=95.0)
    assert vec.shape == (1, 16)
    feat_dict = extract_field_feature_dict("survey_number", "124/3", confidence=95.0)
    for name in FIELD_FEATURE_NAMES:
        assert name in feat_dict


# =====================================================================
# 2. Candidate Correction Generator Tests
# =====================================================================

def test_candidate_corrections_survey():
    """Verify isolated correction suggestion for survey numbers."""
    corr, rationale = suggest_correction("survey_number", "142/3O")
    assert corr == "142/30"
    assert "replaced letter 'O' with digit '0'" in rationale

    # Leading l to 1
    corr2, _ = suggest_correction("survey_number", "l24/3")
    assert corr2 == "124/3"


def test_candidate_corrections_patta():
    """Verify patta correction: PAT-2OO4 -> PAT-2004."""
    corr, _ = suggest_correction("patta_number", "PAT-2OO4")
    assert corr == "PAT-2004"


def test_candidate_corrections_date():
    """Verify date character confusion repair: 26.O6.2O15 -> 26/06/2015."""
    corr, _ = suggest_correction("document_date", "26.O6.2O15")
    assert corr == "26/06/2015"


def test_candidate_corrections_state():
    """Verify gazetted state name standardization."""
    corr, _ = suggest_correction("state", "TamilNadu")
    assert corr == "Tamil Nadu"


def test_candidate_corrections_name_digit_removal():
    """Verify removing intruding digit in owner name."""
    corr, _ = suggest_correction("owner_name", "Ram3sh Kumar")
    assert corr == "Ramesh Kumar"


def test_candidate_corrections_none_for_ambiguous():
    """Never invent numbers or alter ambiguous fields where evidence is insufficient."""
    ambiguous_cases = [
        ("survey_number", "XYZ/???"),
        ("survey_number", "142/???"),
        ("survey_number", "124/"),
        ("document_date", "99/99/2024"),
        ("document_date", "14/15/2021"),
        ("extent", "2.50"),  # Ambiguous unit (Acres vs Hectares vs Cents cannot be guessed)
        ("owner_name", "Ramesh 2"),  # Digit at end; ambiguous meaning
        ("owner_name", "Ramesh 123"),
        ("patta_number", "PAT-UNKNOWN"),
        ("patta_number", "PAT-????"),
        ("district", "Unknown District 42"),
        ("survey_number", ""),
        ("survey_number", "   "),
    ]
    for field_name, value in ambiguous_cases:
        corr, rationale = suggest_correction(field_name, value)
        assert corr is None, f"Expected None for ambiguous {field_name}='{value}', got '{corr}'"
        assert rationale is None


# =====================================================================
# 3. Model Classification Tests (Clean vs Corrupted)
# =====================================================================

def test_model_artifact_loaded():
    """Ensure model artifact loads successfully from disk."""
    model, metadata = load_field_validator_artifacts()
    assert model is not None
    assert metadata is not None
    assert metadata["model_version"] == "landiq-ocr-field-validator-v1.0.0"
    assert metadata["metrics"]["accuracy"] > 0.85
    assert metadata["metrics"]["roc_auc"] > 0.90


def test_clean_fields_classification():
    """Nominal high-confidence valid fields should be classified LIKELY_CORRECT."""
    clean_cases = [
        ("survey_number", "124/3", 96.0),
        ("patta_number", "4521", 94.0),
        ("document_date", "14/06/2021", 97.0),
        ("state", "Tamil Nadu", 98.0),
        ("extent", "2.50 Acres", 92.0),
        ("owner_name", "Ramesh Kumar", 95.0),
    ]
    for name, val, conf in clean_cases:
        res = validate_single_field(SingleFieldValidationInput(
            field_name=name, field_value=val, confidence=conf
        ))
        assert res["review_classification"] == "LIKELY_CORRECT", f"Failed on {name}: {val}"
        assert res["review_priority_score"] < 0.50
        assert len(res["review_reasons"]) == 0


def test_corrupted_fields_classification():
    """Corrupted / low-confidence fields should be classified NEEDS_REVIEW."""
    corrupted_cases = [
        ("survey_number", "142/3O", 45.0),
        ("document_date", "99/99/2026", 88.0),
        ("patta_number", "PAT-XXXX", 40.0),
        ("extent", "2.50 Kilograms", 55.0),
        ("owner_name", "Ram3sh Kumar", 50.0),
    ]
    for name, val, conf in corrupted_cases:
        res = validate_single_field(SingleFieldValidationInput(
            field_name=name, field_value=val, confidence=conf
        ))
        assert res["review_classification"] == "NEEDS_REVIEW", f"Failed on {name}: {val}"
        assert len(res["review_reasons"]) > 0


def test_batch_validation():
    """Verify batch field validation."""
    inputs = [
        SingleFieldValidationInput(field_name="survey_number", field_value="124/3", confidence=95.0),
        SingleFieldValidationInput(field_name="survey_number", field_value="124/3O", confidence=45.0),
    ]
    results = validate_batch_fields(inputs)
    assert len(results) == 2
    assert results[0]["review_classification"] == "LIKELY_CORRECT"
    assert results[1]["review_classification"] == "NEEDS_REVIEW"
    assert results[1]["suggested_correction"] == "124/30"


# =====================================================================
# 4. FastAPI Endpoints Tests
# =====================================================================

def test_api_field_validator_info():
    """GET /ml/field-validator/info returns model schema and performance metrics."""
    resp = client.get("/ml/field-validator/info")
    assert resp.status_code == 200
    data = resp.json()
    assert data["model_version"] == "landiq-ocr-field-validator-v1.0.0"
    assert "metrics" in data
    assert "feature_importances" in data
    assert "safeguards" in data


def test_api_validate_single_field_endpoint():
    """POST /ml/validate-field returns structured review result."""
    payload = {
        "field_name": "survey_number",
        "field_value": "142/3O",
        "confidence": 52.0,
    }
    resp = client.post("/ml/validate-field", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["field_name"] == "survey_number"
    assert data["original_value"] == "142/3O"
    assert data["review_classification"] == "NEEDS_REVIEW"
    assert data["suggested_correction"] == "142/30"
    assert len(data["review_reasons"]) > 0


def test_api_validate_fields_batch_endpoint():
    """POST /ml/validate-fields processes multiple fields in one request."""
    payload = {
        "fields": [
            {"field_name": "district", "field_value": "Coimbatore", "confidence": 98.0},
            {"field_name": "extent", "field_value": "2.50 Acres", "confidence": 94.0},
        ]
    }
    resp = client.post("/ml/validate-fields", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "results" in data
    assert len(data["results"]) == 2
    assert data["results"][0]["review_classification"] == "LIKELY_CORRECT"


def test_api_ready_endpoint():
    """GET /ready verifies models and OCR engine are loaded."""
    resp = client.get("/ready")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ready"
    assert data["field_validator_loaded"] is True
    assert data["anomaly_classifier_loaded"] is True


def test_api_oversized_field_value_rejected():
    """Pydantic rejects oversized field strings (>2000 chars) with 422."""
    payload = {
        "field_name": "survey_number",
        "field_value": "A" * 2005,
        "confidence": 90.0,
    }
    resp = client.post("/ml/validate-field", json=payload)
    assert resp.status_code == 422


def test_api_oversized_batch_rejected():
    """Batch endpoint rejects batches with >100 fields with 422."""
    fields = [
        {"field_name": "survey_number", "field_value": f"100/{i}", "confidence": 90.0}
        for i in range(105)
    ]
    resp = client.post("/ml/validate-fields", json={"fields": fields})
    assert resp.status_code == 422


def test_api_empty_field_handling():
    """Empty field values are accepted and safely flagged as NEEDS_REVIEW."""
    payload = {
        "field_name": "patta_number",
        "field_value": "",
        "confidence": 0.0,
    }
    resp = client.post("/ml/validate-field", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["review_classification"] == "NEEDS_REVIEW"
    assert any("empty" in r.lower() for r in data["review_reasons"])


def test_api_authentication_enforcement(monkeypatch):
    """When OCR_API_KEY is configured, protected endpoints must enforce valid API key."""
    import app.main as main_module
    monkeypatch.setattr(main_module, "OCR_API_KEY", "prod-secret-key-999")

    payload = {
        "field_name": "survey_number",
        "field_value": "124/3",
        "confidence": 95.0,
    }

    # 1. Unauthenticated request rejected with 401
    resp_no_auth = client.post("/ml/validate-field", json=payload)
    assert resp_no_auth.status_code == 401

    # 2. Invalid key rejected with 401
    resp_bad_auth = client.post(
        "/ml/validate-field",
        json=payload,
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert resp_bad_auth.status_code == 401

    # 3. Valid Bearer token accepted with 200
    resp_good_auth = client.post(
        "/ml/validate-field",
        json=payload,
        headers={"Authorization": "Bearer prod-secret-key-999"},
    )
    assert resp_good_auth.status_code == 200

    # 4. Valid X-API-Key accepted with 200
    resp_good_header = client.post(
        "/ml/validate-field",
        json=payload,
        headers={"X-API-Key": "prod-secret-key-999"},
    )
    assert resp_good_header.status_code == 200

    # 5. Health and Ready endpoints remain accessible without auth and expose no secret
    resp_health = client.get("/health")
    assert resp_health.status_code == 200
    assert resp_health.json()["auth_configured"] is True
    assert "prod-secret-key-999" not in resp_health.text


if __name__ == "__main__":
    pytest.main(["-v", __file__])
