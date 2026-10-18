"""
LAND-IQ OCR Field Error Detection Feature Pipeline
Extracts structured numerical features from individual OCR-extracted fields.
Features are strictly computed from inference-time signals (field name, extracted value, OCR confidence)
without any access to private or ground-truth labels.
"""

import math
import re
from typing import Dict, Any, List, Optional
import numpy as np
from pydantic import BaseModel, Field

FIELD_TYPE_NAMES = [
    "survey_number",
    "patta_number",
    "document_number",
    "pattadar_passbook_number",
    "document_date",
    "state",
    "district",
    "taluk",
    "mandal",
    "village",
    "extent",
    "owner_name",
    "pattadar_name",
    "other",
]

FIELD_TYPE_TO_INT = {name: idx for idx, name in enumerate(FIELD_TYPE_NAMES)}
INT_TO_FIELD_TYPE = {idx: name for idx, name in enumerate(FIELD_TYPE_NAMES)}

FIELD_FEATURE_NAMES = [
    "ocr_confidence",
    "field_type_encoded",
    "char_length",
    "digit_ratio",
    "alpha_ratio",
    "special_char_ratio",
    "uppercase_ratio",
    "whitespace_ratio",
    "has_digit",
    "has_alpha",
    "has_special",
    "char_entropy",
    "format_pattern_match",
    "has_ocr_confusion_chars",
    "num_words",
    "is_empty_or_whitespace",
]

TARGET_LABELS = ["LIKELY_CORRECT", "NEEDS_REVIEW"]
LABEL_TO_INT = {"LIKELY_CORRECT": 0, "NEEDS_REVIEW": 1}
INT_TO_LABEL = {0: "LIKELY_CORRECT", 1: "NEEDS_REVIEW"}


class FieldInput(BaseModel):
    field_name: str = Field(description="Field name, e.g. survey_number, patta_number, document_date")
    field_value: str = Field(default="", description="OCR extracted string value")
    confidence: Optional[float] = Field(default=80.0, ge=0.0, le=100.0, description="OCR confidence score percentage")


def compute_char_entropy(text: str) -> float:
    """Computes Shannon character entropy as a measure of text disorder or corruption."""
    if not text:
        return 0.0
    freq: Dict[str, int] = {}
    for c in text:
        freq[c] = freq.get(c, 0) + 1
    total = len(text)
    entropy = 0.0
    for count in freq.values():
        p = count / total
        if p > 0:
            entropy -= p * math.log2(p)
    return round(entropy, 4)


def validate_format_pattern(field_type: str, val: str) -> float:
    """
    Evaluates whether the extracted string matches expected revenue and grammatical patterns.
    Returns 1.0 for valid domain syntax, 0.0 for severe mismatch.
    """
    cleaned = val.strip()
    if not cleaned:
        return 0.0

    field_type = field_type.lower().strip()

    # 1. Survey Number: e.g. 142/3B, 200/1A, 124/3, 55-2
    if field_type == "survey_number":
        # Must start with digit, optionally followed by / or - and alphanumeric sub-survey
        if re.match(r"^\d{1,5}(\s*[\/-]\s*[0-9A-Za-z]+)?$", cleaned):
            return 1.0
        return 0.0

    # 2. Patta Number: e.g. 4521, PAT-2024-001, 8812, PAT-2024/002
    if field_type == "patta_number":
        if re.match(r"^(PAT[-_\s]?)?\d{1,6}([-_\s/]\d{1,6})?[A-Za-z]?$", cleaned, re.IGNORECASE):
            return 1.0
        return 0.0

    # 3. Document Number: e.g. TN-COI-2024-001, DOC/2024/4512, 124/2023
    if field_type == "document_number":
        if len(cleaned) >= 3 and re.search(r"\d", cleaned) and re.match(r"^[A-Za-z0-9\/\-_. ]{3,35}$", cleaned):
            return 1.0
        return 0.0

    # 4. Pattadar Passbook Number: e.g. TNPB-2022-8172, PB-982341, 102948
    if field_type == "pattadar_passbook_number":
        if len(cleaned) >= 4 and re.search(r"\d", cleaned) and re.match(r"^[A-Za-z0-9\/\-_. ]{4,30}$", cleaned):
            return 1.0
        return 0.0

    # 5. Date: e.g. 26/06/2015, 14.08.2021, 2024-01-15
    if field_type == "document_date":
        # Check standard date formats
        m = re.match(r"^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$", cleaned)
        if m:
            d, month, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
            # Handle YYYY-MM-DD
            if d > 1900 and month <= 12 and y <= 31:
                return 1.0
            if (1 <= d <= 31) and (1 <= month <= 12) and (1900 <= y <= 2035 or y <= 99):
                return 1.0
            return 0.0
        return 0.0

    # 6. Extent: e.g. 2.50 Acres, 1.25 Hectares, 50 Cents, 2400 Sq.Ft
    if field_type == "extent":
        m = re.match(
            r"^\d+([.,]\d+)?\s*(acres?|hectares?|ha|cents?|sq\.?\s*ft|sq\.?\s*feet|gunthas?|ares?)$",
            cleaned,
            re.IGNORECASE,
        )
        return 1.0 if m else 0.0

    # 7. State: Validated against known state names
    if field_type == "state":
        known_states = {"tamil nadu", "karnataka", "andhra pradesh", "kerala", "telangana", "maharashtra"}
        return 1.0 if cleaned.lower() in known_states else 0.2

    # 8. District / Taluk / Mandal / Village: should be alphabetic with occasional dots/hyphens
    if field_type in ("district", "taluk", "mandal", "village"):
        if re.match(r"^[A-Za-z\s.'\-]{2,60}$", cleaned):
            return 1.0
        return 0.0

    # 9. Owner / Pattadar Name: Should be human name (letters, spaces, initials) without digits
    if field_type in ("owner_name", "pattadar_name"):
        if re.match(r"^[A-Za-z\s.'\-]{2,80}$", cleaned) and not re.search(r"\d", cleaned):
            return 1.0
        return 0.0

    # Fallback for other fields
    return 1.0 if len(cleaned) > 0 else 0.0


