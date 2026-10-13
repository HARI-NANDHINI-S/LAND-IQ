"""
LAND-IQ Machine Learning Inference Service
Provides documented inference for Land Record Anomaly & Review Priority Classifier.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
import joblib
import numpy as np

from app.ml.features import (
    RecordFeaturesInput,
    extract_feature_vector,
    generate_factor_explanations,
    INT_TO_CLASS,
    PRIORITY_CLASSES,
)

logger = logging.getLogger("landiq.ml")

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(CURRENT_DIR, "models")
MODEL_PATH = os.path.join(MODELS_DIR, "anomaly_classifier.joblib")
METADATA_PATH = os.path.join(MODELS_DIR, "model_metadata.json")

_model = None
_metadata = None


def load_model_artifacts():
    global _model, _metadata
    if _model is not None:
        return _model, _metadata

    if not os.path.exists(MODEL_PATH) or not os.path.exists(METADATA_PATH):
        logger.warning("ML model artifacts not found on disk. Ensure train.py has been executed.")
        return None, None

    try:
        _model = joblib.load(MODEL_PATH)
        with open(METADATA_PATH, "r", encoding="utf-8") as f:
            _metadata = json.load(f)
        logger.info(f"Loaded ML model: {_metadata.get('model_version')}")
    except Exception as e:
        logger.error(f"Failed to load ML model artifacts: {e}", exc_info=True)
        _model = None
        _metadata = None

    return _model, _metadata


def get_model_info() -> Dict[str, Any]:
    """
    Returns public architecture, metrics, and safeguard metadata for the deployed ML model.
    """
    _, metadata = load_model_artifacts()
    if metadata:
        return metadata
    return {
        "status": "unavailable",
        "message": "Model artifacts not yet initialized.",
    }


def predict_review_priority(input_data: RecordFeaturesInput) -> Dict[str, Any]:
    """
    Executes inference for land record anomaly detection and human review prioritization.
    Returns structured priority class, anomaly score, explainable factors, and recommendation.
    """
    model, metadata = load_model_artifacts()

    if model is None:
        # Rule-based fallback when model is not available
        logger.warning("Using heuristic fallback for review priority inference.")
        is_high = (
            input_data.ocr_min_confidence < 50.0
            or input_data.missing_fields_count >= 2
            or input_data.duplicate_similarity_score >= 0.8
            or input_data.area_outlier_score >= 2.5
        )
        is_med = (
            input_data.ocr_avg_confidence < 70.0
            or input_data.missing_fields_count == 1
            or input_data.duplicate_similarity_score >= 0.4
            or input_data.identifier_syntax_mismatch == 1
        )
        priority = "HIGH" if is_high else ("MEDIUM" if is_med else "LOW")
        anomaly_score = 0.85 if is_high else (0.50 if is_med else 0.15)
        probs = {"LOW": 0.1 if is_high else 0.7, "MEDIUM": 0.2 if is_high else 0.2, "HIGH": 0.7 if is_high else 0.1}
        factors = generate_factor_explanations(input_data, priority, anomaly_score)
        return {
            "review_priority": priority,
            "anomaly_score": anomaly_score,
            "probabilities": probs,
            "contributing_factors": factors,
            "recommended_action": "Prioritize for manual verification officer review." if priority != "LOW" else "Nominal. Eligible for expedited officer sign-off.",
            "model_version": "heuristic-fallback-v1",
            "is_experimental": True,
            "safeguards_notice": "Classifier serves strictly to prioritize human review queues. Never independently determines legal outcomes.",
        }

    # Extract feature vector
    X = extract_feature_vector(input_data)

    # Model inference
    pred_class_idx = int(model.predict(X)[0])
    pred_priority = INT_TO_CLASS[pred_class_idx]
    probabilities = model.predict_proba(X)[0]

    probs_dict = {
        cls_name: float(prob)
        for cls_name, prob in zip(PRIORITY_CLASSES, probabilities)
    }

    # Continuous anomaly score (weighted combination of high and medium probability)
    # Range 0.0 to 1.0
    anomaly_score = float(probs_dict.get("HIGH", 0.0) * 1.0 + probs_dict.get("MEDIUM", 0.0) * 0.45)
    anomaly_score = round(min(max(anomaly_score, 0.0), 1.0), 4)

    # Explainable factors
    factors = generate_factor_explanations(input_data, pred_priority, anomaly_score)

    # Human-in-the-loop recommendation
    if pred_priority == "HIGH":
        action = "High anomaly probability. Route immediately to Senior Verification Officer and freeze automatic approval."
    elif pred_priority == "MEDIUM":
        action = "Moderate inconsistency detected. Secondary field verification recommended before patta issuance."
    else:
        action = "Nominal risk profile. Standard review workflow applies."

    return {
        "review_priority": pred_priority,
        "anomaly_score": anomaly_score,
        "probabilities": probs_dict,
        "contributing_factors": factors,
        "recommended_action": action,
        "model_version": metadata.get("model_version", "unknown"),
        "is_experimental": True,
        "safeguards_notice": (
            "Model-generated prioritization indicator. This prediction does not constitute legal proof "
            "of title or ownership, nor does it independently reject citizen submissions."
        ),
    }
