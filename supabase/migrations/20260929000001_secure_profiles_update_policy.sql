-- Secure profile self-service updates while preserving admin-controlled role/scope changes.
-- This keeps normal users limited to their own row and blocks privilege escalation.

CREATE OR REPLACE FUNCTION public.enforce_normal_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_role TEXT;
BEGIN
    v_actor_role := public.user_role();

    IF v_actor_role IS DISTINCT FROM 'SUPER_ADMIN' THEN
        IF NEW.id <> auth.uid() THEN
            RAISE EXCEPTION 'Users can only update their own profile.';
        END IF;

        IF NEW.full_name IS NULL THEN
            RAISE EXCEPTION 'full_name cannot be null.';
        END IF;

        IF NEW.email IS DISTINCT FROM OLD.email THEN
            RAISE EXCEPTION 'Users cannot change their email address.';
        END IF;

        IF NEW.role_id IS DISTINCT FROM OLD.role_id THEN
            RAISE EXCEPTION 'Users cannot change role_id.';
        END IF;

        IF NEW.state_id IS DISTINCT FROM OLD.state_id THEN
            RAISE EXCEPTION 'Users cannot change state_id.';
        END IF;

        IF NEW.district_id IS DISTINCT FROM OLD.district_id THEN
            RAISE EXCEPTION 'Users cannot change district_id.';
        END IF;

        IF NEW.village_id IS DISTINCT FROM OLD.village_id THEN
            RAISE EXCEPTION 'Users cannot change village_id.';
        END IF;

        IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
            RAISE EXCEPTION 'Users cannot change is_active.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_normal_profile_update ON public.profiles;

CREATE TRIGGER enforce_normal_profile_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_normal_profile_update();

CREATE OR REPLACE FUNCTION public.admin_update_profile_authorization(
    p_profile_id UUID,
    p_role_id UUID DEFAULT NULL,
    p_state_id UUID DEFAULT NULL,
    p_district_id UUID DEFAULT NULL,
    p_village_id UUID DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_role TEXT;
    v_target public.profiles;
    v_effective_role_id UUID;
    v_effective_state_id UUID;
    v_effective_district_id UUID;
    v_effective_village_id UUID;
    v_effective_is_active BOOLEAN;
BEGIN
    v_actor_role := public.user_role();

    IF v_actor_role IS DISTINCT FROM 'SUPER_ADMIN' THEN
        RAISE EXCEPTION 'Only SUPER_ADMIN may update profile authorization or scope fields.';
    END IF;

    IF p_profile_id IS NULL THEN
        RAISE EXCEPTION 'A target profile id is required.';
    END IF;

    SELECT * INTO v_target
    FROM public.profiles
    WHERE id = p_profile_id
    FOR UPDATE;

    IF v_target.id IS NULL THEN
        RAISE EXCEPTION 'Target profile was not found.';
    END IF;

    v_effective_role_id := COALESCE(p_role_id, v_target.role_id);
    v_effective_state_id := COALESCE(p_state_id, v_target.state_id);
    v_effective_district_id := COALESCE(p_district_id, v_target.district_id);
    v_effective_village_id := COALESCE(p_village_id, v_target.village_id);
    v_effective_is_active := COALESCE(p_is_active, v_target.is_active);

    IF v_effective_role_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.roles WHERE id = v_effective_role_id
    ) THEN
        RAISE EXCEPTION 'Invalid effective role_id.';
    END IF;

    IF v_effective_state_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.states s
        WHERE s.id = v_effective_state_id
          AND s.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Invalid or inactive effective state_id.';
    END IF;

    IF v_effective_district_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.districts d
        WHERE d.id = v_effective_district_id
          AND d.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Invalid or inactive effective district_id.';
    END IF;

    IF v_effective_district_id IS NOT NULL AND v_effective_state_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.districts d
        WHERE d.id = v_effective_district_id
          AND d.state_id = v_effective_state_id
          AND d.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Effective district_id does not belong to effective state_id.';
    END IF;

    IF v_effective_village_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.villages v
        WHERE v.id = v_effective_village_id
          AND v.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Invalid or inactive effective village_id.';
    END IF;

    IF v_effective_village_id IS NOT NULL AND v_effective_district_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.villages v
        JOIN public.taluks t ON t.id = v.taluk_id
        WHERE v.id = v_effective_village_id
          AND t.district_id = v_effective_district_id
          AND v.is_active = TRUE
          AND t.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Effective village_id does not belong to effective district_id.';
    END IF;

    IF v_effective_village_id IS NOT NULL AND v_effective_state_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.villages v
        JOIN public.taluks t ON t.id = v.taluk_id
        JOIN public.districts d ON d.id = t.district_id
        WHERE v.id = v_effective_village_id
          AND d.state_id = v_effective_state_id
          AND v.is_active = TRUE
          AND t.is_active = TRUE
          AND d.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Effective village_id does not belong to effective state_id.';
    END IF;

    UPDATE public.profiles
    SET
        role_id = v_effective_role_id,
        state_id = v_effective_state_id,
        district_id = v_effective_district_id,
        village_id = v_effective_village_id,
        is_active = v_effective_is_active,
        updated_at = NOW()
    WHERE id = p_profile_id
    RETURNING * INTO v_target;

    RETURN v_target;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.user_role()
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.user_role()
TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_update_profile_authorization(
    UUID,
    UUID,
    UUID,
    UUID,
    UUID,
    BOOLEAN
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_update_profile_authorization(
    UUID,
    UUID,
    UUID,
    UUID,
    UUID,
    BOOLEAN
) TO authenticated;

REVOKE UPDATE ON TABLE public.profiles
FROM authenticated;

REVOKE UPDATE (
    role_id,
    state_id,
    district_id,
    village_id,
    is_active,
    email
)
ON public.profiles
FROM authenticated;

GRANT UPDATE (
    full_name,
    phone,
    avatar_url,
    employee_code,
    designation
)
ON public.profiles
TO authenticated;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    id = auth.uid()
)
WITH CHECK (
    id = auth.uid()
);

-- Note:
-- - Normal users can update only their own profile and cannot change sensitive fields.
-- - SUPER_ADMIN can intentionally update role/scope values through the dedicated admin function.
-- - The privileged path is checked against the database role, not a client-controlled session value.
