-- ============================================================
-- ENHANCE RISK ASSESSMENTS
-- ============================================================

ALTER TABLE public.risk_assessments
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS investigation_notes TEXT;

ALTER TABLE public.risk_signals
ADD COLUMN IF NOT EXISTS severity TEXT CHECK (severity IN ('LOW', 'MODERATE', 'HIGH', 'CRITICAL'));
