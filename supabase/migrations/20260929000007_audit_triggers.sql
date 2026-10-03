-- ============================================================
-- AUDIT LOGS SECURITY FIX
-- ============================================================
-- Revokes direct frontend INSERT access to prevent fabricated logs.
-- Implements trigger-based atomic audit logging.

DROP POLICY IF EXISTS "Authenticated users insert own audit logs" ON public.audit_logs;

CREATE OR REPLACE FUNCTION public.trigger_log_audit()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID;
    v_actor_role TEXT;
    v_action TEXT;
    v_entity_id UUID;
BEGIN
    -- Try to get the user from auth context
    v_actor_id := auth.uid();
    
    IF v_actor_id IS NOT NULL THEN
        SELECT code INTO v_actor_role FROM public.roles
        JOIN public.profiles ON profiles.role_id = roles.id
        WHERE profiles.id = v_actor_id;
    ELSE
        v_actor_role := 'SYSTEM';
    END IF;

    v_entity_id := COALESCE(NEW.id, OLD.id);
    v_action := lower(TG_TABLE_NAME) || '_' || lower(TG_OP);

    INSERT INTO public.audit_logs (
        actor_id,
        actor_role,
        action,
        entity_type,
        entity_id,
        before_state,
        after_state,
        status,
        remarks
    ) VALUES (
        v_actor_id,
        COALESCE(v_actor_role, 'UNKNOWN'),
        v_action,
        TG_TABLE_NAME,
        v_entity_id,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        'SUCCESS',
        'Auto-generated via database trigger'
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to major tables
CREATE TRIGGER audit_land_records AFTER INSERT OR UPDATE OR DELETE ON public.land_records FOR EACH ROW EXECUTE FUNCTION public.trigger_log_audit();
CREATE TRIGGER audit_documents AFTER INSERT OR UPDATE OR DELETE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.trigger_log_audit();
CREATE TRIGGER audit_verification_tasks AFTER INSERT OR UPDATE OR DELETE ON public.verification_tasks FOR EACH ROW EXECUTE FUNCTION public.trigger_log_audit();
CREATE TRIGGER audit_watchlists AFTER INSERT OR UPDATE OR DELETE ON public.watchlists FOR EACH ROW EXECUTE FUNCTION public.trigger_log_audit();
CREATE TRIGGER audit_duplicate_candidates AFTER INSERT OR UPDATE OR DELETE ON public.duplicate_candidates FOR EACH ROW EXECUTE FUNCTION public.trigger_log_audit();
CREATE TRIGGER audit_risk_assessments AFTER INSERT OR UPDATE OR DELETE ON public.risk_assessments FOR EACH ROW EXECUTE FUNCTION public.trigger_log_audit();

-- End
