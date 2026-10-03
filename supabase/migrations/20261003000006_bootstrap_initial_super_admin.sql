-- One-time bootstrap for the initial LAND-IQ administrator.
-- The normal profile-update security trigger remains enabled.
-- Bootstrap authorization is held in a database-only marker table.

CREATE TABLE IF NOT EXISTS public.initial_admin_bootstrap_state (
    profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE ALL ON TABLE public.initial_admin_bootstrap_state FROM PUBLIC;
REVOKE ALL ON TABLE public.initial_admin_bootstrap_state FROM anon;
REVOKE ALL ON TABLE public.initial_admin_bootstrap_state FROM authenticated;

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

    -- One-time bootstrap exception.
    IF v_actor_role IS DISTINCT FROM 'SUPER_ADMIN'
       AND EXISTS (
            SELECT 1
            FROM public.initial_admin_bootstrap_state b
            WHERE b.profile_id = OLD.id
              AND b.profile_id = auth.uid()
       ) THEN

        IF auth.uid() IS NULL
           OR NEW.id IS DISTINCT FROM auth.uid()
           OR lower(NEW.email) <> 'admin@landiq.local'
           OR OLD.role_id IS NOT NULL
           OR NEW.role_id IS DISTINCT FROM '00000000-0000-0000-0000-000000000001'::uuid
           OR OLD.is_active IS DISTINCT FROM NEW.is_active
           OR OLD.email IS DISTINCT FROM NEW.email
           OR OLD.state_id IS DISTINCT FROM NEW.state_id
           OR OLD.district_id IS DISTINCT FROM NEW.district_id
           OR OLD.village_id IS DISTINCT FROM NEW.village_id
           OR OLD.full_name IS DISTINCT FROM NEW.full_name
        THEN
            RAISE EXCEPTION 'Invalid initial administrator bootstrap.';
        END IF;

        RETURN NEW;
    END IF;

    -- Original normal-user protection.
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

CREATE OR REPLACE FUNCTION public.bootstrap_initial_super_admin()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_profile public.profiles;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required.';
    END IF;

    SELECT *
    INTO v_profile
    FROM public.profiles
    WHERE id = auth.uid()
      AND lower(email) = 'admin@landiq.local'
      AND role_id IS NULL
      AND is_active = TRUE
    FOR UPDATE;

    IF v_profile.id IS NULL THEN
        RAISE EXCEPTION 'Initial administrator bootstrap is not available for this account.';
    END IF;

    INSERT INTO public.initial_admin_bootstrap_state(profile_id)
    VALUES (auth.uid());

    UPDATE public.profiles
    SET
        role_id = '00000000-0000-0000-0000-000000000001',
        updated_at = NOW()
    WHERE id = auth.uid()
      AND lower(email) = 'admin@landiq.local'
      AND role_id IS NULL
      AND is_active = TRUE
    RETURNING * INTO v_profile;

    DELETE FROM public.initial_admin_bootstrap_state
    WHERE profile_id = auth.uid();

    RETURN v_profile;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bootstrap_initial_super_admin()
FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.bootstrap_initial_super_admin()
FROM anon;

GRANT EXECUTE ON FUNCTION public.bootstrap_initial_super_admin()
TO authenticated;
