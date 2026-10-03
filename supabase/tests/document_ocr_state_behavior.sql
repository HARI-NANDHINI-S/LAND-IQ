-- Run as a privileged database operator after all migrations.
-- Exercises state transitions only; no OCR result is fabricated and no file is uploaded.
BEGIN;

DO $$
DECLARE
    v_user_id UUID;
    v_document_id UUID := uuid_generate_v4();
    v_processing_status TEXT;
    v_attempts INTEGER;
    v_started RECORD;
BEGIN
    SELECT profile.id INTO v_user_id
    FROM public.profiles profile
    JOIN public.roles role ON role.id = profile.role_id
    JOIN public.role_permissions role_permission ON role_permission.role_id = role.id
    JOIN public.permissions permission ON permission.id = role_permission.permission_id
    WHERE profile.is_active = TRUE
      AND role.code = 'SUPER_ADMIN'
      AND permission.code = 'document:process'
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Test requires an active SUPER_ADMIN with document:process permission.';
    END IF;

    INSERT INTO public.documents (
        id, document_type, original_filename, storage_path, mime_type,
        file_size, processing_status, verification_status, uploaded_by
    ) VALUES (
        v_document_id, 'OCR_STATE_TEST', 'rollback-only.pdf',
        'documents/unlinked/ocr-state-test/rollback-only.pdf', 'application/pdf',
        100, 'PENDING', 'PENDING', v_user_id
    );

    PERFORM set_config('landiq_test.ocr_user_id', v_user_id::TEXT, TRUE);
    PERFORM set_config('landiq_test.ocr_document_id', v_document_id::TEXT, TRUE);
END;
$$;

SELECT set_config('request.jwt.claim.sub', current_setting('landiq_test.ocr_user_id'), TRUE);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_started RECORD;
    v_processing_status TEXT;
    v_attempts INTEGER;
BEGIN
    SELECT * INTO v_started
    FROM public.begin_document_processing(current_setting('landiq_test.ocr_document_id')::UUID);
    IF v_started.storage_path IS NULL THEN
        RAISE EXCEPTION 'begin_document_processing did not return the permitted storage path.';
    END IF;

    SELECT processing_status, processing_attempts
      INTO v_processing_status, v_attempts
    FROM public.documents
    WHERE id = current_setting('landiq_test.ocr_document_id')::UUID;
    IF v_processing_status <> 'OCR_PROCESSING' OR v_attempts <> 1 THEN
        RAISE EXCEPTION 'OCR processing did not enter its in-progress state.';
    END IF;
END;
$$;

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', TRUE);
SET LOCAL ROLE service_role;

SELECT public.fail_document_processing(
    current_setting('landiq_test.ocr_document_id')::UUID,
    'OCR provider is not configured.',
    current_setting('landiq_test.ocr_user_id')::UUID
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_started RECORD;
    v_processing_status TEXT;
    v_attempts INTEGER;
BEGIN
    SELECT processing_status, processing_attempts
      INTO v_processing_status, v_attempts
    FROM public.documents
    WHERE id = current_setting('landiq_test.ocr_document_id')::UUID;
    IF v_processing_status <> 'FAILED' OR v_attempts <> 1 THEN
        RAISE EXCEPTION 'OCR failure state or retry counter was not persisted.';
    END IF;

    SELECT * INTO v_started
    FROM public.begin_document_processing(current_setting('landiq_test.ocr_document_id')::UUID);
    SELECT processing_status, processing_attempts
      INTO v_processing_status, v_attempts
    FROM public.documents
    WHERE id = current_setting('landiq_test.ocr_document_id')::UUID;
    IF v_processing_status <> 'OCR_PROCESSING' OR v_attempts <> 2 THEN
        RAISE EXCEPTION 'A failed OCR document could not be retried or the retry count was not persisted.';
    END IF;

    RAISE NOTICE 'PASS: OCR failure and retry state transitions are persisted without fabricated output.';
END;
$$;

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'service_role', TRUE);
SET LOCAL ROLE service_role;

SELECT public.fail_document_processing(
    current_setting('landiq_test.ocr_document_id')::UUID,
    'OCR provider is not configured.',
    current_setting('landiq_test.ocr_user_id')::UUID
);

RESET ROLE;
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);

DO $$
DECLARE
    v_processing_status TEXT;
    v_attempts INTEGER;
BEGIN
    SELECT processing_status, processing_attempts
      INTO v_processing_status, v_attempts
    FROM public.documents
    WHERE id = current_setting('landiq_test.ocr_document_id')::UUID;
    IF v_processing_status <> 'FAILED' OR v_attempts <> 2 THEN
        RAISE EXCEPTION 'A failed retry did not persist its final state and attempt count.';
    END IF;
END;
$$;

ROLLBACK;
