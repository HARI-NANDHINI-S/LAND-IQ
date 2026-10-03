-- Deterministic duplicate and risk workflows. Existing migrations are retained.

CREATE INDEX IF NOT EXISTS land_records_duplicate_survey_idx
    ON public.land_records (district_id, lower(regexp_replace(survey_number, '[^[:alnum:]]', '', 'g')));
CREATE INDEX IF NOT EXISTS land_records_duplicate_patta_idx
    ON public.land_records (district_id, lower(regexp_replace(patta_number, '[^[:alnum:]]', '', 'g')))
    WHERE patta_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS land_records_duplicate_subdivision_idx
    ON public.land_records (district_id, lower(regexp_replace(subdivision_number, '[^[:alnum:]]', '', 'g')))
    WHERE subdivision_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS land_records_duplicate_registration_idx
    ON public.land_records (district_id, lower(regexp_replace(registration_number, '[^[:alnum:]]', '', 'g')))
    WHERE registration_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS land_record_owners_duplicate_owner_idx
    ON public.land_record_owners (land_record_id, owner_id);
CREATE INDEX IF NOT EXISTS land_owners_duplicate_identity_idx
    ON public.land_owners (lower(regexp_replace(identification_reference, '[^[:alnum:]]', '', 'g')))
    WHERE identification_reference IS NOT NULL;

-- Keep one reviewed decision for each unordered pair before enforcing uniqueness.
WITH ranked_pairs AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY LEAST(record_a_id, record_b_id), GREATEST(record_a_id, record_b_id)
               ORDER BY (reviewed_by IS NOT NULL) DESC, reviewed_at DESC NULLS LAST, created_at ASC
           ) AS pair_rank
    FROM public.duplicate_candidates
)
DELETE FROM public.duplicate_candidates candidate
USING ranked_pairs ranked
WHERE candidate.id = ranked.id
  AND ranked.pair_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS duplicate_candidates_unordered_pair_uidx
    ON public.duplicate_candidates (
        (LEAST(record_a_id, record_b_id)),
        (GREATEST(record_a_id, record_b_id))
    );

