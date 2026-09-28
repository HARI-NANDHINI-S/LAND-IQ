-- ============================================================
-- FIX: Assign SUPER_ADMIN role to the admin profile
-- ============================================================
-- ROOT CAUSE: The handle_new_user() trigger creates a profile
-- with role_id = NULL. The admin user created via Supabase Auth
-- has no role assignment, causing:
-- 1. user_role() returns NULL -> RLS blocks all scoped data
-- 2. Frontend gets zero permissions -> sidebar shows only Dashboard
-- 3. Dashboard counts return zero
--
-- FIX: Update the existing admin profile to have SUPER_ADMIN role.
-- This is safe because:
-- - We use the existing SUPER_ADMIN role ID from seed data
-- - We only update profiles where role_id IS NULL and email matches
-- - SUPER_ADMIN does not need state_id/district_id (RLS grants full access)
-- ============================================================

UPDATE public.profiles
SET role_id = '00000000-0000-0000-0000-000000000001',
    updated_at = NOW()
WHERE email = 'admin@landiq.local'
  AND role_id IS NULL;
