-- Run as a privileged operator after the GIS summary aggregation migration.
-- The transaction rolls back and exercises the function under authenticated RLS.
BEGIN;

DO $setup$
DECLARE
    v_profile_id UUID;
    v_function_oid REGPROCEDURE;
BEGIN
    SELECT profile.id
      INTO v_profile_id
    FROM public.profiles profile
    JOIN public.roles role ON role.id = profile.role_id
    JOIN public.role_permissions role_permission ON role_permission.role_id = role.id
    JOIN public.permissions permission ON permission.id = role_permission.permission_id
    WHERE profile.is_active = TRUE
      AND role.code = 'SUPER_ADMIN'
      AND permission.code = 'land_record:read'
    ORDER BY profile.created_at
    LIMIT 1;

    IF v_profile_id IS NULL THEN
        RAISE EXCEPTION 'GIS summary test requires an active SUPER_ADMIN with land_record:read.';
    END IF;

    v_function_oid := 'public.get_gis_land_record_summary(uuid,uuid,uuid,uuid,text,text,text,text)'::REGPROCEDURE;
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_proc procedure
        WHERE procedure.oid = v_function_oid
          AND NOT procedure.prosecdef
          AND procedure.proconfig @> ARRAY['search_path=public, pg_temp']
    ) THEN
        RAISE EXCEPTION 'GIS aggregation must use SECURITY INVOKER and a fixed search_path.';
    END IF;
    IF has_function_privilege('anon', v_function_oid, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', v_function_oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'GIS aggregation execution grants are incorrect.';
    END IF;

    PERFORM set_config('landiq_test.gis_summary_user_id', v_profile_id::TEXT, TRUE);
END;
$setup$;

SELECT set_config('request.jwt.claim.sub', current_setting('landiq_test.gis_summary_user_id'), TRUE);
SET LOCAL ROLE authenticated;

DO $test$
DECLARE
    v_summary JSONB;
    v_visible_count BIGINT;
BEGIN
    SELECT public.get_gis_land_record_summary(NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
      INTO v_summary;
    SELECT count(*) INTO v_visible_count FROM public.land_records;

    IF (v_summary->>'totalRecords')::BIGINT IS DISTINCT FROM v_visible_count THEN
        RAISE EXCEPTION 'GIS aggregate total does not match the caller-visible land record count.';
    END IF;
    IF jsonb_typeof(v_summary->'totalAreaByUnit') <> 'object'
       OR jsonb_typeof(v_summary->'verificationStatuses') <> 'object'
       OR jsonb_typeof(v_summary->'recordStatuses') <> 'object'
       OR jsonb_typeof(v_summary->'landTypes') <> 'object' THEN
        RAISE EXCEPTION 'GIS aggregate returned an invalid distribution shape.';
    END IF;
END;
$test$;

RESET ROLE;
ROLLBACK;
