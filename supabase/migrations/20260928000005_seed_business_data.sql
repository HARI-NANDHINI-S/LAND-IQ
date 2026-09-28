-- ============================================================
-- BhoomiAI - Corrective Business Data Seed Migration
-- ============================================================
-- ROOT CAUSE OF PREVIOUS FAILURE:
-- The original seed transaction rolled back entirely because of 
-- some partial failure or environment execution issue, leaving 
-- the tables empty. This migration safely inserts the geographic 
-- and land records demo data in the correct dependency order.
-- ============================================================

-- ============================================================
-- 1. GEOGRAPHIC HIERARCHY
-- ============================================================
INSERT INTO public.states (id, name, code) VALUES
    ('10000000-0000-0000-0000-000000000001', 'Tamil Nadu', 'TN')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.districts (id, state_id, name, code) VALUES
    ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Coimbatore', 'TN-CBE'),
    ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Chennai', 'TN-CHN'),
    ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Madurai', 'TN-MDU'),
    ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Salem', 'TN-SLM')
ON CONFLICT DO NOTHING;

INSERT INTO public.taluks (id, district_id, name, code) VALUES
    ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Coimbatore North', 'CBE-N'),
    ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Coimbatore South', 'CBE-S'),
    ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Pollachi', 'CBE-POL'),
    ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'Egmore', 'CHN-EGM'),
    ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', 'Tambaram', 'CHN-TBM')
ON CONFLICT DO NOTHING;

INSERT INTO public.villages (id, taluk_id, name, code) VALUES
    ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Perur', 'CBE-N-PRU'),
    ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'Saravanampatti', 'CBE-N-SRV'),
    ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'Ondipudur', 'CBE-S-OND'),
    ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', 'Singanallur', 'CBE-S-SNG'),
    ('40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000003', 'Pollachi Town', 'POL-TWN')
ON CONFLICT DO NOTHING;


-- ============================================================
-- 2. LAND RECORDS (Demo - Clearly Labeled Synthetic Records)
-- ============================================================
INSERT INTO public.land_owners (id, full_name, identification_reference) VALUES
    ('50000000-0000-0000-0000-000000000001', 'Ramesh Kumar (DEMO)', 'DEMO-ID-001'),
    ('50000000-0000-0000-0000-000000000002', 'Lakshmi Devi (DEMO)', 'DEMO-ID-002'),
    ('50000000-0000-0000-0000-000000000003', 'Arun Kumar (DEMO)', 'DEMO-ID-003'),
    ('50000000-0000-0000-0000-000000000004', 'Meena Krishnan (DEMO)', 'DEMO-ID-004')
ON CONFLICT DO NOTHING;

INSERT INTO public.land_records (
    id, record_number, survey_number, patta_number,
    state_id, district_id, taluk_id, village_id,
    land_area, land_area_unit, land_classification, land_type,
    record_status, verification_status, remarks
) VALUES
    (
        '60000000-0000-0000-0000-000000000001',
        'TN-COI-2024-001',
        '124/3',
        'PAT-2024-001',
        '10000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001',
        '30000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000001',
        2.5, 'acres', 'Agricultural', 'Wet Land',
        'ACTIVE', 'APPROVED',
        '[DEMO RECORD] Synthetic data for development purposes only'
    ),
    (
        '60000000-0000-0000-0000-000000000002',
        'TN-COI-2024-002',
        '200/1A',
        'PAT-2024-002',
        '10000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001',
        '30000000-0000-0000-0000-000000000002',
        '40000000-0000-0000-0000-000000000003',
        1.2, 'acres', 'Residential', 'Dry Land',
        'ACTIVE', 'PENDING',
        '[DEMO RECORD] Synthetic data for development purposes only'
    ),
    (
        '60000000-0000-0000-0000-000000000003',
        'TN-COI-2024-003',
        '315/2B',
        'PAT-2024-003',
        '10000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001',
        '30000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000002',
        0.75, 'acres', 'Commercial', 'Dry Land',
        'ACTIVE', 'UNDER_REVIEW',
        '[DEMO RECORD] Synthetic data for development purposes only'
    )
ON CONFLICT (record_number) DO NOTHING;

INSERT INTO public.land_record_owners (land_record_id, owner_id, ownership_percentage, ownership_type, is_primary, effective_from) VALUES
    ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 100, 'SOLE', true, '2020-01-01'),
    ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 60, 'JOINT', true, '2021-06-15'),
    ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000003', 40, 'JOINT', false, '2021-06-15'),
    ('60000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000004', 100, 'SOLE', true, '2019-03-10')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. INTELLIGENCE (Risks and Alerts)
-- ============================================================
INSERT INTO public.risk_assessments (id, land_record_id, risk_score, risk_level, calculation_version) VALUES
    ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 15.0, 'LOW', 'v1.0-rules-engine-demo'),
    ('70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002', 42.0, 'MODERATE', 'v1.0-rules-engine-demo'),
    ('70000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000003', 68.0, 'HIGH', 'v1.0-rules-engine-demo')
ON CONFLICT DO NOTHING;

INSERT INTO public.risk_signals (risk_assessment_id, signal_type, description, contribution, evidence) VALUES
    (
        '70000000-0000-0000-0000-000000000003',
        'DATA_INCONSISTENCY',
        '[DEMO] Survey number pattern inconsistency detected in demo record',
        35.0,
        '{"field": "survey_number", "note": "demo_data"}'::jsonb
    ),
    (
        '70000000-0000-0000-0000-000000000003',
        'REPEATED_MODIFICATION',
        '[DEMO] Record modified multiple times in short period (demo signal)',
        33.0,
        '{"count": 5, "period_days": 30, "note": "demo_data"}'::jsonb
    )
ON CONFLICT DO NOTHING;

INSERT INTO public.alerts (land_record_id, alert_type, priority, title, description, status) VALUES
    (
        '60000000-0000-0000-0000-000000000003',
        'RISK_ALERT',
        'HIGH',
        '[DEMO] High Risk Record Detected',
        'Demo alert: Risk score 68/100 - repeated modification signal detected in synthetic record.',
        'NEW'
    )
ON CONFLICT DO NOTHING;
