import asyncio
import logging
import os
import re
import time
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import httpx

from app.ocr_engine import LandIQOCR
from app.ml.inference import predict_review_priority, get_model_info
from app.ml.features import RecordFeaturesInput

# Configure safe structured logging (never log secrets, signed URLs, or document content)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("land-iq-ocr")

app = FastAPI(
    title="LAND-IQ Production-Ready OCR Service",
    description="Local and self-hosted OCR microservice powered by PaddleOCR for LAND-IQ land records.",
    version="1.0.0",
)

# Concurrency semaphore to prevent CPU exhaustion on concurrent OCR tasks
MAX_CONCURRENT_OCR = int(os.getenv("MAX_CONCURRENT_OCR", "4"))
ocr_semaphore = asyncio.Semaphore(MAX_CONCURRENT_OCR)

# Configuration from environment
OCR_API_KEY = os.getenv("OCR_API_KEY", "").strip()
MAX_FILE_SIZE_BYTES = int(os.getenv("MAX_FILE_SIZE_BYTES", str(25 * 1024 * 1024)))  # 25 MB
MAX_PDF_PAGES = int(os.getenv("MAX_PDF_PAGES", "50"))

raw_cors = os.getenv("CORS_ORIGINS", "")
if raw_cors.strip():
    allowed_origins = [origin.strip() for origin in raw_cors.split(",") if origin.strip()]
else:
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

ocr_engine = LandIQOCR()

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/tiff",
}


def verify_authentication(request: Request) -> None:
    """
    Enforce API key authentication if OCR_API_KEY is configured.
    When unconfigured (e.g., local developer machine), requests pass through.
    """
    if not OCR_API_KEY:
        return

    auth_header = request.headers.get("Authorization", "")
    api_key_header = request.headers.get("X-API-Key", "")

    token = ""
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    elif api_key_header:
        token = api_key_header.strip()

    if not token or token != OCR_API_KEY:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized: invalid or missing OCR API key.",
        )


def detect_and_validate_format(contents: bytes) -> str:
    """
    Inspect magic bytes / file header to prevent spoofing and validate supported formats.
    """
    if len(contents) > MAX_FILE_SIZE_BYTES:
        max_mb = MAX_FILE_SIZE_BYTES // (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=f"File size exceeds the {max_mb} MB limit.",
        )

    if len(contents) < 4:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty or invalid.",
        )

    # PDF: begins with %PDF-
    if contents.startswith(b"%PDF-"):
        return "application/pdf"

    # JPEG: starts with \xff\xd8\xff
    if contents.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"

    # PNG: starts with \x89PNG\r\n\x1a\n
    if contents.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"

    # WebP: starts with RIFF and has WEBP at byte 8
    if contents.startswith(b"RIFF") and len(contents) >= 12 and contents[8:12] == b"WEBP":
        return "image/webp"

    # TIFF: starts with II*\x00 or MM\x00*
    if contents.startswith(b"II*\x00") or contents.startswith(b"MM\x00*"):
        return "image/tiff"

    raise HTTPException(
        status_code=400,
        detail="Unsupported or invalid file format. Supported formats: PDF, JPEG, PNG, WebP, TIFF.",
    )


def process_pdf(pdf_path: str, temp_dir: str) -> dict[str, Any]:
    """
    Convert PDF pages to images and OCR each page with error & bounds checks.
    """
    import pypdfium2 as pdfium

    try:
        pdf = pdfium.PdfDocument(pdf_path)
    except Exception:
        logger.warning("Failed to open PDF document (corrupted or malformed)")
        raise HTTPException(
            status_code=422,
            detail="Malformed or corrupted PDF document.",
        )

    pages: list[dict[str, Any]] = []

    try:
        # Protect against encrypted / password-protected PDFs
        if getattr(pdf, "is_encrypted", False):
            raise HTTPException(
                status_code=422,
                detail="Encrypted or password-protected PDFs are not supported.",
            )

        page_count = len(pdf)
        if page_count == 0:
            raise HTTPException(
                status_code=422,
                detail="PDF document contains zero pages.",
            )

        if page_count > MAX_PDF_PAGES:
            raise HTTPException(
                status_code=422,
                detail=f"PDF exceeds the maximum allowed page count of {MAX_PDF_PAGES} (received {page_count}).",
            )

        for index in range(page_count):
            page_number = index + 1

            try:
                page = pdf[index]
                bitmap = page.render(scale=2.0)
                image_path = Path(temp_dir) / f"page_{page_number}.png"
                bitmap.to_pil().save(image_path)
            except Exception as exc:
                logger.warning("Failed to render PDF page %d: %s", page_number, type(exc).__name__)
                raise HTTPException(
                    status_code=422,
                    detail=f"Failed to render PDF page {page_number}.",
                )

            result = ocr_engine.process_image(
                str(image_path),
                page_number=page_number,
            )
            pages.append(result)

    finally:
        pdf.close()

    return {"pages": pages}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "land-iq-ocr",
        "engine": "PaddleOCR",
        "version": "1.0.0",
        "mode": "production" if OCR_API_KEY else "local",
        "auth_configured": bool(OCR_API_KEY),
        "max_file_size_mb": MAX_FILE_SIZE_BYTES // (1024 * 1024),
        "max_pdf_pages": MAX_PDF_PAGES,
    }


