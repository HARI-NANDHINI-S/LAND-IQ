CREATE OR REPLACE FUNCTION public.update_verification_task_status(
    p_task_id UUID,
    p_status TEXT,
    p_comment TEXT DEFAULT NULL
)
RETURNS public.verification_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_task public.verification_tasks;
    v_state_id UUID;
    v_district_id UUID;
    v_village_id UUID;
    v_permission TEXT;
BEGIN
    IF p_status NOT IN ('UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CORRECTION_REQUIRED') THEN
        RAISE EXCEPTION 'Unsupported verification status.';
    END IF;

    v_permission := CASE p_status
        WHEN 'APPROVED' THEN 'verification:approve'
        WHEN 'REJECTED' THEN 'verification:reject'
        ELSE 'verification:review'
    END;
    IF NOT public.has_permission(v_permission) THEN
        RAISE EXCEPTION 'You do not have permission to set verification status %.', p_status;
    END IF;

        SELECT task.* INTO v_task
    FROM public.verification_tasks task
    JOIN public.documents document ON document.id = task.document_id
    LEFT JOIN public.land_records record ON record.id = task.land_record_id
    WHERE task.id = p_task_id
    FOR UPDATE OF task;

    IF v_task.id IS NULL THEN
        RAISE EXCEPTION 'Verification task was not found.';
    END IF;
        SELECT coalesce(record.state_id, document.state_id),
               coalesce(record.district_id, document.district_id),
               coalesce(record.village_id, document.village_id)
            INTO v_state_id, v_district_id, v_village_id
        FROM public.documents document
        LEFT JOIN public.land_records record ON record.id = v_task.land_record_id
        WHERE document.id = v_task.document_id;
    IF NOT public.can_access_geographic_scope(v_state_id, v_district_id, v_village_id)
       OR NOT (public.has_permission('verification:review') OR public.has_permission('verification:approve') OR public.has_permission('verification:reject')) THEN
        RAISE EXCEPTION 'Verification task is outside your authorized geographic scope.';
    END IF;
    IF v_task.status IN ('APPROVED', 'REJECTED') THEN
        RAISE EXCEPTION 'A completed verification task cannot be changed.';
    END IF;
    IF p_status IN ('REJECTED', 'CORRECTION_REQUIRED') AND nullif(btrim(p_comment), '') IS NULL THEN
        RAISE EXCEPTION 'A review reason is required for rejection or correction.';
    END IF;

    UPDATE public.verification_tasks
    SET status = p_status,
        assigned_to = coalesce(assigned_to, auth.uid()),
        started_at = CASE WHEN p_status = 'UNDER_REVIEW' THEN coalesce(started_at, NOW()) ELSE started_at END,
        completed_at = CASE WHEN p_status IN ('APPROVED', 'REJECTED') THEN NOW() ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_task_id
    RETURNING * INTO v_task;

    INSERT INTO public.verification_actions (
        verification_task_id, actor_id, action, comment
    ) VALUES (
        p_task_id, auth.uid(), p_status, nullif(btrim(p_comment), '')
    );

    UPDATE public.documents
    SET verification_status = p_status,
        updated_at = NOW()
    WHERE id = v_task.document_id;

    IF v_task.land_record_id IS NOT NULL THEN
        UPDATE public.land_records
        SET verification_status = p_status,
            updated_at = NOW()
        WHERE id = v_task.land_record_id;
    END IF;

    RETURN v_task;
END;
$$;

