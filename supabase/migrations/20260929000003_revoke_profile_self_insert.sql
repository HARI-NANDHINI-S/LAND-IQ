-- Profiles are created by the auth.users SECURITY DEFINER trigger.
-- Authenticated clients do not need a direct INSERT path, which could permit
-- supplying protected role or geography fields when a profile row is missing.
REVOKE INSERT ON TABLE public.profiles FROM authenticated;

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;