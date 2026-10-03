-- Run as a privileged database operator after all migrations.
-- All notification writes below are rolled back.
BEGIN;

DO $$
DECLARE
    v_user_id UUID;
    v_notification_id UUID := uuid_generate_v4();
BEGIN
    SELECT id INTO v_user_id
    FROM public.profiles
    WHERE is_active = TRUE
    ORDER BY id
    LIMIT 1;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Test requires an active profile.';
    END IF;

    INSERT INTO public.notifications (
        id, user_id, notification_type, title, message
    ) VALUES (
        v_notification_id, v_user_id, 'TEST', 'Security test', 'Rollback-only notification.'
    );
    PERFORM set_config('landiq_test.notification_user_id', v_user_id::TEXT, TRUE);
    PERFORM set_config('landiq_test.notification_id', v_notification_id::TEXT, TRUE);
END;
$$;

SELECT set_config('request.jwt.claim.sub', current_setting('landiq_test.notification_user_id'), TRUE);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_notification_id UUID := current_setting('landiq_test.notification_id')::UUID;
    v_read_at TIMESTAMPTZ;
    v_rejected BOOLEAN := FALSE;
BEGIN
    UPDATE public.notifications
    SET is_read = TRUE
    WHERE id = v_notification_id;

    SELECT read_at INTO v_read_at
    FROM public.notifications
    WHERE id = v_notification_id;
    IF v_read_at IS NULL THEN
        RAISE EXCEPTION 'Marking a notification read did not persist its read timestamp.';
    END IF;

    BEGIN
        UPDATE public.notifications
        SET is_read = FALSE
        WHERE id = v_notification_id;
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM = 'A read notification cannot be marked unread.' THEN
            v_rejected := TRUE;
        ELSE
            RAISE;
        END IF;
    END;
    IF NOT v_rejected THEN
        RAISE EXCEPTION 'A read notification could be reset to unread.';
    END IF;

    v_rejected := FALSE;
    BEGIN
        INSERT INTO public.notifications (user_id, notification_type, title, message)
        VALUES (auth.uid(), 'TEST', 'Forged notification', 'Must be rejected.');
    EXCEPTION WHEN insufficient_privilege THEN
        v_rejected := TRUE;
    END;
    IF NOT v_rejected THEN
        RAISE EXCEPTION 'Authenticated users can fabricate notification rows.';
    END IF;

    RAISE NOTICE 'PASS: notification read state persists; clients cannot forge or reset notification rows.';
END;
$$;

RESET ROLE;
ROLLBACK;