INSERT INTO public.permissions (code, description)
VALUES ('duplicate:scan', 'Run a duplicate scan within the user''s authorized geographic scope.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM public.roles role
CROSS JOIN public.permissions permission
WHERE role.code IN ('SUPER_ADMIN', 'STATE_ADMIN', 'DISTRICT_OFFICER')
    AND permission.code = 'duplicate:scan'
ON CONFLICT (role_id, permission_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.trigger_log_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_actor_role TEXT;
    v_entity_id UUID;
    v_metadata JSONB;
BEGIN
    SELECT role.code INTO v_actor_role
    FROM public.profiles profile
    JOIN public.roles role ON role.id = profile.role_id
    WHERE profile.id = v_actor_id
      AND profile.is_active = TRUE;

    IF TG_TABLE_NAME = 'settings' THEN
        v_entity_id := NULL;
        v_metadata := jsonb_build_object('setting_key', coalesce(NEW.key, OLD.key));
    ELSIF TG_OP = 'DELETE' THEN
        v_entity_id := OLD.id;
    ELSE
        v_entity_id := NEW.id;
    END IF;

    INSERT INTO public.audit_logs (
        actor_id, actor_role, action, entity_type, entity_id,
        before_state, after_state, metadata, status, remarks
    ) VALUES (
        v_actor_id,
        coalesce(v_actor_role, CASE WHEN v_actor_id IS NULL THEN 'SYSTEM' ELSE 'UNKNOWN' END),
        lower(TG_TABLE_NAME) || '_' || lower(TG_OP),
        TG_TABLE_NAME,
        v_entity_id,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        v_metadata,
        'SUCCESS',
        'Database-generated audit event.'
    );

    RETURN coalesce(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_log_audit() FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'Audit log rows are immutable.';
END;
$$;

DROP TRIGGER IF EXISTS prevent_audit_log_mutation ON public.audit_logs;
CREATE TRIGGER prevent_audit_log_mutation
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

CREATE OR REPLACE FUNCTION public.calculate_duplicate_pair_evidence(p_record_a_id UUID, p_record_b_id UUID)
RETURNS TABLE(similarity_score NUMERIC, match_signals JSONB)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_a public.land_records;
    v_b public.land_records;
    v_survey_match BOOLEAN;
    v_subdivision_match BOOLEAN;
    v_patta_match BOOLEAN;
    v_record_number_match BOOLEAN;
    v_registration_match BOOLEAN;
    v_village_match BOOLEAN;
    v_district_match BOOLEAN;
    v_area_match BOOLEAN;
    v_owner_identity_match BOOLEAN;
    v_owner_name_match BOOLEAN;
    v_score INTEGER := 0;
BEGIN
    IF p_record_a_id IS NULL OR p_record_b_id IS NULL OR p_record_a_id = p_record_b_id THEN
        RAISE EXCEPTION 'Duplicate comparison requires two distinct record IDs.';
    END IF;

    SELECT * INTO v_a FROM public.land_records WHERE id = p_record_a_id;
    SELECT * INTO v_b FROM public.land_records WHERE id = p_record_b_id;
    IF v_a.id IS NULL OR v_b.id IS NULL THEN
        RAISE EXCEPTION 'A land record for duplicate comparison was not found.';
    END IF;

    v_survey_match := nullif(regexp_replace(lower(coalesce(v_a.survey_number, '')), '[^[:alnum:]]', '', 'g'), '')
        = nullif(regexp_replace(lower(coalesce(v_b.survey_number, '')), '[^[:alnum:]]', '', 'g'), '');
    v_subdivision_match := nullif(regexp_replace(lower(coalesce(v_a.subdivision_number, '')), '[^[:alnum:]]', '', 'g'), '')
        = nullif(regexp_replace(lower(coalesce(v_b.subdivision_number, '')), '[^[:alnum:]]', '', 'g'), '');
    v_patta_match := nullif(regexp_replace(lower(coalesce(v_a.patta_number, '')), '[^[:alnum:]]', '', 'g'), '')
        = nullif(regexp_replace(lower(coalesce(v_b.patta_number, '')), '[^[:alnum:]]', '', 'g'), '');
    v_record_number_match := nullif(regexp_replace(lower(coalesce(v_a.record_number, '')), '[^[:alnum:]]', '', 'g'), '')
        = nullif(regexp_replace(lower(coalesce(v_b.record_number, '')), '[^[:alnum:]]', '', 'g'), '');
    v_registration_match := nullif(regexp_replace(lower(coalesce(v_a.registration_number, '')), '[^[:alnum:]]', '', 'g'), '')
        = nullif(regexp_replace(lower(coalesce(v_b.registration_number, '')), '[^[:alnum:]]', '', 'g'), '');
    v_village_match := v_a.village_id IS NOT NULL AND v_a.village_id = v_b.village_id;
    v_district_match := v_a.district_id IS NOT NULL AND v_a.district_id = v_b.district_id;
    v_area_match := v_a.land_area IS NOT NULL AND v_b.land_area IS NOT NULL
        AND v_a.land_area_unit IS NOT DISTINCT FROM v_b.land_area_unit
        AND abs(v_a.land_area - v_b.land_area) <= greatest(abs(v_a.land_area), abs(v_b.land_area), 0.0001) * 0.05;

    SELECT EXISTS (
        SELECT 1
        FROM public.land_record_owners owner_a
        JOIN public.land_owners person_a ON person_a.id = owner_a.owner_id
        JOIN public.land_record_owners owner_b ON owner_b.land_record_id = p_record_b_id
        JOIN public.land_owners person_b ON person_b.id = owner_b.owner_id
        WHERE owner_a.land_record_id = p_record_a_id
          AND (
              owner_a.owner_id = owner_b.owner_id
              OR (
                  nullif(regexp_replace(lower(coalesce(person_a.identification_reference, '')), '[^[:alnum:]]', '', 'g'), '') IS NOT NULL
                  AND regexp_replace(lower(person_a.identification_reference), '[^[:alnum:]]', '', 'g')
                      = regexp_replace(lower(person_b.identification_reference), '[^[:alnum:]]', '', 'g')
              )
          )
    ) INTO v_owner_identity_match;

    SELECT EXISTS (
        SELECT 1
        FROM public.land_record_owners owner_a
        JOIN public.land_owners person_a ON person_a.id = owner_a.owner_id
        JOIN public.land_record_owners owner_b ON owner_b.land_record_id = p_record_b_id
        JOIN public.land_owners person_b ON person_b.id = owner_b.owner_id
        WHERE owner_a.land_record_id = p_record_a_id
          AND nullif(regexp_replace(lower(coalesce(person_a.full_name, '')), '[^[:alnum:]]', '', 'g'), '') IS NOT NULL
          AND regexp_replace(lower(person_a.full_name), '[^[:alnum:]]', '', 'g')
              = regexp_replace(lower(person_b.full_name), '[^[:alnum:]]', '', 'g')
    ) INTO v_owner_name_match;

    v_score := (CASE WHEN v_survey_match THEN 30 ELSE 0 END)
        + (CASE WHEN v_subdivision_match THEN 12 ELSE 0 END)
        + (CASE WHEN v_patta_match THEN 18 ELSE 0 END)
        + (CASE WHEN v_record_number_match THEN 15 ELSE 0 END)
        + (CASE WHEN v_registration_match THEN 6 ELSE 0 END)
        + (CASE WHEN v_village_match THEN 8 ELSE 0 END)
        + (CASE WHEN v_district_match THEN 4 ELSE 0 END)
        + (CASE WHEN v_area_match THEN 4 ELSE 0 END)
        + (CASE WHEN v_owner_identity_match THEN 15 WHEN v_owner_name_match THEN 8 ELSE 0 END);

    RETURN QUERY SELECT LEAST(v_score, 100)::NUMERIC,
        jsonb_build_object(
            'version', 'duplicate-v1',
            'survey_number_match', v_survey_match,
            'subdivision_match', v_subdivision_match,
            'patta_number_match', v_patta_match,
            'record_number_match', v_record_number_match,
            'registration_number_match', v_registration_match,
            'same_village', v_village_match,
            'same_district', v_district_match,
            'land_area_within_five_percent', v_area_match,
            'owner_identity_match', v_owner_identity_match,
            'owner_name_match', v_owner_name_match
        );
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_duplicate_pair_evidence(UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.generate_duplicate_candidates_for_record(p_record_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    INSERT INTO public.duplicate_candidates (record_a_id, record_b_id, similarity_score, match_signals)
    SELECT source.id,
            candidate.id,
           evidence.similarity_score,
           evidence.match_signals
    FROM public.land_records source
    JOIN public.land_records candidate
            ON candidate.id <> source.id
         AND candidate.state_id IS NOT DISTINCT FROM source.state_id
     AND candidate.district_id IS NOT DISTINCT FROM source.district_id
         AND (
                    nullif(regexp_replace(lower(coalesce(source.survey_number, '')), '[^[:alnum:]]', '', 'g'), '')
                        = nullif(regexp_replace(lower(coalesce(candidate.survey_number, '')), '[^[:alnum:]]', '', 'g'), '')
                    OR nullif(regexp_replace(lower(coalesce(source.subdivision_number, '')), '[^[:alnum:]]', '', 'g'), '')
                        = nullif(regexp_replace(lower(coalesce(candidate.subdivision_number, '')), '[^[:alnum:]]', '', 'g'), '')
                    OR nullif(regexp_replace(lower(coalesce(source.patta_number, '')), '[^[:alnum:]]', '', 'g'), '')
                        = nullif(regexp_replace(lower(coalesce(candidate.patta_number, '')), '[^[:alnum:]]', '', 'g'), '')
                    OR nullif(regexp_replace(lower(coalesce(source.registration_number, '')), '[^[:alnum:]]', '', 'g'), '')
                        = nullif(regexp_replace(lower(coalesce(candidate.registration_number, '')), '[^[:alnum:]]', '', 'g'), '')
                    OR EXISTS (
                            SELECT 1
                            FROM public.land_record_owners source_owner
                            JOIN public.land_owners source_person ON source_person.id = source_owner.owner_id
                            JOIN public.land_record_owners candidate_owner ON candidate_owner.land_record_id = candidate.id
                            JOIN public.land_owners candidate_person ON candidate_person.id = candidate_owner.owner_id
                            WHERE source_owner.land_record_id = source.id
                                AND (
                                        source_owner.owner_id = candidate_owner.owner_id
                                        OR (
                                                source_person.identification_reference IS NOT NULL
                                                AND regexp_replace(lower(source_person.identification_reference), '[^[:alnum:]]', '', 'g')
                                                        = regexp_replace(lower(candidate_person.identification_reference), '[^[:alnum:]]', '', 'g')
                                        )
                                )
                    )
            )
    CROSS JOIN LATERAL public.calculate_duplicate_pair_evidence(source.id, candidate.id) evidence
    WHERE source.id = p_record_id
      AND evidence.similarity_score >= 30
    ON CONFLICT ((LEAST(record_a_id, record_b_id)), (GREATEST(record_a_id, record_b_id)))
    DO UPDATE SET
        similarity_score = EXCLUDED.similarity_score,
        match_signals = EXCLUDED.match_signals,
        updated_at = NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_duplicate_candidates_for_record(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.generate_duplicate_candidates_after_owner_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_owner_id UUID;
    v_record_id UUID;
BEGIN
    IF TG_TABLE_NAME = 'land_owners' THEN
        v_owner_id := coalesce(NEW.id, OLD.id);
        FOR v_record_id IN
            SELECT land_record_id FROM public.land_record_owners WHERE owner_id = v_owner_id
        LOOP
            PERFORM public.generate_duplicate_candidates_for_record(v_record_id);
        END LOOP;
    ELSE
        v_record_id := coalesce(NEW.land_record_id, OLD.land_record_id);
        IF v_record_id IS NOT NULL THEN
            PERFORM public.generate_duplicate_candidates_for_record(v_record_id);
        END IF;
    END IF;
    RETURN coalesce(NEW, OLD);
END;
$$;

CREATE TRIGGER generate_duplicate_candidates_after_record_owner_change
AFTER INSERT OR UPDATE OR DELETE ON public.land_record_owners
FOR EACH ROW EXECUTE FUNCTION public.generate_duplicate_candidates_after_owner_change();

CREATE TRIGGER generate_duplicate_candidates_after_owner_change
AFTER UPDATE OF full_name, identification_reference ON public.land_owners
FOR EACH ROW EXECUTE FUNCTION public.generate_duplicate_candidates_after_owner_change();

CREATE OR REPLACE FUNCTION public.scan_duplicate_candidates()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_record_id UUID;
    v_total INTEGER := 0;
BEGIN
    IF NOT public.has_permission('duplicate:scan') THEN
        RAISE EXCEPTION 'You do not have permission to scan for duplicate records.';
    END IF;

    FOR v_record_id IN
        SELECT record.id
        FROM public.land_records record
        WHERE public.can_access_land_record(record.id)
    LOOP
        v_total := v_total + public.generate_duplicate_candidates_for_record(v_record_id);
    END LOOP;

    RETURN v_total / 2;
END;
$$;

REVOKE ALL ON FUNCTION public.scan_duplicate_candidates() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.scan_duplicate_candidates() TO authenticated;

CREATE OR REPLACE FUNCTION public.generate_duplicate_candidates_after_record_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    PERFORM public.generate_duplicate_candidates_for_record(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS generate_duplicate_candidates_after_insert ON public.land_records;
CREATE TRIGGER generate_duplicate_candidates_after_insert
AFTER INSERT ON public.land_records
FOR EACH ROW EXECUTE FUNCTION public.generate_duplicate_candidates_after_record_change();

DROP TRIGGER IF EXISTS generate_duplicate_candidates_after_update ON public.land_records;
CREATE TRIGGER generate_duplicate_candidates_after_update
AFTER UPDATE OF survey_number, subdivision_number, patta_number, record_number,
    registration_number, district_id, village_id, land_area, land_area_unit
ON public.land_records
FOR EACH ROW EXECUTE FUNCTION public.generate_duplicate_candidates_after_record_change();

CREATE OR REPLACE FUNCTION public.recompute_land_record_risk(p_land_record_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_record public.land_records;
    v_assessment_id UUID;
    v_status TEXT;
    v_assigned_to UUID;
    v_notes TEXT;
    v_score INTEGER := 0;
    v_level TEXT;
    v_signals JSONB := '[]'::JSONB;
    v_document_count INTEGER := 0;
    v_duplicate_count INTEGER := 0;
    v_change_count INTEGER := 0;
    v_high_alert_count INTEGER := 0;
    v_owner_total NUMERIC := 0;
    v_owner_count INTEGER := 0;
    v_geo_inconsistent BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_record FROM public.land_records WHERE id = p_land_record_id;
    IF v_record.id IS NULL THEN RETURN NULL; END IF;

    SELECT count(*) INTO v_document_count FROM public.documents WHERE land_record_id = p_land_record_id;
    SELECT count(*) INTO v_duplicate_count
    FROM public.duplicate_candidates
    WHERE (record_a_id = p_land_record_id OR record_b_id = p_land_record_id)
      AND status IN ('PENDING', 'UNDER_REVIEW', 'CONFIRMED')
      AND similarity_score >= 75;
    SELECT count(*) INTO v_change_count
    FROM public.record_changes
    WHERE land_record_id = p_land_record_id
      AND changed_at >= NOW() - INTERVAL '90 days'
      AND change_priority IN ('HIGH', 'CRITICAL');
    SELECT count(*) INTO v_high_alert_count
    FROM public.alerts
    WHERE land_record_id = p_land_record_id
      AND status <> 'RESOLVED'
      AND priority IN ('HIGH', 'CRITICAL');
    SELECT count(*), coalesce(sum(ownership_percentage), 0)
      INTO v_owner_count, v_owner_total
    FROM public.land_record_owners
    WHERE land_record_id = p_land_record_id
      AND effective_to IS NULL;

    SELECT EXISTS (
        SELECT 1
        FROM public.districts district
        WHERE district.id = v_record.district_id
          AND district.state_id IS DISTINCT FROM v_record.state_id
        UNION ALL
        SELECT 1
        FROM public.taluks taluk
        WHERE taluk.id = v_record.taluk_id
          AND taluk.district_id IS DISTINCT FROM v_record.district_id
        UNION ALL
        SELECT 1
        FROM public.villages village
        JOIN public.taluks taluk ON taluk.id = village.taluk_id
        WHERE village.id = v_record.village_id
          AND taluk.id IS DISTINCT FROM v_record.taluk_id
    ) INTO v_geo_inconsistent;

    IF v_record.verification_status = 'PENDING' THEN
        v_score := v_score + 8;
        v_signals := v_signals || jsonb_build_array(jsonb_build_object('signal_type', 'verification_pending', 'description', 'Record has not completed verification.', 'contribution', 8, 'severity', 'LOW', 'evidence', jsonb_build_object('status', v_record.verification_status)));
    ELSIF v_record.verification_status = 'CORRECTION_REQUIRED' THEN
        v_score := v_score + 16;
        v_signals := v_signals || jsonb_build_array(jsonb_build_object('signal_type', 'verification_correction_required', 'description', 'Verification requested record corrections.', 'contribution', 16, 'severity', 'HIGH', 'evidence', jsonb_build_object('status', v_record.verification_status)));
    ELSIF v_record.verification_status = 'REJECTED' THEN
        v_score := v_score + 25;
        v_signals := v_signals || jsonb_build_array(jsonb_build_object('signal_type', 'verification_rejected', 'description', 'Record verification was rejected.', 'contribution', 25, 'severity', 'HIGH', 'evidence', jsonb_build_object('status', v_record.verification_status)));
    ELSIF v_record.verification_status = 'UNDER_REVIEW' THEN
        v_score := v_score + 4;
        v_signals := v_signals || jsonb_build_array(jsonb_build_object('signal_type', 'verification_in_review', 'description', 'Record is currently being reviewed.', 'contribution', 4, 'severity', 'LOW', 'evidence', jsonb_build_object('status', v_record.verification_status)));
    END IF;

    IF v_record.land_area IS NULL OR v_record.land_area <= 0 THEN
        v_score := v_score + 8;
        v_signals := v_signals || jsonb_build_array(jsonb_build_object('signal_type', 'invalid_land_area', 'description', 'Land area is missing or not positive.', 'contribution', 8, 'severity', 'MODERATE', 'evidence', jsonb_build_object('land_area', v_record.land_area)));
    END IF;
    IF v_record.land_type IS NULL OR btrim(v_record.land_type) = '' THEN
        v_score := v_score + 5;
        v_signals := v_signals || jsonb_build_array(jsonb_build_object('signal_type', 'missing_land_type', 'description', 'Land classification is missing.', 'contribution', 5, 'severity', 'LOW', 'evidence', jsonb_build_object('field', 'land_type')));
    END IF;
    IF v_record.village_id IS NULL THEN
        v_score := v_score + 5;
        v_signals := v_signals || jsonb_build_array(jsonb_build_object('signal_type', 'missing_village', 'description', 'Village linkage is missing.', 'contribution', 5, 'severity', 'LOW', 'evidence', jsonb_build_object('field', 'village_id')));
    END IF;
    IF v_geo_inconsistent THEN
        v_score := v_score + 15;
        v_signals := v_signals || jsonb_build_array(jsonb_build_object('signal_type', 'geography_inconsistent', 'description', 'Record geography does not follow the configured hierarchy.', 'contribution', 15, 'severity', 'HIGH', 'evidence', jsonb_build_object('field', 'geography')));
    END IF;
    IF v_document_count = 0 THEN
        v_score := v_score + 10;
        v_signals := v_signals || jsonb_build_array(jsonb_build_object('signal_type', 'no_documents', 'description', 'No documents are linked to the land record.', 'contribution', 10, 'severity', 'MODERATE', 'evidence', jsonb_build_object('document_count', 0)));
    END IF;
    IF v_duplicate_count > 0 THEN
        v_score := v_score + least(20, v_duplicate_count * 10);
        v_signals := v_signals || jsonb_build_array(jsonb_build_object('signal_type', 'high_similarity_duplicates', 'description', 'High-similarity duplicate candidates require review.', 'contribution', least(20, v_duplicate_count * 10), 'severity', 'HIGH', 'evidence', jsonb_build_object('candidate_count', v_duplicate_count, 'minimum_similarity', 75)));
    END IF;
    IF v_change_count >= 3 THEN
        v_score := v_score + least(15, (v_change_count - 2) * 5);
        v_signals := v_signals || jsonb_build_array(jsonb_build_object('signal_type', 'repeated_critical_changes', 'description', 'Multiple high-priority changes were recorded in the last 90 days.', 'contribution', least(15, (v_change_count - 2) * 5), 'severity', 'HIGH', 'evidence', jsonb_build_object('change_count_90d', v_change_count)));
    END IF;
    IF v_high_alert_count > 0 THEN
        v_score := v_score + least(20, v_high_alert_count * 10);
        v_signals := v_signals || jsonb_build_array(jsonb_build_object('signal_type', 'unresolved_high_alerts', 'description', 'Unresolved high-priority monitoring alerts are linked to this record.', 'contribution', least(20, v_high_alert_count * 10), 'severity', 'HIGH', 'evidence', jsonb_build_object('alert_count', v_high_alert_count)));
    END IF;
    IF v_owner_count > 0 AND v_owner_total > 100 THEN
        v_score := v_score + 15;
        v_signals := v_signals || jsonb_build_array(jsonb_build_object('signal_type', 'ownership_percentage_exceeds_total', 'description', 'Active ownership percentages exceed 100%.', 'contribution', 15, 'severity', 'HIGH', 'evidence', jsonb_build_object('ownership_percentage_total', v_owner_total)));
    END IF;

    v_score := least(v_score, 100);
    v_level := CASE WHEN v_score >= 75 THEN 'CRITICAL'
                    WHEN v_score >= 50 THEN 'HIGH'
                    WHEN v_score >= 25 THEN 'MODERATE'
                    ELSE 'LOW' END;

    SELECT id, status, assigned_to, investigation_notes
      INTO v_assessment_id, v_status, v_assigned_to, v_notes
    FROM public.risk_assessments
    WHERE land_record_id = p_land_record_id
    ORDER BY calculated_at DESC, created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_assessment_id IS NULL THEN
        INSERT INTO public.risk_assessments (land_record_id, risk_score, risk_level, status, calculation_version)
        VALUES (p_land_record_id, v_score, v_level, 'ACTIVE', 'v1.0-live-evidence')
        RETURNING id INTO v_assessment_id;
    ELSE
        UPDATE public.risk_assessments
        SET risk_score = v_score,
            risk_level = v_level,
            calculated_at = NOW(),
            calculation_version = 'v1.0-live-evidence',
            status = coalesce(v_status, 'ACTIVE'),
            assigned_to = v_assigned_to,
            investigation_notes = v_notes,
            updated_at = NOW()
        WHERE id = v_assessment_id;
        DELETE FROM public.risk_signals WHERE risk_assessment_id = v_assessment_id;
    END IF;

    INSERT INTO public.risk_signals (risk_assessment_id, signal_type, description, contribution, severity, evidence)
    SELECT v_assessment_id, signal.signal_type, signal.description, signal.contribution,
           signal.severity, signal.evidence
    FROM jsonb_to_recordset(v_signals) AS signal(
        signal_type TEXT, description TEXT, contribution NUMERIC,
        severity TEXT, evidence JSONB
    );

    RETURN v_assessment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_land_record_risk(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.recompute_risk_assessment(p_land_record_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_record public.land_records;
BEGIN
    IF NOT (public.has_permission('risk:manage') OR public.has_permission('risk:investigate')) THEN
        RAISE EXCEPTION 'You do not have permission to recalculate risk assessments.';
    END IF;

    SELECT * INTO v_record FROM public.land_records WHERE id = p_land_record_id;
    IF v_record.id IS NULL THEN RAISE EXCEPTION 'Land record not found.'; END IF;
    IF NOT public.can_access_land_record(p_land_record_id) THEN
        RAISE EXCEPTION 'Land record is outside your authorized scope.';
    END IF;

    RETURN public.recompute_land_record_risk(p_land_record_id);
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_risk_assessment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_risk_assessment(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.recompute_land_record_risk_after_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_record_id UUID;
BEGIN
    IF TG_TABLE_NAME = 'land_records' THEN
        v_record_id := coalesce(NEW.id, OLD.id);
        PERFORM public.recompute_land_record_risk(v_record_id);
    ELSIF TG_TABLE_NAME = 'duplicate_candidates' THEN
        PERFORM public.recompute_land_record_risk(coalesce(NEW.record_a_id, OLD.record_a_id));
        PERFORM public.recompute_land_record_risk(coalesce(NEW.record_b_id, OLD.record_b_id));
    ELSE
        v_record_id := coalesce(NEW.land_record_id, OLD.land_record_id);
        IF v_record_id IS NOT NULL THEN
            PERFORM public.recompute_land_record_risk(v_record_id);
        END IF;
    END IF;
    RETURN coalesce(NEW, OLD);
END;
$$;

CREATE TRIGGER recompute_risk_after_record_change
AFTER INSERT OR UPDATE OF survey_number, subdivision_number, patta_number, district_id,
    taluk_id, village_id, land_area, land_type, verification_status
ON public.land_records
FOR EACH ROW EXECUTE FUNCTION public.recompute_land_record_risk_after_change();

CREATE TRIGGER recompute_risk_after_document_change
AFTER INSERT OR UPDATE OF land_record_id, processing_status, verification_status OR DELETE
ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.recompute_land_record_risk_after_change();

CREATE TRIGGER recompute_risk_after_verification_change
AFTER INSERT OR UPDATE OF land_record_id, status OR DELETE
ON public.verification_tasks
FOR EACH ROW EXECUTE FUNCTION public.recompute_land_record_risk_after_change();

CREATE TRIGGER recompute_risk_after_duplicate_change
AFTER INSERT OR UPDATE OF status, similarity_score OR DELETE
ON public.duplicate_candidates
FOR EACH ROW EXECUTE FUNCTION public.recompute_land_record_risk_after_change();

CREATE TRIGGER recompute_risk_after_record_change_event
AFTER INSERT ON public.record_changes
FOR EACH ROW EXECUTE FUNCTION public.recompute_land_record_risk_after_change();

CREATE TRIGGER recompute_risk_after_alert_change
AFTER INSERT OR UPDATE OF status, priority OR DELETE
ON public.alerts
FOR EACH ROW EXECUTE FUNCTION public.recompute_land_record_risk_after_change();

CREATE TRIGGER recompute_risk_after_ownership_change
AFTER INSERT OR UPDATE OR DELETE ON public.land_record_owners
FOR EACH ROW EXECUTE FUNCTION public.recompute_land_record_risk_after_change();

CREATE OR REPLACE FUNCTION public.trigger_land_record_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_area_change NUMERIC;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.land_area IS DISTINCT FROM OLD.land_area THEN
        IF OLD.land_area IS NOT NULL AND OLD.land_area > 0 THEN
            v_area_change := abs(NEW.land_area - OLD.land_area) / OLD.land_area;
        END IF;

        INSERT INTO public.record_changes (
            land_record_id, entity_type, entity_id, field_name, old_value, new_value,
            change_priority, changed_by, reason
        ) VALUES (
            NEW.id, 'land_records', NEW.id, 'land_area', OLD.land_area::TEXT, NEW.land_area::TEXT,
            CASE WHEN v_area_change > 0.20 THEN 'CRITICAL' ELSE 'LOW' END,
            v_actor_id,
            CASE WHEN v_area_change > 0.20 THEN 'Automated detection: land area changed by more than 20%.' ELSE 'Land area updated.' END
        );

        IF v_area_change > 0.20 THEN
            INSERT INTO public.alerts (land_record_id, alert_type, priority, title, description, created_by)
            VALUES (NEW.id, 'AREA_CHANGE_ANOMALY', 'CRITICAL', 'Significant Area Modification',
                'Land area changed by more than 20% between revisions.', v_actor_id);
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.land_type IS DISTINCT FROM OLD.land_type THEN
        INSERT INTO public.record_changes (
            land_record_id, entity_type, entity_id, field_name, old_value, new_value,
            change_priority, changed_by, reason
        ) VALUES (
            NEW.id, 'land_records', NEW.id, 'land_type', OLD.land_type, NEW.land_type,
            'HIGH', v_actor_id, 'Land classification modified.'
        );

        INSERT INTO public.alerts (land_record_id, alert_type, priority, title, description, created_by)
        VALUES (NEW.id, 'CLASSIFICATION_CHANGE', 'HIGH', 'Land Classification Changed',
            'The land type was reclassified.', v_actor_id);
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_watchlist_users_for_record_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_record_number TEXT;
BEGIN
    SELECT record_number INTO v_record_number
    FROM public.land_records
    WHERE id = NEW.land_record_id;

    INSERT INTO public.notifications (user_id, notification_type, title, message, entity_type, entity_id)
    SELECT watchlist.user_id,
           'LAND_RECORD_CHANGE',
           'Watched land record changed',
           format('%s: %s changed from %s to %s.', coalesce(v_record_number, NEW.land_record_id::TEXT), NEW.field_name,
               coalesce(NEW.old_value, 'unset'), coalesce(NEW.new_value, 'unset')),
           NEW.entity_type,
           NEW.entity_id
    FROM public.watchlists watchlist
    WHERE watchlist.land_record_id = NEW.land_record_id
      AND watchlist.status = 'ACTIVE';

    RETURN NEW;
END;
$$;

CREATE TRIGGER notify_watchlist_users_after_record_change
AFTER INSERT ON public.record_changes
FOR EACH ROW EXECUTE FUNCTION public.notify_watchlist_users_for_record_change();

CREATE OR REPLACE FUNCTION public.publish_duplicate_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_record_id UUID;
    v_record_number TEXT;
BEGIN
    IF TG_OP <> 'UPDATE' OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;

    FOREACH v_record_id IN ARRAY ARRAY[NEW.record_a_id, NEW.record_b_id] LOOP
        SELECT record_number INTO v_record_number
        FROM public.land_records WHERE id = v_record_id;

        INSERT INTO public.record_changes (
            land_record_id, entity_type, entity_id, field_name, old_value, new_value,
            change_priority, changed_by, reason
        ) VALUES (
            v_record_id, 'duplicate_candidates', NEW.id, 'status', OLD.status, NEW.status,
            CASE WHEN NEW.status = 'CONFIRMED' THEN 'HIGH' ELSE 'MEDIUM' END,
            auth.uid(), 'Duplicate candidate review status changed.'
        );

        IF NEW.status = 'CONFIRMED' THEN
            INSERT INTO public.alerts (land_record_id, alert_type, priority, title, description, created_by)
            VALUES (v_record_id, 'DUPLICATE_CONFIRMED', 'HIGH', 'Duplicate candidate confirmed',
                format('A duplicate candidate involving record %s was confirmed.', coalesce(v_record_number, v_record_id::TEXT)), auth.uid());
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

CREATE TRIGGER publish_duplicate_status_change
AFTER UPDATE OF status ON public.duplicate_candidates
FOR EACH ROW EXECUTE FUNCTION public.publish_duplicate_status_change();

CREATE OR REPLACE FUNCTION public.publish_verification_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP <> 'UPDATE' OR NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.land_record_id IS NULL THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.record_changes (
        land_record_id, entity_type, entity_id, field_name, old_value, new_value,
        change_priority, changed_by, reason
    ) VALUES (
        NEW.land_record_id, 'verification_tasks', NEW.id, 'status', OLD.status, NEW.status,
        CASE WHEN NEW.status IN ('REJECTED', 'CORRECTION_REQUIRED') THEN 'HIGH' ELSE 'MEDIUM' END,
        auth.uid(), 'Verification task status changed.'
    );

    IF NEW.status IN ('REJECTED', 'CORRECTION_REQUIRED') THEN
        INSERT INTO public.alerts (land_record_id, alert_type, priority, title, description, created_by)
        VALUES (
            NEW.land_record_id,
            'VERIFICATION_STATUS_CHANGE',
            'HIGH',
            'Verification requires follow-up',
            format('Verification task %s changed to %s.', NEW.id, NEW.status),
            auth.uid()
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER publish_verification_status_change
AFTER UPDATE OF status ON public.verification_tasks
FOR EACH ROW EXECUTE FUNCTION public.publish_verification_status_change();

CREATE OR REPLACE FUNCTION public.publish_high_risk_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_record_number TEXT;
BEGIN
    IF NEW.risk_level NOT IN ('HIGH', 'CRITICAL')
       OR (TG_OP = 'UPDATE' AND NEW.risk_level IS NOT DISTINCT FROM OLD.risk_level) THEN
        RETURN NEW;
    END IF;

    SELECT record_number INTO v_record_number
    FROM public.land_records WHERE id = NEW.land_record_id;

    INSERT INTO public.alerts (land_record_id, alert_type, priority, title, description, created_by)
    VALUES (
        NEW.land_record_id,
        'RISK_LEVEL_CHANGE',
        NEW.risk_level,
        'Land record risk increased',
        format('Record %s is now classified as %s risk (score %s).', coalesce(v_record_number, NEW.land_record_id::TEXT), NEW.risk_level, NEW.risk_score),
        auth.uid()
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER publish_high_risk_alert
AFTER INSERT OR UPDATE OF risk_level ON public.risk_assessments
FOR EACH ROW EXECUTE FUNCTION public.publish_high_risk_alert();

CREATE TRIGGER audit_alerts
AFTER INSERT OR UPDATE OR DELETE ON public.alerts
FOR EACH ROW EXECUTE FUNCTION public.trigger_log_audit();

DO $$
DECLARE
    v_record_id UUID;
BEGIN
    FOR v_record_id IN SELECT id FROM public.land_records LOOP
        PERFORM public.recompute_land_record_risk(v_record_id);
    END LOOP;
END;
$$;