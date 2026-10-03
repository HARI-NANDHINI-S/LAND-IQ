-- ============================================================
-- ENHANCE WATCHLISTS
-- ============================================================

ALTER TABLE public.watchlists
ADD COLUMN IF NOT EXISTS notes TEXT;