REVOKE ALL ON FUNCTION public.update_verification_task_status(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_verification_task_status(UUID, TEXT, TEXT) TO authenticated;
REVOKE INSERT ON public.verification_actions FROM authenticated;

CREATE TRIGGER audit_verification_actions
AFTER INSERT OR UPDATE OR DELETE ON public.verification_actions
FOR EACH ROW EXECUTE FUNCTION public.trigger_log_audit();

CREATE OR REPLACE FUNCTION public.update_risk_assessment_status(
    p_assessment_id UUID,
    p_status TEXT,
    p_notes TEXT DEFAULT NULL,
    p_assigned_to UUID DEFAULT NULL
)
RETURNS public.risk_assessments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_assessment public.risk_assessments;
    v_record public.land_records;
    v_target public.profiles;
    v_role TEXT := public.user_role();
    v_permission TEXT;
BEGIN
    IF p_status NOT IN ('ACTIVE', 'UNDER_REVIEW', 'RESOLVED', 'REOPENED') THEN
        RAISE EXCEPTION 'Unsupported risk assessment status.';
    END IF;
    IF p_notes IS NOT NULL AND length(p_notes) > 5000 THEN
        RAISE EXCEPTION 'Investigation notes cannot exceed 5000 characters.';
    END IF;

    v_permission := CASE WHEN p_status IN ('RESOLVED', 'REOPENED') THEN 'risk:manage' ELSE 'risk:investigate' END;
    IF NOT public.has_permission(v_permission) THEN
        RAISE EXCEPTION 'You do not have permission to set risk status %.', p_status;
    END IF;

    SELECT * INTO v_assessment
    FROM public.risk_assessments assessment
    WHERE assessment.id = p_assessment_id
    FOR UPDATE;
    IF v_assessment.id IS NULL THEN RAISE EXCEPTION 'Risk assessment was not found.'; END IF;

    SELECT * INTO v_record FROM public.land_records WHERE id = v_assessment.land_record_id;
    IF v_record.id IS NULL OR NOT public.can_access_land_record(v_record.id) THEN
        RAISE EXCEPTION 'Risk assessment is outside your authorized geographic scope.';
    END IF;

    IF p_assigned_to IS NOT NULL THEN
        SELECT * INTO v_target FROM public.profiles WHERE id = p_assigned_to AND is_active = TRUE;
        IF v_target.id IS NULL OR NOT (
            v_role = 'SUPER_ADMIN'
            OR public.can_access_geographic_scope(v_target.state_id, v_target.district_id, v_target.village_id)
        ) THEN
            RAISE EXCEPTION 'Assigned investigator is inactive or outside your authorized scope.';
        END IF;
    END IF;

    UPDATE public.risk_assessments
    SET status = p_status,
        investigation_notes = coalesce(p_notes, investigation_notes),
        assigned_to = coalesce(p_assigned_to, assigned_to),
        updated_at = NOW()
    WHERE id = p_assessment_id
    RETURNING * INTO v_assessment;

    RETURN v_assessment;
END;
$$;

REVOKE ALL ON FUNCTION public.update_risk_assessment_status(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_risk_assessment_status(UUID, TEXT, TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_duplicate_candidate_status(
    p_candidate_id UUID,
    p_status TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS public.duplicate_candidates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_candidate public.duplicate_candidates;
    v_record_a public.land_records;
    v_record_b public.land_records;
    v_permission TEXT;
BEGIN
    IF p_status NOT IN ('UNDER_REVIEW', 'CONFIRMED', 'FALSE_POSITIVE', 'LEGITIMATE_SUBDIVISION', 'DISPUTED') THEN
        RAISE EXCEPTION 'Unsupported duplicate candidate status.';
    END IF;
    IF p_notes IS NOT NULL AND length(p_notes) > 5000 THEN
        RAISE EXCEPTION 'Review notes cannot exceed 5000 characters.';
    END IF;
    IF p_status IN ('FALSE_POSITIVE', 'LEGITIMATE_SUBDIVISION', 'DISPUTED')
       AND nullif(btrim(p_notes), '') IS NULL THEN
        RAISE EXCEPTION 'A resolution reason is required for this status.';
    END IF;

    v_permission := CASE WHEN p_status = 'UNDER_REVIEW' THEN 'duplicate:review' ELSE 'duplicate:resolve' END;
    IF NOT public.has_permission(v_permission) THEN
        RAISE EXCEPTION 'You do not have permission to set duplicate status %.', p_status;
    END IF;

    SELECT * INTO v_candidate
    FROM public.duplicate_candidates candidate
    WHERE candidate.id = p_candidate_id
    FOR UPDATE;
    IF v_candidate.id IS NULL THEN RAISE EXCEPTION 'Duplicate candidate was not found.'; END IF;

    SELECT * INTO v_record_a FROM public.land_records WHERE id = v_candidate.record_a_id;
    SELECT * INTO v_record_b FROM public.land_records WHERE id = v_candidate.record_b_id;
    IF v_record_a.id IS NULL OR v_record_b.id IS NULL
       OR NOT public.can_access_land_record(v_record_a.id)
       OR NOT public.can_access_land_record(v_record_b.id) THEN
        RAISE EXCEPTION 'Duplicate candidate is outside your authorized geographic scope.';
    END IF;

    UPDATE public.duplicate_candidates
    SET status = p_status,
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        resolution_notes = coalesce(nullif(btrim(p_notes), ''), resolution_notes),
        updated_at = NOW()
    WHERE id = p_candidate_id
    RETURNING * INTO v_candidate;

    RETURN v_candidate;
END;
$$;

REVOKE ALL ON FUNCTION public.update_duplicate_candidate_status(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_duplicate_candidate_status(UUID, TEXT, TEXT) TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.duplicate_candidates FROM authenticated;
REVOKE UPDATE ON public.risk_assessments FROM authenticated;
REVOKE UPDATE ON public.verification_tasks FROM authenticated;

CREATE TRIGGER audit_profiles
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trigger_log_audit();

CREATE TRIGGER audit_settings
AFTER INSERT OR UPDATE OR DELETE ON public.settings
FOR EACH ROW EXECUTE FUNCTION public.trigger_log_audit();

CREATE OR REPLACE FUNCTION public.publish_alert_change_to_watchlists()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.land_record_id IS NULL THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

    INSERT INTO public.record_changes (
        land_record_id, entity_type, entity_id, field_name, old_value, new_value,
        change_priority, changed_by, reason
    ) VALUES (
        NEW.land_record_id,
        'alerts',
        NEW.id,
        'status',
        CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
        NEW.status,
        NEW.priority,
        auth.uid(),
        CASE WHEN TG_OP = 'INSERT' THEN 'Monitoring alert created.' ELSE 'Monitoring alert status changed.' END
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER publish_alert_change_to_watchlists
AFTER INSERT OR UPDATE OF status ON public.alerts
FOR EACH ROW EXECUTE FUNCTION public.publish_alert_change_to_watchlists();

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'alerts'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
        END IF;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_alert_status(p_alert_id UUID, p_status TEXT)
RETURNS public.alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_alert public.alerts;
    v_record public.land_records;
    v_role TEXT := public.user_role();
BEGIN
    IF p_status NOT IN ('ACKNOWLEDGED', 'RESOLVED') THEN
        RAISE EXCEPTION 'Unsupported alert status transition.';
    END IF;
    IF NOT public.has_permission('monitoring:manage') THEN
        RAISE EXCEPTION 'You do not have permission to manage alerts.';
    END IF;

    SELECT * INTO v_alert
    FROM public.alerts alert
    WHERE alert.id = p_alert_id
    FOR UPDATE;
    IF v_alert.id IS NULL THEN RAISE EXCEPTION 'Alert was not found.'; END IF;

    IF v_alert.land_record_id IS NOT NULL THEN
        SELECT * INTO v_record FROM public.land_records WHERE id = v_alert.land_record_id;
        IF NOT public.can_access_land_record(v_record.id) THEN
            RAISE EXCEPTION 'Alert is outside your authorized geographic scope.';
        END IF;
    ELSIF v_role <> 'SUPER_ADMIN' THEN
        RAISE EXCEPTION 'Only SUPER_ADMIN can manage system alerts.';
    END IF;
    IF v_alert.status = 'RESOLVED' AND p_status = 'ACKNOWLEDGED' THEN
        RAISE EXCEPTION 'A resolved alert cannot be acknowledged.';
    END IF;

    UPDATE public.alerts
    SET status = p_status,
        acknowledged_at = CASE WHEN p_status = 'ACKNOWLEDGED' THEN coalesce(acknowledged_at, NOW()) ELSE acknowledged_at END,
        resolved_at = CASE WHEN p_status = 'RESOLVED' THEN NOW() ELSE resolved_at END,
        updated_at = NOW()
    WHERE id = p_alert_id
    RETURNING * INTO v_alert;
    RETURN v_alert;
END;
$$;

REVOKE ALL ON FUNCTION public.update_alert_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_alert_status(UUID, TEXT) TO authenticated;
REVOKE UPDATE ON public.alerts FROM authenticated;

CREATE OR REPLACE FUNCTION public.enforce_watchlist_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_land_record_id UUID;
    v_user_id UUID;
BEGIN
    IF NOT public.has_permission('watchlist:manage') THEN
        RAISE EXCEPTION 'You do not have permission to manage watchlists.';
    END IF;

    IF TG_OP = 'DELETE' THEN
        v_land_record_id := OLD.land_record_id;
        v_user_id := OLD.user_id;
    ELSE
        v_land_record_id := NEW.land_record_id;
        v_user_id := NEW.user_id;
    END IF;

    IF public.user_role() IS DISTINCT FROM 'SUPER_ADMIN' AND v_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Users can manage only their own watchlist entries.';
    END IF;
    IF NOT public.can_access_land_record(v_land_record_id) THEN
        RAISE EXCEPTION 'Land record is outside your authorized scope.';
    END IF;
    IF TG_OP = 'UPDATE' AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.land_record_id IS DISTINCT FROM OLD.land_record_id) THEN
        RAISE EXCEPTION 'Watchlist owner and land record cannot be changed.';
    END IF;
    IF TG_OP = 'INSERT' THEN
        NEW.user_id := auth.uid();
        RETURN NEW;
    END IF;
    RETURN coalesce(NEW, OLD);
END;
$$;

CREATE TRIGGER enforce_watchlist_mutation
BEFORE INSERT OR UPDATE OR DELETE ON public.watchlists
FOR EACH ROW EXECUTE FUNCTION public.enforce_watchlist_mutation();

CREATE OR REPLACE FUNCTION public.enforce_document_geographic_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_record public.land_records;
BEGIN
    IF auth.uid() IS NOT NULL AND TG_OP = 'INSERT' THEN
        NEW.uploaded_by := auth.uid();
    ELSIF auth.uid() IS NOT NULL AND NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by
       AND public.user_role() IS DISTINCT FROM 'SUPER_ADMIN' THEN
        RAISE EXCEPTION 'Document uploader cannot be changed.';
    END IF;

    IF NEW.land_record_id IS NOT NULL THEN
        SELECT * INTO v_record
        FROM public.land_records record
        WHERE record.id = NEW.land_record_id;
        IF v_record.id IS NULL THEN RAISE EXCEPTION 'Linked land record was not found.'; END IF;
        IF NEW.state_id IS DISTINCT FROM v_record.state_id
           OR NEW.district_id IS DISTINCT FROM v_record.district_id
           OR NEW.village_id IS DISTINCT FROM v_record.village_id THEN
            RAISE EXCEPTION 'Document geography must match the linked land record.';
        END IF;
    END IF;

    IF auth.uid() IS NOT NULL
       AND public.user_role() IS DISTINCT FROM 'SUPER_ADMIN'
       AND NOT public.can_access_geographic_scope(NEW.state_id, NEW.district_id, NEW.village_id) THEN
        RAISE EXCEPTION 'Document is outside your authorized geographic scope.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_document_geographic_scope
BEFORE INSERT OR UPDATE OF land_record_id, state_id, district_id, village_id, uploaded_by
ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.enforce_document_geographic_scope();