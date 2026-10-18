-- ============================================================
-- MIGRATION: 20261018000004_align_citizen_and_staff_rls_policies.sql
-- Post-Audit Security Hardening:
-- 1. Align CITIZEN role in public.documents, land_records, and storage policies
-- 2. Restrict citizen_applications, application_documents, and timeline
--    to prevent cross-user leakage (horizontal privilege escalation)
-- 3. Require explicit staff authorization and geographic scope for
--    updating applications, viewing staff GIS validations, and versioning
-- 4. Set CITIZEN as default self-registration role in handle_new_user()
-- ============================================================

-- 1. DOCUMENTS RLS: Allow both CITIZEN and CUSTOMER to access own documents
DROP POLICY IF EXISTS "Customers read own documents" ON public.documents;
CREATE POLICY "Customers read own documents"
ON public.documents
FOR SELECT
TO authenticated
USING (
    public.user_role() IN ('CITIZEN', 'CUSTOMER')
    AND uploaded_by = auth.uid()
);

DROP POLICY IF EXISTS "Customers create own documents" ON public.documents;
CREATE POLICY "Customers create own documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (
    public.user_role() IN ('CITIZEN', 'CUSTOMER')
    AND uploaded_by = auth.uid()
);

-- 2. LAND RECORDS RLS: Allow CITIZEN to read verified active records
DROP POLICY IF EXISTS "Customers read verified land records" ON public.land_records;
CREATE POLICY "Customers read verified land records"
ON public.land_records
FOR SELECT
TO authenticated
USING (
    public.user_role() IN ('CITIZEN', 'CUSTOMER')
    AND record_status = 'ACTIVE'
    AND verification_status = 'APPROVED'
);

-- 3. STORAGE UPLOAD POLICY: Allow CITIZEN to upload document files
DROP POLICY IF EXISTS "Customers upload Bhoomi documents" ON storage.objects;
CREATE POLICY "Customers upload Bhoomi documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'bhoomi-documents'
    AND public.user_role() IN ('CITIZEN', 'CUSTOMER')
    AND split_part(name, '/', 1) = 'documents'
);

-- 4. CITIZEN APPLICATIONS RLS: Prevent horizontal privilege escalation
-- Citizens can only view their own applications. Staff with application:read
-- can view applications strictly within their authorized geographic scope.
DROP POLICY IF EXISTS "Citizens view own applications" ON public.citizen_applications;
CREATE POLICY "Citizens view own applications"
ON public.citizen_applications
FOR SELECT
TO authenticated
USING (
    citizen_id = auth.uid()
    OR (
        public.has_permission('application:read')
        AND public.user_role() NOT IN ('CITIZEN', 'CUSTOMER')
        AND public.can_access_geographic_scope(state_id, district_id, village_id)
    )
);

-- Staff update applications in scope: Require application:update permission and scope
DROP POLICY IF EXISTS "Staff update applications in scope" ON public.citizen_applications;
CREATE POLICY "Staff update applications in scope"
ON public.citizen_applications
FOR UPDATE
TO authenticated
USING (
    public.has_permission('application:update')
    AND public.user_role() NOT IN ('CITIZEN', 'CUSTOMER')
    AND public.can_access_geographic_scope(state_id, district_id, village_id)
);

-- 5. GIS CROSS VALIDATIONS RLS: Staff only within geographic jurisdiction
DROP POLICY IF EXISTS "Staff read gis cross validations in scope" ON public.gis_cross_validations;
CREATE POLICY "Staff read gis cross validations in scope"
ON public.gis_cross_validations
FOR SELECT
TO authenticated
USING (
    (public.has_permission('gis:validate') OR public.has_permission('gis:read'))
    AND public.user_role() NOT IN ('CITIZEN', 'CUSTOMER')
    AND public.can_access_geographic_scope(state_id, district_id, village_id)
);

-- 6. APPLICATION DOCUMENTS RLS: Scoped access for applicant and authorized staff
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
          AND (
              a.citizen_id = auth.uid()
              OR (
                  public.has_permission('application:read')
                  AND public.user_role() NOT IN ('CITIZEN', 'CUSTOMER')
                  AND public.can_access_geographic_scope(a.state_id, a.district_id, a.village_id)
              )
          )
    )
);

