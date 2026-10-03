REVOKE ALL ON FUNCTION public.complete_document_processing(UUID, TEXT, JSONB)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_document_processing(UUID, TEXT)
    FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.begin_document_processing(p_document_id UUID)
RETURNS TABLE(storage_path TEXT, mime_type TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_document public.documents;
BEGIN
    IF NOT public.has_permission('document:process') THEN
        RAISE EXCEPTION 'You do not have permission to process this document.';
    END IF;

    SELECT * INTO v_document
    FROM public.documents document
    WHERE document.id = p_document_id
      AND public.can_access_geographic_scope(document.state_id, document.district_id, document.village_id)
    FOR UPDATE;

    IF v_document.id IS NULL THEN
        RAISE EXCEPTION 'Document was not found or is outside your authorized scope.';
    END IF;
    IF v_document.processing_status NOT IN ('PENDING', 'FAILED') THEN
        RAISE EXCEPTION 'Only pending or failed documents can be processed or retried.';
    END IF;

    UPDATE public.documents
    SET processing_status = 'OCR_PROCESSING',
        processing_error = NULL,
        processing_attempts = processing_attempts + 1,
        updated_at = NOW()
    WHERE id = p_document_id;

    RETURN QUERY SELECT v_document.storage_path, v_document.mime_type;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_document_processing(
    p_document_id UUID,
    p_provider TEXT,
    p_pages JSONB,
    p_actor_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_result INTEGER;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'OCR provider results can only be persisted by the trusted processing service.';
    END IF;
    IF p_actor_id IS NULL THEN
        RAISE EXCEPTION 'An authenticated processing actor is required.';
    END IF;

    PERFORM set_config('request.jwt.claim.sub', p_actor_id::TEXT, TRUE);
    IF NOT public.has_permission('document:process') THEN
        RAISE EXCEPTION 'The processing actor is inactive or lacks document processing permission.';
    END IF;

    SELECT public.complete_document_processing(p_document_id, p_provider, p_pages)
    INTO v_result;
    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_document_processing(
    p_document_id UUID,
    p_error TEXT,
    p_actor_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Document processing state can only be updated by the trusted processing service.';
    END IF;
    IF p_actor_id IS NULL THEN
        RAISE EXCEPTION 'An authenticated processing actor is required.';
    END IF;

    PERFORM set_config('request.jwt.claim.sub', p_actor_id::TEXT, TRUE);
    IF NOT public.has_permission('document:process') THEN
        RAISE EXCEPTION 'The processing actor is inactive or lacks document processing permission.';
    END IF;

    PERFORM public.fail_document_processing(p_document_id, p_error);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_document_processing(UUID, TEXT, JSONB, UUID)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_document_processing(UUID, TEXT, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_document_processing(UUID, TEXT, JSONB, UUID)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_document_processing(UUID, TEXT, UUID)
    TO service_role;
