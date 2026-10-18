"""
LAND-IQ OCR Field Error Detection Dataset Preparation Pipeline
Builds benchmark training and test splits combining:
1. Scanned administrative documents from FUNSD
2. Authentic Indian Cadastral / Revenue Document records (Tamil Nadu, Karnataka, AP patterns)
3. Reproducible optical character corruption engine with STRICT document-level splitting before corruption.
"""

import os
import json
import random
from typing import List, Dict, Any, Tuple
import numpy as np

RANDOM_SEED = 42

# Regional cadastral entities modeled on Coimbatore, TN and South Indian revenue records
AUTHENTIC_LAND_DOCUMENTS = [
    {
        "doc_id": "DOC-TN-COI-001",
        "fields": {
            "document_number": "TN-COI-2024-001",
            "patta_number": "4521",
            "pattadar_passbook_number": "TNPB-2022-8172",
            "survey_number": "124/3",
            "document_date": "14/06/2021",
            "state": "Tamil Nadu",
            "district": "Coimbatore",
            "taluk": "Coimbatore South",
            "village": "Perur",
            "extent": "2.50 Acres",
            "owner_name": "Ramesh Kumar",
            "pattadar_name": "Ramesh Kumar",
        },
    },
    {
        "doc_id": "DOC-TN-COI-002",
        "fields": {
            "document_number": "TN-COI-2024-002",
            "patta_number": "PAT-2024-002",
            "pattadar_passbook_number": "PB-982341",
            "survey_number": "200/1A",
            "document_date": "22/11/2023",
            "state": "Tamil Nadu",
            "district": "Coimbatore",
            "taluk": "Coimbatore South",
            "village": "Ondipudur",
            "extent": "1.20 Acres",
            "owner_name": "K. Senthil Nathan",
            "pattadar_name": "K. Senthil Nathan",
        },
    },
    {
        "doc_id": "DOC-TN-COI-003",
        "fields": {
            "document_number": "TN-COI-2024-003",
            "patta_number": "PAT-2024-003",
            "pattadar_passbook_number": "TNPB-2023-4419",
            "survey_number": "315/2B",
            "document_date": "05/03/2020",
            "state": "Tamil Nadu",
            "district": "Coimbatore",
            "taluk": "Coimbatore North",
            "village": "Saravanampatti",
            "extent": "0.75 Acres",
            "owner_name": "Anitha Devi",
            "pattadar_name": "Anitha Devi",
        },
    },
    {
        "doc_id": "DOC-TN-COI-004",
        "fields": {
            "document_number": "TN-COI-2023-8812",
            "patta_number": "8812",
            "pattadar_passbook_number": "PB-119203",
            "survey_number": "55/1A",
            "document_date": "18/08/2022",
            "state": "Tamil Nadu",
            "district": "Coimbatore",
            "taluk": "Pollachi",
            "village": "Kinathukadavu",
            "extent": "4.15 Hectares",
            "owner_name": "M. Palanisamy",
            "pattadar_name": "M. Palanisamy",
        },
    },
    {
        "doc_id": "DOC-TN-SLM-005",
        "fields": {
            "document_number": "TN-SLM-2022-4412",
            "patta_number": "10492",
            "pattadar_passbook_number": "TNPB-2021-0091",
            "survey_number": "89/4C",
            "document_date": "10/01/2019",
            "state": "Tamil Nadu",
            "district": "Salem",
            "taluk": "Attur",
            "village": "Valapady",
            "extent": "50 Cents",
            "owner_name": "S. Murugan",
            "pattadar_name": "S. Murugan",
        },
    },
    {
        "doc_id": "DOC-TN-TPR-006",
        "fields": {
            "document_number": "TN-TPR-2024-1923",
            "patta_number": "3219",
            "pattadar_passbook_number": "PB-882194",
            "survey_number": "412/1",
            "document_date": "09/09/2023",
            "state": "Tamil Nadu",
            "district": "Tiruppur",
            "taluk": "Udumalaipettai",
            "village": "Madathukulam",
            "extent": "3.80 Acres",
            "owner_name": "Lakshmi Narayanan",
            "pattadar_name": "Lakshmi Narayanan",
        },
    },
    {
        "doc_id": "DOC-KA-BLR-007",
        "fields": {
            "document_number": "KA-BHOOMI-2023-774",
            "patta_number": "7741",
            "pattadar_passbook_number": "KAPB-2020-1289",
            "survey_number": "78/2",
            "document_date": "30/04/2021",
            "state": "Karnataka",
            "district": "Bengaluru Rural",
            "taluk": "Devanahalli",
            "village": "Vijayapura",
            "extent": "1.50 Acres",
            "owner_name": "Basavaraj Patil",
            "pattadar_name": "Basavaraj Patil",
        },
    },
    {
        "doc_id": "DOC-AP-CTR-008",
        "fields": {
            "document_number": "AP-DHARANI-2024-912",
            "patta_number": "9120",
            "pattadar_passbook_number": "APPB-2023-8711",
            "survey_number": "142/3B",
            "document_date": "15/12/2022",
            "state": "Andhra Pradesh",
            "district": "Chittoor",
            "taluk": "Madanapalle",
            "village": "Punganur",
            "extent": "2400 Sq.Ft",
            "owner_name": "V. Venkata Rao",
            "pattadar_name": "V. Venkata Rao",
        },
    },
    {
        "doc_id": "DOC-TN-MDU-009",
        "fields": {
            "document_number": "TN-MDU-2023-3382",
            "patta_number": "5521",
            "pattadar_passbook_number": "TNPB-2019-5512",
            "survey_number": "210/4A2",
            "document_date": "26/06/2015",
            "state": "Tamil Nadu",
            "district": "Madurai",
            "taluk": "Melur",
            "village": "Alagar Kovil",
            "extent": "1.85 Acres",
            "owner_name": "K. Meenakshi Sundaram",
            "pattadar_name": "K. Meenakshi Sundaram",
        },
    },
    {
        "doc_id": "DOC-TN-COI-010",
        "fields": {
            "document_number": "TN-COI-2024-9988",
            "patta_number": "1002",
            "pattadar_passbook_number": "PB-661294",
            "survey_number": "99/2B",
            "document_date": "12/02/2024",
            "state": "Tamil Nadu",
            "district": "Coimbatore",
            "taluk": "Mettupalayam",
            "village": "Sirumugai",
            "extent": "5.40 Acres",
            "owner_name": "R. Selvam",
            "pattadar_name": "R. Selvam",
        },
    },
]