def check_ocr_confusion(field_type: str, val: str) -> int:
    """
    Detects classic optical character confusion artifacts:
    - Letter 'O' or 'o' occurring within a numeric token (e.g. '142/3O', 'PAT-2OO4')
    - Letter 'l' or 'I' or '|' substituted for digit 1
    - Letter 'S' substituted for digit 5 in numeric sequences
    - Digits appearing inside person names (e.g. 'Ram3sh Kumar')
    - Letters inside date strings (e.g. '26/O6/2O15')
    """
    cleaned = val.strip()
    if not cleaned:
        return 0

    field_type = field_type.lower().strip()

    # Digits in names
    if field_type in ("owner_name", "pattadar_name"):
        if re.search(r"\d", cleaned):
            return 1

    # Letters in dates
    if field_type == "document_date":
        if re.search(r"[a-zA-Z]", cleaned):
            return 1

    # Numeric/identifier confusion (O/0, l/1, S/5)
    if field_type in ("survey_number", "patta_number", "pattadar_passbook_number"):
        # e.g. 142/3O -> 'O' at end or between digits
        if re.search(r"\d[Oo]", cleaned) or re.search(r"[Oo]\d", cleaned) or re.search(r"\/\s*[Oo]", cleaned):
            return 1
        # 'l' or 'I' adjacent to digits or after slash
        if re.search(r"\d[Il|]", cleaned) or re.search(r"[Il|]\d", cleaned) or re.search(r"\/\s*[Il]", cleaned):
            return 1
        # 'S' directly adjacent to digits where 5 is expected
        if re.search(r"\d[Ss]\d", cleaned):
            return 1

    # General gibberish / repeated noise characters (e.g. '###', '???', '___')
    if re.search(r"[#@$^~`\\|]{2,}", cleaned):
        return 1

    return 0


