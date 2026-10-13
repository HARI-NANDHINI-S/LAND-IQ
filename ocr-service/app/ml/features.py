"""
LAND-IQ Machine Learning Feature Pipeline
Feature engineering and normalization for Land Record Anomaly & Review Priority Classifier.
"""

from typing import Dict, Any, List, Optional
import numpy as np
from pydantic import BaseModel, Field

FEATURE_NAMES = [
    "ocr_avg_confidence",
    "ocr_min_confidence",
    "missing_fields_count",
    "duplicate_similarity_score",
    "identifier_syntax_mismatch",
    "area_outlier_score",
    "document_type_encoded",
    "page_count",
    "text_density_ratio",
]

DOC_TYPE_MAPPING = {
    "PATTA": 0,
    "SALE_DEED": 1,
    "CHITTA": 2,
    "REVENUE_RECORD": 3,
    "ENCUMBRANCE_CERTIFICATE": 4,
    "OTHER": 5,
}

PRIORITY_CLASSES = ["LOW", "MEDIUM", "HIGH"]
CLASS_TO_INT = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}
INT_TO_CLASS = {0: "LOW", 1: "MEDIUM", 2: "HIGH"}


class RecordFeaturesInput(BaseModel):
    ocr_avg_confidence: float = Field(default=85.0, ge=0.0, le=100.0, description="Average OCR confidence percentage")
    ocr_min_confidence: float = Field(default=75.0, ge=0.0, le=100.0, description="Minimum field confidence percentage")
    missing_fields_count: int = Field(default=0, ge=0, le=10, description="Count of missing required fields")
    duplicate_similarity_score: float = Field(default=0.0, ge=0.0, le=1.0, description="Similarity score against existing registry")
    identifier_syntax_mismatch: int = Field(default=0, ge=0, le=1, description="1 if survey/patta syntax is irregular, 0 otherwise")
    area_outlier_score: float = Field(default=0.0, ge=0.0, le=5.0, description="Z-score or degree of area outlier deviation")
    document_type: str = Field(default="PATTA", description="Document type: PATTA, SALE_DEED, CHITTA, REVENUE_RECORD, etc.")
    page_count: int = Field(default=1, ge=1, le=50, description="Document page count")
    text_density_ratio: float = Field(default=1.0, ge=0.0, le=10.0, description="Extracted word density ratio")


def extract_feature_vector(input_data: RecordFeaturesInput) -> np.ndarray:
    """
    Transforms structured input features into a clean numeric vector for model ingestion.
    Safely validates bounds and missing values.
    """
    doc_type_code = DOC_TYPE_MAPPING.get(input_data.document_type.upper().strip(), DOC_TYPE_MAPPING["OTHER"])

    # Vector in exact order matching FEATURE_NAMES
    features = [
        float(input_data.ocr_avg_confidence),
        float(input_data.ocr_min_confidence),
        float(input_data.missing_fields_count),
        float(input_data.duplicate_similarity_score),
        float(input_data.identifier_syntax_mismatch),
        float(input_data.area_outlier_score),
        float(doc_type_code),
        float(input_data.page_count),
        float(input_data.text_density_ratio),
    ]

    return np.array(features, dtype=np.float32).reshape(1, -1)


def generate_factor_explanations(input_data: RecordFeaturesInput, predicted_priority: str, anomaly_score: float) -> List[str]:
    """
    Generates explainable human-readable factors for why a record was flagged for review priority.
    """
    factors = []

    if input_data.ocr_min_confidence < 60.0:
        factors.append(f"Low OCR confidence ({input_data.ocr_min_confidence:.1f}%) detected on one or more extracted fields")
    elif input_data.ocr_avg_confidence < 70.0:
        factors.append(f"Sub-optimal overall OCR legibility (average confidence {input_data.ocr_avg_confidence:.1f}%)")

    if input_data.missing_fields_count > 0:
        factors.append(f"{input_data.missing_fields_count} mandatory land record field(s) were missing or unextracted")

    if input_data.duplicate_similarity_score >= 0.75:
        factors.append(f"High duplicate match probability ({input_data.duplicate_similarity_score * 100:.1f}%) against existing land registry")
    elif input_data.duplicate_similarity_score >= 0.40:
        factors.append(f"Potential partial overlap detected ({input_data.duplicate_similarity_score * 100:.1f}%) with registered parcel")

    if input_data.identifier_syntax_mismatch == 1:
        factors.append("Survey / Patta identifier format does not conform to standard revenue patterns")

    if input_data.area_outlier_score >= 2.0:
        factors.append(f"Land area deviates significantly from typical cadastral parcel bounds (outlier index {input_data.area_outlier_score:.1f})")

    if not factors:
        if predicted_priority == "LOW":
            factors.append("All primary verification indicators and OCR confidence metrics are within nominal ranges")
        else:
            factors.append(f"Cumulative secondary risk indicators evaluated to {predicted_priority} priority")

    return factors
