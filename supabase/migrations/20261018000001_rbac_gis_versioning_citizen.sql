-- ============================================================
-- MIGRATION: 20261018000001_rbac_gis_versioning_citizen.sql
-- Role-Based Access Control + Three Advanced Land-Record Features:
-- 1. Five-Role RBAC Model (Citizen, Clerk, Officer, Supervisor, Admin)
-- 2. Feature 1: Geospatial Land-Record Cross-Validation
-- 3. Feature 2: Record Versioning and Change-Impact Tracking
-- 4. Feature 3: Citizen Application Tracking & Discrepancy Resolution
-- ============================================================

-- ============================================================
-- SECTION 1: ROLES & FINE-GRAINED PERMISSIONS
-- ============================================================

-- Seed CITIZEN role (Customer synonym)
INSERT INTO public.roles (id, code, name, description) VALUES
    ('00000000-0000-0000-0000-000000000011', 'CITIZEN', 'Citizen / Landowner', 'Citizen self-service portal, digitization requests, document tracking')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Seed advanced feature permissions
INSERT INTO public.permissions (code, description) VALUES
    ('application:create', 'Submit citizen land record applications'),
    ('application:read', 'View citizen land record applications'),
    ('application:update', 'Update and review citizen applications'),
    ('application:decide', 'Approve or reject citizen applications'),
    ('gis:validate', 'Perform GIS cross-validation against cadastral records'),
    ('gis:resolve', 'Resolve GIS boundary and parcel discrepancies'),
    ('version:read', 'View land record version history and change comparison')
ON CONFLICT (code) DO NOTHING;

-- Grant all permissions to SUPER_ADMIN
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000001', id
FROM public.permissions
ON CONFLICT DO NOTHING;

-- Grant supervisory permissions to STATE_ADMIN
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000002', id
FROM public.permissions
WHERE code IN (
    'application:read', 'application:update', 'application:decide',
    'gis:validate', 'gis:resolve', 'version:read'
)
ON CONFLICT DO NOTHING;

-- Grant supervisor permissions to DISTRICT_OFFICER
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000003', id
FROM public.permissions
WHERE code IN (
    'application:read', 'application:update', 'application:decide',
    'gis:validate', 'gis:resolve', 'version:read'
)
ON CONFLICT DO NOTHING;

-- Grant clerk permissions to DATA_ENTRY_OFFICER (Registration Clerk)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000004', id
FROM public.permissions
WHERE code IN (
    'application:read', 'application:update',
    'gis:validate', 'version:read'
)
ON CONFLICT DO NOTHING;

-- Grant verification officer permissions to VERIFICATION_OFFICER
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000005', id
FROM public.permissions
WHERE code IN (
    'application:read', 'application:update', 'application:decide',
    'gis:validate', 'gis:resolve', 'version:read'
)
ON CONFLICT DO NOTHING;

-- Grant citizen permissions to CITIZEN & CUSTOMER
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('CITIZEN', 'CUSTOMER')
  AND p.code IN (
      'application:create', 'application:read',
      'document:create', 'document:read', 'document:download',
      'land_record:read', 'customer:portal', 'assistant:use', 'version:read'
  )
ON CONFLICT DO NOTHING;

