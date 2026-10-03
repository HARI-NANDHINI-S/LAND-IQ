-- ============================================================
-- RECORD CHANGES & SMART ALERTS TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.trigger_land_record_rules()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_alert_title TEXT;
    v_alert_desc TEXT;
    v_alert_priority TEXT;
    v_alert_type TEXT;
BEGIN
    -- Only evaluate on UPDATE
    IF TG_OP = 'UPDATE' THEN
        
        -- Rule 1: Area change > 20%
        IF NEW.total_area IS DISTINCT FROM OLD.total_area AND OLD.total_area > 0 THEN
            IF ABS(NEW.total_area - OLD.total_area) / OLD.total_area > 0.20 THEN
                
                INSERT INTO public.record_changes (
                    land_record_id, entity_type, entity_id, field_name, old_value, new_value, change_priority, changed_by, reason
                ) VALUES (
                    NEW.id, 'land_records', NEW.id, 'total_area', OLD.total_area::TEXT, NEW.total_area::TEXT, 'CRITICAL', v_actor_id, 'Automated detection: Area changed by >20%'
                );

                INSERT INTO public.alerts (
                    land_record_id, alert_type, priority, title, description, created_by
                ) VALUES (
                    NEW.id, 'AREA_CHANGE_ANOMALY', 'CRITICAL', 'Significant Area Modification', 'Total area changed by more than 20% between revisions.', v_actor_id
                );
            ELSE
                INSERT INTO public.record_changes (
                    land_record_id, entity_type, entity_id, field_name, old_value, new_value, change_priority, changed_by, reason
                ) VALUES (
                    NEW.id, 'land_records', NEW.id, 'total_area', OLD.total_area::TEXT, NEW.total_area::TEXT, 'LOW', v_actor_id, 'Normal area update'
                );
            END IF;
        END IF;

        -- Rule 2: Land Type change
        IF NEW.land_type IS DISTINCT FROM OLD.land_type THEN
            INSERT INTO public.record_changes (
                land_record_id, entity_type, entity_id, field_name, old_value, new_value, change_priority, changed_by, reason
            ) VALUES (
                NEW.id, 'land_records', NEW.id, 'land_type', OLD.land_type, NEW.land_type, 'HIGH', v_actor_id, 'Land classification modified'
            );

            INSERT INTO public.alerts (
                land_record_id, alert_type, priority, title, description, created_by
            ) VALUES (
                NEW.id, 'CLASSIFICATION_CHANGE', 'HIGH', 'Land Classification Changed', 'The land type was reclassified.', v_actor_id
            );
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_land_record_rules
    AFTER UPDATE ON public.land_records
    FOR EACH ROW EXECUTE FUNCTION public.trigger_land_record_rules();
