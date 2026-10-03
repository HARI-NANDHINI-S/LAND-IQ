-- Run as a privileged database operator after all migrations.
-- This test uses existing active profiles and rolls all writes back.
BEGIN;

DO $$
DECLARE
    v_user_a UUID;
    v_user_b UUID;
BEGIN
    SELECT id INTO v_user_a
    FROM public.profiles
    WHERE is_active = TRUE
    ORDER BY id
    LIMIT 1;

    SELECT id INTO v_user_b
    FROM public.profiles
    WHERE is_active = TRUE
      AND id <> v_user_a
    ORDER BY id
    LIMIT 1;

    IF v_user_a IS NULL OR v_user_b IS NULL THEN
        RAISE EXCEPTION 'Test requires two active profile fixtures.';
    END IF;

    PERFORM set_config('landiq_test.voice_user_a', v_user_a::TEXT, TRUE);
    PERFORM set_config('landiq_test.voice_user_b', v_user_b::TEXT, TRUE);
END;
$$;

SELECT set_config('request.jwt.claim.sub', current_setting('landiq_test.voice_user_a'), TRUE);
SET LOCAL ROLE authenticated;

INSERT INTO public.bhoomivoice_sessions (user_id)
VALUES (current_setting('landiq_test.voice_user_a')::UUID);

SELECT set_config(
    'landiq_test.voice_session_id',
    (SELECT id::TEXT FROM public.bhoomivoice_sessions
     WHERE user_id = current_setting('landiq_test.voice_user_a')::UUID
     ORDER BY created_at DESC LIMIT 1),
    TRUE
);

INSERT INTO public.bhoomivoice_messages (session_id, role, content)
VALUES (current_setting('landiq_test.voice_session_id')::UUID, 'user', 'ownership test');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', current_setting('landiq_test.voice_user_b'), TRUE);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_visible_count INTEGER;
    v_rejected BOOLEAN := FALSE;
BEGIN
    SELECT count(*) INTO v_visible_count
    FROM public.bhoomivoice_sessions
    WHERE id = current_setting('landiq_test.voice_session_id')::UUID;
    IF v_visible_count <> 0 THEN
        RAISE EXCEPTION 'Cross-user session rows were visible.';
    END IF;

    BEGIN
        INSERT INTO public.bhoomivoice_messages (session_id, role, content)
        VALUES (current_setting('landiq_test.voice_session_id')::UUID, 'assistant', 'forbidden message');
    EXCEPTION WHEN insufficient_privilege THEN
        v_rejected := TRUE;
    END;

    IF NOT v_rejected THEN
        RAISE EXCEPTION 'Cross-user message insert was not rejected by RLS.';
    END IF;
    RAISE NOTICE 'PASS: BhoomiVoice session and message ownership is enforced by RLS.';
END;
$$;

RESET ROLE;
ROLLBACK;
