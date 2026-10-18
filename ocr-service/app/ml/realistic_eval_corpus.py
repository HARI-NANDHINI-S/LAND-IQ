"""
LAND-IQ Realistic Land-Record Evaluation Corpus Generator
Generates legally compliant, clearly labeled synthetic land-record layouts modeled on
authentic Tamil Nadu Revenue Administration statutory formats:
1. Form 1: Patta / Chitta Extract (Revenue Dept)
2. Form 2: Town Survey Land Register (TSLR) Extract
3. Form 3: Sale Deed / Conveyance Memorial
4. Form 4: Partition / Settlement Deed Extract

Each document is rendered in 3 scan quality profiles:
- 'clean': Crisp 300 DPI high-contrast scan
- 'medium': Scanner noise, optical bleed, and contrast variance
- 'degraded': Low contrast, heavy noise, slight blur (aged record simulation)

Includes full ground-truth annotations (document-level text and field-level key-values)
stored in a JSON manifest for CER/WER and OCR error evaluation.
"""

import os
import json
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

CORPUS_DOCUMENTS = [
    {
        "doc_id": "EVAL-TN-COI-PATTA-001",
        "doc_type": "patta_chitta_extract",
        "title": "GOVERNMENT OF TAMIL NADU - REVENUE DEPARTMENT\nPATTA / CHITTA EXTRACT (FORM 1)",
        "fields": {
            "document_number": "TN-COI-2024-7711",
            "patta_number": "4521",
            "survey_number": "142/3B",
            "document_date": "14/06/2021",
            "district": "Coimbatore",
            "taluk": "Coimbatore South",
            "village": "Perur",
            "extent": "2.50 Acres",
            "owner_name": "Ramesh Kumar",
        },
    },
    {
        "doc_id": "EVAL-TN-COI-TSLR-002",
        "doc_type": "tslr_extract",
        "title": "TOWN SURVEY LAND REGISTER (TSLR) EXTRACT\nCOIMBATORE MUNICIPAL CORPORATION",
        "fields": {
            "document_number": "TSLR-2023-9901",
            "patta_number": "PAT-2023-882",
            "survey_number": "200/1A",
            "document_date": "22/11/2023",
            "district": "Coimbatore",
            "taluk": "Coimbatore South",
            "village": "Ondipudur",
            "extent": "1.20 Acres",
            "owner_name": "K. Senthil Nathan",
        },
    },
    {
        "doc_id": "EVAL-TN-SLM-SALEDEED-003",
        "doc_type": "sale_deed_extract",
        "title": "SUB-REGISTRAR OFFICE VALAPADY - SALEM DISTRICT\nREGISTRATION ACT 1908 - SCHEDULE OF PROPERTY",
        "fields": {
            "document_number": "DOC-SLM-2022-4412",
            "patta_number": "10492",
            "survey_number": "89/4C",
            "document_date": "10/01/2019",
            "district": "Salem",
            "taluk": "Attur",
            "village": "Valapady",
            "extent": "50 Cents",
            "owner_name": "S. Murugan",
        },
    },
    {
        "doc_id": "EVAL-TN-TPR-SETTLE-004",
        "doc_type": "settlement_deed_extract",
        "title": "SETTLEMENT DEED SCHEDULE - TIRUPPUR REGISTRATION DISTRICT\nREVENUE SUB-DIVISION SCHEDULE 'A'",
        "fields": {
            "document_number": "TN-TPR-2023-3190",
            "patta_number": "PAT-2023-004",
            "survey_number": "412/1",
            "document_date": "17/09/2023",
            "district": "Tiruppur",
            "taluk": "Dharapuram",
            "village": "Kundadam",
            "extent": "3.80 Hectares",
            "owner_name": "P. Vijayalakshmi",
        },
    },
    {
        "doc_id": "EVAL-TN-MDU-PATTA-005",
        "doc_type": "patta_chitta_extract",
        "title": "GOVERNMENT OF TAMIL NADU - REVENUE DEPARTMENT\nPATTA PASSBOOK EXTRACT (MADURAI EAST)",
        "fields": {
            "document_number": "TN-MDU-2024-5501",
            "patta_number": "6102",
            "survey_number": "78/2A",
            "document_date": "03/04/2022",
            "district": "Madurai",
            "taluk": "Madurai East",
            "village": "Othakadai",
            "extent": "1.75 Acres",
            "owner_name": "A. Meenakshi Sundaram",
        },
    },
    {
        "doc_id": "EVAL-TN-COI-CHITTA-006",
        "doc_type": "patta_chitta_extract",
        "title": "REVENUE REGISTER (CHITTA) EXTRACT\nPOLLACHI TALUK - COIMBATORE DISTRICT",
        "fields": {
            "document_number": "TN-COI-2023-8812",
            "patta_number": "8812",
            "survey_number": "55/1A",
            "document_date": "18/08/2022",
            "district": "Coimbatore",
            "taluk": "Pollachi",
            "village": "Kinathukadavu",
            "extent": "4.15 Hectares",
            "owner_name": "M. Palanisamy",
        },
    },
]


