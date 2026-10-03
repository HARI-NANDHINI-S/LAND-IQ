ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS processing_error TEXT,
    ADD COLUMN IF NOT EXISTS processing_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

ALTER TABLE public.document_pages
    ADD COLUMN IF NOT EXISTS extracted_text TEXT,
    ADD COLUMN IF NOT EXISTS extraction_provider TEXT,
    ADD COLUMN IF NOT EXISTS processing_error TEXT,
    ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS document_pages_document_page_idx
    ON public.document_pages (document_id, page_number);
CREATE UNIQUE INDEX IF NOT EXISTS extracted_fields_provider_page_name_uidx
    ON public.extracted_fields (document_id, source_page_id, field_name)
    WHERE extraction_method = 'OCR_PROVIDER';

INSERT INTO public.permissions (code, description)
VALUES ('document:process', 'Run or retry configured OCR processing for an accessible document.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM public.roles role
CROSS JOIN public.permissions permission
WHERE role.code IN ('SUPER_ADMIN', 'STATE_ADMIN', 'DISTRICT_OFFICER', 'DATA_ENTRY_OFFICER', 'VERIFICATION_OFFICER')
  AND permission.code = 'document:process'
ON CONFLICT (role_id, permission_id) DO NOTHING;

CREATE POLICY "Authorized OCR staff create extracted fields"
ON public.extracted_fields
FOR INSERT TO authenticated
WITH CHECK (
    public.has_permission('document:process')
    AND EXISTS (
        SELECT 1 FROM public.documents document
        WHERE document.id = extracted_fields.document_id
          AND (
              public.user_role() = 'SUPER_ADMIN'
              OR (public.user_role() = 'STATE_ADMIN' AND document.state_id = public.user_state_id())
              OR (public.user_role() IN ('DISTRICT_OFFICER', 'DATA_ENTRY_OFFICER', 'VERIFICATION_OFFICER')
                  AND document.district_id = public.user_district_id())
          )
    )
);

REVOKE UPDATE ON public.documents FROM authenticated;

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
    IF v_document.processing_status = 'OCR_PROCESSING' THEN
        RAISE EXCEPTION 'This document is already being processed.';
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
    p_pages JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_document public.documents;
    v_page JSONB;
    v_field JSONB;
    v_page_number INTEGER;
    v_page_id UUID;
    v_page_count INTEGER := 0;
    v_field_name TEXT;
    v_confidence NUMERIC;
BEGIN
    IF NOT public.has_permission('document:process') THEN
        RAISE EXCEPTION 'You do not have permission to complete document processing.';
    END IF;

    SELECT * INTO v_document
    FROM public.documents document
    WHERE document.id = p_document_id
      AND public.can_access_geographic_scope(document.state_id, document.district_id, document.village_id)
    FOR UPDATE;
    IF v_document.id IS NULL OR v_document.processing_status <> 'OCR_PROCESSING' THEN
        RAISE EXCEPTION 'Document is not in a processable state or is outside your authorized scope.';
    END IF;
    IF p_provider IS NULL OR length(btrim(p_provider)) > 100
       OR jsonb_typeof(p_pages) <> 'array'
       OR jsonb_array_length(p_pages) < 1
       OR jsonb_array_length(p_pages) > 2000 THEN
        RAISE EXCEPTION 'OCR provider returned an invalid page collection.';
    END IF;

    DELETE FROM public.extracted_fields
    WHERE document_id = p_document_id
      AND extraction_method = 'OCR_PROVIDER'
      AND verified_value IS NULL;

    UPDATE public.document_pages
    SET ocr_status = 'STALE', processing_error = NULL
    WHERE document_id = p_document_id
      AND extraction_provider IS NOT NULL;

    FOR v_page IN SELECT value FROM jsonb_array_elements(p_pages) LOOP
        v_page_number := (v_page->>'page_number')::INTEGER;
        IF v_page_number < 1 OR jsonb_typeof(v_page->'text') <> 'string'
           OR (v_page->'fields' IS NOT NULL AND jsonb_typeof(v_page->'fields') <> 'array') THEN
            RAISE EXCEPTION 'OCR provider returned an invalid page.';
        END IF;

        SELECT id INTO v_page_id
        FROM public.document_pages
        WHERE document_id = p_document_id AND page_number = v_page_number
        FOR UPDATE;

        IF v_page_id IS NULL THEN
            INSERT INTO public.document_pages (
                document_id, page_number, extracted_text, extraction_provider,
                ocr_status, attempt_count, updated_at
            ) VALUES (
                p_document_id, v_page_number, v_page->>'text', p_provider,
                'COMPLETED', v_document.processing_attempts, NOW()
            ) RETURNING id INTO v_page_id;
        ELSE
            UPDATE public.document_pages
            SET extracted_text = v_page->>'text',
                extraction_provider = p_provider,
                ocr_status = 'COMPLETED',
                processing_error = NULL,
                attempt_count = v_document.processing_attempts,
                updated_at = NOW()
            WHERE id = v_page_id;
        END IF;
        v_page_count := v_page_count + 1;

        FOR v_field IN SELECT value FROM jsonb_array_elements(coalesce(v_page->'fields', '[]'::JSONB)) LOOP
            v_field_name := btrim(v_field->>'name');
            v_confidence := nullif(v_field->>'confidence', '')::NUMERIC;
            IF v_field_name IS NULL OR v_field_name = '' OR length(v_field_name) > 100
               OR jsonb_typeof(v_field->'value') NOT IN ('string', 'number', 'boolean')
               OR (v_confidence IS NOT NULL AND v_confidence NOT BETWEEN 0 AND 100) THEN
                RAISE EXCEPTION 'OCR provider returned an invalid extracted field.';
            END IF;

            INSERT INTO public.extracted_fields (
                document_id, land_record_id, field_name, field_value,
                normalized_value, confidence_score, source_page_id,
                extraction_method, validation_status
            ) VALUES (
                p_document_id, v_document.land_record_id, v_field_name,
                v_field->>'value', nullif(btrim(v_field->>'normalized_value'), ''),
                v_confidence, v_page_id, 'OCR_PROVIDER', 'PENDING'
            )
            ON CONFLICT (document_id, source_page_id, field_name)
                WHERE extraction_method = 'OCR_PROVIDER'
            DO UPDATE SET
                field_value = EXCLUDED.field_value,
                normalized_value = EXCLUDED.normalized_value,
                confidence_score = EXCLUDED.confidence_score,
                validation_status = CASE
                    WHEN public.extracted_fields.verified_value IS NOT NULL THEN 'VERIFIED'
                    ELSE 'PENDING'
                END,
                updated_at = NOW();
        END LOOP;
    END LOOP;

    UPDATE public.documents
    SET processing_status = 'COMPLETED',
        processing_error = NULL,
        processed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_document_id;

    RETURN v_page_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_document_processing(p_document_id UUID, p_error TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT public.has_permission('document:process') THEN
        RAISE EXCEPTION 'You do not have permission to update document processing state.';
    END IF;

    UPDATE public.documents document
    SET processing_status = 'FAILED',
        processing_error = left(coalesce(nullif(btrim(p_error), ''), 'OCR processing failed.'), 1000),
        updated_at = NOW()
    WHERE document.id = p_document_id
      AND document.processing_status = 'OCR_PROCESSING'
      AND public.can_access_geographic_scope(document.state_id, document.district_id, document.village_id);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Document was not found, is outside scope, or is not currently processing.';
    END IF;
END;
$$;

REVOKE UPDATE ON public.extracted_fields FROM authenticated;

CREATE OR REPLACE FUNCTION public.verify_extracted_field(p_field_id UUID, p_verified_value TEXT)
RETURNS public.extracted_fields
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_field public.extracted_fields;
    v_document public.documents;
BEGIN
    IF NOT (public.has_permission('verification:review') OR public.has_permission('verification:approve')) THEN
        RAISE EXCEPTION 'You do not have permission to verify extracted fields.';
    END IF;

    SELECT field.* INTO v_field
    FROM public.extracted_fields field
    JOIN public.documents document ON document.id = field.document_id
    WHERE field.id = p_field_id
            AND public.can_access_geographic_scope(document.state_id, document.district_id, document.village_id)
    FOR UPDATE OF field;

    IF v_field.id IS NULL THEN
        RAISE EXCEPTION 'Extracted field was not found or is outside your authorized scope.';
    END IF;

    UPDATE public.extracted_fields
    SET verified_value = nullif(btrim(p_verified_value), ''),
        verified_by = auth.uid(),
        verified_at = NOW(),
        validation_status = CASE WHEN nullif(btrim(p_verified_value), '') IS NULL THEN 'PENDING' ELSE 'VERIFIED' END,
        updated_at = NOW()
    WHERE id = p_field_id
    RETURNING * INTO v_field;

    RETURN v_field;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_document_processing(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_document_processing(UUID, TEXT, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fail_document_processing(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_extracted_field(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_document_processing(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_document_processing(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fail_document_processing(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_extracted_field(UUID, TEXT) TO authenticated;

CREATE TRIGGER audit_document_pages
AFTER INSERT OR UPDATE OR DELETE ON public.document_pages
FOR EACH ROW EXECUTE FUNCTION public.trigger_log_audit();

CREATE TRIGGER audit_extracted_fields
AFTER INSERT OR UPDATE OR DELETE ON public.extracted_fields
FOR EACH ROW EXECUTE FUNCTION public.trigger_log_audit();