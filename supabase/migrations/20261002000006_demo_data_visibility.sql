ALTER TABLE public.land_records
    ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.land_owners
    ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.land_records
SET is_demo = TRUE
WHERE remarks ILIKE '[DEMO RECORD]%'
   OR record_number IN ('TN-COI-2024-001', 'TN-COI-2024-002', 'TN-COI-2024-003');

UPDATE public.land_owners
SET is_demo = TRUE
WHERE full_name ILIKE '%(DEMO)%'
   OR identification_reference ILIKE 'DEMO-ID-%';

CREATE TABLE IF NOT EXISTS public.demo_data_policy (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
    development_data_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES public.profiles(id)
);

INSERT INTO public.demo_data_policy (singleton, development_data_enabled)
VALUES (TRUE, FALSE)
ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE public.demo_data_policy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins read demo visibility policy"
ON public.demo_data_policy FOR SELECT TO authenticated
USING (public.user_role() = 'SUPER_ADMIN');
CREATE POLICY "Super admins update demo visibility policy"
ON public.demo_data_policy FOR UPDATE TO authenticated
USING (public.user_role() = 'SUPER_ADMIN')
WITH CHECK (public.user_role() = 'SUPER_ADMIN' AND updated_by = auth.uid());
REVOKE INSERT, DELETE ON public.demo_data_policy FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.demo_data_policy TO authenticated;

CREATE OR REPLACE FUNCTION public.demo_data_visible()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT coalesce((
        SELECT policy.development_data_enabled
        FROM public.demo_data_policy policy
        WHERE policy.singleton = TRUE
    ), FALSE);
$$;

CREATE OR REPLACE FUNCTION public.is_demo_entity(p_entity_type TEXT, p_entity_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_demo BOOLEAN := FALSE;
BEGIN
    IF p_entity_id IS NULL THEN RETURN FALSE; END IF;
    CASE p_entity_type
        WHEN 'land_records' THEN
            SELECT is_demo INTO v_demo FROM public.land_records WHERE id = p_entity_id;
        WHEN 'land_owners' THEN
            SELECT is_demo INTO v_demo FROM public.land_owners WHERE id = p_entity_id;
        WHEN 'land_record_owners' THEN
            SELECT record.is_demo INTO v_demo
            FROM public.land_record_owners link
            JOIN public.land_records record ON record.id = link.land_record_id
            WHERE link.id = p_entity_id;
        WHEN 'documents' THEN
            SELECT coalesce(record.is_demo, FALSE) INTO v_demo
            FROM public.documents document
            LEFT JOIN public.land_records record ON record.id = document.land_record_id
            WHERE document.id = p_entity_id;
        WHEN 'verification_tasks' THEN
            SELECT coalesce(record.is_demo, FALSE) INTO v_demo
            FROM public.verification_tasks task
            LEFT JOIN public.land_records record ON record.id = task.land_record_id
            WHERE task.id = p_entity_id;
        WHEN 'verification_actions' THEN
            SELECT coalesce(record.is_demo, FALSE) INTO v_demo
            FROM public.verification_actions action
            JOIN public.verification_tasks task ON task.id = action.verification_task_id
            LEFT JOIN public.land_records record ON record.id = task.land_record_id
            WHERE action.id = p_entity_id;
        WHEN 'document_pages' THEN
            SELECT coalesce(record.is_demo, FALSE) INTO v_demo
            FROM public.document_pages page
            JOIN public.documents document ON document.id = page.document_id
            LEFT JOIN public.land_records record ON record.id = document.land_record_id
            WHERE page.id = p_entity_id;
        WHEN 'extracted_fields' THEN
            SELECT coalesce(record.is_demo, FALSE) INTO v_demo
            FROM public.extracted_fields field
            JOIN public.documents document ON document.id = field.document_id
            LEFT JOIN public.land_records record ON record.id = document.land_record_id
            WHERE field.id = p_entity_id;
        WHEN 'risk_assessments' THEN
            SELECT record.is_demo INTO v_demo
            FROM public.risk_assessments assessment
            JOIN public.land_records record ON record.id = assessment.land_record_id
            WHERE assessment.id = p_entity_id;
        WHEN 'risk_signals' THEN
            SELECT record.is_demo INTO v_demo
            FROM public.risk_signals signal
            JOIN public.risk_assessments assessment ON assessment.id = signal.risk_assessment_id
            JOIN public.land_records record ON record.id = assessment.land_record_id
            WHERE signal.id = p_entity_id;
        WHEN 'duplicate_candidates' THEN
            SELECT record_a.is_demo OR record_b.is_demo INTO v_demo
            FROM public.duplicate_candidates candidate
            JOIN public.land_records record_a ON record_a.id = candidate.record_a_id
            JOIN public.land_records record_b ON record_b.id = candidate.record_b_id
            WHERE candidate.id = p_entity_id;
        WHEN 'record_changes' THEN
            SELECT record.is_demo INTO v_demo
            FROM public.record_changes change
            JOIN public.land_records record ON record.id = change.land_record_id
            WHERE change.id = p_entity_id;
        WHEN 'watchlists' THEN
            SELECT record.is_demo INTO v_demo
            FROM public.watchlists watchlist
            JOIN public.land_records record ON record.id = watchlist.land_record_id
            WHERE watchlist.id = p_entity_id;
        WHEN 'alerts' THEN
            SELECT coalesce(record.is_demo, FALSE) INTO v_demo
            FROM public.alerts alert
            LEFT JOIN public.land_records record ON record.id = alert.land_record_id
            WHERE alert.id = p_entity_id;
        ELSE
            v_demo := FALSE;
    END CASE;
    RETURN coalesce(v_demo, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.demo_data_visible() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_demo_entity(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demo_data_visible() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_demo_entity(TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_access_land_record(p_record_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.land_records record
        WHERE record.id = p_record_id
          AND public.can_access_geographic_scope(record.state_id, record.district_id, record.village_id)
          AND (NOT record.is_demo OR public.demo_data_visible())
    );
$$;

CREATE POLICY "Demo records hidden by default"
ON public.land_records AS RESTRICTIVE
FOR ALL TO authenticated
USING (NOT is_demo OR public.demo_data_visible())
WITH CHECK (NOT is_demo OR public.demo_data_visible());

CREATE POLICY "Demo owner data hidden by default"
ON public.land_owners AS RESTRICTIVE
FOR ALL TO authenticated
USING (NOT is_demo OR public.demo_data_visible())
WITH CHECK (NOT is_demo OR public.demo_data_visible());

CREATE POLICY "Demo documents hidden by default"
ON public.documents AS RESTRICTIVE
FOR ALL TO authenticated
USING (land_record_id IS NULL OR public.can_access_land_record(land_record_id))
WITH CHECK (land_record_id IS NULL OR public.can_access_land_record(land_record_id));

CREATE POLICY "Demo page data hidden by default"
ON public.document_pages AS RESTRICTIVE
FOR ALL TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.documents document
    WHERE document.id = document_pages.document_id
      AND (document.land_record_id IS NULL OR public.can_access_land_record(document.land_record_id))
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.documents document
    WHERE document.id = document_pages.document_id
      AND (document.land_record_id IS NULL OR public.can_access_land_record(document.land_record_id))
));

CREATE POLICY "Demo extracted fields hidden by default"
ON public.extracted_fields AS RESTRICTIVE
FOR ALL TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.documents document
    WHERE document.id = extracted_fields.document_id
      AND (document.land_record_id IS NULL OR public.can_access_land_record(document.land_record_id))
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.documents document
    WHERE document.id = extracted_fields.document_id
      AND (document.land_record_id IS NULL OR public.can_access_land_record(document.land_record_id))
));

