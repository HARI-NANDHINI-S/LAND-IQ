# LAND-IQ

LAND-IQ is a land-record administration and intelligence application. The frontend is React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, and TanStack Query. Supabase provides Auth, PostgreSQL, Storage, SQL functions, and RLS.

## Architecture

The browser uses the Supabase anon key and calls Supabase directly. React Query caches service results; RLS remains the authorization boundary. Frontend permission checks control presentation and workflow affordances but do not replace database authorization. There is no separate application server in this repository.

Main service areas include `src/services/auth`, `land-records`, `documents`, `verification`, `risk`, `monitoring`, `geographic`, `analyticsService.ts`, `duplicateService.ts`, `profileService.ts`, and `bhoomiVoiceService.ts`.

## Local Setup

Prerequisites: Node.js 20.19+ or 22.12+, npm, and access to the LAND-IQ Supabase project.

1. Run `npm install`.
2. Copy `.env.example` to `.env` and set the Supabase project URL and public anon key.
3. Run `npm run dev` and open the URL printed by Vite.

Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` belong in frontend environment configuration. Never put a service-role key or other private secret in a `VITE_` variable or frontend file. `.env` is ignored by Git; verify `git status` before committing.

## Authentication And Authorization

Supported roles are `SUPER_ADMIN`, `STATE_ADMIN`, `DISTRICT_OFFICER`, `DATA_ENTRY_OFFICER`, `VERIFICATION_OFFICER`, and `VIEWER`. Role permissions are seeded in `20260928000004_seed_rbac_data.sql`.

Profile scope and protected authorization fields are controlled by the database. Normal users can update only safe fields on their own profile. `SUPER_ADMIN` role/scope changes use `public.admin_update_profile_authorization(...)`; direct authenticated updates to protected profile columns and inserts are revoked. `public.user_role()`, `public.user_state_id()`, `public.user_district_id()`, and `public.has_permission(...)` support RLS decisions.

Important routes include `/login`, `/dashboard`, `/land-records`, `/land-records/new`, `/land-records/:id`, `/land-records/:id/edit`, `/documents`, `/documents/:id`, `/verification`, `/verification/:id`, `/duplicates`, `/duplicates/:id`, `/risk`, `/risk/:id`, `/monitoring`, `/monitoring/alerts/:id`, `/monitoring/watchlists`, `/monitoring/watchlists/:id`, `/gis`, `/analytics`, `/bhoomi-voice`, and `/users`. `/assistant` and the existing `/risk-intelligence` redirects are retained for compatibility.

## Supabase And Migrations

Migrations are ordered in `supabase/migrations/`. Review the linked project's migration history before applying anything. Use the Supabase CLI's `migration list` and `db push` only after confirming which versions are already applied and reviewing every pending SQL file. Do not use `supabase db reset` against a shared or production project.

The `bhoomi-documents` bucket is private, limited to PDF/JPEG/PNG and 25 MiB. Document downloads use short-lived signed URLs; storage-object access is expected to follow document-row RLS and state/district scope. Review the storage policies and `supabase/tests/production_security_contract.sql` after applying the storage hardening migration.

Several existing migrations contain seed data. In particular, `20260928000005_seed_business_data.sql` inserts synthetic land records and related operational fixtures. Those rows are useful for development and testing, not real government records. The migration is already part of the migration history; do not delete or replay it to clean a deployed database. Production rollout is blocked until the deployment owner confirms the target database's migration state and approves a safe demo-data strategy.

The local `supabase/config.toml` disables the nonexistent standalone `seed.sql` hook; demo fixtures are currently embedded in migrations. Its auth URL/password/signup settings apply to local Supabase CLI configuration, not automatically to the hosted project. Configure hosted Auth redirect URLs, password policy, signup policy, and Storage settings separately for each environment.

## Validation

```sh
npm run build
npm run lint
npm run test:supabase:connectivity
```

`npm run test:supabase:connectivity` performs a read-only query against `roles` using `.env`. `supabase/tests/profile_security_behavior.sql` is a transaction-based profile security test for a privileged SQL editor. `supabase/tests/production_security_contract.sql` checks RLS, role grants, profile privileges, authorization function settings, and storage policy presence without writing rows. Neither SQL test has been executed automatically by the npm scripts.

## Deployment

1. Review the hosted Supabase migration history and the demo-data blocker above; do not reset the database.
2. Apply only reviewed, unapplied migrations through the existing Supabase project.
3. Configure hosted Auth redirect URLs for the production origin, and verify password/signup settings.
4. Confirm the private document bucket, allowed MIME types, size limit, and scoped object policies in the hosted project.
5. Configure the hosting environment with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only.
6. Run the build and lint commands, publish the Vite `dist/` output to the existing static host, and configure SPA fallback to `index.html` for React Router routes.
7. Run authenticated smoke tests for each role and geography scope before opening access to production users.

## Known Limitations And Blockers

- Geography IDs in the existing seed data are UUID-shaped but not RFC-compliant v4 UUIDs; Zod v4 `z.uuid()` rejects them in Land Record Create/Edit. This is intentionally deferred.
- The current seeded dataset has synthetic Tamil Nadu geography, owners, records, and risk/alert fixtures. Do not represent it as live government data.
- Full cross-role, cross-district RLS behavior tests require representative role/scope fixtures. Do not create temporary production users to manufacture those fixtures.
- The current test suite is not a comprehensive browser or service test suite; see the actual validation results for what has been run.
- Audit writes are performed separately from business mutations and are currently best-effort in `auditService`; atomic mutation-plus-audit guarantees need a database transaction/RPC design before claiming compliance-grade completeness.
- If document metadata deletion succeeds but Storage deletion fails, the service now reports the orphaned-object condition; manual reconciliation may still be required.
