-- Fix notification_type not-null constraint in create_system_notification
CREATE OR REPLACE FUNCTION public.create_system_notification(
    p_user_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_entity_type TEXT DEFAULT 'citizen_applications',
    p_entity_id UUID DEFAULT NULL,
    p_notification_type TEXT DEFAULT 'APPLICATION_STATUS'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_notif_id UUID;
BEGIN
    INSERT INTO public.notifications (
        user_id, notification_type, title, message, entity_type, entity_id, is_read, created_at
    ) VALUES (
        p_user_id, COALESCE(p_notification_type, 'APPLICATION_STATUS'), p_title, p_message, p_entity_type, p_entity_id, FALSE, NOW()
    )
    RETURNING id INTO v_notif_id;

    RETURN v_notif_id;
END;
$$;
