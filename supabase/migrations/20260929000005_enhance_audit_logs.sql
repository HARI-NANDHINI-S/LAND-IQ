-- ============================================================
-- Enhance Audit Logs Table
-- ============================================================
-- Adds missing fields required for Phase C Audit Logs implementation

ALTER TABLE public.audit_logs
ADD COLUMN IF NOT EXISTS actor_email TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'SUCCESS',
ADD COLUMN IF NOT EXISTS remarks TEXT;

-- Use request_id as correlation_id, or we can just rename it.
-- Let's just add correlation_id for clarity
ALTER TABLE public.audit_logs
ADD COLUMN IF NOT EXISTS correlation_id TEXT;
