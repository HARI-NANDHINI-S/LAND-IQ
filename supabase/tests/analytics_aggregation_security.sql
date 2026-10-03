-- Run as a privileged operator after the analytics aggregation migration.
-- The transaction is rolled back; role and JWT settings simulate API callers.
BEGIN;

DO $$
DECLARE
    v_profile_id UUID;
    v_home_district_id UUID;
    v_other_district_id UUID;
    v_function_oid REGPROCEDURE;
BEGIN
    SELECT profile.id, profile.district_id
      INTO v_profile_id, v_home_district_id
    FROM public.profiles profile
    JOIN public.roles role ON role.id = profile.role_id
    JOIN public.role_permissions role_permission ON role_permission.role_id = role.id
    JOIN public.permissions permission ON permission.id = role_permission.permission_id
    WHERE profile.is_active = TRUE
      AND role.code = 'DISTRICT_OFFICER'
      AND profile.district_id IS NOT NULL
      AND permission.code = 'analytics:read'
    ORDER BY profile.created_at
    LIMIT 1;

    IF v_profile_id IS NULL THEN
        RAISE EXCEPTION 'Analytics scope test requires an active DISTRICT_OFFICER with analytics:read and a district.';
    END IF;

    SELECT district.id INTO v_other_district_id
    FROM public.districts district
    WHERE district.is_active = TRUE
      AND district.id <> v_home_district_id
    LIMIT 1;

    IF v_other_district_id IS NULL THEN
        RAISE EXCEPTION 'Analytics scope test requires a second active district.';
    END IF;

    SELECT 'public.get_analytics_dashboard_data(uuid,uuid,uuid,uuid,text,text,text,text,text,text,date,date)'::REGPROCEDURE
      INTO v_function_oid;

    IF v_function_oid IS NULL OR NOT EXISTS (
        SELECT 1 FROM pg_proc procedure
        WHERE procedure.oid = v_function_oid
          AND procedure.prosecdef = FALSE
    ) THEN
        RAISE EXCEPTION 'Analytics aggregation must exist as SECURITY INVOKER.';
    END IF;
    IF has_function_privilege('anon', v_function_oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'Anonymous users must not execute analytics aggregation.';
    END IF;
    IF NOT has_function_privilege('authenticated', v_function_oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'Authenticated users must be granted analytics aggregation execution.';
    END IF;

    PERFORM set_config('landiq_test.analytics_user_id', v_profile_id::TEXT, TRUE);
    PERFORM set_config('landiq_test.analytics_other_district_id', v_other_district_id::TEXT, TRUE);
END;
$$;

SELECT set_config('request.jwt.claim.sub', current_setting('landiq_test.analytics_user_id'), TRUE);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_result JSONB;
    v_visible_count BIGINT;
    v_visible_documents BIGINT;
    v_visible_tasks BIGINT;
    v_visible_duplicates BIGINT;
    v_visible_risks BIGINT;
    v_visible_alerts BIGINT;
    v_outside_result JSONB;
BEGIN
    SELECT public.get_analytics_dashboard_data(
        NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    ) INTO v_result;
    SELECT count(*) INTO v_visible_count FROM public.land_records;
    SELECT count(*) INTO v_visible_documents FROM public.documents;
    SELECT count(*) INTO v_visible_tasks FROM public.verification_tasks;
    SELECT count(*) INTO v_visible_duplicates FROM public.duplicate_candidates;
    SELECT count(*) INTO v_visible_risks FROM public.risk_assessments;
    SELECT count(*) INTO v_visible_alerts FROM public.alerts;

    IF (v_result #>> '{summary,totalLandRecords}')::BIGINT <> v_visible_count THEN
        RAISE EXCEPTION 'Analytics land-record total does not match rows visible under the caller RLS policies.';
    END IF;
    IF (v_result #>> '{summary,totalDocuments}')::BIGINT <> v_visible_documents
       OR (v_result #>> '{summary,totalVerificationTasks}')::BIGINT <> v_visible_tasks
       OR (v_result #>> '{summary,totalDuplicateCandidates}')::BIGINT <> v_visible_duplicates
       OR (v_result #>> '{summary,totalRiskAssessments}')::BIGINT <> v_visible_risks
       OR (v_result #>> '{summary,totalAlerts}')::BIGINT <> v_visible_alerts THEN
        RAISE EXCEPTION 'Analytics totals do not match rows visible under the caller RLS policies.';
    END IF;

    SELECT public.get_analytics_dashboard_data(
        NULL,
        current_setting('landiq_test.analytics_other_district_id')::UUID,
        NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    ) INTO v_outside_result;

    IF (v_outside_result #>> '{summary,totalLandRecords}')::BIGINT <> 0 THEN
        RAISE EXCEPTION 'Analytics aggregation exposed land records outside the caller district.';
    END IF;
    IF (v_outside_result #>> '{summary,totalDocuments}')::BIGINT <> 0
       OR (v_outside_result #>> '{summary,totalVerificationTasks}')::BIGINT <> 0
       OR (v_outside_result #>> '{summary,totalRiskAssessments}')::BIGINT <> 0
       OR (v_outside_result #>> '{summary,totalAlerts}')::BIGINT <> 0 THEN
        RAISE EXCEPTION 'Analytics aggregation exposed geographically filtered child records outside the caller district.';
    END IF;
    RAISE NOTICE 'PASS: analytics output is scoped by caller RLS and cannot aggregate another district.';
END;
$$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', TRUE);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_rejected BOOLEAN := FALSE;
BEGIN
    BEGIN
        PERFORM public.get_analytics_dashboard_data(
            NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
        );
    EXCEPTION WHEN insufficient_privilege THEN
        v_rejected := TRUE;
    END;

    IF NOT v_rejected THEN
        RAISE EXCEPTION 'Analytics aggregation accepted a caller without analytics:read.';
    END IF;
    RAISE NOTICE 'PASS: analytics permission is enforced inside the RPC.';
END;
$$;

RESET ROLE;
ROLLBACK;
