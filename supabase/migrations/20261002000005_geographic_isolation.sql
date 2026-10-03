CREATE OR REPLACE FUNCTION public.user_village_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT village_id
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_active = TRUE
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_access_geographic_scope(
    p_state_id UUID,
    p_district_id UUID,
    p_village_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT CASE public.user_role()
        WHEN 'SUPER_ADMIN' THEN TRUE
        WHEN 'STATE_ADMIN' THEN p_state_id = public.user_state_id()
            AND (public.user_village_id() IS NULL OR p_village_id = public.user_village_id())
        WHEN 'DISTRICT_OFFICER' THEN p_district_id = public.user_district_id()
            AND (public.user_village_id() IS NULL OR p_village_id = public.user_village_id())
        WHEN 'DATA_ENTRY_OFFICER' THEN p_district_id = public.user_district_id()
            AND (public.user_village_id() IS NULL OR p_village_id = public.user_village_id())
        WHEN 'VERIFICATION_OFFICER' THEN p_district_id = public.user_district_id()
            AND (public.user_village_id() IS NULL OR p_village_id = public.user_village_id())
        WHEN 'VIEWER' THEN p_district_id = public.user_district_id()
            AND (public.user_village_id() IS NULL OR p_village_id = public.user_village_id())
        ELSE FALSE
    END;
$$;

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
    );
$$;

REVOKE ALL ON FUNCTION public.user_village_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_geographic_scope(UUID, UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_land_record(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_village_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_geographic_scope(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_land_record(UUID) TO authenticated;

CREATE POLICY "Geographic scope restricts land records"
ON public.land_records AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.can_access_geographic_scope(state_id, district_id, village_id))
WITH CHECK (public.can_access_geographic_scope(state_id, district_id, village_id));

CREATE POLICY "Geographic scope restricts documents"
ON public.documents AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.can_access_geographic_scope(state_id, district_id, village_id))
WITH CHECK (public.can_access_geographic_scope(state_id, district_id, village_id));

CREATE POLICY "Geographic scope restricts document pages"
ON public.document_pages AS RESTRICTIVE
FOR ALL TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.documents document
    WHERE document.id = document_pages.document_id
      AND public.can_access_geographic_scope(document.state_id, document.district_id, document.village_id)
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.documents document
    WHERE document.id = document_pages.document_id
      AND public.can_access_geographic_scope(document.state_id, document.district_id, document.village_id)
));

CREATE POLICY "Geographic scope restricts extracted fields"
ON public.extracted_fields AS RESTRICTIVE
FOR ALL TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.documents document
    WHERE document.id = extracted_fields.document_id
      AND public.can_access_geographic_scope(document.state_id, document.district_id, document.village_id)
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.documents document
    WHERE document.id = extracted_fields.document_id
      AND public.can_access_geographic_scope(document.state_id, document.district_id, document.village_id)
));

CREATE POLICY "Geographic scope restricts record ownership links"
ON public.land_record_owners AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.can_access_land_record(land_record_id))
WITH CHECK (public.can_access_land_record(land_record_id));

CREATE POLICY "Geographic scope restricts land owner reads"
ON public.land_owners AS RESTRICTIVE
FOR SELECT TO authenticated
USING (
    public.user_role() = 'SUPER_ADMIN'
    OR EXISTS (
        SELECT 1
        FROM public.land_record_owners link
        WHERE link.owner_id = land_owners.id
          AND public.can_access_land_record(link.land_record_id)
    )
);

CREATE POLICY "Geographic scope restricts verification tasks"
ON public.verification_tasks AS RESTRICTIVE
FOR ALL TO authenticated
USING (
    (land_record_id IS NOT NULL AND public.can_access_land_record(land_record_id))
    OR (land_record_id IS NULL AND EXISTS (
        SELECT 1 FROM public.documents document
        WHERE document.id = verification_tasks.document_id
          AND public.can_access_geographic_scope(document.state_id, document.district_id, document.village_id)
    ))
)
WITH CHECK (
    (land_record_id IS NOT NULL AND public.can_access_land_record(land_record_id))
    OR (land_record_id IS NULL AND EXISTS (
        SELECT 1 FROM public.documents document
        WHERE document.id = verification_tasks.document_id
          AND public.can_access_geographic_scope(document.state_id, document.district_id, document.village_id)
    ))
);

CREATE POLICY "Geographic scope restricts duplicate candidates"
ON public.duplicate_candidates AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.can_access_land_record(record_a_id) AND public.can_access_land_record(record_b_id))
WITH CHECK (public.can_access_land_record(record_a_id) AND public.can_access_land_record(record_b_id));

CREATE POLICY "Geographic scope restricts risk assessments"
ON public.risk_assessments AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.can_access_land_record(land_record_id))
WITH CHECK (public.can_access_land_record(land_record_id));

CREATE POLICY "Geographic scope restricts risk signals"
ON public.risk_signals AS RESTRICTIVE
FOR ALL TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.risk_assessments assessment
    WHERE assessment.id = risk_signals.risk_assessment_id
      AND public.can_access_land_record(assessment.land_record_id)
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.risk_assessments assessment
    WHERE assessment.id = risk_signals.risk_assessment_id
      AND public.can_access_land_record(assessment.land_record_id)
));

CREATE POLICY "Geographic scope restricts record changes"
ON public.record_changes AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.can_access_land_record(land_record_id))
WITH CHECK (public.can_access_land_record(land_record_id));

CREATE POLICY "Geographic scope restricts watchlists"
ON public.watchlists AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.can_access_land_record(land_record_id))
WITH CHECK (public.can_access_land_record(land_record_id));

CREATE POLICY "Geographic scope restricts alerts"
ON public.alerts AS RESTRICTIVE
FOR ALL TO authenticated
USING (
    (land_record_id IS NULL AND public.user_role() = 'SUPER_ADMIN')
    OR (land_record_id IS NOT NULL AND public.can_access_land_record(land_record_id))
)
WITH CHECK (
    (land_record_id IS NULL AND public.user_role() = 'SUPER_ADMIN')
    OR (land_record_id IS NOT NULL AND public.can_access_land_record(land_record_id))
);