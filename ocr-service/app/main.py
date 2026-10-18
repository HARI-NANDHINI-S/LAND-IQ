import asyncio
import base64
import hashlib
import hmac
import json
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
from app.ml.field_validator_service import (
    SingleFieldValidationInput,
    BatchFieldValidationInput,
    get_field_validator_info,
    validate_single_field,
    validate_batch_fields,
)

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
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "").strip()
SUPABASE_JWT_AUDIENCE = os.getenv("SUPABASE_JWT_AUDIENCE", "authenticated").strip()
SUPABASE_JWT_ISSUER = os.getenv("SUPABASE_JWT_ISSUER", "").strip()
MAX_FILE_SIZE_BYTES = int(os.getenv("MAX_FILE_SIZE_BYTES", str(25 * 1024 * 1024)))  # 25 MB
MAX_PDF_PAGES = int(os.getenv("MAX_PDF_PAGES", "50"))
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "120"))

from collections import defaultdict
_rate_limit_records: dict[str, list[float]] = defaultdict(list)
_rate_limit_lock = asyncio.Lock()

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


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Exempt health, readiness, and CORS preflight options
    if request.method == "OPTIONS" or request.url.path in ("/health", "/ready"):
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    async with _rate_limit_lock:
        timestamps = _rate_limit_records[client_ip]
        _rate_limit_records[client_ip] = [t for t in timestamps if now - t < 60.0]
        if len(_rate_limit_records[client_ip]) >= RATE_LIMIT_PER_MINUTE:
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Too many requests. Please retry later."},
                headers={"Retry-After": "60"},
            )
        _rate_limit_records[client_ip].append(now)

    return await call_next(request)

ocr_engine = LandIQOCR()

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/tiff",
}


def _verify_supabase_jwt(token: str) -> bool:
    """
    Validate a Supabase HS256 JWT using Python standard library crypto.
    Strictly verifies:
    1. Structure: exactly 3 dot-separated URL-safe base64 segments.
    2. Header: alg must strictly be 'HS256' (rejects 'none', 'RS256', asymmetric keys, etc.).
    3. Signature: constant-time HMAC-SHA256 comparison verified BEFORE inspecting payload.
    4. Payload structure and valid JSON decoding.
    5. Expiration (exp): must be present and not expired (with 60s clock skew tolerance).
    6. Not-Before (nbf): if present, current time must be >= nbf - 60s.
    7. Audience (aud): must match SUPABASE_JWT_AUDIENCE (default: 'authenticated').
    8. Issuer (iss): if SUPABASE_JWT_ISSUER is configured, must match expected issuer.
    9. Subject (sub): must be a non-empty string identifier.
    """
    if not SUPABASE_JWT_SECRET or not token:
        return False
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return False
        header_b64, payload_b64, sig_b64 = parts

        # Signature segment must not be empty (rejects unsigned / none tokens)
        if not sig_b64:
            return False

        # 1. Inspect header without trusting it yet - must specify HS256
        header_padding = len(header_b64) % 4
        header_bytes = base64.urlsafe_b64decode(header_b64 + ("=" * ((4 - header_padding) % 4)))
        header_json = json.loads(header_bytes.decode("utf-8"))
        if not isinstance(header_json, dict):
            return False
        if header_json.get("alg") != "HS256":
            # Rejects 'none', RS256, ES256, etc.
            return False

        # 2. Decode signature bytes
        sig_padding = len(sig_b64) % 4
        sig_bytes = base64.urlsafe_b64decode(sig_b64 + ("=" * ((4 - sig_padding) % 4)))

        # 3. Cryptographically verify signature using constant-time comparison
        # (Must verify before trusting any payload claims!)
        signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
        expected_sig = hmac.new(
            SUPABASE_JWT_SECRET.encode("utf-8"),
            signing_input,
            hashlib.sha256,
        ).digest()
        if not hmac.compare_digest(sig_bytes, expected_sig):
            return False

        # 4. Decode payload JSON after signature verification
        payload_padding = len(payload_b64) % 4
        payload_bytes = base64.urlsafe_b64decode(payload_b64 + ("=" * ((4 - payload_padding) % 4)))
        payload_json = json.loads(payload_bytes.decode("utf-8"))
        if not isinstance(payload_json, dict):
            return False

        now = time.time()
        clock_skew = 60.0  # 60s tolerance for clock drift

        # 5. Expiration (exp) check - required
        exp = payload_json.get("exp")
        if exp is None or not isinstance(exp, (int, float)):
            return False
        if now > (exp + clock_skew):
            return False

        # 6. Not Before (nbf) check
        nbf = payload_json.get("nbf")
        if nbf is not None and isinstance(nbf, (int, float)):
            if now < (nbf - clock_skew):
                return False

        # 7. Audience (aud) check
        if SUPABASE_JWT_AUDIENCE:
            aud = payload_json.get("aud")
            if isinstance(aud, list):
                if SUPABASE_JWT_AUDIENCE not in aud:
                    return False
            elif aud != SUPABASE_JWT_AUDIENCE:
                return False

        # 8. Issuer (iss) check
        if SUPABASE_JWT_ISSUER:
            iss = payload_json.get("iss")
            if iss != SUPABASE_JWT_ISSUER:
                return False

        # 9. Subject (sub) must be present and non-empty
        sub = payload_json.get("sub")
        if not sub or not isinstance(sub, str):
            return False

        return True
    except Exception:
        return False