CREATE POLICY "Demo verification tasks hidden by default"
ON public.verification_tasks AS RESTRICTIVE
FOR ALL TO authenticated
USING (
    (land_record_id IS NOT NULL AND public.can_access_land_record(land_record_id))
    OR (land_record_id IS NULL AND EXISTS (
        SELECT 1 FROM public.documents document
        WHERE document.id = verification_tasks.document_id
          AND (document.land_record_id IS NULL OR public.can_access_land_record(document.land_record_id))
    ))
)
WITH CHECK (
    (land_record_id IS NOT NULL AND public.can_access_land_record(land_record_id))
    OR (land_record_id IS NULL AND EXISTS (
        SELECT 1 FROM public.documents document
        WHERE document.id = verification_tasks.document_id
          AND (document.land_record_id IS NULL OR public.can_access_land_record(document.land_record_id))
    ))
);

CREATE POLICY "Demo audit events hidden by default"
ON public.audit_logs AS RESTRICTIVE
FOR SELECT TO authenticated
USING (NOT public.is_demo_entity(entity_type, entity_id) OR public.demo_data_visible());

CREATE POLICY "Demo notifications hidden by default"
ON public.notifications AS RESTRICTIVE
FOR ALL TO authenticated
USING (NOT public.is_demo_entity(entity_type, entity_id) OR public.demo_data_visible())
WITH CHECK (NOT public.is_demo_entity(entity_type, entity_id) OR public.demo_data_visible());

CREATE OR REPLACE FUNCTION public.protect_demo_data_label()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NOT NULL AND public.user_role() IS DISTINCT FROM 'SUPER_ADMIN' THEN
        IF TG_OP = 'INSERT' THEN
            NEW.is_demo := FALSE;
        ELSIF NEW.is_demo IS DISTINCT FROM OLD.is_demo THEN
            RAISE EXCEPTION 'Only SUPER_ADMIN can change the demo-data label.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER protect_land_record_demo_label
BEFORE INSERT OR UPDATE OF is_demo ON public.land_records
FOR EACH ROW EXECUTE FUNCTION public.protect_demo_data_label();

CREATE TRIGGER protect_land_owner_demo_label
BEFORE INSERT OR UPDATE OF is_demo ON public.land_owners
FOR EACH ROW EXECUTE FUNCTION public.protect_demo_data_label();