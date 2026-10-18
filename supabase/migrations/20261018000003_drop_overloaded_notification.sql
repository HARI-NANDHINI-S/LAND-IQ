-- Drop obsolete 5-parameter create_system_notification overload to resolve ambiguity
DROP FUNCTION IF EXISTS public.create_system_notification(UUID, TEXT, TEXT, TEXT, UUID);