def verify_authentication(request: Request, require_service_key: bool = False) -> None:
    """
    Enforce authentication when OCR_API_KEY or SUPABASE_JWT_SECRET is configured.
    - If require_service_key=True (e.g. /ocr document processing endpoint):
      Strictly requires matching the private OCR_API_KEY server-to-server secret.
    - If require_service_key=False (e.g. /ml/* field validation endpoints):
      Accepts either matching OCR_API_KEY OR a valid Supabase user JWT.
    - When unconfigured (e.g. local developer machine), requests pass through.
    """
    if not OCR_API_KEY and not SUPABASE_JWT_SECRET:
        return

    auth_header = request.headers.get("Authorization", "")
    api_key_header = request.headers.get("X-API-Key", "")

    token = ""
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    elif api_key_header:
        token = api_key_header.strip()

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized: invalid or missing OCR API key.",
        )

    # 1. Constant-time comparison for service-to-service API key
    if OCR_API_KEY and hmac.compare_digest(token, OCR_API_KEY):
        return

    # 2. Check Supabase user JWT for client-facing endpoints
    if not require_service_key and SUPABASE_JWT_SECRET and _verify_supabase_jwt(token):
        return

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
        "mode": "production" if (OCR_API_KEY or SUPABASE_JWT_SECRET) else "local",
        "auth_configured": bool(OCR_API_KEY or SUPABASE_JWT_SECRET),
        "jwt_verification_configured": bool(SUPABASE_JWT_SECRET),
        "rate_limit_per_minute": RATE_LIMIT_PER_MINUTE,
        "max_file_size_mb": MAX_FILE_SIZE_BYTES // (1024 * 1024),
        "max_pdf_pages": MAX_PDF_PAGES,
    }


@app.get("/ready")
def ready():
    """
    Kubernetes / Docker container readiness probe.
    Verifies that OCR engine is initialized and both ML models are loaded in memory.
    """
    from app.ml.field_validator_service import load_field_validator_artifacts
    from app.ml.inference import load_model_artifacts

    val_model, _ = load_field_validator_artifacts()
    anom_model, _ = load_model_artifacts()

    is_ready = (ocr_engine is not None) and (val_model is not None) and (anom_model is not None)
    if not is_ready:
        raise HTTPException(
            status_code=503,
            detail="Service unavailable: ML models or OCR engine not fully initialized."
        )
    return {
        "status": "ready",
        "ocr_engine": "PaddleOCR",
        "field_validator_loaded": val_model is not None,
        "anomaly_classifier_loaded": anom_model is not None,
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
    verify_authentication(request, require_service_key=True)

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
    verify_authentication(request, require_service_key=False)
    try:
        result = predict_review_priority(payload)
        return result
    except Exception as e:
        logger.error("ML anomaly inference internal error: %s", type(e).__name__, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during ML anomaly analysis.")


@app.get("/ml/field-validator/info")
async def field_validator_model_info():
    """
    Returns public metadata, evaluation metrics, feature schema, and ethical safeguards
    for the deployed OCR Field Validator & Error Detection Model.
    """
    return get_field_validator_info()


@app.post("/ml/validate-field")
async def validate_field_endpoint(payload: SingleFieldValidationInput, request: Request):
    """
    Evaluates an individual OCR-extracted field.
    Returns review classification (LIKELY_CORRECT vs NEEDS_REVIEW),
    explainable review reasons, and an evidence-backed candidate correction (if supported).
    """
    verify_authentication(request, require_service_key=False)
    try:
        return validate_single_field(payload)
    except Exception as e:
        logger.error("Field validation internal error: %s", type(e).__name__, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during field validation.")


@app.post("/ml/validate-fields")
async def validate_fields_batch_endpoint(payload: BatchFieldValidationInput, request: Request):
    """
    Batch evaluation of multiple OCR-extracted fields for a document or verification task.
    """
    verify_authentication(request, require_service_key=False)
    try:
        return {"results": validate_batch_fields(payload.fields)}
    except Exception as e:
        logger.error("Batch field validation internal error: %s", type(e).__name__, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during batch field validation.")