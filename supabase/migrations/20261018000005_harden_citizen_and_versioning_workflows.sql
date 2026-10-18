-- ============================================================
-- MIGRATION: 20261018000005_harden_citizen_and_versioning_workflows.sql
-- Security, State Transition & Data Integrity Hardening:
-- 1. Enforce strict application lifecycle state transitions
--    (Terminal states APPROVED/REJECTED/CANCELLED cannot be altered or reopened)
-- 2. Prevent unauthorized or stolen document attachment in applications
-- 3. Prevent duplicate active submissions for the same survey
-- 4. Require non-empty reasons for statutory decision & clarification
-- 5. Serialize record version snapshot creation using row locks to eliminate concurrency collisions
-- 6. Require non-empty officer resolution notes for GIS discrepancy overrides
-- ============================================================

-- 1. HARDEN SUBMIT_CITIZEN_APPLICATION
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
    v_clean_survey TEXT;
    v_is_active BOOLEAN;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required to submit applications.';
    END IF;

    -- Verify active account
    SELECT is_active INTO v_is_active
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_is_active IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Your account is inactive or suspended.';
    END IF;

    -- Validate request type
    IF p_request_type NOT IN ('DIGITIZATION', 'CORRECTION', 'MUTATION', 'TITLE_VERIFICATION') THEN
        RAISE EXCEPTION 'Invalid request type %.', p_request_type;
    END IF;

    -- Validate applicant name
    IF p_applicant_name IS NULL OR TRIM(p_applicant_name) = '' THEN
        RAISE EXCEPTION 'Applicant name is required.';
    END IF;

    -- Validate geography
    IF p_state_id IS NULL OR p_district_id IS NULL OR p_village_id IS NULL THEN
        RAISE EXCEPTION 'State, district, and village are all required for geographic filing.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.villages v
        JOIN public.taluks t ON v.taluk_id = t.id
        WHERE v.id = p_village_id
          AND t.district_id = p_district_id
          AND v.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Target village is invalid or does not belong to specified district.';
    END IF;

    v_clean_survey := TRIM(COALESCE(p_survey_number, ''));

    -- Prevent duplicate active applications by same citizen for same survey
    IF v_clean_survey <> '' AND EXISTS (
        SELECT 1 FROM public.citizen_applications
        WHERE citizen_id = auth.uid()
          AND village_id = p_village_id
          AND TRIM(COALESCE(survey_number, '')) = v_clean_survey
          AND status IN ('SUBMITTED', 'OCR_PROCESSING', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'RESUBMITTED')
          AND request_type = p_request_type
    ) THEN
        RAISE EXCEPTION 'An active % application for survey % in this village is already pending review.', p_request_type, v_clean_survey;
    END IF;

    -- Verify that all submitted documents belong to the authenticated user
    IF p_document_ids IS NOT NULL AND array_length(p_document_ids, 1) > 0 THEN
        FOREACH v_doc_id IN ARRAY p_document_ids LOOP
            IF NOT EXISTS (
                SELECT 1 FROM public.documents
                WHERE id = v_doc_id
                  AND (uploaded_by = auth.uid() OR public.user_role() = 'SUPER_ADMIN')
            ) THEN
                RAISE EXCEPTION 'Document % does not belong to you or does not exist.', v_doc_id;
            END IF;
        END LOOP;
    END IF;

    -- Generate sequence number safely for year 2026
    SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq_num
    FROM public.citizen_applications;

    v_app_number := format('APP-2026-%s', LPAD(v_seq_num::text, 4, '0'));

    INSERT INTO public.citizen_applications (
        application_number, citizen_id, request_type, status,
        state_id, district_id, village_id, survey_number,
        applicant_name, applicant_phone, applicant_email, description
    ) VALUES (
        v_app_number, auth.uid(), p_request_type, 'SUBMITTED',
        p_state_id, p_district_id, p_village_id, NULLIF(v_clean_survey, ''),
        TRIM(p_applicant_name), p_applicant_phone, (SELECT email FROM auth.users WHERE id = auth.uid()), p_description
    )
    RETURNING * INTO v_app;

    -- Link submitted documents safely
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