def extract_field_feature_dict(
    field_name: str,
    field_value: str,
    confidence: Optional[float] = 80.0,
) -> Dict[str, float]:
    """
    Extracts all 16 feature values as a dictionary for transparency and logging.
    """
    val = (field_value or "").strip()
    norm_field = field_name.lower().strip()
    field_code = FIELD_TYPE_TO_INT.get(norm_field, FIELD_TYPE_TO_INT["other"])

    length = len(val)
    conf = float(confidence if confidence is not None else 80.0)
    conf = max(0.0, min(100.0, conf))

    if length == 0:
        return {
            "ocr_confidence": conf,
            "field_type_encoded": float(field_code),
            "char_length": 0.0,
            "digit_ratio": 0.0,
            "alpha_ratio": 0.0,
            "special_char_ratio": 0.0,
            "uppercase_ratio": 0.0,
            "whitespace_ratio": 0.0,
            "has_digit": 0.0,
            "has_alpha": 0.0,
            "has_special": 0.0,
            "char_entropy": 0.0,
            "format_pattern_match": 0.0,
            "has_ocr_confusion_chars": 0.0,
            "num_words": 0.0,
            "is_empty_or_whitespace": 1.0,
        }

    digits = sum(1 for c in val if c.isdigit())
    alphas = sum(1 for c in val if c.isalpha())
    uppers = sum(1 for c in val if c.isupper())
    spaces = sum(1 for c in val if c.isspace())
    specials = sum(1 for c in val if not c.isalnum() and not c.isspace())

    words = len(val.split())
    entropy = compute_char_entropy(val)
    pattern_match = validate_format_pattern(norm_field, val)
    confusion = float(check_ocr_confusion(norm_field, val))

    return {
        "ocr_confidence": conf,
        "field_type_encoded": float(field_code),
        "char_length": float(length),
        "digit_ratio": round(digits / length, 4),
        "alpha_ratio": round(alphas / length, 4),
        "special_char_ratio": round(specials / length, 4),
        "uppercase_ratio": round(uppers / length, 4),
        "whitespace_ratio": round(spaces / length, 4),
        "has_digit": 1.0 if digits > 0 else 0.0,
        "has_alpha": 1.0 if alphas > 0 else 0.0,
        "has_special": 1.0 if specials > 0 else 0.0,
        "char_entropy": entropy,
        "format_pattern_match": pattern_match,
        "has_ocr_confusion_chars": confusion,
        "num_words": float(words),
        "is_empty_or_whitespace": 0.0,
    }


def extract_field_feature_vector(
    field_name: str,
    field_value: str,
    confidence: Optional[float] = 80.0,
) -> np.ndarray:
    """Converts extracted features into a 1x16 float32 numpy array matching FIELD_FEATURE_NAMES."""
    feat_dict = extract_field_feature_dict(field_name, field_value, confidence)
    vec = [feat_dict[k] for k in FIELD_FEATURE_NAMES]
    return np.array(vec, dtype=np.float32).reshape(1, -1)


def generate_field_review_reasons(
    field_name: str,
    field_value: str,
    confidence: Optional[float],
    features: Dict[str, float],
) -> List[str]:
    """Generates precise explainable review reasons for why a field requires human attention."""
    reasons: List[str] = []
    val = (field_value or "").strip()
    norm_field = field_name.lower().strip()
    conf = features.get("ocr_confidence", 80.0)

    if not val:
        reasons.append("Field value is empty or unextracted by OCR.")
        return reasons

    if conf < 65.0:
        reasons.append(f"Low OCR confidence ({conf:.1f}%) indicates optical scanning degradation.")
    elif conf < 75.0:
        reasons.append(f"Sub-optimal OCR confidence ({conf:.1f}%).")

    if features.get("has_ocr_confusion_chars", 0.0) == 1.0:
        if norm_field in ("owner_name", "pattadar_name"):
            reasons.append("Numeric digit detected inside legal owner name string.")
        elif norm_field == "document_date":
            reasons.append("Alphabetical character detected within numeric date structure.")
        else:
            reasons.append("Suspicious character substitution detected (e.g., visual confusion between 'O' and '0', or 'l' and '1').")

    if features.get("format_pattern_match", 1.0) == 0.0:
        if norm_field == "survey_number":
            reasons.append("Survey identifier does not conform to standard cadastral format (expected digits optionally followed by / subdivision).")
        elif norm_field == "patta_number":
            reasons.append("Patta number does not match expected statutory revenue sequence.")
        elif norm_field == "document_date":
            reasons.append("Date format or calendar value is invalid (expected DD/MM/YYYY with valid calendar bounds).")
        elif norm_field == "extent":
            reasons.append("Land extent lacks a recognizable cadastral area unit (acres, hectares, cents, sq.ft).")
        else:
            reasons.append(f"Extracted format does not match typical {field_name.replace('_', ' ')} syntax.")

    if features.get("char_entropy", 0.0) > 3.8 and len(val) > 8:
        reasons.append("High character entropy indicates possible noisy or scrambled OCR text.")

    if not reasons:
        reasons.append("Borderline feature risk indicators warrant human officer review.")

    return reasons