@app.post("/ocr")
@app.post("/")
async def process_document_endpoint(
    request: Request,
    file: UploadFile | None = File(None),
):
    """
    Unified OCR processing endpoint supporting both:
    1. Direct file upload (multipart/form-data with `file`)
    2. Edge Function JSON payload (`{ document_id, document_url, mime_type, response_format }`)
    """
    verify_authentication(request)

    content_type = request.headers.get("content-type", "").lower()
    start_time = time.monotonic()

    async with ocr_semaphore:
        # Mode 1: JSON payload with document_url (used by Supabase Edge Function)
        if "application/json" in content_type:
            try:
                body = await request.json()
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid JSON body.")

            document_url = body.get("document_url") if isinstance(body, dict) else None
            if not document_url or not isinstance(document_url, str):
                raise HTTPException(status_code=400, detail="A valid document_url is required.")

            # Validate URL protocol
            if not (document_url.startswith("http://") or document_url.startswith("https://")):
                raise HTTPException(status_code=400, detail="document_url must be an HTTP or HTTPS URL.")

            # Fetch document bytes safely with timeout and stream limit
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    resp = await client.get(document_url)
                    if resp.status_code != 200:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Failed to fetch document from storage (HTTP {resp.status_code}).",
                        )
                    contents = resp.content
            except httpx.TimeoutException:
                raise HTTPException(status_code=504, detail="Timeout while fetching document from storage.")
            except HTTPException:
                raise
            except Exception as exc:
                logger.warning("Error fetching remote document: %s", type(exc).__name__)
                raise HTTPException(status_code=502, detail="Unable to retrieve document from URL.")

            actual_mime = detect_and_validate_format(contents)
            ext = ".pdf" if actual_mime == "application/pdf" else ".png"

            with TemporaryDirectory() as temp_dir:
                input_path = Path(temp_dir) / f"doc{ext}"
                input_path.write_bytes(contents)

                if actual_mime == "application/pdf":
                    res = process_pdf(str(input_path), temp_dir)
                else:
                    page = ocr_engine.process_image(str(input_path), page_number=1)
                    res = {"pages": [page]}

                elapsed = round(time.monotonic() - start_time, 2)
                page_count = len(res.get("pages", []))
                logger.info("Processed remote document in %.2fs (pages=%d, size=%d bytes)", elapsed, page_count, len(contents))
                return res

        # Mode 2: Multipart form upload (used by direct frontend upload)
        if file is not None:
            contents = await file.read()
            actual_mime = detect_and_validate_format(contents)
            ext = Path(file.filename or "").suffix.lower()
            if not ext:
                ext = ".pdf" if actual_mime == "application/pdf" else ".png"

            with TemporaryDirectory() as temp_dir:
                input_path = Path(temp_dir) / f"upload{ext}"
                input_path.write_bytes(contents)

                if actual_mime == "application/pdf":
                    res = process_pdf(str(input_path), temp_dir)
                else:
                    page = ocr_engine.process_image(str(input_path), page_number=1)
                    res = {"pages": [page]}

                elapsed = round(time.monotonic() - start_time, 2)
                page_count = len(res.get("pages", []))
                logger.info("Processed uploaded document in %.2fs (pages=%d, size=%d bytes)", elapsed, page_count, len(contents))
                return res

        raise HTTPException(
            status_code=400,
            detail="A file upload or a JSON body containing document_url is required.",
        )


@app.get("/ml/model-info")
async def model_info():
    """
    Returns public metadata, evaluation metrics, feature schema, and ethical safeguards
    for the deployed Land Record Anomaly & Review Priority Classifier.
    """
    return get_model_info()


@app.post("/ml/predict")
async def predict_record_anomaly(payload: RecordFeaturesInput, request: Request):
    """
    Inference endpoint for Land Record Anomaly & Review Priority classification.
    Predicts review priority (LOW, MEDIUM, HIGH), anomaly score, contributing factors,
    and human-in-the-loop verification recommendation.
    """
    verify_authentication(request)
    try:
        result = predict_review_priority(payload)
        return result
    except Exception as e:
        logger.error(f"ML inference error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")