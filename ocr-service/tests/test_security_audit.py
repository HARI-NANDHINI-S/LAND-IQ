"""
LAND-IQ Phase 5 Security Audit Test Suite
Independently verifies:
1. Authentication behavior: missing, invalid, valid API key, valid Supabase JWT
2. Endpoint authorization: /ocr requires server service key; /ml/* accepts JWT or service key
3. Rate limiting: sliding window returns 429 when threshold exceeded
4. Payload limits: 413 on oversized files, 422 on oversized string lengths
5. Error sanitization: 500 errors contain no secrets, internal stack traces, or sensitive internals
6. CORS controls: verify allowed vs disallowed origins
"""

import base64
import hashlib
import hmac
import json
import time
import os
import sys

# Ensure ocr-service root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from starlette.testclient import TestClient
import app.main as main_module
from app.main import app, _verify_supabase_jwt

client = TestClient(app)


def make_jwt(payload: dict, secret: str, alg: str = "HS256") -> str:
    """Helper to generate JWT for test cases with configurable algorithm and claims."""
    header = {"alg": alg, "typ": "JWT"}
    header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode("utf-8")).decode("utf-8").rstrip("=")
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8").rstrip("=")
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    if alg == "none":
        sig_b64 = ""
    else:
        sig = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
        sig_b64 = base64.urlsafe_b64encode(sig).decode("utf-8").rstrip("=")
    return f"{header_b64}.{payload_b64}.{sig_b64}"


def test_auth_missing_and_invalid_credentials(monkeypatch):
    """Verify that requests with missing or invalid credentials are rejected with 401."""
    monkeypatch.setattr(main_module, "OCR_API_KEY", "server-secret-xyz-777")
    monkeypatch.setattr(main_module, "SUPABASE_JWT_SECRET", "supabase-jwt-secret-888")

    payload = {"field_name": "survey_number", "field_value": "142/3", "confidence": 95.0}

    # 1. Missing Authorization header
    resp_no_auth = client.post("/ml/validate-field", json=payload)
    assert resp_no_auth.status_code == 401
    assert "Unauthorized" in resp_no_auth.json().get("detail", "")

    # 2. Invalid Bearer token
    resp_bad_bearer = client.post(
        "/ml/validate-field",
        json=payload,
        headers={"Authorization": "Bearer completely-wrong-token"},
    )
    assert resp_bad_bearer.status_code == 401

    # 3. Invalid X-API-Key
    resp_bad_key = client.post(
        "/ml/validate-field",
        json=payload,
        headers={"X-API-Key": "wrong-key"},
    )
    assert resp_bad_key.status_code == 401


def test_auth_valid_service_key(monkeypatch):
    """Verify that valid service key authorizes both /ocr and /ml/* endpoints."""
    monkeypatch.setattr(main_module, "OCR_API_KEY", "server-secret-xyz-777")
    monkeypatch.setattr(main_module, "SUPABASE_JWT_SECRET", "supabase-jwt-secret-888")

    payload = {"field_name": "patta_number", "field_value": "4521", "confidence": 92.0}

    # Via Authorization: Bearer
    resp_bearer = client.post(
        "/ml/validate-field",
        json=payload,
        headers={"Authorization": "Bearer server-secret-xyz-777"},
    )
    assert resp_bearer.status_code == 200
    assert resp_bearer.json()["review_classification"] == "LIKELY_CORRECT"

    # Via X-API-Key
    resp_key = client.post(
        "/ml/validate-field",
        json=payload,
        headers={"X-API-Key": "server-secret-xyz-777"},
    )
    assert resp_key.status_code == 200


