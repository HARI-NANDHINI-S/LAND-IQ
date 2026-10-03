-- Run as a privileged database operator after all migrations.
-- All fixtures and generated rows are rolled back by the surrounding transaction.
BEGIN;

DO $$
DECLARE
    v_record_a UUID := uuid_generate_v4();
    v_record_b UUID := uuid_generate_v4();
    v_owner_id UUID := uuid_generate_v4();
    v_candidate_count INTEGER;
    v_candidate public.duplicate_candidates;
    v_score_a NUMERIC;
    v_evidence_a JSONB;
    v_score_b NUMERIC;
    v_evidence_b JSONB;
    v_assessment public.risk_assessments;
    v_nearby_count INTEGER;
    v_map_count INTEGER;
    v_actor_id UUID;
    v_west DOUBLE PRECISION;
    v_south DOUBLE PRECISION;
    v_east DOUBLE PRECISION;
    v_north DOUBLE PRECISION;
BEGIN
    INSERT INTO public.land_records (
        id, record_number, survey_number, subdivision_number, patta_number,
        registration_number, land_area, land_area_unit, land_type,
        verification_status, latitude, longitude
    ) VALUES
        (v_record_a, 'TEST-' || v_record_a::TEXT, 'TEST-SURVEY-104', '1A', 'TEST-PATTA-4', 'TEST-REG-204', 2.0, 'acres', 'TEST', 'APPROVED', 12.1, 76.1),
        (v_record_b, 'TEST-' || v_record_b::TEXT, ' test survey 104 ', '1-a', 'TEST PATTA 4', 'TEST REG 204', 2.0, 'acres', 'TEST', 'APPROVED', 12.1005, 76.1005);

    INSERT INTO public.land_owners (id, full_name, identification_reference)
    VALUES (v_owner_id, 'TEST OWNER', 'TEST-ID-884');

    INSERT INTO public.land_record_owners (land_record_id, owner_id, ownership_percentage)
    VALUES (v_record_a, v_owner_id, 100), (v_record_b, v_owner_id, 100);

    SELECT count(*) INTO v_candidate_count
    FROM public.duplicate_candidates candidate
    WHERE (candidate.record_a_id = v_record_a AND candidate.record_b_id = v_record_b)
       OR (candidate.record_a_id = v_record_b AND candidate.record_b_id = v_record_a);
    IF v_candidate_count <> 1 THEN
        RAISE EXCEPTION 'Expected one deterministic duplicate candidate, found %.', v_candidate_count;
    END IF;

    SELECT * INTO v_candidate
    FROM public.duplicate_candidates candidate
    WHERE (candidate.record_a_id = v_record_a AND candidate.record_b_id = v_record_b)
       OR (candidate.record_a_id = v_record_b AND candidate.record_b_id = v_record_a);
    IF v_candidate.similarity_score < 75 OR v_candidate.match_signals->>'version' <> 'duplicate-v1' THEN
        RAISE EXCEPTION 'Duplicate candidate score/evidence was not persisted correctly.';
    END IF;

    SELECT similarity_score, match_signals INTO v_score_a, v_evidence_a
    FROM public.calculate_duplicate_pair_evidence(v_record_a, v_record_b);
    SELECT similarity_score, match_signals INTO v_score_b, v_evidence_b
    FROM public.calculate_duplicate_pair_evidence(v_record_a, v_record_b);
    IF v_score_a IS DISTINCT FROM v_score_b OR v_evidence_a IS DISTINCT FROM v_evidence_b THEN
        RAISE EXCEPTION 'Duplicate scoring is not reproducible.';
    END IF;

    SELECT * INTO v_assessment
    FROM public.risk_assessments
    WHERE land_record_id = v_record_a
    ORDER BY calculated_at DESC
    LIMIT 1;
    IF v_assessment.id IS NULL
       OR v_assessment.risk_score NOT BETWEEN 0 AND 100
       OR v_assessment.risk_level IS DISTINCT FROM (CASE
            WHEN v_assessment.risk_score >= 75 THEN 'CRITICAL'
            WHEN v_assessment.risk_score >= 50 THEN 'HIGH'
            WHEN v_assessment.risk_score >= 25 THEN 'MODERATE'
            ELSE 'LOW'
          END)
       OR v_assessment.calculation_version <> 'v1.0-live-evidence' THEN
        RAISE EXCEPTION 'Risk score, level, or calculation version is invalid.';
    END IF;

    UPDATE public.risk_assessments SET status = 'UNDER_REVIEW' WHERE id = v_assessment.id;
    PERFORM public.recompute_land_record_risk(v_record_a);
    IF (SELECT status FROM public.risk_assessments WHERE id = v_assessment.id) <> 'UNDER_REVIEW' THEN
        RAISE EXCEPTION 'Evidence recomputation overwrote manual investigation status.';
    END IF;

    SELECT count(*) INTO v_map_count
    FROM public.get_spatial_land_records(76.09, 12.09, 76.11, 12.11, p_limit => 50)
    WHERE id IN (v_record_a, v_record_b);
    IF v_map_count <> 2 THEN
        RAISE EXCEPTION 'Bounds-based spatial query did not return the two test records.';
    END IF;

    SELECT count(*) INTO v_nearby_count
    FROM public.get_nearby_land_records(12.1, 76.1, 200, 50)
    WHERE id IN (v_record_a, v_record_b);
    IF v_nearby_count <> 2 THEN
        RAISE EXCEPTION 'Nearby search did not return the two test records.';
    END IF;

    SELECT profile.id INTO v_actor_id
    FROM public.profiles profile
    JOIN public.roles role ON role.id = profile.role_id
    WHERE profile.is_active = TRUE
      AND role.code = 'SUPER_ADMIN'
    LIMIT 1;
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Spatial extent test requires an active SUPER_ADMIN.';
    END IF;
    PERFORM set_config('request.jwt.claim.sub', v_actor_id::TEXT, TRUE);

    SELECT extent.west, extent.south, extent.east, extent.north
      INTO v_west, v_south, v_east, v_north
    FROM public.get_spatial_land_record_extent() extent;
    IF v_west > 76.1 OR v_south > 12.1 OR v_east < 76.1005 OR v_north < 12.1005 THEN
        RAISE EXCEPTION 'The spatial extent did not include the persisted test coordinates.';
    END IF;

    RAISE NOTICE 'PASS: duplicate evidence, deterministic score, live risk recompute, and spatial filters.';
END;
$$;

ROLLBACK;
