# LAND-IQ — Production Deployment & Release Guide

## 1. System Architecture & Component Responsibilities

LAND-IQ employs a decoupled, secure, and resilient microservice architecture designed for Indian land-record verification and revenue administration:

```
┌────────────────────────────────────────────────────────┐
│               LAND-IQ Web Client (React 19)            │
│  - Document inspection & OCR text display              │
│  - FieldReviewSection: Live ML alerts vs Offline Rules │
│  - Officer verification workspace (RBAC-enforced)      │
└───────────────┬────────────────────────┬───────────────┘
                │                        │
       HTTPS API│                        │Supabase Client
       (Port 8001)                       │(PostgreSQL + RLS)
                ▼                        ▼
┌──────────────────────────────┐  ┌──────────────────────────────────┐
│   FastAPI OCR & ML Service   │  │       Supabase / PostgreSQL      │
│  - Local PaddleOCR engine    │  │  - Extracted fields storage      │
│  - RandomForest validator    │  │  - verify_extracted_field RPC   │
│  - Review reasons & fixes    │  │  - Geographic scope verification │
│  - Rate limiting & auth      │  │  - Immutable original OCR values │
└──────────────────────────────┘  └──────────────────────────────────┘
```

### Component Responsibilities:
1. **Frontend (`src/`)**: Built with React 19, TypeScript, TailwindCSS, TanStack Query, and Zustand. Features `FieldReviewSection.tsx` which communicates with the ML microservice for field-level error alerts and candidate corrections. Gracefully transitions to `clientHeuristicFieldValidator` if the microservice is temporarily unreachable, clearly displaying an "Offline Domain Rules" badge.
2. **OCR & ML Microservice (`ocr-service/`)**: Built with FastAPI, PaddleOCR, and scikit-learn. Performs CPU-based local OCR without third-party API dependencies. Enriches extracted cadastral fields with review classifications (`LIKELY_CORRECT` vs `NEEDS_REVIEW`), explainable rationale, and deterministic corrections.
3. **Database & Authorization (`supabase/`)**: PostgreSQL with PostGIS extension. Row Level Security (RLS) is enabled on all tables. Updates to `extracted_fields` are strictly forbidden via direct SQL and must proceed through the `verify_extracted_field` SECURITY DEFINER RPC.

---

## 2. Local Development Startup Instructions

### Prerequisites:
- Node.js $\ge 20$
- Python $3.11$ or $3.13$ with virtual environment support

### Step 1: Start the OCR & ML Microservice
```bash
cd ocr-service
# Activate existing virtual environment
.\.venv\Scripts\activate   # Windows
# source .venv/bin/activate # Linux/macOS

# Start uvicorn server on port 8001
uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

Verify service readiness:
```bash
curl http://127.0.0.1:8001/health
curl http://127.0.0.1:8001/ready
```

### Step 2: Start the Frontend Application
```bash
# In the project root directory
npm install
npm run dev
```
Navigate to `http://localhost:5173`.

### Step 3: Run Full Automated Regression Test Battery
```bash
npm run test:all
```
This executes:
1. `npm run test:ocr` (OCR service image and multi-page PDF tests)
2. `npm run test:ml` (Document-level anomaly classifier tests)
3. `npm run test:ml:fields` (ML field error detection and endpoint test suite)
4. `npm run test:services` (PostGIS spatial queries and risk assessment suite)

---

## 3. Environment Variable Documentation & Secret Isolation

LAND-IQ enforces strict isolation between client-accessible public variables and private server secrets:

### Public Browser Variables (`.env` — Statically Bundled into Client Build):
```ini
# Supabase Project Connection (Required)
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>

# OCR & ML Microservice URL (Use HTTPS URL in production)
VITE_OCR_SERVICE_URL=http://127.0.0.1:8001
```

> ⚠️ **SECURITY AUDIT NOTE (Phase 5 Resolution)**:
> Previously, `VITE_OCR_API_KEY` was present in template configurations. In Vite, any variable prefixed with `VITE_` is baked directly into compiled client-side JavaScript bundles (`dist/assets/*.js`), exposing the private key to anyone inspecting browser network traffic or source maps.
> **Resolution**: `VITE_OCR_API_KEY` has been completely eliminated from frontend configs. The client authenticates against the ML microservice using the authenticated officer's Supabase session JWT (`Authorization: Bearer <access_token>`). Full document OCR extraction is gated server-to-server via the Supabase Edge Function `process-document`.