-- 2. HARDEN REQUEST_APPLICATION_CLARIFICATION
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
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF NOT (
        public.has_permission('application:update')
        OR public.has_permission('verification:review')
        OR public.has_permission('verification:approve')
    ) THEN
        RAISE EXCEPTION 'You do not have permission to request clarification.';
    END IF;

    SELECT * INTO v_app
    FROM public.citizen_applications
    WHERE id = p_application_id
    FOR UPDATE;

    IF v_app.id IS NULL THEN
        RAISE EXCEPTION 'Application not found.';
    END IF;

    IF NOT public.can_access_geographic_scope(v_app.state_id, v_app.district_id, v_app.village_id) THEN
        RAISE EXCEPTION 'Application is outside your authorized geographic scope.';
    END IF;

    -- Strict lifecycle validation
    IF v_app.status IN ('APPROVED', 'REJECTED', 'CANCELLED') THEN
        RAISE EXCEPTION 'Cannot request clarification on an application that has reached terminal status %.', v_app.status;
    END IF;

    IF v_app.status = 'ACTION_REQUIRED' THEN
        RAISE EXCEPTION 'Application is already awaiting citizen clarification.';
    END IF;

    IF v_app.status NOT IN ('SUBMITTED', 'UNDER_REVIEW', 'RESUBMITTED', 'OCR_PROCESSING') THEN
        RAISE EXCEPTION 'Invalid status transition from % to ACTION_REQUIRED.', v_app.status;
    END IF;

    IF p_message IS NULL OR TRIM(p_message) = '' THEN
        RAISE EXCEPTION 'Clarification message is required.';
    END IF;

    UPDATE public.citizen_applications
    SET status = 'ACTION_REQUIRED',
        clarification_request = TRIM(p_message),
        assigned_officer_id = auth.uid(),
        updated_at = NOW()
    WHERE id = p_application_id
    RETURNING * INTO v_app;

    INSERT INTO public.application_timeline (
        application_id, status, actor_id, actor_role, event_title, event_description
    ) VALUES (
        v_app.id, 'ACTION_REQUIRED', auth.uid(), public.user_role(),
        'Clarification Requested',
        TRIM(p_message)
    );

    PERFORM public.create_system_notification(
        v_app.citizen_id,
        'Action Required on Your Application',
        format('Revenue officer requested clarification on %s: %s', v_app.application_number, TRIM(p_message)),
        'citizen_applications',
        v_app.id
    );

    RETURN v_app;
END;
$$;


-- 3. HARDEN RESPOND_APPLICATION_CLARIFICATION
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
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT * INTO v_app
    FROM public.citizen_applications
    WHERE id = p_application_id
    FOR UPDATE;

    IF v_app.id IS NULL THEN
        RAISE EXCEPTION 'Application not found.';
    END IF;

    IF v_app.citizen_id <> auth.uid() AND public.user_role() NOT IN ('SUPER_ADMIN') THEN
        RAISE EXCEPTION 'You can only respond to your own applications.';
    END IF;

    -- Strict lifecycle check: Can only respond when ACTION_REQUIRED
    IF v_app.status <> 'ACTION_REQUIRED' THEN
        RAISE EXCEPTION 'Clarification cannot be submitted because application status is % (expected ACTION_REQUIRED).', v_app.status;
    END IF;

    IF p_response IS NULL OR TRIM(p_response) = '' THEN
        RAISE EXCEPTION 'Clarification response text is required.';
    END IF;

    -- If supporting evidence document is provided, verify caller owns it
    IF p_new_document_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.documents
            WHERE id = p_new_document_id
              AND (uploaded_by = auth.uid() OR public.user_role() = 'SUPER_ADMIN')
        ) THEN
            RAISE EXCEPTION 'Attached document % was not found or does not belong to you.', p_new_document_id;
        END IF;

        INSERT INTO public.application_documents (
            application_id, document_id, is_clarification_evidence, uploaded_by
        ) VALUES (
            v_app.id, p_new_document_id, TRUE, auth.uid()
        );
    END IF;

    UPDATE public.citizen_applications
    SET status = 'RESUBMITTED',
        clarification_response = TRIM(p_response),
        updated_at = NOW()
    WHERE id = p_application_id
    RETURNING * INTO v_app;

    INSERT INTO public.application_timeline (
        application_id, status, actor_id, actor_role, event_title, event_description
    ) VALUES (
        v_app.id, 'RESUBMITTED', auth.uid(), public.user_role(),
        'Citizen Clarification Submitted',
        TRIM(p_response)
    );

    RETURN v_app;
END;
$$;


-- 4. HARDEN DECIDE_CITIZEN_APPLICATION
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
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF NOT (
        public.has_permission('verification:approve')
        OR public.has_permission('application:decide')
    ) THEN
        RAISE EXCEPTION 'You do not have official authorization to approve or reject citizen applications.';
    END IF;

    IF p_decision = 'APPROVE' THEN
        v_new_status := 'APPROVED';
    ELSIF p_decision = 'REJECT' THEN
        v_new_status := 'REJECTED';
    ELSE
        RAISE EXCEPTION 'Invalid decision: % (must be APPROVE or REJECT).', p_decision;
    END IF;

    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'A valid decision reason is required.';
    END IF;

    SELECT * INTO v_app
    FROM public.citizen_applications
    WHERE id = p_application_id
    FOR UPDATE;

    IF v_app.id IS NULL THEN
        RAISE EXCEPTION 'Application not found.';
    END IF;

    IF NOT public.can_access_geographic_scope(v_app.state_id, v_app.district_id, v_app.village_id) THEN
        RAISE EXCEPTION 'Application is outside your authorized geographic jurisdiction.';
    END IF;

    -- Terminal states cannot be decided again
    IF v_app.status IN ('APPROVED', 'REJECTED', 'CANCELLED') THEN
        RAISE EXCEPTION 'Application has already reached terminal status % and cannot be decided again.', v_app.status;
    END IF;

    -- Clarification must be answered before approval
    IF v_app.status = 'ACTION_REQUIRED' AND p_decision = 'APPROVE' THEN
        RAISE EXCEPTION 'Cannot approve an application while citizen clarification is pending (ACTION_REQUIRED).';
    END IF;

    UPDATE public.citizen_applications
    SET status = v_new_status,
        officer_decision_reason = TRIM(p_reason),
        assigned_officer_id = auth.uid(),
        updated_at = NOW()
    WHERE id = p_application_id
    RETURNING * INTO v_app;

    INSERT INTO public.application_timeline (
        application_id, status, actor_id, actor_role, event_title, event_description
    ) VALUES (
        v_app.id, v_new_status, auth.uid(), public.user_role(),
        format('Application %s', INITCAP(v_new_status)),
        TRIM(p_reason)
    );

    PERFORM public.create_system_notification(
        v_app.citizen_id,
        format('Application %s', INITCAP(v_new_status)),
        format('Your application %s has been %s. Reason: %s', v_app.application_number, LOWER(v_new_status), TRIM(p_reason)),
        'citizen_applications',
        v_app.id
    );

    RETURN v_app;
