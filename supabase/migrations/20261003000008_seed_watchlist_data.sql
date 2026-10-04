-- ============================================================
-- Seed Demo Watchlist Data
-- Temporarily disables enforcement trigger to allow 
-- service-role seeding of demo watchlist entries.
-- ============================================================

ALTER TABLE public.watchlists DISABLE TRIGGER enforce_watchlist_mutation;

INSERT INTO public.watchlists (id, land_record_id, user_id, reason, status, notes)
SELECT 
    'd0000000-0000-0000-0000-000000000001'::uuid,
    lr.id,
    'b4f2f043-0acb-4429-85cd-358ef8580054'::uuid,
    '[DEMO] High-risk record - monitoring for further modifications',
    'ACTIVE',
    'Added to watchlist due to risk score exceeding threshold'
FROM public.land_records lr
WHERE lr.record_number = 'TN-COI-2024-003'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.watchlists (id, land_record_id, user_id, reason, status, notes)
SELECT 
    'd0000000-0000-0000-0000-000000000002'::uuid,
    lr.id,
    'b4f2f043-0acb-4429-85cd-358ef8580054'::uuid,
    '[DEMO] Pending verification - awaiting document validation',
    'ACTIVE',
    'Sale deed verification in progress'
FROM public.land_records lr
WHERE lr.record_number = 'TN-COI-2024-002'
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.watchlists ENABLE TRIGGER enforce_watchlist_mutation;
