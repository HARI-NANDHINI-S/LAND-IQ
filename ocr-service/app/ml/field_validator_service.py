"""
LAND-IQ OCR Field Validator Inference Service
Provides field error detection, review classification, explainability,
and candidate correction generation.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
import joblib
import numpy as np
from pydantic import BaseModel, Field

from app.ml.field_features import (
    FIELD_FEATURE_NAMES,
    TARGET_LABELS,
    INT_TO_LABEL,
    extract_field_feature_dict,
    extract_field_feature_vector,
    generate_field_review_reasons,
)
from app.ml.candidate_corrections import suggest_correction

logger = logging.getLogger("landiq.ml.field_validator")

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(CURRENT_DIR, "models")
MODEL_PATH = os.path.join(MODELS_DIR, "ocr_field_validator.joblib")
METADATA_PATH = os.path.join(MODELS_DIR, "field_validator_metadata.json")

_validator_model = None
_validator_metadata = None


class SingleFieldValidationInput(BaseModel):
    field_name: str = Field(max_length=100, description="Name of the field, e.g. survey_number, patta_number, extent")
    field_value: str = Field(default="", max_length=2000, description="Original OCR extracted value")
    confidence: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="OCR confidence score percentage")
    field_id: Optional[str] = Field(default=None, max_length=100, description="Optional extracted field database UUID")


class BatchFieldValidationInput(BaseModel):
    fields: List[SingleFieldValidationInput] = Field(default_factory=list, max_length=100, description="Array of fields to evaluate (max 100 per request)")


def load_field_validator_artifacts():
    """Loads the trained Random Forest model and metadata from disk."""
    global _validator_model, _validator_metadata
    if _validator_model is not None:
        return _validator_model, _validator_metadata

    if not os.path.exists(MODEL_PATH) or not os.path.exists(METADATA_PATH):
        logger.warning(f"Field validator model not found on disk at {MODEL_PATH}. Heuristic fallback will be used.")
        return None, None

    try:
        _validator_model = joblib.load(MODEL_PATH)
        with open(METADATA_PATH, "r", encoding="utf-8") as f:
            _validator_metadata = json.load(f)
        logger.info(f"Loaded OCR Field Validator model: {_validator_metadata.get('model_version')}")
    except Exception as e:
        logger.error(f"Failed to load field validator artifacts: {e}", exc_info=True)
        _validator_model = None
        _validator_metadata = None

    return _validator_model, _validator_metadata


def get_field_validator_info() -> Dict[str, Any]:
    """Returns architecture, training metrics, and safeguard disclosures for the field validator."""
    _, metadata = load_field_validator_artifacts()
    if metadata:
        return metadata
    return {
        "status": "unavailable",
        "message": "Model artifacts not yet trained or initialized. Using domain heuristic safeguards.",
    }


def validate_single_field(input_data: SingleFieldValidationInput) -> Dict[str, Any]:
    """
    Evaluates an extracted field, predicting LIKELY_CORRECT vs NEEDS_REVIEW.
    Includes contributing reasons and evidence-backed candidate correction.
    """
    model, metadata = load_field_validator_artifacts()
    features = extract_field_feature_dict(
        field_name=input_data.field_name,
        field_value=input_data.field_value,
        confidence=input_data.confidence if input_data.confidence is not None else 80.0,
    )

    # Heuristic fallback if model not loaded
    if model is None:
        is_review = (
            (input_data.confidence is not None and input_data.confidence < 72.0)
            or features["format_pattern_match"] == 0.0
            or features["has_ocr_confusion_chars"] == 1.0
            or features["is_empty_or_whitespace"] == 1.0
        )
        pred_label = "NEEDS_REVIEW" if is_review else "LIKELY_CORRECT"
        model_version = "heuristic-field-validator-fallback-v1"
        prob = 0.85 if is_review else 0.15
    else:
        # Vector in exact order matching FIELD_FEATURE_NAMES
        vec = np.array([features[k] for k in FIELD_FEATURE_NAMES], dtype=np.float32).reshape(1, -1)
        pred_idx = int(model.predict(vec)[0])
        pred_label = INT_TO_LABEL.get(pred_idx, "NEEDS_REVIEW")
        probs = model.predict_proba(vec)[0]
        prob = float(probs[1]) if len(probs) > 1 else (1.0 if pred_label == "NEEDS_REVIEW" else 0.0)
        model_version = metadata.get("model_version", "landiq-ocr-field-validator-v1.0.0")

        # Domain verification guardrails:
        # Severe syntax violations (e.g. invalid calendar dates like 99/99/2026, empty fields, or confusion chars)
        # must always prompt human verification officer attention regardless of optical confidence score
        if features["format_pattern_match"] == 0.0 or features["is_empty_or_whitespace"] == 1.0:
            pred_label = "NEEDS_REVIEW"
            prob = max(prob, 0.95)
        elif features["has_ocr_confusion_chars"] == 1.0 and prob < 0.60:
            pred_label = "NEEDS_REVIEW"
            prob = max(prob, 0.75)

    reasons: List[str] = []
    if pred_label == "NEEDS_REVIEW":
        reasons = generate_field_review_reasons(
            field_name=input_data.field_name,
            field_value=input_data.field_value,
            confidence=input_data.confidence,
            features=features,
        )

    # Candidate correction generation (completely isolated from classification)
    suggested_val, rationale = suggest_correction(input_data.field_name, input_data.field_value)

    return {
        "field_id": input_data.field_id,
        "field_name": input_data.field_name,
        "original_value": input_data.field_value,
        "review_classification": pred_label,
        "review_priority_score": round(prob, 4),
        "confidence_score": input_data.confidence,
        "review_reasons": reasons,
        "suggested_correction": suggested_val,
        "correction_rationale": rationale,
        "model_version": model_version,
        "is_experimental": True,
        "safeguards_notice": (
            "Field error predictions assist reviewer focus and verification queues. "
            "All cadastral modifications require explicit human officer approval."
        ),
    }


def validate_batch_fields(fields: List[SingleFieldValidationInput]) -> List[Dict[str, Any]]:
    """Batch evaluation for a document's extracted fields."""
    return [validate_single_field(f) for f in fields]
