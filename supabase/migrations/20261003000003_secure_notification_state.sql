DROP POLICY IF EXISTS "Authorized users insert notifications" ON public.notifications;
REVOKE INSERT, UPDATE ON public.notifications FROM PUBLIC, anon, authenticated;
GRANT UPDATE (is_read) ON public.notifications TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_notification_read_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NOT NULL THEN
        IF NEW.user_id IS DISTINCT FROM OLD.user_id
           OR NEW.notification_type IS DISTINCT FROM OLD.notification_type
           OR NEW.title IS DISTINCT FROM OLD.title
           OR NEW.message IS DISTINCT FROM OLD.message
           OR NEW.entity_type IS DISTINCT FROM OLD.entity_type
           OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
           OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION 'Notification content and ownership are immutable.';
        END IF;
        IF OLD.is_read AND NOT NEW.is_read THEN
            RAISE EXCEPTION 'A read notification cannot be marked unread.';
        END IF;

        NEW.read_at := CASE
            WHEN NEW.is_read THEN coalesce(OLD.read_at, NOW())
            ELSE NULL
        END;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_notification_read_state
BEFORE UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.enforce_notification_read_state();
