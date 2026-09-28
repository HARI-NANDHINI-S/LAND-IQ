# BhoomiAI

**Transforming Legacy Land Records into Trusted Digital Intelligence**

BhoomiAI is a production-grade AI-powered Land Record Digitization, Validation, Intelligence, Monitoring and Decision Support Platform built for Tamil Nadu's land administration.

## Phase Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ COMPLETE | React + Vite + TypeScript + Tailwind + shadcn/ui |
| Phase 2 | ✅ COMPLETE | Supabase Foundation (DB, Auth, RLS, Storage) |
| Phase 3 | 🔄 NEXT | Authentication UI + Protected Routing |

## Architecture

```
React Frontend (Vite + TypeScript)
         ↓ HTTPS
     Supabase
    /    |    \
  Auth  DB   Storage
         |
    Row Level Security
         |
    Application Data
```

## Prerequisites

- Node.js 18+
- A Supabase project (https://supabase.com)

## Supabase Setup

1. Create a project at https://supabase.com
2. Go to SQL Editor and run the migrations in order:
   - `supabase/migrations/20260928000001_initial_schema.sql`
   - `supabase/migrations/20260928000002_seed_data.sql`
3. Enable Storage bucket `bhoomi-documents` (private)

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

⚠️ **NEVER put SUPABASE_SERVICE_ROLE_KEY in VITE_ variables.**

## Local Development

```bash
npm install
npm run dev
```

## Database Migrations

Run the SQL files in `supabase/migrations/` against your Supabase project in order.

## Security Notes

- All sensitive tables have Row Level Security (RLS) enabled
- Super Admin users have full access; District Officers are scoped to their district
- Storage bucket `bhoomi-documents` is PRIVATE — signed URLs required
- Audit logs are append-only (no UPDATE/DELETE policies)
- Never commit `.env` files

## Seed Data

The `20260928000002_seed_data.sql` migration contains **clearly labeled synthetic DEMO data** for Tamil Nadu (Coimbatore, Chennai, Madurai, Salem). All demo records are prefixed with [DEMO] to prevent confusion with real data.
