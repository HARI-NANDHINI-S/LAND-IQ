# LAND-IQ

LAND-IQ is an AI-powered land-record digitization, validation, and intelligence platform. The frontend is built with React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, and TanStack Query. Supabase provides Auth, PostgreSQL, Storage, Edge Functions, SQL RPCs, and Row-Level Security (RLS). A dedicated Python FastAPI microservice powered by PaddleOCR performs local and self-hosted OCR extraction.

---

## Architecture & System Overview

- **Frontend**: Single-page application using React 19 and TanStack Query. Communicates directly with Supabase via the public `anon` key, bounded by PostgreSQL RLS.
- **Database & Storage**: Hosted Supabase PostgreSQL database with 28 RLS-protected tables, strict role-based access control (RBAC), and private document storage (`bhoomi-documents`).
- **OCR & ML Microservice**: Python FastAPI service running local PaddleOCR (`PP-OCRv6`, `UVDoc`, `PP-LCNet`) and Random Forest ML Field Error Detection & Candidate Correction Validator. Supports both multipart file uploads and secure remote fetching via signed URLs.
- **ML Field Validator & Deployment Guide**: See [DEPLOYMENT_AND_RELEASE_GUIDE.md](DEPLOYMENT_AND_RELEASE_GUIDE.md) for complete evaluation metrics, reproducible benchmarks, Docker configuration, and statutory safeguards.
- **Edge Functions**:
  - `process-document`: Server-side trusted OCR processing gateway utilizing `service_role` privileges to validate scopes and persist extracted data.
  - `bhoomivoice-chat`: Natural language assistant using Groq LLM integration (`qwen/qwen3.8-27b`) scoped to the caller's database permissions.

---

## Required Software & Versions

- **Node.js**: `v20.19+` or `v22.12+` (Node 26+ also supported)
- **npm**: `v10+` or `v11+`
- **Python**: `3.11` to `3.13` (with 64-bit architecture)
- **Supabase CLI**: `v2.119+`
- **Docker** (optional, for containerized OCR deployment): Docker Engine `24+` & Compose `v2+`

---

## Environment Variables

All secrets must remain private. Never commit actual API keys or service role secrets.

### 1. Frontend (`.env` — Public Browser Variables)

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Supabase Project URL (Public) | `https://your-project.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase Public Anon Key (Bound by RLS) | `eyJhbGciOi...` |
| `VITE_OCR_SERVICE_URL` | OCR Microservice URL (Client endpoint) | `http://127.0.0.1:8001` (local) or `https://ocr.yourdomain.com` (prod) |