-- Update can_access_geographic_scope() to treat CITIZEN and CUSTOMER with ownership isolation
CREATE OR REPLACE FUNCTION public.can_access_geographic_scope(
    p_state_id UUID,
    p_district_id UUID,
    p_village_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT CASE public.user_role()
        WHEN 'SUPER_ADMIN' THEN TRUE
        WHEN 'STATE_ADMIN' THEN p_state_id = public.user_state_id()
            AND (public.user_village_id() IS NULL OR p_village_id = public.user_village_id())
        WHEN 'DISTRICT_OFFICER' THEN p_district_id = public.user_district_id()
            AND (public.user_village_id() IS NULL OR p_village_id = public.user_village_id())
        WHEN 'DATA_ENTRY_OFFICER' THEN p_district_id = public.user_district_id()
            AND (public.user_village_id() IS NULL OR p_village_id = public.user_village_id())
        WHEN 'VERIFICATION_OFFICER' THEN p_district_id = public.user_district_id()
            AND (public.user_village_id() IS NULL OR p_village_id = public.user_village_id())
        WHEN 'VIEWER' THEN p_district_id = public.user_district_id()
            AND (public.user_village_id() IS NULL OR p_village_id = public.user_village_id())
        WHEN 'AUDITOR' THEN (public.user_district_id() IS NULL OR p_district_id = public.user_district_id())
        WHEN 'GIS_ANALYST' THEN (public.user_state_id() IS NULL OR p_state_id = public.user_state_id())
            AND (public.user_district_id() IS NULL OR p_district_id = public.user_district_id())
        WHEN 'RISK_ANALYST' THEN (public.user_state_id() IS NULL OR p_state_id = public.user_state_id())
            AND (public.user_district_id() IS NULL OR p_district_id = public.user_district_id())
        WHEN 'CUSTOMER' THEN TRUE -- Access restricted by ownership / uploader / status policies
        WHEN 'CITIZEN' THEN TRUE  -- Access restricted by ownership / uploader / status policies
        ELSE FALSE
    END;
$$;

REVOKE ALL ON FUNCTION public.can_access_geographic_scope(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_geographic_scope(UUID, UUID, UUID) TO authenticated;


-- ============================================================
-- SECTION 2: FEATURE 1 — GEOSPATIAL LAND-RECORD CROSS-VALIDATION
-- ============================================================

-- Authoritative cadastral parcels reference table
CREATE TABLE IF NOT EXISTS public.cadastral_parcels (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    parcel_id TEXT UNIQUE NOT NULL,
    state_id UUID NOT NULL REFERENCES public.states(id),
    district_id UUID NOT NULL REFERENCES public.districts(id),
    taluk_id UUID REFERENCES public.taluks(id),
    village_id UUID NOT NULL REFERENCES public.villages(id),
    survey_number TEXT NOT NULL,
    subdivision_number TEXT,
    parcel_area NUMERIC(10,2) NOT NULL,
    area_unit TEXT NOT NULL DEFAULT 'Acres',
    land_use TEXT DEFAULT 'AGRICULTURAL',
    boundary_geometry extensions.geometry(Geometry, 4326),
    boundary_geojson JSONB,
    cadastral_source TEXT NOT NULL DEFAULT 'TN-CADASTRAL-SURVEY-AUTHORITY',
    source_timestamp TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cadastral_parcels_geom_gix
    ON public.cadastral_parcels USING GIST (boundary_geometry);
CREATE INDEX IF NOT EXISTS cadastral_parcels_lookup_idx
    ON public.cadastral_parcels (village_id, survey_number);

-- GIS Cross-Validation outcomes and discrepancy tracking
CREATE TABLE IF NOT EXISTS public.gis_cross_validations (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    land_record_id UUID REFERENCES public.land_records(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    state_id UUID REFERENCES public.states(id),
    district_id UUID REFERENCES public.districts(id),
    village_id UUID REFERENCES public.villages(id),
    extracted_survey_number TEXT,
    extracted_subdivision TEXT,
    extracted_area TEXT,
    matched_parcel_id TEXT,
    cadastral_survey_number TEXT,
    cadastral_area NUMERIC(10,2),
    cadastral_area_unit TEXT,
    validation_status TEXT NOT NULL CHECK (
        validation_status IN (
            'MATCHED',
            'POSSIBLE_MISMATCH',
            'AMBIGUOUS_MATCH',
            'NO_MATCH',
            'SOURCE_DATA_UNAVAILABLE',
            'NOT_YET_VALIDATED'
        )
    ) DEFAULT 'NOT_YET_VALIDATED',
    confidence_score NUMERIC(5,2) DEFAULT 0.0,
    discrepancies JSONB DEFAULT '[]'::jsonb,
    is_duplicate_parcel BOOLEAN DEFAULT FALSE,
    has_geometry_overlap BOOLEAN DEFAULT FALSE,
    overlapping_parcel_ids JSONB DEFAULT '[]'::jsonb,
    geometry_geojson JSONB,
    cadastral_source TEXT DEFAULT 'TN-CADASTRAL-SURVEY-AUTHORITY',
    source_timestamp TIMESTAMPTZ DEFAULT NOW(),
    officer_resolution_status TEXT DEFAULT 'PENDING' CHECK (
        officer_resolution_status IN (
            'PENDING',
            'ACCEPTED_OVERRIDE',
            'CONFIRMED_MATCH',
            'REJECTED_DISCREPANCY'
        )
    ),
    officer_notes TEXT,
    resolved_by UUID REFERENCES public.profiles(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gis_cross_validations_record_idx
    ON public.gis_cross_validations (land_record_id);
CREATE INDEX IF NOT EXISTS gis_cross_validations_status_idx
    ON public.gis_cross_validations (validation_status);

-- Seed authoritative cadastral reference parcels for Coimbatore benchmarks
INSERT INTO public.cadastral_parcels (
    parcel_id, state_id, district_id, village_id,
    survey_number, subdivision_number, parcel_area, area_unit,
    land_use, cadastral_source, boundary_geometry, boundary_geojson
) VALUES
(
    'TN-COI-PER-P124-3',
    '109a3667-5740-45ef-a3c4-f0577f9b454b',
    '0aa083a3-218f-4e22-b9b0-6e3fa3bfa9e4',
    '2d114ae7-1e10-41dc-9db5-45b206173fe1',
    '124/3', '3', 2.50, 'Acres', 'AGRICULTURAL', 'TN-CADASTRAL-SURVEY-AUTHORITY',
    extensions.ST_SetSRID(extensions.ST_GeomFromText('POLYGON((76.9178 10.9708, 76.9192 10.9708, 76.9192 10.9718, 76.9178 10.9718, 76.9178 10.9708))'), 4326),
    '{"type":"Polygon","coordinates":[[[76.9178,10.9708],[76.9192,10.9708],[76.9192,10.9718],[76.9178,10.9718],[76.9178,10.9708]]]}'::jsonb
),
(
    'TN-COI-OND-P200-1A',
    '109a3667-5740-45ef-a3c4-f0577f9b454b',
    '0aa083a3-218f-4e22-b9b0-6e3fa3bfa9e4',
    '0592e87c-6c09-45cf-820c-72c3d613fb2f',
    '200/1A', '1A', 1.20, 'Acres', 'RESIDENTIAL', 'TN-CADASTRAL-SURVEY-AUTHORITY',
    extensions.ST_SetSRID(extensions.ST_GeomFromText('POLYGON((77.0365 11.0024, 77.0375 11.0024, 77.0375 11.0032, 77.0365 11.0032, 77.0365 11.0024))'), 4326),
    '{"type":"Polygon","coordinates":[[[77.0365,11.0024],[77.0375,11.0024],[77.0375,11.0032],[77.0365,11.0032],[77.0365,11.0024]]]}'::jsonb
),
(
    'TN-COI-SAR-P315-2B',
    '109a3667-5740-45ef-a3c4-f0577f9b454b',
    '0aa083a3-218f-4e22-b9b0-6e3fa3bfa9e4',
    '456f87a6-f5ee-4a36-9bce-107149b343e5',
    '315/2B', '2B', 0.75, 'Acres', 'COMMERCIAL', 'TN-CADASTRAL-SURVEY-AUTHORITY',
    extensions.ST_SetSRID(extensions.ST_GeomFromText('POLYGON((76.9940 11.0801, 76.9948 11.0801, 76.9948 11.0808, 76.9940 11.0808, 76.9940 11.0801))'), 4326),
    '{"type":"Polygon","coordinates":[[[76.9940,11.0801],[76.9948,11.0801],[76.9948,11.0808],[76.9940,11.0808],[76.9940,11.0801]]]}'::jsonb
),
(
    'TN-COI-PER-P124-CONFLICT',
    '109a3667-5740-45ef-a3c4-f0577f9b454b',
    '0aa083a3-218f-4e22-b9b0-6e3fa3bfa9e4',
    '2d114ae7-1e10-41dc-9db5-45b206173fe1',
    '124/3-ENCROACH', '3', 0.80, 'Acres', 'AGRICULTURAL', 'TN-CADASTRAL-SURVEY-AUTHORITY',
    extensions.ST_SetSRID(extensions.ST_GeomFromText('POLYGON((76.9185 10.9710, 76.9200 10.9710, 76.9200 10.9720, 76.9185 10.9720, 76.9185 10.9710))'), 4326),
    '{"type":"Polygon","coordinates":[[[76.9185,10.9710],[76.9200,10.9710],[76.9200,10.9720],[76.9185,10.9720],[76.9185,10.9710]]]}'::jsonb
)
ON CONFLICT (parcel_id) DO UPDATE
SET parcel_area = EXCLUDED.parcel_area,
    boundary_geometry = EXCLUDED.boundary_geometry,
    boundary_geojson = EXCLUDED.boundary_geojson;

-- RPC: Perform GIS Cross-Validation
CREATE OR REPLACE FUNCTION public.perform_gis_cross_validation(
    p_land_record_id UUID,
    p_document_id UUID DEFAULT NULL
)
RETURNS public.gis_cross_validations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_record public.land_records;
    v_cadastral public.cadastral_parcels;
    v_cadastral_count INTEGER;
    v_validation public.gis_cross_validations;
    v_status TEXT := 'NOT_YET_VALIDATED';
    v_confidence NUMERIC(5,2) := 95.0;
    v_discrepancies JSONB := '[]'::jsonb;
    v_is_dup BOOLEAN := FALSE;
    v_has_overlap BOOLEAN := FALSE;
    v_overlapping_ids JSONB := '[]'::jsonb;
    v_clean_survey TEXT;
    v_area_diff_pct NUMERIC;
BEGIN
    SELECT * INTO v_record FROM public.land_records WHERE id = p_land_record_id;
    IF v_record.id IS NULL THEN
        RAISE EXCEPTION 'Land record % not found.', p_land_record_id;
    END IF;

    IF NOT public.can_access_geographic_scope(v_record.state_id, v_record.district_id, v_record.village_id) THEN
        RAISE EXCEPTION 'You do not have geographic permission to validate this record.';
    END IF;

    v_clean_survey := TRIM(v_record.survey_number);

    -- Check if cadastral source exists for village
    SELECT COUNT(*) INTO v_cadastral_count
    FROM public.cadastral_parcels
    WHERE village_id = v_record.village_id;

    IF v_cadastral_count = 0 THEN
        v_status := 'SOURCE_DATA_UNAVAILABLE';
        v_confidence := 0.0;
        v_discrepancies := jsonb_build_array('No authoritative cadastral survey data available for village.');
    ELSE
        -- Query matching parcel
        SELECT * INTO v_cadastral
        FROM public.cadastral_parcels
        WHERE village_id = v_record.village_id
          AND survey_number = v_clean_survey
        LIMIT 1;

        IF v_cadastral.id IS NULL THEN
            -- Check partial or ambiguous match
            SELECT COUNT(*) INTO v_cadastral_count
            FROM public.cadastral_parcels
            WHERE village_id = v_record.village_id
              AND (survey_number ILIKE '%' || split_part(v_clean_survey, '/', 1) || '%' OR survey_number ILIKE '%' || v_clean_survey || '%');

            IF v_cadastral_count > 1 THEN
                v_status := 'AMBIGUOUS_MATCH';
                v_confidence := 65.0;
                v_discrepancies := jsonb_build_array(format('Multiple (%s) candidate cadastral parcels match base survey %s.', v_cadastral_count, split_part(v_clean_survey, '/', 1)));
            ELSE
                v_status := 'NO_MATCH';
                v_confidence := 30.0;
                v_discrepancies := jsonb_build_array(format('Survey number %s does not exist in authoritative village cadastral register.', v_clean_survey));
            END IF;
        ELSE
            -- Exact survey match found! Compare attributes & geometry
            v_status := 'MATCHED';
            v_confidence := 98.0;

            -- Check duplicate parcel reference in existing land records
            SELECT EXISTS (
                SELECT 1 FROM public.land_records
                WHERE id <> v_record.id
                  AND village_id = v_record.village_id
                  AND survey_number = v_clean_survey
            ) INTO v_is_dup;

            IF v_is_dup THEN
                v_status := 'POSSIBLE_MISMATCH';
                v_confidence := 70.0;
                v_discrepancies := v_discrepancies || jsonb_build_array(format('Potential duplicate: Another record references survey %s in this village.', v_clean_survey));
            END IF;

            -- Compare area if numeric comparison feasible
            IF v_record.land_area IS NOT NULL AND v_cadastral.parcel_area > 0 THEN
                BEGIN
                    -- Extract numeric portion from record area string (e.g. '2.50 Acres' -> 2.50)
                    DECLARE
                        v_rec_num NUMERIC;
                    BEGIN
                        v_rec_num := (regexp_match(v_record.land_area, '([0-9]+(\.[0-9]+)?)'))[1]::NUMERIC;
                        IF v_rec_num IS NOT NULL THEN
                            v_area_diff_pct := ABS(v_rec_num - v_cadastral.parcel_area) / v_cadastral.parcel_area * 100.0;
                            IF v_area_diff_pct > 15.0 THEN
                                v_status := 'POSSIBLE_MISMATCH';
                                v_confidence := 75.0;
                                v_discrepancies := v_discrepancies || jsonb_build_array(
                                    format('Area mismatch: Extracted area (%s) differs by %s%% from cadastral area (%s %s).',
                                    v_record.land_area, ROUND(v_area_diff_pct, 1), v_cadastral.parcel_area, v_cadastral.area_unit)
                                );
                            END IF;
                        END IF;
                    EXCEPTION WHEN OTHERS THEN
                        -- Ignore area parse errors
                    END;
                END;
            END IF;

            -- Detect spatial geometry overlap with conflicting parcels
            IF v_cadastral.boundary_geometry IS NOT NULL THEN
                SELECT COALESCE(jsonb_agg(p.parcel_id), '[]'::jsonb), COUNT(*) > 0
                INTO v_overlapping_ids, v_has_overlap
                FROM public.cadastral_parcels p
                WHERE p.id <> v_cadastral.id
                  AND p.village_id = v_cadastral.village_id
                  AND extensions.ST_Overlaps(p.boundary_geometry, v_cadastral.boundary_geometry);

                IF v_has_overlap THEN
                    v_status := 'POSSIBLE_MISMATCH';
                    v_confidence := 68.0;
                    v_discrepancies := v_discrepancies || jsonb_build_array(
                        format('Conflicting spatial overlap detected with parcel(s): %s.', v_overlapping_ids::text)
                    );
                END IF;
            END IF;
        END IF;
    END IF;

    -- Upsert cross validation result
    INSERT INTO public.gis_cross_validations (
        land_record_id, document_id, state_id, district_id, village_id,
        extracted_survey_number, extracted_subdivision, extracted_area,
        matched_parcel_id, cadastral_survey_number, cadastral_area, cadastral_area_unit,
        validation_status, confidence_score, discrepancies,
        is_duplicate_parcel, has_geometry_overlap, overlapping_parcel_ids,
        geometry_geojson, cadastral_source
    ) VALUES (
        v_record.id, p_document_id, v_record.state_id, v_record.district_id, v_record.village_id,
        v_clean_survey, v_cadastral.subdivision_number, v_record.land_area,
        v_cadastral.parcel_id, v_cadastral.survey_number, v_cadastral.parcel_area, v_cadastral.area_unit,
        v_status, v_confidence, v_discrepancies,
        v_is_dup, v_has_overlap, v_overlapping_ids,
        COALESCE(v_cadastral.boundary_geojson, v_record.parcel_geometry::jsonb),
        COALESCE(v_cadastral.cadastral_source, 'TN-CADASTRAL-SURVEY-AUTHORITY')
    )
    RETURNING * INTO v_validation;

    RETURN v_validation;
END;
$$;

REVOKE ALL ON FUNCTION public.perform_gis_cross_validation(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.perform_gis_cross_validation(UUID, UUID) TO authenticated;

-- RPC: Officer resolves GIS discrepancy
CREATE OR REPLACE FUNCTION public.resolve_gis_discrepancy(
    p_validation_id UUID,
    p_resolution_status TEXT,
    p_notes TEXT
)
RETURNS public.gis_cross_validations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_val public.gis_cross_validations;
BEGIN
    IF NOT (public.has_permission('verification:review') OR public.has_permission('verification:approve') OR public.has_permission('gis:resolve')) THEN
        RAISE EXCEPTION 'You do not have permission to resolve GIS discrepancies.';
    END IF;

    SELECT * INTO v_val FROM public.gis_cross_validations WHERE id = p_validation_id FOR UPDATE;
    IF v_val.id IS NULL THEN
        RAISE EXCEPTION 'GIS validation record % not found.', p_validation_id;
    END IF;

    IF NOT public.can_access_geographic_scope(v_val.state_id, v_val.district_id, v_val.village_id) THEN
        RAISE EXCEPTION 'You do not have geographic permission to resolve this record.';
    END IF;

    IF p_resolution_status NOT IN ('ACCEPTED_OVERRIDE', 'CONFIRMED_MATCH', 'REJECTED_DISCREPANCY') THEN
        RAISE EXCEPTION 'Invalid resolution status %.', p_resolution_status;
    END IF;

    UPDATE public.gis_cross_validations
    SET officer_resolution_status = p_resolution_status,
        officer_notes = p_notes,
        resolved_by = auth.uid(),
        resolved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_validation_id
    RETURNING * INTO v_val;

    -- Record in audit logs
    INSERT INTO public.audit_logs (
        actor_id, actor_role, action, entity_type, entity_id,
        metadata
    ) VALUES (
        auth.uid(), public.user_role(), 'GIS_DISCREPANCY_RESOLVED', 'gis_cross_validations', v_val.id,
        jsonb_build_object('status', p_resolution_status, 'notes', p_notes, 'land_record_id', v_val.land_record_id)
    );

    RETURN v_val;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_gis_discrepancy(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_gis_discrepancy(UUID, TEXT, TEXT) TO authenticated;


-- ============================================================
-- SECTION 3: FEATURE 2 — RECORD VERSIONING & CHANGE IMPACT
-- ============================================================

CREATE TABLE IF NOT EXISTS public.land_record_versions (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    land_record_id UUID NOT NULL REFERENCES public.land_records(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (
        event_type IN (
            'INITIAL_INGESTION',
            'OCR_EXTRACTED',
            'PROPOSED_CORRECTION',
            'VERIFIED_APPROVAL',
            'REJECTION',
            'GIS_DISCREPANCY_RESOLVED',
            'MANUAL_EDIT'
        )
    ),
    snapshot JSONB NOT NULL,
    field_changes JSONB DEFAULT '[]'::jsonb,
    actor_id UUID REFERENCES public.profiles(id),
    actor_role TEXT,
    reason TEXT,
    correlation_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(land_record_id, version_number)
);

CREATE INDEX IF NOT EXISTS land_record_versions_record_idx
    ON public.land_record_versions (land_record_id, version_number DESC);

-- STRICT APPEND-ONLY INTEGRITY: Revoke UPDATE and DELETE from all roles
REVOKE UPDATE, DELETE ON public.land_record_versions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.land_record_versions TO authenticated;

-- Helper to record version snapshot
CREATE OR REPLACE FUNCTION public.create_record_version(
    p_land_record_id UUID,
    p_event_type TEXT,
    p_document_id UUID DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_field_changes JSONB DEFAULT '[]'::jsonb
)
RETURNS public.land_record_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_record public.land_records;
    v_next_version INTEGER;
    v_snapshot JSONB;
    v_new_version public.land_record_versions;
BEGIN
    SELECT * INTO v_record FROM public.land_records WHERE id = p_land_record_id;
    IF v_record.id IS NULL THEN
        RAISE EXCEPTION 'Land record % not found.', p_land_record_id;
    END IF;

    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
    FROM public.land_record_versions
    WHERE land_record_id = p_land_record_id;

    v_snapshot := jsonb_build_object(
        'id', v_record.id,
        'record_number', v_record.record_number,
        'survey_number', v_record.survey_number,
        'patta_number', v_record.patta_number,
        'land_area', v_record.land_area,
        'land_type', v_record.land_type,
        'state_id', v_record.state_id,
        'district_id', v_record.district_id,
        'village_id', v_record.village_id,
        'verification_status', v_record.verification_status,
        'record_status', v_record.record_status,
        'latitude', v_record.latitude,
        'longitude', v_record.longitude,
        'updated_at', v_record.updated_at
    );

    INSERT INTO public.land_record_versions (
        land_record_id, version_number, document_id, event_type,
        snapshot, field_changes, actor_id, actor_role, reason
    ) VALUES (
        p_land_record_id, v_next_version, p_document_id, p_event_type,
        v_snapshot, p_field_changes, auth.uid(), public.user_role(), p_reason
    )
    RETURNING * INTO v_new_version;

    RETURN v_new_version;
END;
$$;

REVOKE ALL ON FUNCTION public.create_record_version(UUID, TEXT, UUID, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_record_version(UUID, TEXT, UUID, TEXT, JSONB) TO authenticated;

-- Seed initial version snapshots for existing records if not present
DO $$
DECLARE
    v_rec RECORD;
    v_exists BOOLEAN;
BEGIN
    FOR v_rec IN SELECT * FROM public.land_records LOOP
        SELECT EXISTS(SELECT 1 FROM public.land_record_versions WHERE land_record_id = v_rec.id) INTO v_exists;
        IF NOT v_exists THEN
            INSERT INTO public.land_record_versions (
                land_record_id, version_number, event_type, snapshot, field_changes,
                actor_role, reason, created_at
            ) VALUES (
                v_rec.id, 1, 'INITIAL_INGESTION',
                jsonb_build_object(
                    'id', v_rec.id,
                    'record_number', v_rec.record_number,
                    'survey_number', v_rec.survey_number,
                    'patta_number', v_rec.patta_number,
                    'land_area', v_rec.land_area,
                    'land_type', v_rec.land_type,
                    'verification_status', v_rec.verification_status,
                    'record_status', v_rec.record_status
                ),
                '[]'::jsonb,
                'SYSTEM_MIGRATION',
                'Initial digitized record baseline capture.',
                v_rec.created_at
            );
        END IF;
    END LOOP;
END;
$$;


-- ============================================================
-- SECTION 4: FEATURE 3 — CITIZEN APPLICATION TRACKING & RESOLUTION
-- ============================================================

CREATE TABLE IF NOT EXISTS public.citizen_applications (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    application_number TEXT UNIQUE NOT NULL,
    citizen_id UUID NOT NULL REFERENCES public.profiles(id),
    request_type TEXT NOT NULL CHECK (
        request_type IN (
            'DIGITIZATION',
            'CORRECTION',
            'MUTATION',
            'TITLE_VERIFICATION'
        )
    ),
    status TEXT NOT NULL CHECK (
        status IN (
            'SUBMITTED',
            'OCR_PROCESSING',
            'UNDER_REVIEW',
            'ACTION_REQUIRED',
            'RESUBMITTED',
            'APPROVED',
            'REJECTED',
            'PROCESSING_FAILED',
            'CANCELLED'
        )
    ) DEFAULT 'SUBMITTED',
    land_record_id UUID REFERENCES public.land_records(id) ON DELETE SET NULL,
    state_id UUID REFERENCES public.states(id),
    district_id UUID REFERENCES public.districts(id),
    taluk_id UUID REFERENCES public.taluks(id),
    village_id UUID REFERENCES public.villages(id),
    survey_number TEXT,
    applicant_name TEXT NOT NULL,
    applicant_phone TEXT,
    applicant_email TEXT,
    description TEXT,
    clarification_request TEXT,
    clarification_response TEXT,
    officer_decision_reason TEXT,
    assigned_officer_id UUID REFERENCES public.profiles(id),
    assigned_clerk_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS citizen_applications_citizen_idx
    ON public.citizen_applications (citizen_id);
CREATE INDEX IF NOT EXISTS citizen_applications_status_idx
    ON public.citizen_applications (status);
CREATE INDEX IF NOT EXISTS citizen_applications_scope_idx
    ON public.citizen_applications (district_id, village_id);

-- Application documents linking
CREATE TABLE IF NOT EXISTS public.application_documents (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES public.citizen_applications(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL DEFAULT 'SUPPORTING_DEED',
    is_clarification_evidence BOOLEAN DEFAULT FALSE,
    uploaded_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Application timeline audit
CREATE TABLE IF NOT EXISTS public.application_timeline (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES public.citizen_applications(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    actor_id UUID REFERENCES public.profiles(id),
    actor_role TEXT,
    event_title TEXT NOT NULL,
    event_description TEXT,
    citizen_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS application_timeline_app_idx
    ON public.application_timeline (application_id, created_at ASC);

-- Append-only timeline
REVOKE UPDATE, DELETE ON public.application_timeline FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.application_timeline TO authenticated;

-- Helper to safely create notification without spam
CREATE OR REPLACE FUNCTION public.create_system_notification(
    p_user_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_entity_type TEXT DEFAULT 'citizen_applications',
    p_entity_id UUID DEFAULT NULL,
    p_notification_type TEXT DEFAULT 'APPLICATION_STATUS'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_notif_id UUID;
BEGIN
    INSERT INTO public.notifications (
        user_id, notification_type, title, message, entity_type, entity_id, is_read, created_at
    ) VALUES (
        p_user_id, COALESCE(p_notification_type, 'APPLICATION_STATUS'), p_title, p_message, p_entity_type, p_entity_id, FALSE, NOW()
    )
    RETURNING id INTO v_notif_id;

    RETURN v_notif_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_system_notification(UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_system_notification(UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;

-- RPC: Citizen Submits Application
CREATE OR REPLACE FUNCTION public.submit_citizen_application(
    p_request_type TEXT,
    p_state_id UUID,
    p_district_id UUID,
    p_village_id UUID,
    p_survey_number TEXT,
    p_applicant_name TEXT,
    p_applicant_phone TEXT,
    p_description TEXT,
    p_document_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS public.citizen_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_app_number TEXT;
    v_app public.citizen_applications;
    v_doc_id UUID;
    v_seq_num INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required to submit applications.';
    END IF;

    IF p_request_type NOT IN ('DIGITIZATION', 'CORRECTION', 'MUTATION', 'TITLE_VERIFICATION') THEN
        RAISE EXCEPTION 'Invalid request type %.', p_request_type;
    END IF;

    IF p_applicant_name IS NULL OR TRIM(p_applicant_name) = '' THEN
        RAISE EXCEPTION 'Applicant name is required.';
    END IF;

    -- Generate sequence number for year 2026
    SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq_num
    FROM public.citizen_applications;

    v_app_number := format('APP-2026-%s', LPAD(v_seq_num::text, 4, '0'));

    INSERT INTO public.citizen_applications (
        application_number, citizen_id, request_type, status,
        state_id, district_id, village_id, survey_number,
        applicant_name, applicant_phone, applicant_email, description
    ) VALUES (
        v_app_number, auth.uid(), p_request_type, 'SUBMITTED',
        p_state_id, p_district_id, p_village_id, p_survey_number,
        TRIM(p_applicant_name), p_applicant_phone, (SELECT email FROM auth.users WHERE id = auth.uid()), p_description
    )
    RETURNING * INTO v_app;

    -- Link submitted documents
    IF p_document_ids IS NOT NULL AND array_length(p_document_ids, 1) > 0 THEN
        FOREACH v_doc_id IN ARRAY p_document_ids LOOP
            INSERT INTO public.application_documents (
                application_id, document_id, uploaded_by
            ) VALUES (
                v_app.id, v_doc_id, auth.uid()
            );
        END LOOP;
    END IF;

    -- Log initial timeline event
    INSERT INTO public.application_timeline (
        application_id, status, actor_id, actor_role, event_title, event_description
    ) VALUES (
        v_app.id, 'SUBMITTED', auth.uid(), public.user_role(),
        'Application Submitted',
        format('Application %s submitted successfully for %s processing.', v_app.application_number, p_request_type)
    );

    -- Send confirmation notification to citizen
    PERFORM public.create_system_notification(
        auth.uid(),
        'Application Submitted Successfully',
        format('Your application %s for %s has been received and queued for verification.', v_app.application_number, p_request_type),
        'citizen_applications',
        v_app.id
    );

    RETURN v_app;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_citizen_application(TEXT, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_citizen_application(TEXT, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID[]) TO authenticated;

-- RPC: Officer Requests Clarification from Citizen
CREATE OR REPLACE FUNCTION public.request_application_clarification(
    p_application_id UUID,
    p_message TEXT
)
RETURNS public.citizen_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_app public.citizen_applications;
BEGIN
    IF NOT (public.has_permission('verification:review') OR public.has_permission('verification:approve') OR public.has_permission('application:update')) THEN
        RAISE EXCEPTION 'You do not have permission to request clarification.';
    END IF;

    SELECT * INTO v_app FROM public.citizen_applications WHERE id = p_application_id FOR UPDATE;
    IF v_app.id IS NULL THEN
        RAISE EXCEPTION 'Application not found.';
    END IF;

    IF NOT public.can_access_geographic_scope(v_app.state_id, v_app.district_id, v_app.village_id) THEN
        RAISE EXCEPTION 'Application is outside your authorized geographic scope.';
    END IF;

    IF p_message IS NULL OR TRIM(p_message) = '' THEN
        RAISE EXCEPTION 'Clarification message is required.';
    END IF;

    UPDATE public.citizen_applications
    SET status = 'ACTION_REQUIRED',
        clarification_request = p_message,
        assigned_officer_id = auth.uid(),
        updated_at = NOW()
    WHERE id = p_application_id
    RETURNING * INTO v_app;

    -- Add timeline
    INSERT INTO public.application_timeline (
        application_id, status, actor_id, actor_role, event_title, event_description
    ) VALUES (
        v_app.id, 'ACTION_REQUIRED', auth.uid(), public.user_role(),
        'Clarification Requested',
        p_message
    );

    -- Notify citizen
    PERFORM public.create_system_notification(
        v_app.citizen_id,
        'Action Required on Your Application',
        format('Revenue officer requested clarification on %s: %s', v_app.application_number, p_message),
        'citizen_applications',
        v_app.id
    );

    RETURN v_app;
END;
$$;

REVOKE ALL ON FUNCTION public.request_application_clarification(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_application_clarification(UUID, TEXT) TO authenticated;

-- RPC: Citizen Responds with Clarification & Supporting Evidence
CREATE OR REPLACE FUNCTION public.respond_application_clarification(
    p_application_id UUID,
    p_response TEXT,
    p_new_document_id UUID DEFAULT NULL
)
RETURNS public.citizen_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_app public.citizen_applications;
BEGIN
    SELECT * INTO v_app FROM public.citizen_applications WHERE id = p_application_id FOR UPDATE;
    IF v_app.id IS NULL THEN
        RAISE EXCEPTION 'Application not found.';
    END IF;

    IF v_app.citizen_id <> auth.uid() AND public.user_role() NOT IN ('SUPER_ADMIN') THEN
        RAISE EXCEPTION 'You can only respond to your own applications.';
    END IF;

    IF p_response IS NULL OR TRIM(p_response) = '' THEN
        RAISE EXCEPTION 'Clarification response text is required.';
    END IF;

    UPDATE public.citizen_applications
    SET status = 'RESUBMITTED',
        clarification_response = p_response,
        updated_at = NOW()
    WHERE id = p_application_id
    RETURNING * INTO v_app;

    IF p_new_document_id IS NOT NULL THEN
        INSERT INTO public.application_documents (
            application_id, document_id, is_clarification_evidence, uploaded_by
        ) VALUES (
            v_app.id, p_new_document_id, TRUE, auth.uid()
        );
    END IF;

    INSERT INTO public.application_timeline (
        application_id, status, actor_id, actor_role, event_title, event_description
    ) VALUES (
        v_app.id, 'RESUBMITTED', auth.uid(), public.user_role(),
        'Citizen Clarification Submitted',
        p_response
    );

    RETURN v_app;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_application_clarification(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_application_clarification(UUID, TEXT, UUID) TO authenticated;

-- RPC: Officer Decides Application (Approve or Reject)
CREATE OR REPLACE FUNCTION public.decide_citizen_application(
    p_application_id UUID,
    p_decision TEXT,
    p_reason TEXT
)
RETURNS public.citizen_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_app public.citizen_applications;
    v_new_status TEXT;
BEGIN
    IF NOT (public.has_permission('verification:approve') OR public.has_permission('application:decide')) THEN
        RAISE EXCEPTION 'You do not have official authorization to approve or reject citizen applications.';
    END IF;

    IF p_decision = 'APPROVE' THEN
        v_new_status := 'APPROVED';
    ELSIF p_decision = 'REJECT' THEN
        v_new_status := 'REJECTED';
    ELSE
        RAISE EXCEPTION 'Invalid decision: % (must be APPROVE or REJECT).', p_decision;
    END IF;

    SELECT * INTO v_app FROM public.citizen_applications WHERE id = p_application_id FOR UPDATE;
    IF v_app.id IS NULL THEN
        RAISE EXCEPTION 'Application not found.';
    END IF;

    IF NOT public.can_access_geographic_scope(v_app.state_id, v_app.district_id, v_app.village_id) THEN
        RAISE EXCEPTION 'Application is outside your authorized geographic jurisdiction.';
    END IF;

    UPDATE public.citizen_applications
    SET status = v_new_status,
        officer_decision_reason = p_reason,
        assigned_officer_id = auth.uid(),
        updated_at = NOW()
    WHERE id = p_application_id
    RETURNING * INTO v_app;

    INSERT INTO public.application_timeline (
        application_id, status, actor_id, actor_role, event_title, event_description
    ) VALUES (
        v_app.id, v_new_status, auth.uid(), public.user_role(),
        format('Application %s', INITCAP(v_new_status)),
        p_reason
    );

    PERFORM public.create_system_notification(
        v_app.citizen_id,
        format('Application %s', INITCAP(v_new_status)),
        format('Your application %s has been %s. Reason: %s', v_app.application_number, LOWER(v_new_status), p_reason),
        'citizen_applications',
        v_app.id
    );

    RETURN v_app;
END;
$$;

REVOKE ALL ON FUNCTION public.decide_citizen_application(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_citizen_application(UUID, TEXT, TEXT) TO authenticated;


-- ============================================================
-- SECTION 5: ROW LEVEL SECURITY POLICIES FOR NEW TABLES
-- ============================================================

-- 1. CADASTRAL PARCELS RLS
ALTER TABLE public.cadastral_parcels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read cadastral parcels" ON public.cadastral_parcels;
CREATE POLICY "Authenticated users read cadastral parcels"
ON public.cadastral_parcels
FOR SELECT
TO authenticated
USING (
    public.can_access_geographic_scope(state_id, district_id, village_id)
);

-- 2. GIS CROSS VALIDATIONS RLS
ALTER TABLE public.gis_cross_validations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read gis cross validations in scope" ON public.gis_cross_validations;
CREATE POLICY "Staff read gis cross validations in scope"
ON public.gis_cross_validations
FOR SELECT
TO authenticated
USING (
    public.can_access_geographic_scope(state_id, district_id, village_id)
);

-- 3. LAND RECORD VERSIONS RLS
ALTER TABLE public.land_record_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read record versions in scope" ON public.land_record_versions;
CREATE POLICY "Authenticated users read record versions in scope"
ON public.land_record_versions
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.land_records r
        WHERE r.id = land_record_versions.land_record_id
          AND public.can_access_geographic_scope(r.state_id, r.district_id, r.village_id)
    )
);

-- 4. CITIZEN APPLICATIONS RLS
ALTER TABLE public.citizen_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Citizens view own applications" ON public.citizen_applications;
CREATE POLICY "Citizens view own applications"
ON public.citizen_applications
FOR SELECT
TO authenticated
USING (
    citizen_id = auth.uid()
    OR public.can_access_geographic_scope(state_id, district_id, village_id)
);

DROP POLICY IF EXISTS "Citizens insert own applications" ON public.citizen_applications;
CREATE POLICY "Citizens insert own applications"
ON public.citizen_applications
FOR INSERT
TO authenticated
WITH CHECK (
    citizen_id = auth.uid()
);

DROP POLICY IF EXISTS "Staff update applications in scope" ON public.citizen_applications;
CREATE POLICY "Staff update applications in scope"
ON public.citizen_applications
FOR UPDATE
TO authenticated
USING (
    public.can_access_geographic_scope(state_id, district_id, village_id)
);

-- 5. APPLICATION DOCUMENTS RLS
ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read application documents" ON public.application_documents;
CREATE POLICY "Users read application documents"
ON public.application_documents
FOR SELECT
TO authenticated
USING (
    uploaded_by = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.citizen_applications a
        WHERE a.id = application_documents.application_id
          AND (a.citizen_id = auth.uid() OR public.can_access_geographic_scope(a.state_id, a.district_id, a.village_id))
    )
);

DROP POLICY IF EXISTS "Users insert application documents" ON public.application_documents;
CREATE POLICY "Users insert application documents"
ON public.application_documents
FOR INSERT
TO authenticated
WITH CHECK (
    uploaded_by = auth.uid()
);

-- 6. APPLICATION TIMELINE RLS
ALTER TABLE public.application_timeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read application timeline" ON public.application_timeline;
CREATE POLICY "Users read application timeline"
ON public.application_timeline
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.citizen_applications a
        WHERE a.id = application_timeline.application_id
          AND (
              (a.citizen_id = auth.uid() AND application_timeline.citizen_visible = TRUE)
              OR public.can_access_geographic_scope(a.state_id, a.district_id, a.village_id)
          )
    )
);
