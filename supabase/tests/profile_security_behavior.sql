-- Run as a privileged operator in Supabase SQL Editor after the security
-- migration has been applied. This transaction rolls back all profile writes.
-- SET ROLE and the auth claim GUC below are a test harness only; they are not
-- an application authorization mechanism and must never be client-controlled.

BEGIN;

DO $$
DECLARE
    v_super_admin_id UUID;
    v_target_id UUID;
    v_non_admin_id UUID;
BEGIN
    SELECT p.id INTO v_super_admin_id
    FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    WHERE r.code = 'SUPER_ADMIN'
      AND p.is_active = TRUE
    ORDER BY p.created_at
    LIMIT 1;

    SELECT p.id INTO v_target_id
    FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    WHERE r.code <> 'SUPER_ADMIN'
      AND p.is_active = TRUE
    ORDER BY p.created_at
    LIMIT 1;

    IF v_super_admin_id IS NULL THEN
        RAISE EXCEPTION 'Test setup requires an active SUPER_ADMIN profile.';
    END IF;
    IF v_target_id IS NULL THEN
        RAISE EXCEPTION 'Test setup requires an active non-SUPER_ADMIN profile.';
    END IF;

    v_non_admin_id := v_target_id;
    PERFORM set_config('landiq_test.super_admin_id', v_super_admin_id::TEXT, TRUE);
    PERFORM set_config('landiq_test.target_id', v_target_id::TEXT, TRUE);
    PERFORM set_config('landiq_test.non_admin_id', v_non_admin_id::TEXT, TRUE);
END;
$$;

SELECT set_config('request.jwt.claim.sub', current_setting('landiq_test.super_admin_id'), TRUE);
SET LOCAL ROLE authenticated;

-- A. SUPER_ADMIN can update a non-admin profile via the SECURITY DEFINER RPC.
DO $$
DECLARE
    v_target_id UUID := current_setting('landiq_test.target_id')::UUID;
    v_before_active BOOLEAN;
    v_after_active BOOLEAN;
    v_result public.profiles;
BEGIN
    SELECT p.is_active INTO v_before_active
    FROM public.profiles p
    WHERE p.id = v_target_id;

    SELECT public.admin_update_profile_authorization(
        v_target_id,
        p_is_active => NOT v_before_active
    ) INTO v_result;

    SELECT p.is_active INTO v_after_active
    FROM public.profiles p
    WHERE p.id = v_target_id;

    IF v_result.is_active IS DISTINCT FROM NOT v_before_active
       OR v_after_active IS DISTINCT FROM NOT v_before_active THEN
        RAISE EXCEPTION 'A failed: the valid SUPER_ADMIN update did not take effect.';
    END IF;

    PERFORM public.admin_update_profile_authorization(
        v_target_id,
        p_is_active => v_before_active
    );
    RAISE NOTICE 'PASS A: SUPER_ADMIN update accepted; original active state restored inside the transaction.';
END;
$$;

-- B. A role UUID absent from roles is rejected by the authorization function.
DO $$
DECLARE
    v_target_id UUID := current_setting('landiq_test.target_id')::UUID;
    v_invalid_role_id UUID;
    v_error TEXT;
    v_rejected BOOLEAN := FALSE;
BEGIN
    LOOP
        v_invalid_role_id := uuid_generate_v4();
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.roles WHERE id = v_invalid_role_id);
    END LOOP;

    BEGIN
        PERFORM public.admin_update_profile_authorization(v_target_id, p_role_id => v_invalid_role_id);
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
        IF v_error = 'Invalid effective role_id.' THEN
            v_rejected := TRUE;
        ELSE
            RAISE;
        END IF;
    END;

    IF NOT v_rejected THEN RAISE EXCEPTION 'B failed: invalid role UUID was accepted.'; END IF;
    RAISE NOTICE 'PASS B: nonexistent role UUID rejected.';
END;
$$;

-- C. An existing district paired with a different existing state is rejected.
DO $$
DECLARE
    v_target_id UUID := current_setting('landiq_test.target_id')::UUID;
    v_state_id UUID;
    v_district_id UUID;
    v_error TEXT;
    v_rejected BOOLEAN := FALSE;
BEGIN
    SELECT s.id, d.id INTO v_state_id, v_district_id
    FROM public.states s
    CROSS JOIN public.districts d
    WHERE s.is_active = TRUE
      AND d.is_active = TRUE
      AND d.state_id <> s.id
    LIMIT 1;

    IF v_state_id IS NULL OR v_district_id IS NULL THEN
        RAISE EXCEPTION 'C unavailable: need active state and district IDs from different states.';
    END IF;

    BEGIN
        PERFORM public.admin_update_profile_authorization(
            v_target_id,
            p_state_id => v_state_id,
            p_district_id => v_district_id
        );
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
        IF v_error = 'Effective district_id does not belong to effective state_id.' THEN
            v_rejected := TRUE;
        ELSE
            RAISE;
        END IF;
    END;

    IF NOT v_rejected THEN RAISE EXCEPTION 'C failed: mismatched state/district IDs were accepted.'; END IF;
    RAISE NOTICE 'PASS C: mismatched state/district hierarchy rejected.';