END;
$$;


-- 5. HARDEN CREATE_RECORD_VERSION (ROW LOCKING FOR CONCURRENCY SERIALIZATION)
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
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF NOT (
        public.has_permission('land_record:update')
        OR public.has_permission('verification:review')
        OR public.has_permission('verification:approve')
    ) THEN
        RAISE EXCEPTION 'You do not have permission to create land record version snapshots.';
    END IF;

    IF p_event_type NOT IN (
        'INITIAL_INGESTION',
        'OCR_EXTRACTED',
        'PROPOSED_CORRECTION',
        'VERIFIED_APPROVAL',
        'REJECTION',
        'GIS_DISCREPANCY_RESOLVED',
        'MANUAL_EDIT'
    ) THEN
        RAISE EXCEPTION 'Invalid event type: %.', p_event_type;
    END IF;

    IF (p_reason IS NULL OR TRIM(p_reason) = '') AND p_event_type IN ('MANUAL_EDIT', 'REJECTION', 'PROPOSED_CORRECTION') THEN
        RAISE EXCEPTION 'A non-empty reason is required for event type %.', p_event_type;
    END IF;

    IF p_document_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.documents WHERE id = p_document_id) THEN
        RAISE EXCEPTION 'Associated document % not found.', p_document_id;
    END IF;

    -- Explicit FOR UPDATE lock serializes concurrent version snapshot creation
    SELECT * INTO v_record
    FROM public.land_records
    WHERE id = p_land_record_id
    FOR UPDATE;

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
        v_snapshot, COALESCE(p_field_changes, '[]'::jsonb), auth.uid(), public.user_role(), NULLIF(TRIM(p_reason), '')
    )
    RETURNING * INTO v_new_version;

    RETURN v_new_version;
END;
$$;


-- 6. HARDEN RESOLVE_GIS_DISCREPANCY (REQUIRE NON-EMPTY NOTES)
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
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF NOT (
        public.has_permission('verification:review')
        OR public.has_permission('verification:approve')
        OR public.has_permission('gis:resolve')
    ) THEN
        RAISE EXCEPTION 'You do not have permission to resolve GIS discrepancies.';
    END IF;

    IF p_resolution_status NOT IN ('ACCEPTED_OVERRIDE', 'CONFIRMED_MATCH', 'REJECTED_DISCREPANCY') THEN
        RAISE EXCEPTION 'Invalid resolution status %.', p_resolution_status;
    END IF;

    IF p_notes IS NULL OR TRIM(p_notes) = '' THEN
        RAISE EXCEPTION 'Officer resolution notes are required for discrepancy adjudication.';
    END IF;

    SELECT * INTO v_val
    FROM public.gis_cross_validations
    WHERE id = p_validation_id
    FOR UPDATE;

    IF v_val.id IS NULL THEN
        RAISE EXCEPTION 'GIS validation record % not found.', p_validation_id;
    END IF;

    IF NOT public.can_access_geographic_scope(v_val.state_id, v_val.district_id, v_val.village_id) THEN
        RAISE EXCEPTION 'You do not have geographic permission to resolve this record.';
    END IF;

    UPDATE public.gis_cross_validations
    SET officer_resolution_status = p_resolution_status,
        officer_notes = TRIM(p_notes),
        resolved_by = auth.uid(),
        resolved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_validation_id
    RETURNING * INTO v_val;

    INSERT INTO public.audit_logs (
        actor_id, actor_role, action, entity_type, entity_id,
        metadata
    ) VALUES (
        auth.uid(), public.user_role(), 'GIS_DISCREPANCY_RESOLVED', 'gis_cross_validations', v_val.id,
        jsonb_build_object(
            'status', p_resolution_status,
            'notes', TRIM(p_notes),
            'land_record_id', v_val.land_record_id
        )
    );

    RETURN v_val;
END;
$$;