def render_document_image(doc: dict, quality: str) -> tuple[Image.Image, str]:
    """
    Renders document text onto an image canvas with the specified degradation quality.
    Returns (PIL.Image, ground_truth_text).
    """
    width, height = 950, 600
    bg_color = (255, 255, 255) if quality != "degraded" else (245, 243, 235)
    img = Image.new("RGB", (width, height), color=bg_color)
    draw = ImageDraw.Draw(img)

    lines = []
    # Header
    for header_line in doc["title"].split("\n"):
        lines.append(header_line)
    lines.append("-" * 65)

    # Key-Value pairs
    fields = doc["fields"]
    lines.append(f"Document Number : {fields['document_number']}")
    lines.append(f"Patta Number    : {fields['patta_number']}")
    lines.append(f"Survey Number   : {fields['survey_number']}")
    lines.append(f"Document Date   : {fields['document_date']}")
    lines.append(f"District        : {fields['district']}")
    lines.append(f"Taluk           : {fields['taluk']}")
    lines.append(f"Village         : {fields['village']}")
    lines.append(f"Extent          : {fields['extent']}")
    lines.append(f"Owner Name      : {fields['owner_name']}")
    lines.append("-" * 65)
    lines.append("Statutory Revenue Extract - Certified Copy for Land Record Verification")

    gt_text = "\n".join(lines)

    y = 35
    for line in lines:
        text_color = (20, 20, 20)
        if quality == "degraded":
            text_color = (65, 65, 65)  # Faded ink
        draw.text((45, y), line, fill=text_color)
        y += 28

    # Apply quality degradation profiles
    if quality == "medium":
        # Slight noise and minor contrast change
        arr = np.array(img).astype(np.float32)
        noise = np.random.normal(0, 7.0, arr.shape)
        arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
        img = Image.fromarray(arr)

    elif quality == "degraded":
        # Heavier noise, faint blur, and slight contrast reduction
        arr = np.array(img).astype(np.float32)
        noise = np.random.normal(0, 18.0, arr.shape)
        arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
        img = Image.fromarray(arr)
        img = img.filter(ImageFilter.GaussianBlur(radius=0.7))
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(0.85)

    return img, gt_text


def build_realistic_corpus(output_dir: str):
    """
    Builds the complete realistic land-record evaluation corpus and saves images + ground-truth manifest.
    """
    os.makedirs(output_dir, exist_ok=True)
    images_dir = os.path.join(output_dir, "images")
    os.makedirs(images_dir, exist_ok=True)

    manifest = []
    qualities = ["clean", "medium", "degraded"]

    for doc in CORPUS_DOCUMENTS:
        for q in qualities:
            image_filename = f"{doc['doc_id']}_{q}.png"
            image_path = os.path.join(images_dir, image_filename)

            img, gt_text = render_document_image(doc, quality=q)
            img.save(image_path, format="PNG")

            manifest.append({
                "doc_id": doc["doc_id"],
                "doc_type": doc["doc_type"],
                "quality": q,
                "image_filename": image_filename,
                "image_rel_path": os.path.relpath(image_path, output_dir),
                "fields_ground_truth": doc["fields"],
                "text_ground_truth": gt_text,
            })

    manifest_path = os.path.join(output_dir, "corpus_manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"Generated {len(manifest)} realistic land-record evaluation images -> {images_dir}")
    print(f"Saved manifest -> {manifest_path}")
    return manifest


if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.join(current_dir, "data", "realistic_land_records")
    build_realistic_corpus(out_dir)