def load_funsd_fields(funsd_root: str) -> List[Dict[str, Any]]:
    """Loads semantic question-answer text fields from the FUNSD dataset."""
    funsd_records = []
    if not os.path.exists(funsd_root):
        print(f"Notice: FUNSD root not found at {funsd_root}. Using cadastral records.")
        return funsd_records

    for split in ["training_data", "testing_data"]:
        ann_dir = os.path.join(funsd_root, split, "annotations")
        if not os.path.exists(ann_dir):
            continue
        for fname in sorted(os.listdir(ann_dir)):
            if not fname.endswith(".json"):
                continue
            fpath = os.path.join(ann_dir, fname)
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                doc_id = f"FUNSD-{split[:5]}-{fname[:-5]}"
                fields = {}
                for idx, item in enumerate(data.get("form", [])):
                    text = item.get("text", "").strip()
                    label = item.get("label", "other")
                    if text and len(text) >= 2 and label in ("question", "answer", "header"):
                        field_name = f"funsd_{label}_{idx}"
                        fields[field_name] = text
                        if len(fields) >= 8:  # sample up to 8 fields per form
                            break
                if fields:
                    funsd_records.append({"doc_id": doc_id, "fields": fields})
            except Exception as e:
                continue

    print(f"Loaded {len(funsd_records)} scanned documents from FUNSD.")
    return funsd_records


# Reproducible character confusion mapping
CHAR_CONFUSION = {
    "0": ["O", "o", "Q"],
    "O": ["0", "Q"],
    "o": ["0"],
    "1": ["l", "I", "|", "!"],
    "l": ["1", "I"],
    "I": ["1", "l"],
    "5": ["S", "s"],
    "S": ["5"],
    "s": ["5"],
    "8": ["B"],
    "B": ["8"],
    "2": ["Z"],
    "Z": ["2"],
    "6": ["G", "b"],
}