END;
$$;

-- D. Existing, active geography IDs with a village outside the selected district are rejected.
DO $$
DECLARE
    v_target_id UUID := current_setting('landiq_test.target_id')::UUID;
    v_state_id UUID;
    v_district_id UUID;
    v_village_id UUID;
    v_error TEXT;
    v_rejected BOOLEAN := FALSE;
BEGIN
    SELECT d.state_id, d.id, v.id INTO v_state_id, v_district_id, v_village_id
    FROM public.districts d
    JOIN public.states s ON s.id = d.state_id AND s.is_active = TRUE
    CROSS JOIN public.villages v
    JOIN public.taluks t ON t.id = v.taluk_id AND t.is_active = TRUE
    WHERE d.is_active = TRUE
      AND v.is_active = TRUE
      AND t.district_id <> d.id
    LIMIT 1;

    IF v_state_id IS NULL OR v_district_id IS NULL OR v_village_id IS NULL THEN
        RAISE EXCEPTION 'D unavailable: need active IDs for two different districts and an active village.';
    END IF;

    BEGIN
        PERFORM public.admin_update_profile_authorization(
            v_target_id,
            p_state_id => v_state_id,
            p_district_id => v_district_id,
            p_village_id => v_village_id
        );
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
        IF v_error = 'Effective village_id does not belong to effective district_id.' THEN
            v_rejected := TRUE;
        ELSE
            RAISE;
        END IF;
    END;

    IF NOT v_rejected THEN RAISE EXCEPTION 'D failed: village outside the selected district was accepted.'; END IF;
    RAISE NOTICE 'PASS D: mismatched village hierarchy rejected.';
END;
$$;

-- E. A non-SUPER_ADMIN can execute the RPC but cannot pass its authorization check.
SELECT set_config('request.jwt.claim.sub', current_setting('landiq_test.non_admin_id'), TRUE);
DO $$
DECLARE
    v_target_id UUID := current_setting('landiq_test.target_id')::UUID;
    v_error TEXT;
    v_rejected BOOLEAN := FALSE;
BEGIN
    BEGIN
        PERFORM public.admin_update_profile_authorization(v_target_id);
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
        IF v_error = 'Only SUPER_ADMIN may update profile authorization or scope fields.' THEN
            v_rejected := TRUE;
        ELSE
            RAISE;
        END IF;
    END;

    IF NOT v_rejected THEN RAISE EXCEPTION 'E failed: non-SUPER_ADMIN call succeeded.'; END IF;
    RAISE NOTICE 'PASS E: non-SUPER_ADMIN authorization rejected.';
END;
$$;

-- F. An active non-admin can update each safe field on their own row.
DO $$
DECLARE
    v_rows INTEGER;
BEGIN
    UPDATE public.profiles
    SET full_name = full_name,
        phone = phone,
        avatar_url = avatar_url,
        employee_code = employee_code,
        designation = designation
    WHERE id = auth.uid();

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN RAISE EXCEPTION 'F failed: expected to update exactly one own profile row, updated %.', v_rows; END IF;
    RAISE NOTICE 'PASS F: self-service UPDATE accepted for all five safe columns.';
END;
$$;

-- G. Protected columns must fail at PostgreSQL privilege checking for authenticated.
DO $$
DECLARE
    v_column TEXT;
    v_denied BOOLEAN;
    v_protected_columns TEXT[] := ARRAY['role_id', 'state_id', 'district_id', 'village_id', 'is_active', 'email'];
BEGIN
    FOREACH v_column IN ARRAY v_protected_columns LOOP
        v_denied := FALSE;
        BEGIN
            EXECUTE format(
                'UPDATE public.profiles SET %1$I = %1$I WHERE id = auth.uid()',
                v_column
            );
        EXCEPTION WHEN insufficient_privilege THEN
            v_denied := TRUE;
        END;

        IF NOT v_denied THEN
            RAISE EXCEPTION 'G failed: authenticated could UPDATE protected column %.', v_column;
        END IF;
    END LOOP;
    RAISE NOTICE 'PASS G: UPDATE denied for role_id, state_id, district_id, village_id, is_active, and email.';
END;
$$;

RESET ROLE;
ROLLBACK;