"""
LAND-IQ Isolated Candidate Correction Generator
Generates evidence-backed candidate suggestions for OCR-extracted fields requiring review.

IMPORTANT ETHICAL & ARCHITECTURAL SAFEGUARDS:
1. This module is completely decoupled and isolated from the classification model.
2. It NEVER hallucinates or invents arbitrary legal identifiers.
3. Candidate suggestions are offered ONLY when deterministic optical/typographical rules apply.
4. Suggestions NEVER automatically alter stored database records. All final changes require authorized human review.
"""

import re
from typing import Optional, Tuple


def suggest_correction(field_name: str, field_value: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Returns (suggested_value, correction_rationale) if a reliable correction is available,
    otherwise (None, None).
    """
    val = (field_value or "").strip()
    if not val:
        return None, None

    norm_field = field_name.lower().strip()

    # -------------------------------------------------------------------------
    # 1. Survey Number Corrections
    # -------------------------------------------------------------------------
    if norm_field == "survey_number":
        # Handle O/0 confusion in survey denominator or numerator, e.g. 142/3O -> 142/30
        if re.search(r"\d+\/\d*[Oo]+", val):
            corrected = re.sub(r"(\d+\/\d*)[Oo]+", lambda m: m.group(1) + "0", val)
            if corrected != val:
                return corrected, "Corrected optical character confusion: replaced letter 'O' with digit '0' in survey number."

        # Handle 'l' or 'I' instead of '1'
        if re.search(r"^[Il|]\d+", val):
            corrected = "1" + val[1:]
            return corrected, "Corrected optical character confusion: replaced letter 'l'/'I' with digit '1' at start of survey number."

        # Normalize space around slashes: "142 / 3B" -> "142/3B"
        if re.search(r"\d+\s*[\/-]\s*[0-9A-Za-z]+", val):
            corrected = re.sub(r"\s*[\/-]\s*", "/", val)
            if corrected != val:
                return corrected, "Standardized cadastral sub-division format: normalized spacing around '/'."

    # -------------------------------------------------------------------------
    # 2. Patta Number Corrections
    # -------------------------------------------------------------------------
    if norm_field == "patta_number":
        # e.g. PAT-2OO4 -> PAT-2004
        if re.search(r"^(PAT[-_ ]?)(\d*[Oo]+\d*)$", val, re.IGNORECASE):
            m = re.match(r"^(PAT[-_ ]?)(\d*[Oo]+\d*)$", val, re.IGNORECASE)
            if m:
                prefix = m.group(1).upper()
                body = m.group(2).replace("O", "0").replace("o", "0")
                return f"{prefix}{body}", "Corrected visual confusion 'O' -> '0' in patta registration number."

        # Pure numeric patta with O at end or middle, e.g. 452O -> 4520
        if re.match(r"^\d*[Oo]+\d*$", val):
            corrected = val.replace("O", "0").replace("o", "0")
            return corrected, "Corrected letter 'O' to digit '0' in patta number."

        # Leading l instead of 1, e.g. l029 -> 1029
        if re.match(r"^[Il|]\d+$", val):
            corrected = "1" + val[1:]
            return corrected, "Replaced optical scan letter 'l'/'I' with digit '1' in patta sequence."

    # -------------------------------------------------------------------------
    # 3. Document Date Corrections
    # -------------------------------------------------------------------------
    if norm_field == "document_date":
        # Optical confusion in dates: 26.O6.2O15 -> 26.06.2015
        if re.search(r"[OoIl|]", val) and re.search(r"\d", val):
            cleaned = val.replace("O", "0").replace("o", "0").replace("l", "1").replace("I", "1").replace("|", "1")
            m = re.match(r"^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$", cleaned)
            if m:
                d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
                if 1 <= d <= 31 and 1 <= mo <= 12:
                    return f"{d:02d}/{mo:02d}/{y}", "Repaired optical character confusion ('O'->'0', 'l'->'1') and standardized date format."

        # Normalize single-digit components: 26-6-2015 -> 26/06/2015
        m_std = re.match(r"^(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})$", val)
        if m_std:
            d, mo, y = int(m_std.group(1)), int(m_std.group(2)), int(m_std.group(3))
            if 1 <= d <= 31 and 1 <= mo <= 12:
                formatted = f"{d:02d}/{mo:02d}/{y}"
                if formatted != val:
                    return formatted, "Standardized date representation to DD/MM/YYYY."

    # -------------------------------------------------------------------------
    # 4. State Normalization
    # -------------------------------------------------------------------------
    if norm_field == "state":
        lookup = {
            "tamilnadu": "Tamil Nadu",
            "tamll nadu": "Tamil Nadu",
            "tamil nadu": "Tamil Nadu",
            "tamil_nadu": "Tamil Nadu",
            "karnatka": "Karnataka",
            "karnataka": "Karnataka",
            "andhrapradesh": "Andhra Pradesh",
            "andhra pradesh": "Andhra Pradesh",
            "telengana": "Telangana",
            "telangana": "Telangana",
            "kerala": "Kerala",
        }
        cleaned_state = re.sub(r"[_\s]+", " ", val.lower().strip())
        if cleaned_state in lookup and lookup[cleaned_state] != val:
            return lookup[cleaned_state], "Standardized state naming syntax to official gazetted format."

    # -------------------------------------------------------------------------
    # 5. Extent / Area Normalization
    # -------------------------------------------------------------------------
    if norm_field == "extent":
        # e.g. "2,50 Acres" -> "2.50 Acres"
        comma_sub = re.sub(r"(\d+),(\d+)", r"\1.\2", val)
        # e.g. "2.50Acres" -> "2.50 Acres"
        spaced = re.sub(r"(\d+)\s*([A-Za-z])", r"\1 \2", comma_sub).strip(" .:")
        if spaced != val:
            return spaced, "Cleaned punctuation and standardized spacing for land extent."

    # -------------------------------------------------------------------------
    # 6. Owner / Pattadar Name Artifact Removal
    # -------------------------------------------------------------------------
    if norm_field in ("owner_name", "pattadar_name"):
        # Leetspeak / digit intrusion: Ram3sh -> Ramesh, Kum4r -> Kumar, Palan1samy -> Palanisamy
        if re.search(r"[A-Za-z]\d[A-Za-z]", val):
            repaired = val
            repaired = re.sub(r"([A-Za-z])3([A-Za-z])", r"\1e\2", repaired)
            repaired = re.sub(r"([A-Za-z])4([A-Za-z])", r"\1a\2", repaired)
            repaired = re.sub(r"([A-Za-z])1([A-Za-z])", r"\1i\2", repaired)
            repaired = re.sub(r"([A-Za-z])0([A-Za-z])", r"\1o\2", repaired)
            if repaired != val:
                return repaired, "Removed intruding OCR digit artifacts from personal name string."

        # Strip dangling colon or label prefix: "Owner: Ramesh Kumar" -> "Ramesh Kumar"
        prefix_clean = re.sub(r"^(owner|pattadar|name)\s*[:.\-]\s*", "", val, flags=re.IGNORECASE).strip(" .:-")
        if prefix_clean != val and len(prefix_clean) >= 2:
            return prefix_clean, "Stripped redundant OCR label prefix from name field."

    # In all other cases, return None rather than guessing
    return None, None