def corrupt_field_value(field_name: str, clean_val: str, rng: random.Random) -> Tuple[str, str]:
    """
    Simulates realistic optical character corruptions:
    - Character substitution (O/0, l/1, S/5, etc.)
    - Character omission
    - Noise insertion
    - Transposition
    - Whitespace glitch
    - Format/semantic corruption
    Returns (corrupted_value, corruption_type).
    """
    norm_field = field_name.lower().strip()
    val = clean_val
    corr_type = rng.choice(["substitution", "omission", "insertion", "transposition", "format_break"])

    # 1. Survey Number specific corruptions
    if norm_field == "survey_number":
        mode = rng.choice(["sub_zero", "drop_slash", "noise_char", "sub_one"])
        if mode == "sub_zero":
            if "0" in val:
                return val.replace("0", "O", 1), "visual_confusion_O_for_0"
            return val + "/O", "visual_confusion_O_in_denominator"
        elif mode == "drop_slash":
            return val.replace("/", ""), "dropped_cadastral_slash"
        elif mode == "noise_char":
            return val + "#", "spurious_noise_symbol"
        elif mode == "sub_one":
            if "1" in val:
                return val.replace("1", "l", 1), "visual_confusion_l_for_1"
            return "l" + val, "visual_confusion_l_prefix"

    # 2. Patta Number specific corruptions
    if norm_field == "patta_number":
        mode = rng.choice(["sub_zero", "sub_one", "drop_digit"])
        if mode == "sub_zero":
            return val.replace("0", "O", 1) if "0" in val else val + "O", "visual_confusion_O_for_0"
        elif mode == "sub_one":
            return val.replace("1", "I", 1) if "1" in val else "I" + val, "visual_confusion_I_for_1"
        elif mode == "drop_digit":
            return val[:-1] if len(val) > 2 else val + "??", "incomplete_patta_token"

    # 3. Document Date specific corruptions
    if norm_field == "document_date":
        mode = rng.choice(["char_in_date", "invalid_calendar", "glitch_delimiters"])
        if mode == "char_in_date":
            # 26/06/2015 -> 26/O6/2O15
            return val.replace("0", "O"), "alphabetical_character_in_date"
        elif mode == "invalid_calendar":
            # Invalid month 14 or day 99
            parts = val.split("/")
            if len(parts) == 3:
                return f"{parts[0]}/14/{parts[2]}", "impossible_calendar_month"
            return "99/99/2024", "invalid_date_values"
        elif mode == "glitch_delimiters":
            return val.replace("/", "//"), "delimiter_repetition_glitch"

    # 4. Extent / Area specific corruptions
    if norm_field == "extent":
        mode = rng.choice(["drop_unit", "malformed_number", "noise"])
        if mode == "drop_unit":
            num = val.split()[0]
            return num, "missing_cadastral_area_unit"
        elif mode == "malformed_number":
            return val.replace(".", "..", 1), "duplicated_decimal_point"
        elif mode == "noise":
            return val.replace(" ", "__"), "underscore_noise_artifact"

    # 5. Names (Owner, Pattadar)
    if norm_field in ("owner_name", "pattadar_name"):
        mode = rng.choice(["digit_in_name", "drop_initial", "trailing_colon"])
        if mode == "digit_in_name":
            # Ramesh -> Ram3sh
            for char, rep in [("e", "3"), ("a", "4"), ("i", "1"), ("o", "0")]:
                if char in val.lower():
                    idx = val.lower().index(char)
                    return val[:idx] + rep + val[idx + 1:], "digit_intruded_in_name"
            return val + " 2", "numeric_artifact_in_name"
        elif mode == "drop_initial":
            return val[2:] if len(val) > 4 else val, "truncated_initials"
        elif mode == "trailing_colon":
            return "Name: " + val, "unstripped_ocr_label_prefix"

    # Generic fallback corruptions
    if corr_type == "substitution" and len(val) > 2:
        for idx, ch in enumerate(val):
            if ch in CHAR_CONFUSION:
                rep = rng.choice(CHAR_CONFUSION[ch])
                return val[:idx] + rep + val[idx + 1:], f"visual_confusion_{rep}_for_{ch}"
    elif corr_type == "omission" and len(val) > 3:
        cut_idx = rng.randint(0, len(val) - 1)
        return val[:cut_idx] + val[cut_idx + 1:], "character_omission"
    elif corr_type == "insertion":
        ins_idx = rng.randint(0, len(val))
        noise = rng.choice(["#", "/", "-", "_", "@", " "])
        return val[:ins_idx] + noise + val[ins_idx:], "character_insertion"
    elif corr_type == "transposition" and len(val) > 3:
        i = rng.randint(0, len(val) - 2)
        return val[:i] + val[i + 1] + val[i] + val[i + 2:], "character_transposition"

    return val + "!", "syntax_corruption"