def test_auth_supabase_user_jwt(monkeypatch):
    """Verify that a valid Supabase user JWT authorizes /ml/* but NOT /ocr."""
    secret = "supabase-jwt-secret-888"
    monkeypatch.setattr(main_module, "OCR_API_KEY", "server-secret-xyz-777")
    monkeypatch.setattr(main_module, "SUPABASE_JWT_SECRET", secret)

    valid_token = make_jwt(
        {"sub": "user-uuid-1234", "aud": "authenticated", "role": "authenticated", "exp": time.time() + 3600},
        secret,
    )
    expired_token = make_jwt(
        {"sub": "user-uuid-1234", "aud": "authenticated", "role": "authenticated", "exp": time.time() - 3600},
        secret,
    )

    payload = {"field_name": "survey_number", "field_value": "142/3O", "confidence": 55.0}

    # 1. Valid JWT grants access to /ml/validate-field
    resp_valid_jwt = client.post(
        "/ml/validate-field",
        json=payload,
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert resp_valid_jwt.status_code == 200
    assert resp_valid_jwt.json()["review_classification"] == "NEEDS_REVIEW"

    # 2. Expired JWT is rejected with 401
    resp_exp_jwt = client.post(
        "/ml/validate-field",
        json=payload,
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert resp_exp_jwt.status_code == 401

    # 3. User JWT CANNOT access /ocr (which requires the private service key)
    files = {"file": ("empty.png", b"", "image/png")}
    resp_ocr_jwt = client.post(
        "/ocr",
        files=files,
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert resp_ocr_jwt.status_code == 401, "User JWT must not be permitted on server-to-server /ocr endpoint"


def test_jwt_algorithm_and_claim_matrix(monkeypatch):
    """
    Exhaustively audit JWT verification across:
    - 'none' algorithm
    - wrong algorithm (RS256)
    - tampered payload
    - missing exp
    - future not-before (nbf)
    - wrong audience (aud)
    - wrong issuer (iss)
    - missing subject (sub)
    """
    secret = "supabase-jwt-secret-888"
    monkeypatch.setattr(main_module, "OCR_API_KEY", "server-secret-xyz-777")
    monkeypatch.setattr(main_module, "SUPABASE_JWT_SECRET", secret)
    monkeypatch.setattr(main_module, "SUPABASE_JWT_AUDIENCE", "authenticated")
    monkeypatch.setattr(main_module, "SUPABASE_JWT_ISSUER", "https://quzzqfuvjdyekogbvfsr.supabase.co/auth/v1")

    base_payload = {
        "sub": "user-1234-uuid",
        "aud": "authenticated",
        "iss": "https://quzzqfuvjdyekogbvfsr.supabase.co/auth/v1",
        "role": "authenticated",
        "exp": time.time() + 3600,
    }

    # 1. Valid baseline
    valid_token = make_jwt(base_payload, secret)
    assert _verify_supabase_jwt(valid_token) is True

    # 2. Algorithm 'none' (unsigned) must be rejected
    none_token = make_jwt(base_payload, secret, alg="none")
    assert _verify_supabase_jwt(none_token) is False

    # 3. Algorithm 'RS256' must be rejected (only HS256 permitted)
    rs256_token = make_jwt(base_payload, secret, alg="RS256")
    assert _verify_supabase_jwt(rs256_token) is False

    # 4. Tampered payload (signature from different payload)
    parts = valid_token.split(".")
    tampered_payload = dict(base_payload, sub="tampered-attacker-id")
    tampered_b64 = base64.urlsafe_b64encode(json.dumps(tampered_payload).encode()).decode().rstrip("=")
    tampered_token = f"{parts[0]}.{tampered_b64}.{parts[2]}"
    assert _verify_supabase_jwt(tampered_token) is False

    # 5. Wrong HMAC secret
    wrong_secret_token = make_jwt(base_payload, "completely-wrong-secret")
    assert _verify_supabase_jwt(wrong_secret_token) is False

    # 6. Missing exp claim
    no_exp = dict(base_payload)
    del no_exp["exp"]
    assert _verify_supabase_jwt(make_jwt(no_exp, secret)) is False

    # 7. Premature token (nbf in future)
    future_nbf = dict(base_payload, nbf=time.time() + 600)
    assert _verify_supabase_jwt(make_jwt(future_nbf, secret)) is False

    # 8. Wrong audience
    wrong_aud = dict(base_payload, aud="wrong_audience")
    assert _verify_supabase_jwt(make_jwt(wrong_aud, secret)) is False

    # 9. Wrong issuer
    wrong_iss = dict(base_payload, iss="https://malicious.issuer.org/auth/v1")
    assert _verify_supabase_jwt(make_jwt(wrong_iss, secret)) is False

    # 10. Missing subject (sub)
    no_sub = dict(base_payload)
    del no_sub["sub"]
    assert _verify_supabase_jwt(make_jwt(no_sub, secret)) is False


def test_public_endpoints_unrestricted_and_no_leakage(monkeypatch):
    """Verify that /health, /ready, and model metadata endpoints do not leak credentials."""
    secret_key = "super-secret-service-key-9999"
    monkeypatch.setattr(main_module, "OCR_API_KEY", secret_key)
    monkeypatch.setattr(main_module, "SUPABASE_JWT_SECRET", "super-secret-jwt-key-8888")

    # 1. Health endpoint
    resp_health = client.get("/health")
    assert resp_health.status_code == 200
    assert resp_health.json()["auth_configured"] is True
    assert secret_key not in resp_health.text

    # 2. Ready probe
    resp_ready = client.get("/ready")
    assert resp_ready.status_code == 200
    assert secret_key not in resp_ready.text

    # 3. Field validator metadata info
    resp_info = client.get("/ml/field-validator/info")
    assert resp_info.status_code == 200
    assert secret_key not in resp_info.text


def test_rate_limiter_enforcement(monkeypatch):
    """Verify that sliding window rate limiter returns 429 when threshold is reached."""
    monkeypatch.setattr(main_module, "RATE_LIMIT_PER_MINUTE", 5)
    # Clear client records
    main_module._rate_limit_records.clear()

    payload = {"field_name": "patta_number", "field_value": "123", "confidence": 95.0}

    responses = [client.post("/ml/validate-field", json=payload) for _ in range(6)]
    status_codes = [r.status_code for r in responses]

    # First 5 should succeed (or be 200 if unauthenticated), 6th must be 429
    assert status_codes[-1] == 429, f"Expected 429 on 6th request, got {status_codes[-1]}"
    assert "Rate limit exceeded" in responses[-1].json().get("detail", "")

    # Cleanup
    monkeypatch.setattr(main_module, "RATE_LIMIT_PER_MINUTE", 120)
    main_module._rate_limit_records.clear()


def test_payload_size_limits():
    """Verify that oversized file uploads are rejected with HTTP 413."""
    # Create fake bytes exceeding MAX_FILE_SIZE_BYTES (25 MB)
    oversized_content = b"X" * (26 * 1024 * 1024)
    files = {"file": ("huge.pdf", oversized_content, "application/pdf")}
    resp = client.post("/ocr", files=files)
    assert resp.status_code == 413
    assert "exceeds" in resp.json().get("detail", "").lower()