-- 7. APPLICATION TIMELINE RLS: Scoped access for applicant and staff
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
              OR (
                  public.has_permission('application:read')
                  AND public.user_role() NOT IN ('CITIZEN', 'CUSTOMER')
                  AND public.can_access_geographic_scope(a.state_id, a.district_id, a.village_id)
              )
          )
    )
);

-- 8. HARDEN CREATE_RECORD_VERSION RPC: Check caller permission and scope
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
    IF NOT (
        public.has_permission('land_record:update')
        OR public.has_permission('verification:review')
        OR public.has_permission('verification:approve')
    ) THEN
        RAISE EXCEPTION 'You do not have permission to create land record version snapshots.';
    END IF;

    SELECT * INTO v_record FROM public.land_records WHERE id = p_land_record_id;
    IF v_record.id IS NULL THEN
        RAISE EXCEPTION 'Land record % not found.', p_land_record_id;
    END IF;

    IF NOT public.can_access_geographic_scope(v_record.state_id, v_record.district_id, v_record.village_id) THEN
        RAISE EXCEPTION 'Land record is outside your authorized geographic scope.';
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

-- 9. HARDEN PERFORM_GIS_CROSS_VALIDATION RPC: Check caller permission
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
    IF NOT (
        public.has_permission('gis:validate')
        OR public.has_permission('gis:read')
        OR public.has_permission('verification:review')
        OR public.has_permission('verification:approve')
    ) THEN
        RAISE EXCEPTION 'You do not have permission to perform GIS cross-validation.';
    END IF;

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
        SELECT * INTO v_cadastral
        FROM public.cadastral_parcels
        WHERE village_id = v_record.village_id
          AND survey_number = v_clean_survey
        LIMIT 1;

        IF v_cadastral.id IS NULL THEN
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
            v_status := 'MATCHED';
            v_confidence := 98.0;

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

            IF v_record.land_area IS NOT NULL AND v_cadastral.parcel_area > 0 THEN
                BEGIN
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
                    END;
                END;
            END IF;

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

-- 10. UPDATE REGISTRATION TRIGGER: Default to CITIZEN role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_default_role_id UUID;
    v_full_name TEXT;
    v_state_id UUID := NULL;
    v_district_id UUID := NULL;
BEGIN
    SELECT id INTO v_default_role_id
    FROM public.roles
    WHERE code = 'CITIZEN'
    LIMIT 1;

    IF v_default_role_id IS NULL THEN
        SELECT id INTO v_default_role_id
        FROM public.roles
        WHERE code = 'CUSTOMER'
        LIMIT 1;
    END IF;

    v_full_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(split_part(NEW.email, '@', 1)), ''),
        'User'
    );

    IF NEW.raw_user_meta_data->>'state_id' IS NOT NULL AND NEW.raw_user_meta_data->>'state_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT id INTO v_state_id FROM public.states WHERE id = (NEW.raw_user_meta_data->>'state_id')::UUID AND is_active = TRUE;
    END IF;

    IF NEW.raw_user_meta_data->>'district_id' IS NOT NULL AND NEW.raw_user_meta_data->>'district_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT id INTO v_district_id FROM public.districts WHERE id = (NEW.raw_user_meta_data->>'district_id')::UUID AND is_active = TRUE;
    END IF;

    INSERT INTO public.profiles (
        id,
        full_name,
        email,
        role_id,
        state_id,
        district_id,
        is_active
    )
    VALUES (
        NEW.id,
        v_full_name,
        NEW.email,
        v_default_role_id,
        v_state_id,
        v_district_id,
        TRUE
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        full_name = CASE 
            WHEN profiles.full_name = 'New User' OR profiles.full_name = '' 
            THEN EXCLUDED.full_name 
            ELSE profiles.full_name 
        END,
        role_id = COALESCE(profiles.role_id, EXCLUDED.role_id),
        state_id = COALESCE(profiles.state_id, EXCLUDED.state_id),
        district_id = COALESCE(profiles.district_id, EXCLUDED.district_id);

    RETURN NEW;
END;
$$;