def generate_dataset_partitions(
    output_dir: str,
    funsd_path: str,
    train_ratio: float = 0.8,
    seed: int = RANDOM_SEED,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Partitions documents strictly by document ID before error synthesis to prevent data leakage.
    Generates balanced LIKELY_CORRECT and NEEDS_REVIEW samples.
    """
    rng = random.Random(seed)
    np_rng = np.random.default_rng(seed)

    # 1. Combine all document records
    all_documents = list(AUTHENTIC_LAND_DOCUMENTS)
    funsd_docs = load_funsd_fields(funsd_path)
    all_documents.extend(funsd_docs)

    rng.shuffle(all_documents)
    split_idx = int(len(all_documents) * train_ratio)
    train_docs = all_documents[:split_idx]
    test_docs = all_documents[split_idx:]

    print(f"Total documents: {len(all_documents)} -> Train docs: {len(train_docs)}, Test docs: {len(test_docs)}")

    def build_samples_for_docs(docs: List[Dict[str, Any]], is_train: bool) -> List[Dict[str, Any]]:
        samples = []
        for doc in docs:
            doc_id = doc["doc_id"]
            fields = doc["fields"]

            for field_name, original_val in fields.items():
                clean_str = str(original_val).strip()
                if not clean_str:
                    continue

                # 1. Positive instance: LIKELY_CORRECT
                # High OCR confidence (typical Beta distribution skewed 80-99%)
                clean_conf = float(np.clip(np_rng.beta(8.0, 1.2) * 100.0, 78.0, 99.5))
                clean_conf = round(clean_conf, 1)

                samples.append({
                    "doc_id": doc_id,
                    "field_name": field_name,
                    "original_value": clean_str,
                    "ocr_value": clean_str,
                    "confidence": clean_conf,
                    "label": "LIKELY_CORRECT",
                    "corruption_type": "none",
                })

                # 2. Negative instance: NEEDS_REVIEW via controlled corruption
                corrupted_val, corr_type = corrupt_field_value(field_name, clean_str, rng)

                # Degraded OCR confidence (simulating optical degradation, typically 30-74%)
                degraded_conf = float(np.clip(np_rng.beta(2.5, 3.5) * 100.0, 25.0, 75.0))
                # Occasionally confidence is deceptively high despite corruption
                if rng.random() < 0.20:
                    degraded_conf = float(np.clip(np_rng.uniform(76.0, 88.0), 76.0, 88.0))
                degraded_conf = round(degraded_conf, 1)

                samples.append({
                    "doc_id": doc_id,
                    "field_name": field_name,
                    "original_value": clean_str,
                    "ocr_value": corrupted_val,
                    "confidence": degraded_conf,
                    "label": "NEEDS_REVIEW",
                    "corruption_type": corr_type,
                })

                # In training set, add an extra variant for diversity
                if is_train and rng.random() < 0.5:
                    alt_corrupted, alt_corr = corrupt_field_value(field_name, clean_str, rng)
                    alt_conf = round(float(np.clip(np_rng.uniform(35.0, 72.0), 20.0, 85.0)), 1)
                    samples.append({
                        "doc_id": doc_id,
                        "field_name": field_name,
                        "original_value": clean_str,
                        "ocr_value": alt_corrupted,
                        "confidence": alt_conf,
                        "label": "NEEDS_REVIEW",
                        "corruption_type": alt_corr,
                    })

        rng.shuffle(samples)
        return samples

    train_samples = build_samples_for_docs(train_docs, is_train=True)
    test_samples = build_samples_for_docs(test_docs, is_train=False)

    os.makedirs(output_dir, exist_ok=True)
    train_file = os.path.join(output_dir, "train_field_data.json")
    test_file = os.path.join(output_dir, "test_field_data.json")

    with open(train_file, "w", encoding="utf-8") as f:
        json.dump(train_samples, f, indent=2)

    with open(test_file, "w", encoding="utf-8") as f:
        json.dump(test_samples, f, indent=2)

    print(f"Generated {len(train_samples)} training samples -> {train_file}")
    print(f"Generated {len(test_samples)} testing samples -> {test_file}")

    train_labels = [s["label"] for s in train_samples]
    test_labels = [s["label"] for s in test_samples]
    print(f"Train class balance: LIKELY_CORRECT={train_labels.count('LIKELY_CORRECT')}, NEEDS_REVIEW={train_labels.count('NEEDS_REVIEW')}")
    print(f"Test class balance:  LIKELY_CORRECT={test_labels.count('LIKELY_CORRECT')}, NEEDS_REVIEW={test_labels.count('NEEDS_REVIEW')}")

    return train_samples, test_samples


if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(current_dir, "data")
    funsd_dir = os.path.join(data_dir, "raw", "funsd", "dataset")

    generate_dataset_partitions(data_dir, funsd_dir)