### Server-Side Secrets (NEVER Expose to Frontend / Client):
```ini
# OCR & ML Microservice Environment (ocr-service/.env or Docker Secrets):
OCR_API_KEY=your-production-secret-service-key
SUPABASE_JWT_SECRET=your-supabase-project-jwt-secret
CORS_ORIGINS=https://app.landiq.gov.in,https://admin.landiq.gov.in
MAX_CONCURRENT_OCR=4
MAX_FILE_SIZE_BYTES=26214400 # 25 MB
MAX_PDF_PAGES=50
RATE_LIMIT_PER_MINUTE=120
PORT=8001
HOST=0.0.0.0

# Supabase Edge Function Secrets (supabase secrets set):
OCR_PROVIDER_URL=https://ocr.landiq.gov.in/ocr
OCR_PROVIDER_API_KEY=your-production-secret-service-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

---

## 4. Confirmed Security Fixes (Phase 5)

1. **Frontend Secret Audit & Removal of `VITE_OCR_API_KEY`**:
   - `VITE_OCR_API_KEY` was audited and removed from `src/services/ml/mlService.ts`, `.env.example`, `README.md`, and deployment docs.
   - Frontend bundle (`dist/assets/*.js`) audited: 0 occurrences of API keys or service role secrets.
   - Browser client dynamically attaches `Authorization: Bearer <session.access_token>` from Supabase Auth.
2. **FastAPI Microservice Authentication Hardening**:
   - `/ocr` (heavy document OCR): strictly enforces server-to-server `OCR_API_KEY` via constant-time `hmac.compare_digest`. Direct unauthorized access is rejected with `401 Unauthorized`.
   - `/ml/*` endpoints: accept either server-to-server `OCR_API_KEY` OR verified Supabase user JWT (using timing-safe HMAC-SHA256 standard library crypto).
   - Timing side-channel attacks prevented via constant-time comparison.
   - Public observability endpoints (`/health`, `/ready`, `/ml/model-info`, `/ml/field-validator/info`) remain accessible without credentials and expose zero secrets.
3. **In-Memory Rate Limiting & Denial-of-Service Defenses**:
   - Sliding-window IP rate limiter (`RATE_LIMIT_PER_MINUTE=120`) returns `429 Too Many Requests` with `Retry-After: 60` headers.
   - Input bounds: Max file upload 25 MB (`413 Payload Too Large`), max PDF pages 50 (`422`), max field string length 2,000 characters (`422`), max batch size 100 fields (`422`).
   - Concurrency semaphore (`MAX_CONCURRENT_OCR=4`) prevents thread pool exhaustion during heavy OCR jobs.
4. **Database Authorization & Field Immutability**:
   - Direct SQL mutations on `extracted_fields` revoked from `authenticated` and `anon`.
   - All human verification operations must execute through `verify_extracted_field` SECURITY DEFINER RPC.
   - The original OCR extraction (`field_value` and `raw_value`) is permanently immutable. Corrections are stored exclusively in `verified_value` alongside `verified_by` and `verified_at` audit columns.
   - RPC validates `public.can_access_geographic_scope(document.state_id, document.district_id, document.village_id)`.

---

## 5. Dataset Provenance & Synthetic Limitations

### Data Sources & Provenance:
1. **FUNSD (Form Understanding in Noisy Scanned Documents)**:
   - *Source*: ICDAR-OST 2019 (Guillaume Jaume et al.)
   - *Licence*: Creative Commons Attribution 4.0 (CC BY 4.0).
   - *Content*: 199 genuine administrative forms providing baseline layout structures.
2. **Statutory Cadastral Specifications**:
   - *Origin*: Modeled on official Tamil Nadu Revenue Administration public templates (Form 1 Patta/Chitta, Form 2 TSLR, Settlement & Sale Deed extracts).
   - *Permitted Use*: Open source engineering benchmark data.
   - *Data Hygiene*: Strict compliance with DPDP 2023. No private citizen records were scraped.

### Document-Level Isolation (0 Overlap):
- Training set: 167 documents (3,375 field samples).
- Test set: 42 documents (704 field samples).
- **Leakage Audit**: Tested and verified **0 document ID overlap** between train and test splits.

### Evaluation Corpus Nature (Synthetic vs Authentic Records):
- The 18-document OCR evaluation corpus (`realistic_land_records`) consists of **synthetic layout renderings** generated via PIL with simulated scan noise, Gaussian blur, and optical artifacts across 3 quality tiers (`clean`, `medium`, `degraded`).
- **Limitation**: While simulated degradation accurately models scanner noise and optical character confusion, physical deed artifacts such as century-old brittle palm-leaf paper, wax seal overlaps, water damage, and handwritten sub-registrar endorsements require mandatory human supervision.

---

## 6. Reproducible Evaluation Commands & Exact Results

### Execution Commands:
```bash
# 1. Reproduce model metrics, threshold tuning, and isolation checks
.\ocr-service\.venv\Scripts\python.exe -m pytest ocr-service\tests\test_reproduce_eval.py -v

# 2. Reproduce security audit (auth, rate limits, payload bounds)
.\ocr-service\.venv\Scripts\python.exe -m pytest ocr-service\tests\test_security_audit.py -v

# 3. Reproduce end-to-end live workflow and database audit
node scripts/test_live_workflow.mjs
```

### Exact Reproduced Results:
1. **ML Field Validator Classifier Metrics (704 Held-Out Test Samples)**:
   - **Accuracy**: **92.90%** (654 / 704)
   - **Macro Precision**: **93.71%**
   - **Macro Recall**: **92.90%**
   - **Macro F1-Score**: **0.9286**
   - **ROC-AUC**: **0.9835**
   - **Confusion Matrix**:
     - True Negatives (`LIKELY_CORRECT` correctly classified): **351**
     - False Positives (Clean fields falsely flagged): **1**
     - False Negatives (Corrupted fields missed): **49**
     - True Positives (`NEEDS_REVIEW` correctly flagged): **303**
2. **Decision Threshold Tuning (Evaluated on Strictly Isolated 34-Document / 701-Sample Validation Partition)**:
   - *Audit Correction (Phase 6)*: Prior reports evaluated thresholds using the production model on an in-sample random split (which reported an optimistic 93.49% recall at $\tau = 0.40$). In Phase 6, a strictly isolated, document-level validation split was created (133 subtrain docs vs 34 val docs, 0 overlap). A separate model was trained exclusively on the 133 subtrain documents without the validation samples.
   - Default ($\tau = 0.50$): Recall = 87.53%, Missed Errors = 53, FPR = 0.00%, Precision = 100.0%.
   - Operational ($\tau = 0.40$): Recall = 88.00%, Missed Errors = 51, FPR = 0.72%, Precision = 99.47%.
   - **Recommended Operational ($\tau = 0.35$)**: Recall = **90.12%**, Missed Errors = **42**, FPR = **1.81%**, Precision = **98.71%**.
   - Aggressive Recall ($\tau = 0.30$): Recall = 91.76%, Missed Errors = 35, FPR = 3.99%, Precision = 97.26%.
3. **Probability Calibration**:
   - **Brier Score**: **0.0533** (strong calibration $\le 0.10$).
   - **Expected Calibration Error (ECE)**: **5.94%**.
4. **OCR Text Recognition (18 Realistic Synthetic Documents)**:
   - Overall CER: **29.57%** | Overall WER: **29.83%**
   - Clean scans ($n=6$): CER 29.52% | WER 26.37%
   - Medium scans ($n=6$): CER 29.71% | WER 25.81%
   - Degraded scans ($n=6$): CER 29.48% | WER 37.30%
   - Note: CER/WER are aggregated using Levenshtein edit distance normalized by ground truth length.

---

## 7. Deployment Instructions & CI/CD Commands

### Local Development (Host Process):
```bash
# Terminal 1: OCR Microservice
cd ocr-service
.\.venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8001

# Terminal 2: Frontend
npm run dev
```

### Container Deployment (Linux CI / Production Host):
```bash
# Build production container image
docker build -t land-iq-ocr:1.0.0 ./ocr-service

# Run container with volume-cached PaddleOCR models
docker run -d \
  -p 8001:8001 \
  -e OCR_API_KEY="your-production-secret-service-key" \
  -e SUPABASE_JWT_SECRET="your-supabase-jwt-secret" \
  -e SUPABASE_JWT_AUDIENCE="authenticated" \
  -e CORS_ORIGINS="https://app.landiq.gov.in" \
  -e MAX_CONCURRENT_OCR=4 \
  -e RATE_LIMIT_PER_MINUTE=120 \
  -v landiq_paddle_cache:/home/appuser/.paddlex \
  --name land-iq-ocr \
  land-iq-ocr:1.0.0

# Verify probes
curl -f http://localhost:8001/health
curl -f http://localhost:8001/ready
```

---

## 8. Known Production Blockers & Architectural Limitations

1. **Docker Daemon Status on Host Workstation**:
   - **Status: NOT VERIFIED (Host daemon offline)**. The local Windows workstation runs Docker CLI 29.8.0, but the Docker Desktop Linux daemon (`npipe:////./pipe/dockerDesktopLinuxEngine`) was stopped. Container testing must be performed on a Linux CI/CD runner using the provided Dockerfile.
2. **In-Memory Rate Limiter Scalability**:
   - The sliding-window rate limiter is stored in Python memory (`dict[str, list[float]]`). It is effective for single-container or worker-process deployments. For multi-replica horizontal autoscaling behind a cloud load balancer, rate limits become per-replica; Redis/Valkey should be configured for distributed tracking.
3. **Tamil Script Vernacular Recognition**:
   - The local PaddleOCR configuration uses default English/Latin bilingual recognition models. When ingesting purely vernacular Tamil patta documents without English transliteration, `PP-OCRv4_ta` language weights must be downloaded into the model cache.

---

## 9. Final Release Verification Checklist

| Domain | Check Description | Status | Evidence / Verification Method |
| :--- | :--- | :--- | :--- |
| **Frontend Secrets** | `VITE_*` variable audit | **PASS** | Removed `VITE_OCR_API_KEY`; `dist/assets/*.js` contains 0 service keys. |
| **Authentication** | Missing/invalid credentials rejected | **PASS** | `test_security_audit.py`: 401 on missing/invalid key/JWT. |
| **JWT Claims** | Algorithm & Claim Matrix verification | **PASS** | `test_security_audit.py`: strictly enforces HS256, verifies exp/nbf/aud/iss/sub, signature verified before claims. |
| **Protected Endpoints** | `/ocr` requires server key | **PASS** | `test_security_audit.py`: user JWT cannot call `/ocr`. |
| **Rate Limiting** | Sliding window limits DoS | **PASS** | `test_security_audit.py`: 429 Too Many Requests verified. |
| **Model Metrics** | Exact metric reproduction | **PASS** | `test_reproduce_eval.py`: Acc 92.90%, F1 0.9286, ROC-AUC 0.9835. |
| **Data Isolation** | 0 document-level leakage | **PASS** | `test_reproduce_eval.py`: 167 train vs 42 test docs, 0 overlap. |
| **Threshold Tuning** | Validation split isolation | **PASS** | `test_reproduce_eval.py`: 133 subtrain vs 34 val docs (0 overlap), separate model trained without val data. |
| **OCR Evaluation** | Realistic corpus CER/WER | **PASS** | CER 29.57%, WER 29.83% across 18 synthetic layout renderings. |
| **Database Audit** | RPC auth & scope enforcement | **PASS** | `test_live_workflow.mjs`: anonymous rejected; scope checked. |
| **Immutability** | Original OCR value preserved | **PASS** | Direct SQL revoked; `field_value` unchanged by verification. |
| **Offline Safeguard** | Client fallback & UI badge | **PASS** | Heuristic fallback produces `client-heuristic-safeguard-v1.0.0`. |
| **Docker Container** | Container image smoke test | **NOT VERIFIED** | Local Windows Docker daemon offline; Linux CI commands provided. |
| **Code Hygiene** | Linting & TypeScript build | **PASS** | `oxlint`: 0 errors on 95 files; `tsc -b && vite build`: 0 errors. |

---

## 10. Phase 6 Final Security & Evaluation Audit Findings

### 10.1 JWT Authentication Audit
1. **Algorithm Lockdown**:
   - The verification routine `_verify_supabase_jwt()` in `ocr-service/app/main.py` explicitly enforces `alg == "HS256"`.
   - Any token with `alg: "none"`, `RS256`, `ES256`, or missing `alg` header is immediately rejected before signature processing.
2. **Signature-First Verification**:
   - The HMAC-SHA256 signature is cryptographically computed and compared via `hmac.compare_digest` *prior* to parsing or inspecting any payload claims, preventing blind claim trust or forged payloads.
3. **Claim Matrix Validation**:
   - `exp`: Required and strictly checked (with 60-second drift tolerance).
   - `nbf`: Checked when present; rejected if `now < nbf - 60`.
   - `aud`: Strictly checked against `SUPABASE_JWT_AUDIENCE` (default: `"authenticated"`).
   - `iss`: Validated against `SUPABASE_JWT_ISSUER` when configured.
   - `sub`: Validated as a non-empty string identifier.
4. **Service Key vs User JWT Separation**:
   - `/ocr` (heavy extraction) strictly requires `OCR_API_KEY` via server-to-server header.
   - `/ml/*` endpoints accept either matching `OCR_API_KEY` or a valid Supabase user JWT.
   - User JWTs attempting to call `/ocr` are rejected with HTTP 401.

### 10.2 ML Evaluation Leakage Audit
1. **Test Set Isolation**:
   - Verified that the 704 held-out test samples (from 42 distinct documents) were never used during feature normalization, preprocessing, model fitting, or threshold tuning. Document overlap between training and test sets is **0**.
2. **Validation Split Contamination Resolution**:
   - In earlier evaluation pipelines, threshold tuning evaluated the production model (which had been fitted on all 167 training documents) over a 20% random slice, introducing in-sample evaluation bias (optimistic 93.49% recall).
   - In Phase 6, `evaluate_threshold_tuning` was rewritten to group the 167 development documents into 133 sub-train documents ($n=2,675$) and 34 validation documents ($n=701$) with **0 document overlap**.
   - A separate validation model was trained exclusively on the 133 sub-train documents without the validation samples.
   - True out-of-sample threshold sweep results:
     - $\tau = 0.50$ (Default): Recall 87.53%, Precision 100.0%, FPR 0.00%, Missed Errors 53
     - $\tau = 0.40$: Recall 88.00%, Precision 99.47%, FPR 0.72%, Missed Errors 51
     - $\tau = 0.35$ (Recommended): Recall 90.12%, Precision 98.71%, FPR 1.81%, Missed Errors 42
     - $\tau = 0.30$: Recall 91.76%, Precision 97.26%, FPR 3.99%, Missed Errors 35

### 10.3 Credential and Gateway Audit
1. **Frontend Bundle Hygiene**:
   - Automated grep searches across all TypeScript source files (`src/`) and compiled production bundle assets (`dist/assets/*.js`) confirmed **0 occurrences** of `OCR_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or `JWT_SECRET`.
2. **Gateway Protection**:
   - The frontend does not invoke the microservice `/ocr` endpoint. All document ingestion requests route through the Supabase Edge Function `process-document`.
   - `process-document` validates caller authentication, active session, and PostgreSQL geographic scope before requesting signed storage URLs or invoking OCR.
3. **Client-Side Safeguard Isolation**:
   - `clientHeuristicFieldValidator` is a pure in-memory heuristic function that flags fields and suggests corrections in the browser UI. It does not perform database writes or modify state.
   - All human verifications must execute through the `verify_extracted_field` SECURITY DEFINER RPC, which enforces `verification:review` permissions and immutable preservation of the original OCR values.

### 10.4 Deployment Recommendation
- **Verdict**: **RECOMMENDED FOR STAGING / CONTROLLED PILOT DEPLOYMENT**.
- **Conditions**:
  1. Microservice container build must be validated on a Linux CI/CD runner prior to production release (`NOT VERIFIED` on host Windows workstation due to offline Docker daemon).
  2. For deployments handling purely vernacular Tamil scripts, download and mount the `PP-OCRv4_ta` recognition weights.
  3. When scaling out the OCR microservice beyond a single replica, integrate Redis for distributed sliding-window rate limiting.


