-- Read-only production security contract checks.
-- Run as a privileged operator after all migrations; this script writes no data.

DO $$
DECLARE
    v_missing TEXT[];
    v_permission_count INTEGER;
    v_super_admin_permission_count INTEGER;
    v_bucket_public BOOLEAN;
    v_bucket_size BIGINT;
    v_function_count INTEGER;
    v_column TEXT;
    v_unhardened_functions TEXT[];
BEGIN
    SELECT ARRAY_AGG(required.table_name)
    INTO v_missing
    FROM unnest(ARRAY[
        'profiles', 'land_records', 'land_owners', 'land_record_owners',
        'documents', 'document_pages', 'extracted_fields', 'verification_tasks',
        'verification_actions', 'duplicate_candidates', 'risk_assessments',
        'risk_signals', 'watchlists', 'alerts', 'notifications', 'record_changes',
        'audit_logs', 'roles', 'permissions', 'role_permissions', 'states',
        'districts', 'taluks', 'villages', 'settings',
        'bhoomivoice_sessions', 'bhoomivoice_messages', 'demo_data_policy'
    ]) AS required(table_name)
    LEFT JOIN pg_catalog.pg_class c
        ON c.relname = required.table_name
       AND c.relnamespace = (
           SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = 'public'
       )
    WHERE c.oid IS NULL OR NOT c.relrowsecurity;

    IF COALESCE(CARDINALITY(v_missing), 0) > 0 THEN
        RAISE EXCEPTION 'RLS is missing or disabled on public tables: %', v_missing;
    END IF;

    IF (SELECT COUNT(*) FROM public.roles WHERE code = ANY(ARRAY[
        'SUPER_ADMIN', 'STATE_ADMIN', 'DISTRICT_OFFICER',
        'DATA_ENTRY_OFFICER', 'VERIFICATION_OFFICER', 'VIEWER'
    ])) <> 6 THEN
        RAISE EXCEPTION 'The expected six LAND-IQ roles are not all seeded.';
    END IF;

    SELECT COUNT(*) INTO v_permission_count FROM public.permissions;
    SELECT COUNT(*) INTO v_super_admin_permission_count
    FROM public.role_permissions rp
    JOIN public.roles r ON r.id = rp.role_id
    WHERE r.code = 'SUPER_ADMIN';

    IF v_permission_count = 0 OR v_super_admin_permission_count <> v_permission_count THEN
        RAISE EXCEPTION 'SUPER_ADMIN must be assigned every seeded permission.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.role_permissions rp
        JOIN public.roles r ON r.id = rp.role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE r.code = 'VIEWER'
          AND p.code IN (
              'land_record:create', 'land_record:update', 'land_record:delete',
              'document:create', 'document:update', 'document:delete',
              'verification:review', 'verification:approve', 'verification:reject',
              'duplicate:review', 'duplicate:resolve', 'risk:manage',
              'risk:investigate', 'monitoring:manage', 'watchlist:manage',
              'user:create', 'user:update', 'user:disable', 'settings:manage'
          )
    ) THEN
        RAISE EXCEPTION 'VIEWER has a seeded mutation/administration permission.';
    END IF;

    SELECT COUNT(*) INTO v_function_count
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(ARRAY[
          'user_role', 'user_district_id', 'user_state_id',
          'user_village_id', 'can_access_geographic_scope', 'can_access_land_record',
          'has_permission', 'admin_update_profile_authorization'
      ])
      AND p.prosecdef
      AND p.proconfig @> ARRAY['search_path=public, pg_temp'];

        IF v_function_count <> 8 THEN
                RAISE EXCEPTION 'Expected eight hardened authorization functions; found %.', v_function_count;
    END IF;

        SELECT ARRAY_AGG(required.function_name)
        INTO v_unhardened_functions
        FROM unnest(ARRAY[
            'trigger_log_audit', 'scan_duplicate_candidates', 'recompute_land_record_risk',
            'recompute_risk_assessment', 'begin_document_processing', 'complete_document_processing',
            'fail_document_processing', 'verify_extracted_field', 'update_verification_task_status',
            'update_duplicate_candidate_status', 'update_risk_assessment_status', 'update_alert_status',
            'import_land_record_geojson', 'demo_data_visible', 'is_demo_entity'
        ]) AS required(function_name)
        WHERE NOT EXISTS (
            SELECT 1
            FROM pg_catalog.pg_proc procedure
            JOIN pg_catalog.pg_namespace namespace ON namespace.oid = procedure.pronamespace
            WHERE namespace.nspname = 'public'
              AND procedure.proname = required.function_name
              AND procedure.prosecdef
              AND procedure.proconfig @> ARRAY[
                  CASE WHEN required.function_name = 'import_land_record_geojson'
                       THEN 'search_path=public, extensions, pg_temp'
                       ELSE 'search_path=public, pg_temp' END
              ]
        );

        IF COALESCE(CARDINALITY(v_unhardened_functions), 0) > 0 THEN
            RAISE EXCEPTION 'Privileged workflow functions are missing SECURITY DEFINER/search_path hardening: %.', v_unhardened_functions;
        END IF;

        IF NOT EXISTS (
                SELECT 1 FROM pg_catalog.pg_proc p
                JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public'
                    AND p.proname = 'scan_duplicate_candidates'
                    AND p.prosecdef
                    AND p.proconfig @> ARRAY['search_path=public, pg_temp']
        ) OR NOT EXISTS (
                SELECT 1 FROM pg_catalog.pg_proc p
                JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public'
                    AND p.proname = 'recompute_risk_assessment'
                    AND p.prosecdef
                    AND p.proconfig @> ARRAY['search_path=public, pg_temp']
        ) OR NOT EXISTS (
                SELECT 1 FROM pg_catalog.pg_proc p
                JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public'
                    AND p.proname = 'update_verification_task_status'
                    AND p.prosecdef
                    AND p.proconfig @> ARRAY['search_path=public, pg_temp']
        ) OR NOT EXISTS (
                SELECT 1 FROM pg_catalog.pg_proc p
                JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public'
                    AND p.proname = 'update_duplicate_candidate_status'
                    AND p.prosecdef
                    AND p.proconfig @> ARRAY['search_path=public, pg_temp']
        ) OR NOT EXISTS (
                SELECT 1 FROM pg_catalog.pg_proc p
                JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public'
                    AND p.proname = 'update_risk_assessment_status'
                    AND p.prosecdef
                    AND p.proconfig @> ARRAY['search_path=public, pg_temp']
        ) OR NOT EXISTS (
                SELECT 1 FROM pg_catalog.pg_proc p
                JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public'
                    AND p.proname = 'update_alert_status'
                    AND p.prosecdef
                    AND p.proconfig @> ARRAY['search_path=public, pg_temp']
        ) OR NOT EXISTS (
                SELECT 1 FROM pg_catalog.pg_proc p
                JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public'
                    AND p.proname = 'import_land_record_geojson'
                    AND p.prosecdef
                    AND p.proconfig @> ARRAY['search_path=public, extensions, pg_temp']
        ) OR NOT EXISTS (
                SELECT 1 FROM pg_catalog.pg_proc p
                JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public'
                    AND p.proname = 'verify_extracted_field'
                    AND p.prosecdef
                    AND p.proconfig @> ARRAY['search_path=public, pg_temp']
        ) THEN
                RAISE EXCEPTION 'A privileged workflow function is missing SECURITY DEFINER or an explicit search_path.';
        END IF;

    FOREACH v_column IN ARRAY ARRAY[
        'role_id', 'state_id', 'district_id', 'village_id', 'is_active', 'email'
    ] LOOP
        IF has_column_privilege('authenticated', 'public.profiles', v_column, 'UPDATE') THEN
            RAISE EXCEPTION 'authenticated retains direct UPDATE on protected profile column %.', v_column;
        END IF;
    END LOOP;

    IF has_table_privilege('authenticated', 'public.profiles', 'INSERT') THEN
        RAISE EXCEPTION 'authenticated retains direct INSERT on profiles.';
    END IF;

    IF has_table_privilege('authenticated', 'public.audit_logs', 'INSERT')
       OR has_table_privilege('authenticated', 'public.audit_logs', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.audit_logs', 'DELETE')
       OR has_table_privilege('authenticated', 'public.duplicate_candidates', 'INSERT')
       OR has_table_privilege('authenticated', 'public.duplicate_candidates', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.duplicate_candidates', 'DELETE')
       OR has_table_privilege('authenticated', 'public.risk_assessments', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.verification_tasks', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.verification_actions', 'INSERT')
       OR has_table_privilege('authenticated', 'public.alerts', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.notifications', 'INSERT')
       OR has_table_privilege('authenticated', 'public.notifications', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.extracted_fields', 'UPDATE') THEN
        RAISE EXCEPTION 'Authenticated retains direct writes that must use hardened database workflows.';
    END IF;

    IF NOT has_column_privilege('authenticated', 'public.notifications', 'is_read', 'UPDATE')
       OR has_column_privilege('authenticated', 'public.notifications', 'read_at', 'UPDATE')
       OR has_column_privilege('authenticated', 'public.notifications', 'title', 'UPDATE') THEN
        RAISE EXCEPTION 'Authenticated notification updates must be limited to marking their own rows read.';
    END IF;

    IF has_function_privilege(
           'authenticated',
           'public.complete_document_processing(uuid,text,jsonb)',
           'EXECUTE'
       )
       OR has_function_privilege(
           'authenticated',
           'public.fail_document_processing(uuid,text)',
           'EXECUTE'
       )
       OR has_function_privilege(
           'authenticated',
           'public.complete_document_processing(uuid,text,jsonb,uuid)',
           'EXECUTE'
       )
       OR has_function_privilege(
           'authenticated',
           'public.fail_document_processing(uuid,text,uuid)',
           'EXECUTE'
       )
       OR NOT has_function_privilege(
           'service_role',
           'public.complete_document_processing(uuid,text,jsonb,uuid)',
           'EXECUTE'
       )
       OR NOT has_function_privilege(
           'service_role',
           'public.fail_document_processing(uuid,text,uuid)',
           'EXECUTE'
       ) THEN
        RAISE EXCEPTION 'Only the trusted processing service may persist OCR results or processing failures.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_trigger trigger_row
        JOIN pg_catalog.pg_class table_row ON table_row.oid = trigger_row.tgrelid
        JOIN pg_catalog.pg_namespace namespace ON namespace.oid = table_row.relnamespace
        WHERE namespace.nspname = 'public'
          AND table_row.relname = 'audit_logs'
          AND trigger_row.tgname = 'prevent_audit_log_mutation'
          AND NOT trigger_row.tgisinternal
    ) THEN
        RAISE EXCEPTION 'Append-only audit mutation trigger is missing.';
    END IF;

    IF NOT has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE') THEN
        RAISE EXCEPTION 'authenticated cannot perform the expected safe self-profile update.';
    END IF;

    SELECT public, file_size_limit
    INTO v_bucket_public, v_bucket_size
    FROM storage.buckets
    WHERE id = 'bhoomi-documents';

    IF NOT FOUND OR v_bucket_public OR v_bucket_size <> 26214400 THEN
        RAISE EXCEPTION 'bhoomi-documents must exist, remain private, and enforce a 25 MiB limit.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'Users read accessible Bhoomi documents'
          AND cmd = 'SELECT' AND qual ILIKE '%documents%'
    ) OR NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'Scoped staff upload Bhoomi documents'
          AND cmd = 'INSERT' AND with_check ILIKE '%user_district_id%'
    ) OR NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'Authorized staff update accessible Bhoomi documents'
          AND cmd = 'UPDATE' AND qual ILIKE '%documents%'
    ) OR NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'Authorized users delete accessible Bhoomi documents'
          AND cmd = 'DELETE' AND qual ILIKE '%owner_id%'
    ) THEN
        RAISE EXCEPTION 'Expected scoped read, upload, and delete storage policies are missing.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'get_spatial_land_record_extent'
          AND p.prosecdef = FALSE
          AND p.proconfig @> ARRAY['search_path=public, extensions, pg_temp']
    ) THEN
        RAISE EXCEPTION 'The RLS-respecting spatial extent query is missing.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_policies
        WHERE schemaname = 'public' AND tablename = 'land_records'
          AND policyname = 'State admins read state land records'
          AND qual ILIKE '%user_state_id%'
    ) OR NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_policies
        WHERE schemaname = 'public' AND tablename = 'land_records'
          AND policyname = 'District staff read district land records'
          AND qual ILIKE '%user_district_id%'
          AND qual ILIKE '%VIEWER%'
    ) OR NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_policies
        WHERE schemaname = 'public' AND tablename = 'land_records'
          AND policyname = 'Data entry officers create district records'
          AND with_check ILIKE '%user_district_id%'
    ) THEN
        RAISE EXCEPTION 'Expected state, district, viewer-read, and data-entry scope policies are missing.';
    END IF;
END;
$$;

SELECT 'PASS: LAND-IQ production security contract checks.' AS result;