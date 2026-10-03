-- Harden administrative profile authorization RPC.
-- Anonymous clients must never be able to execute this function.

REVOKE EXECUTE ON FUNCTION public.admin_update_profile_authorization(
    UUID,
    UUID,
    UUID,
    UUID,
    UUID,
    BOOLEAN
) FROM anon;

GRANT EXECUTE ON FUNCTION public.admin_update_profile_authorization(
    UUID,
    UUID,
    UUID,
    UUID,
    UUID,
    BOOLEAN
) TO authenticated;