> ⚠️ **CRITICAL SECURITY RULE**: Never place private backend secrets (`OCR_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or DB credentials) in `VITE_*` variables. Any variable prefixed with `VITE_` is bundled into compiled client JavaScript. Server-to-server keys belong strictly in backend microservice configs and Supabase Edge Function secrets.

### 2. OCR Microservice Environment (`ocr-service/.env` or Docker)

| Variable | Description | Default |
| :--- | :--- | :--- |
| `OCR_API_KEY` | Shared secret for incoming request authorization | `""` (unauthenticated for local dev) |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins | `http://localhost:5173,http://127.0.0.1:5173` |
| `MAX_CONCURRENT_OCR` | Maximum concurrent OCR processing tasks | `4` |
| `MAX_FILE_SIZE_BYTES` | Maximum upload size in bytes | `26214400` (25 MiB) |
| `MAX_PDF_PAGES` | Maximum allowed pages per PDF | `50` |

### 3. Supabase Edge Function Secrets (`supabase secrets set`)

| Secret Name | Description | Example |
| :--- | :--- | :--- |
| `OCR_PROVIDER_URL` | Public HTTPS endpoint of deployed OCR service | `https://ocr.yourdomain.com/ocr` |
| `OCR_PROVIDER_API_KEY` | Bearer token / API key matching `OCR_API_KEY` | `your-secure-shared-key` |
| `OCR_PROVIDER_NAME` | Provider label stored in database | `PaddleOCR Production` |
| `GROQ_API_KEY` | Groq API Key for BhoomiVoice LLM | `gsk_...` |
| `GROQ_MODEL` | Groq model identifier | `qwen/qwen3.8-27b` |

---

## Local Development Setup

### 1. Frontend Web App

```sh
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# 3. Start development server
npm run dev
# The application will be accessible at http://localhost:5173
```

### 2. Local OCR Service

```powershell
# Navigate to ocr-service
cd ocr-service

# Activate Python virtual environment (Windows PowerShell)
.\.venv\Scripts\Activate.ps1

# (If initializing a new virtual environment)
# python -m venv .venv
# pip install -r requirements.txt

# Start FastAPI server on port 8001
uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

Health check: verify `http://127.0.0.1:8001/health` returns `{"status":"ok"}`.

---

## Production OCR Service Deployment

To deploy the OCR service so Supabase Edge Functions can reach it in production:

### Option A: Docker Deployment (Recommended)

1. Build and run using Docker Compose:
   ```sh
   cd ocr-service
   docker compose up -d --build
   ```
2. Place behind an HTTPS reverse proxy (Nginx, Caddy, Cloudflare Tunnel, or AWS ALB) with SSL/TLS termination.
3. Configure `OCR_API_KEY` in the container environment.
4. Set the Supabase Edge Function secrets:
   ```sh
   npx supabase secrets set OCR_PROVIDER_URL="https://ocr.yourdomain.com/ocr" OCR_PROVIDER_API_KEY="your-secret-key"
   ```

### Option B: Cloud Container Hosting (Render, Railway, Fly.io, Cloud Run)

1. Connect the `ocr-service/` directory with `Dockerfile`.
2. Allocate at least 2 GB RAM and 1-2 vCPUs for PaddleOCR inference.
3. Set environment variables: `OCR_API_KEY`, `CORS_ORIGINS`, `MAX_CONCURRENT_OCR=2`.
4. Copy the public service HTTPS URL and set it in Supabase Edge Function secrets as described above.

---

## Testing & Validation

Run the following test commands:

```sh
# 1. Typecheck and bundle production assets
npm run build

# 2. Lint codebase for syntax and code health
npm run lint

# 3. Check Supabase connection and read access
npm run test:supabase:connectivity

# 4. Run automated PaddleOCR inference and contract tests
npm run test:ocr
```

### Privileged Database Security Contract Tests

Run database contract tests using the Supabase CLI against the linked project:

```sh
npx supabase db query --file supabase/tests/production_security_contract.sql --linked
npx supabase db query --file supabase/tests/document_ocr_state_behavior.sql --linked
npx supabase db query --file supabase/tests/profile_security_behavior.sql --linked
npx supabase db query --file supabase/tests/intelligence_workflow_behavior.sql --linked
npx supabase db query --file supabase/tests/bhoomivoice_session_ownership.sql --linked
npx supabase db query --file supabase/tests/analytics_aggregation_security.sql --linked
npx supabase db query --file supabase/tests/gis_summary_security.sql --linked
npx supabase db query --file supabase/tests/notification_security_behavior.sql --linked
```

All 8 tests execute within isolated rollback transactions (`BEGIN; ... ROLLBACK;`) and write no permanent test fixtures.

---

## Authentication & Default Roles

Six roles are supported:
- `SUPER_ADMIN`
- `STATE_ADMIN`
- `DISTRICT_OFFICER`
- `DATA_ENTRY_OFFICER`
- `VERIFICATION_OFFICER`
- `VIEWER`

Initial Super Admin credentials for testing:
- **Email**: `admin@landiq.local`
- **Role**: `SUPER_ADMIN`

---

## Troubleshooting Common Issues

1. **`getaddrinfo ENOTFOUND *.supabase.co` or 521 Cloudflare Error**:
   - The Supabase free-tier project may have paused due to inactivity. Restore it via the Supabase dashboard or via the Supabase Management API (`POST https://api.supabase.com/v1/projects/{ref}/restore`).
2. **`Could not find the table 'public.profiles' in the schema cache`**:
   - PostgREST cache reload needed after database startup. Run:
     `npx supabase db query "NOTIFY pgrst, 'reload schema';" --linked`
3. **`OCR service is unavailable`**:
   - Ensure the Python OCR service is running on `http://127.0.0.1:8001` (`npm run test:ocr` can verify health and inference).
4. **`Users cannot change role_id`**:
   - Protected authorization columns must be changed through `public.admin_update_profile_authorization(...)` by a `SUPER_ADMIN`. Direct client mutations are blocked by triggers.

---

## Known Limitations & Remaining Manual Actions

1. **Production OCR Deployment**: The OCR service is containerized, hardened, and deployment-ready (`Dockerfile`, `docker-compose.yml`, `requirements.txt`). Live cloud deployment requires the operator's cloud hosting credentials.
2. **Edge Function Secrets**: Once the production OCR service is deployed to an HTTPS URL, run `npx supabase secrets set OCR_PROVIDER_URL=... OCR_PROVIDER_API_KEY=...`.
3. **Browser Automation in Offline Sandbox**: Playwright driver binary installation requires internet connectivity for driver downloads; interactive browser tests were simulated and validated via direct API and unit tests.
