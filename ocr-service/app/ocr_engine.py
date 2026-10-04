from pathlib import Path
from typing import Any
import re

from paddleocr import PaddleOCR


class LandIQOCR:
    """
    Local OCR engine for LAND-IQ.

    PaddleOCR performs OCR locally.
    No external OCR API or API key is required.
    """

    def __init__(self):
        self.ocr = PaddleOCR(
            lang="en",
            device="cpu",
        )

    # ================================================================
    # OCR
    # ================================================================

    def process_image(
        self,
        image_path: str,
        page_number: int = 1,
    ) -> dict[str, Any]:

        image = str(Path(image_path).resolve())

        result = self.ocr.predict(image)

        text_lines: list[str] = []

        for page_result in result:
            if not page_result:
                continue

            data = page_result

            if hasattr(data, "json"):
                data = data.json

            if isinstance(data, str):
                import json
                data = json.loads(data)

            if isinstance(data, dict):
                res = data.get("res", data)

                texts = res.get("rec_texts", [])

                if texts:
                    text_lines.extend(
                        str(text).strip()
                        for text in texts
                        if str(text).strip()
                    )

        full_text = "\n".join(text_lines)

        return {
            "page_number": page_number,
            "text": full_text,
            "fields": self.extract_fields(full_text),
        }

    # ================================================================
    # TEXT NORMALIZATION
    # ================================================================

    @staticmethod
    def normalize_text(text: str) -> str:
        text = text.replace("\r", "\n")

        # Normalize OCR punctuation
        text = text.replace("–", "-")
        text = text.replace("—", "-")
        text = text.replace("−", "-")

        # Normalize whitespace while preserving line breaks
        text = re.sub(r"[ \t]+", " ", text)

        # Remove excessive blank lines
        text = re.sub(r"\n{2,}", "\n", text)

        return text.strip()

    @staticmethod
    def clean_value(value: str) -> str:
        value = value.strip()
        value = re.sub(r"\s+", " ", value)
        value = value.strip(" :-.,;")

        return value

    @staticmethod
    def make_field(
        value: str,
        confidence: float,
        evidence: str,
    ) -> dict[str, Any]:

        return {
            "value": value,
            "confidence": round(confidence, 2),
            "evidence": evidence.strip(),
        }

    # ================================================================
    # GENERIC FIELD SEARCH
    # ================================================================

    @staticmethod
    def search_field(
        text: str,
        patterns: list[str],
        confidence: float,
    ) -> dict[str, Any] | None:

        for pattern in patterns:

            match = re.search(
                pattern,
                text,
                flags=re.IGNORECASE,
            )

            if not match:
                continue

            value = LandIQOCR.clean_value(
                match.group(1)
            )

            if not value:
                continue

            return LandIQOCR.make_field(
                value=value,
                confidence=confidence,
                evidence=match.group(0),
            )

        return None

    # ================================================================
    # STATE NORMALIZATION
    # ================================================================

    @staticmethod
    def normalize_state(value: str) -> str:

        normalized = re.sub(
            r"\s+",
            " ",
            value.strip().lower(),
        )

        states = {
            "andhrapradesh": "Andhra Pradesh",
            "andhra pradesh": "Andhra Pradesh",
            "tamilnadu": "Tamil Nadu",
            "tamil nadu": "Tamil Nadu",
            "karnataka": "Karnataka",
            "kerala": "Kerala",
            "telangana": "Telangana",
        }

        return states.get(
            normalized,
            value.title(),
        )

    # ================================================================
    # DOCUMENT NUMBER
    # ================================================================

    @staticmethod
    def extract_document_number(
        text: str,
    ):

        return LandIQOCR.search_field(
            text,
            [
                r"\bland\s+ownership\s+right\s+document\s*(?:no|number)\s*[:.\-]?\s*([A-Za-z0-9\/\-\.]+)",

                r"\bownership\s+right\s+document\s*(?:no|number)\s*[:.\-]?\s*([A-Za-z0-9\/\-\.]+)",

                r"\bdocument\s*(?:no|number)\s*[:.\-]?\s*([A-Za-z0-9\/\-\.]+)",

                r"\bdoc\s*(?:no|number)\s*[:.\-]?\s*([A-Za-z0-9\/\-\.]+)",
            ],
            0.98,
        )

    # ================================================================
    # PATTA NUMBER
    # ================================================================

    @staticmethod
    def extract_patta_number(
        text: str,
    ):

        return LandIQOCR.search_field(
            text,
            [
                r"\bpatta\s*(?:no|number)\s*[:.\-]?\s*([A-Za-z0-9\/\-\.]+)",
            ],
            0.97,
        )

    # ================================================================
    # PATTADAR PASSBOOK NUMBER
    # ================================================================

    @staticmethod
    def extract_passbook_number(
        text: str,
    ):

        return LandIQOCR.search_field(
            text,
            [
                r"\bpattadar\s+passbook\s*(?:no|number)\s*[:.\-]?\s*([A-Za-z0-9\/\-\.]+)",

                r"\bpassbook\s*(?:no|number)\s*[:.\-]?\s*([A-Za-z0-9\/\-\.]+)",
            ],
            0.97,
        )

    # ================================================================
    # SURVEY NUMBER
    # ================================================================

    @staticmethod
    def extract_survey_number(
        text: str,
    ):

        return LandIQOCR.search_field(
            text,
            [
                r"\bsurvey\s*(?:no|number)\s*[:.\-]?\s*([A-Za-z0-9\/\-\.]+)",

                r"\bsurvey\s*id\s*[:.\-]?\s*([A-Za-z0-9\/\-\.]+)",

                r"\bs\.?\s*no\.?\s*[:.\-]?\s*([A-Za-z0-9\/\-\.]+)",

                r"\bs\.?\s*number\s*[:.\-]?\s*([A-Za-z0-9\/\-\.]+)",
            ],
            0.95,
        )

    # ================================================================
    # DOCUMENT DATE
    # ================================================================

    @staticmethod
    def extract_date(
        text: str,
    ):

        patterns = [
            # Date: 26.6.2015
            # Date.26.6.2015
            # Date-26/06/2015
            # Date 26-06-2015
            r"date\s*[:.\-]?\s*(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4})",

            # Fallback for a standalone date
            r"\b(\d{1,2}[./\-]\d{1,2}[./\-]\d{4})\b",
        ]

        for pattern in patterns:

            match = re.search(
                pattern,
                text,
                flags=re.IGNORECASE,
            )

            if match:

                return LandIQOCR.make_field(
                    value=match.group(1),
                    confidence=0.96,
                    evidence=match.group(0),
                )

        return None

    # ================================================================
    # STATE
    # ================================================================

    @staticmethod
    def extract_state(
        text: str,
    ):

        patterns = [
            r"\bANDHRA\s*PRADESH\b",
            r"\bTAMIL\s*NADU\b",
            r"\bKARNATAKA\b",
            r"\bKERALA\b",
            r"\bTELANGANA\b",
        ]

        for pattern in patterns:

            match = re.search(
                pattern,
                text,
                flags=re.IGNORECASE,
            )

            if match:

                state = LandIQOCR.normalize_state(
                    match.group(0)
                )

                return LandIQOCR.make_field(
                    value=state,
                    confidence=0.99,
                    evidence=match.group(0),
                )

        return None

    # ================================================================
    # DISTRICT
    # ================================================================

    @staticmethod
    def extract_district(
        text: str,
    ):

        return LandIQOCR.search_field(
            text,
            [
                r"\bdistrict\s*[:.\-]\s*([A-Za-z][A-Za-z .'\-]{2,80})",

                r"\bdistrict\s+of\s+([A-Za-z][A-Za-z .'\-]{2,80})",

                r"\bdist\.?\s*[:.\-]\s*([A-Za-z][A-Za-z .'\-]{2,80})",
            ],
            0.90,
        )

    # ================================================================
    # TALUK
    # ================================================================

    @staticmethod
    def extract_taluk(
        text: str,
    ):

        return LandIQOCR.search_field(
            text,
            [
                r"\btaluk\s*[:.\-]\s*([A-Za-z][A-Za-z .'\-]{2,80})",

                r"\btaluka\s*[:.\-]\s*([A-Za-z][A-Za-z .'\-]{2,80})",

                r"\btaluk\s+of\s+([A-Za-z][A-Za-z .'\-]{2,80})",
            ],
            0.90,
        )

    # ================================================================
    # MANDAL
    # ================================================================

    @staticmethod
    def extract_mandal(
        text: str,
    ):

        return LandIQOCR.search_field(
            text,
            [
                r"\bmandal\s*[:.\-]\s*([A-Za-z][A-Za-z .'\-]{2,80})",

                r"\bmandal\s+of\s+([A-Za-z][A-Za-z .'\-]{2,80})",
            ],
            0.90,
        )

    # ================================================================
    # VILLAGE
    # ================================================================

    @staticmethod
    def extract_village(
        text: str,
    ):

        return LandIQOCR.search_field(
            text,
            [
                r"\bvillage\s*[:.\-]\s*([A-Za-z][A-Za-z .'\-]{2,80})",

                r"\bvillage\s+of\s+([A-Za-z][A-Za-z .'\-]{2,80})",
            ],
            0.90,
        )

    # ================================================================
    # EXTENT / AREA
    # ================================================================

    @staticmethod
    def extract_extent(
        text: str,
    ):

        return LandIQOCR.search_field(
            text,
            [
                r"\bextent\s*[:.\-]?\s*([0-9][0-9,.\s]*(?:acres?|hectares?|ha|cents?|sq\.?\s*ft|sq\.?\s*feet))",

                r"\barea\s*[:.\-]?\s*([0-9][0-9,.\s]*(?:acres?|hectares?|ha|cents?|sq\.?\s*ft|sq\.?\s*feet))",

                r"\bland\s+extent\s*[:.\-]?\s*([0-9][0-9,.\s]*(?:acres?|hectares?|ha|cents?|sq\.?\s*ft|sq\.?\s*feet))",
            ],
            0.92,
        )

    # ================================================================
    # OWNER NAME
    #
    # IMPORTANT:
    # Do NOT use generic "owner:" matching.
    #
    # Otherwise:
    # "Ownership Right Document"
    # can incorrectly become an owner name.
    # ================================================================

    @staticmethod
    def extract_owner(
        text: str,
    ):

        return LandIQOCR.search_field(
            text,
            [
                r"\bowner\s+name\s*[:.\-]\s*([A-Za-z][A-Za-z .'\-]{2,100})",

                r"\bname\s+of\s+owner\s*[:.\-]\s*([A-Za-z][A-Za-z .'\-]{2,100})",

                r"\bregistered\s+owner\s*[:.\-]\s*([A-Za-z][A-Za-z .'\-]{2,100})",
            ],
            0.90,
        )

    # ================================================================
    # PATTADAR NAME
    #
    # IMPORTANT:
    # Do NOT use generic "pattadar:" matching.
    #
    # Otherwise:
    # "Pattadar Passbook Land Ownership..."
    # can become a false pattadar name.
    # ================================================================

    @staticmethod
    def extract_pattadar(
        text: str,
    ):

        return LandIQOCR.search_field(
            text,
            [
                r"\bpattadar\s+name\s*[:.\-]\s*([A-Za-z][A-Za-z .'\-]{2,100})",

                r"\bpattadar\s+holder\s*[:.\-]\s*([A-Za-z][A-Za-z .'\-]{2,100})",
            ],
            0.90,
        )

    # ================================================================
    # MAIN FIELD EXTRACTION
    # ================================================================

    @staticmethod
    def extract_fields(
        text: str,
    ) -> dict[str, Any]:

        text = LandIQOCR.normalize_text(text)

        fields: dict[str, Any] = {}

        # ------------------------------------------------------------
        # DOCUMENT IDENTIFICATION
        # ------------------------------------------------------------

        document_number = (
            LandIQOCR.extract_document_number(text)
        )

        if document_number:
            fields["document_number"] = document_number

        patta_number = (
            LandIQOCR.extract_patta_number(text)
        )

        if patta_number:
            fields["patta_number"] = patta_number

        passbook_number = (
            LandIQOCR.extract_passbook_number(text)
        )

        if passbook_number:
            fields["pattadar_passbook_number"] = (
                passbook_number
            )

        survey_number = (
            LandIQOCR.extract_survey_number(text)
        )

        if survey_number:
            fields["survey_number"] = survey_number

        # ------------------------------------------------------------
        # DATE
        # ------------------------------------------------------------

        document_date = (
            LandIQOCR.extract_date(text)
        )

        if document_date:
            fields["document_date"] = document_date

        # ------------------------------------------------------------
        # STATE
        # ------------------------------------------------------------

        state = (
            LandIQOCR.extract_state(text)
        )

        if state:
            fields["state"] = state

        # ------------------------------------------------------------
        # DISTRICT
        # ------------------------------------------------------------

        district = (
            LandIQOCR.extract_district(text)
        )

        if district:
            fields["district"] = district

        # ------------------------------------------------------------
        # TALUK
        # ------------------------------------------------------------

        taluk = (
            LandIQOCR.extract_taluk(text)
        )

        if taluk:
            fields["taluk"] = taluk

        # ------------------------------------------------------------
        # MANDAL
        # ------------------------------------------------------------

        mandal = (
            LandIQOCR.extract_mandal(text)
        )

        if mandal:
            fields["mandal"] = mandal

        # ------------------------------------------------------------
        # VILLAGE
        # ------------------------------------------------------------

        village = (
            LandIQOCR.extract_village(text)
        )

        if village:
            fields["village"] = village

        # ------------------------------------------------------------
        # EXTENT / AREA
        # ------------------------------------------------------------

        extent = (
            LandIQOCR.extract_extent(text)
        )

        if extent:
            fields["extent"] = extent

        # ------------------------------------------------------------
        # OWNER
        # ------------------------------------------------------------

        owner = (
            LandIQOCR.extract_owner(text)
        )

        if owner:
            fields["owner_name"] = owner

        # ------------------------------------------------------------
        # PATTADAR
        # ------------------------------------------------------------

        pattadar = (
            LandIQOCR.extract_pattadar(text)
        )

        if pattadar:
            fields["pattadar_name"] = pattadar

        return fields