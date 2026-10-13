"""
LAND-IQ OCR Service Automated Test Suite
Tests:
- Health check
- Empty file handling (400)
- Invalid/corrupt file handling (400)
- Image OCR inference and field extraction
- Multi-page PDF OCR inference and field extraction
- Field contract: [{ name, value, normalized_value, confidence }]
- Confidence scale: 0-100 numeric
"""

import io
import time
import requests
from PIL import Image, ImageDraw, ImageFont

OCR_BASE_URL = "http://127.0.0.1:8001"


def test_health():
    resp = requests.get(f"{OCR_BASE_URL}/health", timeout=5)
    assert resp.status_code == 200, f"Health check failed with {resp.status_code}"
    data = resp.json()
    assert data["status"] == "ok"
    assert data["service"] == "land-iq-ocr"
    print("PASS: Health check passed.")


def test_empty_file():
    files = {"file": ("empty.png", b"", "image/png")}
    resp = requests.post(f"{OCR_BASE_URL}/ocr", files=files, timeout=5)
    assert resp.status_code == 400, f"Expected 400 for empty file, got {resp.status_code}"
    print("PASS: Empty file correctly rejected with 400.")


def test_corrupt_file():
    files = {"file": ("corrupt.png", b"NOT_A_VALID_IMAGE_OR_PDF_DATA", "image/png")}
    resp = requests.post(f"{OCR_BASE_URL}/ocr", files=files, timeout=5)
    assert resp.status_code == 400, f"Expected 400 for corrupt file header, got {resp.status_code}"
    print("PASS: Corrupt file header correctly rejected with 400.")


def create_test_image() -> bytes:
    """Create a realistic synthetic land record image."""
    img = Image.new("RGB", (800, 400), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    text_lines = [
        "GOVERNMENT OF TAMIL NADU - REVENUE DEPARTMENT",
        "Document Number: TN-2026-9988",
        "Patta Number: 4521",
        "Survey Number: 142/3B",
        "District: Coimbatore",
        "Taluk: Coimbatore South",
        "Village: Perur",
        "Owner Name: Ramesh Kumar",
        "Extent: 2.50 Acres",
    ]

    y = 30
    for line in text_lines:
        draw.text((40, y), line, fill=(0, 0, 0))
        y += 35

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_image_ocr():
    img_bytes = create_test_image()
    files = {"file": ("land_record.png", img_bytes, "image/png")}
    
    t0 = time.time()
    resp = requests.post(f"{OCR_BASE_URL}/ocr", files=files, timeout=30)
    elapsed = time.time() - t0

    assert resp.status_code == 200, f"Image OCR failed with {resp.status_code}: {resp.text}"
    data = resp.json()

    assert "pages" in data, "Response missing 'pages' key"
    assert len(data["pages"]) == 1, f"Expected 1 page, got {len(data['pages'])}"
    
    page = data["pages"][0]
    assert page["page_number"] == 1
    assert isinstance(page["text"], str) and len(page["text"]) > 0
    assert isinstance(page["fields"], list), "fields must be an array"

    print(f"Extracted text ({len(page['text'])} chars) in {elapsed:.2f}s:")
    print("Extracted fields count:", len(page["fields"]))
    for field in page["fields"]:
        assert "name" in field
        assert "value" in field
        assert "confidence" in field
        assert 0 <= field["confidence"] <= 100, f"Confidence {field['confidence']} out of bounds (0-100)"
        print(f"  - {field['name']}: {field['value']} (confidence: {field['confidence']}%)")

    print("PASS: Image OCR inference and contract verified.")


def create_test_pdf() -> bytes:
    """Create a 2-page synthetic PDF using PIL and saving to PDF."""
    img1 = Image.new("RGB", (800, 300), color=(255, 255, 255))
    draw1 = ImageDraw.Draw(img1)
    draw1.text((40, 40), "LAND RECORD PAGE 1\nPatta Number: 8812\nSurvey Number: 55/1A", fill=(0, 0, 0))

    img2 = Image.new("RGB", (800, 300), color=(255, 255, 255))
    draw2 = ImageDraw.Draw(img2)
    draw2.text((40, 40), "LAND RECORD PAGE 2\nDistrict: Coimbatore\nOwner Name: Anitha Devi", fill=(0, 0, 0))

    buf = io.BytesIO()
    img1.save(buf, format="PDF", save_all=True, append_images=[img2])
    return buf.getvalue()


def test_pdf_ocr():
    pdf_bytes = create_test_pdf()
    files = {"file": ("two_page_record.pdf", pdf_bytes, "application/pdf")}
    
    t0 = time.time()
    resp = requests.post(f"{OCR_BASE_URL}/ocr", files=files, timeout=60)
    elapsed = time.time() - t0

    assert resp.status_code == 200, f"PDF OCR failed with {resp.status_code}: {resp.text}"
    data = resp.json()

    assert "pages" in data
    assert len(data["pages"]) == 2, f"Expected 2 pages, got {len(data['pages'])}"
    
    for i, page in enumerate(data["pages"], 1):
        assert page["page_number"] == i
        assert isinstance(page["text"], str)
        assert isinstance(page["fields"], list)
        print(f"  Page {i}: {len(page['text'])} chars, {len(page['fields'])} fields")

    print(f"PASS: Multi-page PDF OCR passed in {elapsed:.2f}s.")


if __name__ == "__main__":
    print("Running LAND-IQ OCR service test suite...")
    test_health()
    test_empty_file()
    test_corrupt_file()
    test_image_ocr()
    test_pdf_ocr()
    print("ALL OCR SERVICE TESTS PASSED SUCCESSFULLY!")
