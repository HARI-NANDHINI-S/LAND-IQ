CREATE OR REPLACE FUNCTION public.get_analytics_dashboard_data(
    p_state_id UUID,
    p_district_id UUID,
    p_taluk_id UUID,
    p_village_id UUID,
    p_land_type TEXT,
    p_record_status TEXT,
    p_verification_status TEXT,
    p_risk_level TEXT,
    p_alert_status TEXT,
    p_alert_priority TEXT,
    p_created_from DATE,
    p_created_to DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
SET row_security = on
AS $$
BEGIN
    IF NOT public.has_permission('analytics:read') THEN
        RAISE EXCEPTION 'You do not have permission to view analytics.'
            USING ERRCODE = '42501';
    END IF;

    RETURN (
        WITH selected_records AS MATERIALIZED (
            SELECT record.id,
                   record.state_id,
                   record.district_id,
                   record.taluk_id,
                   record.village_id,
                   record.land_type,
                   record.record_status,
                   record.verification_status,
                   record.land_area,
                   record.created_at
            FROM public.land_records record
            WHERE (p_state_id IS NULL OR record.state_id = p_state_id)
              AND (p_district_id IS NULL OR record.district_id = p_district_id)
              AND (p_taluk_id IS NULL OR record.taluk_id = p_taluk_id)
              AND (p_village_id IS NULL OR record.village_id = p_village_id)
              AND (p_land_type IS NULL OR record.land_type = p_land_type)
              AND (p_record_status IS NULL OR record.record_status = p_record_status)
              AND (p_verification_status IS NULL OR record.verification_status = p_verification_status)
              AND (p_created_from IS NULL OR record.created_at >= (p_created_from::TIMESTAMP AT TIME ZONE 'UTC'))
              AND (p_created_to IS NULL OR record.created_at <=
                   ((p_created_to::TIMESTAMP + TIME '23:59:59.999') AT TIME ZONE 'UTC'))
        ),
        documents AS MATERIALIZED (
            SELECT document.id,
                   document.document_type,
                   document.processing_status,
                   document.verification_status,
                   document.land_record_id,
                   document.created_at
            FROM public.documents document
            WHERE (p_state_id IS NULL OR document.state_id = p_state_id)
              AND (p_district_id IS NULL OR document.district_id = p_district_id)
              AND (p_village_id IS NULL OR document.village_id = p_village_id)
              AND (
                  (p_state_id IS NULL AND p_district_id IS NULL AND p_taluk_id IS NULL AND p_village_id IS NULL)
                  OR document.land_record_id IN (SELECT record.id FROM selected_records record)
              )
              AND (p_created_from IS NULL OR document.created_at >= (p_created_from::TIMESTAMP AT TIME ZONE 'UTC'))
              AND (p_created_to IS NULL OR document.created_at <=
                   ((p_created_to::TIMESTAMP + TIME '23:59:59.999') AT TIME ZONE 'UTC'))
        ),
        verification_tasks AS MATERIALIZED (
            SELECT task.id,
                   task.status,
                   task.assigned_to,
                   task.land_record_id,
                   task.created_at
            FROM public.verification_tasks task
            WHERE (p_verification_status IS NULL OR task.status = p_verification_status)
              AND (
                  (p_state_id IS NULL AND p_district_id IS NULL AND p_taluk_id IS NULL AND p_village_id IS NULL)
                  OR task.land_record_id IN (SELECT record.id FROM selected_records record)
              )
              AND (p_created_from IS NULL OR task.created_at >= (p_created_from::TIMESTAMP AT TIME ZONE 'UTC'))
              AND (p_created_to IS NULL OR task.created_at <=
                   ((p_created_to::TIMESTAMP + TIME '23:59:59.999') AT TIME ZONE 'UTC'))
        ),
        duplicate_candidates AS MATERIALIZED (
            SELECT candidate.id,
                   candidate.status,
                   candidate.similarity_score,
                   candidate.record_a_id,
                   candidate.record_b_id,
                   candidate.created_at
            FROM public.duplicate_candidates candidate
            WHERE NOT EXISTS (SELECT 1 FROM selected_records)
               OR EXISTS (
                   SELECT 1 FROM selected_records record
                   WHERE record.id = candidate.record_a_id
                      OR record.id = candidate.record_b_id
               )
        ),
        risk_assessments AS MATERIALIZED (
            SELECT assessment.id,
                   assessment.risk_level,
                   assessment.status,
                   assessment.land_record_id,
                   assessment.calculated_at
            FROM public.risk_assessments assessment
            WHERE (p_risk_level IS NULL OR assessment.risk_level = p_risk_level)
              AND (
                  (p_state_id IS NULL AND p_district_id IS NULL AND p_taluk_id IS NULL AND p_village_id IS NULL)
                  OR assessment.land_record_id IN (SELECT record.id FROM selected_records record)
              )
              AND (p_created_from IS NULL OR assessment.calculated_at >= (p_created_from::TIMESTAMP AT TIME ZONE 'UTC'))
              AND (p_created_to IS NULL OR assessment.calculated_at <=
                   ((p_created_to::TIMESTAMP + TIME '23:59:59.999') AT TIME ZONE 'UTC'))
        ),
        alerts AS MATERIALIZED (
            SELECT alert.id,
                   alert.status,
                   alert.priority,
                   alert.land_record_id,
                   alert.created_at
            FROM public.alerts alert
            WHERE (p_alert_status IS NULL OR alert.status = p_alert_status)
              AND (p_alert_priority IS NULL OR alert.priority = p_alert_priority)
              AND (
                  (p_state_id IS NULL AND p_district_id IS NULL AND p_taluk_id IS NULL AND p_village_id IS NULL)
                  OR alert.land_record_id IN (SELECT record.id FROM selected_records record)
              )
              AND (p_created_from IS NULL OR alert.created_at >= (p_created_from::TIMESTAMP AT TIME ZONE 'UTC'))
              AND (p_created_to IS NULL OR alert.created_at <=
                   ((p_created_to::TIMESTAMP + TIME '23:59:59.999') AT TIME ZONE 'UTC'))
        ),
        land_status AS (
            SELECT coalesce(record.record_status, 'Unspecified') AS label, count(*) AS value
            FROM selected_records record GROUP BY 1
        ),
        land_type AS (
            SELECT coalesce(record.land_type, 'Unspecified') AS label, count(*) AS value
            FROM selected_records record GROUP BY 1
        ),
        land_district AS (
            SELECT coalesce(district.name, record.district_id::TEXT, 'Unspecified') AS label, count(*) AS value
            FROM selected_records record
            LEFT JOIN public.districts district ON district.id = record.district_id AND district.is_active = TRUE
            GROUP BY 1
        ),
        land_taluk AS (
            SELECT coalesce(taluk.name, record.taluk_id::TEXT, 'Unspecified') AS label, count(*) AS value
            FROM selected_records record
            LEFT JOIN public.taluks taluk ON taluk.id = record.taluk_id AND taluk.is_active = TRUE
            GROUP BY 1
        ),
        land_village AS (
            SELECT coalesce(village.name, record.village_id::TEXT, 'Unspecified') AS label, count(*) AS value
            FROM selected_records record
            LEFT JOIN public.villages village ON village.id = record.village_id AND village.is_active = TRUE
            GROUP BY 1
        ),
        land_area_district AS (
            SELECT coalesce(district.name, record.district_id::TEXT, 'Unspecified') AS label,
                   sum(coalesce(record.land_area, 0)) AS value,
                   max(record.created_at) AS first_seen
            FROM selected_records record
            LEFT JOIN public.districts district ON district.id = record.district_id AND district.is_active = TRUE
            GROUP BY 1
        ),
        land_trend AS (
            SELECT (record.created_at AT TIME ZONE 'UTC')::DATE::TEXT AS label, count(*) AS value
            FROM selected_records record
            GROUP BY 1
        ),
        document_status AS (
            SELECT coalesce(document.processing_status, 'Unspecified') AS label, count(*) AS value
            FROM documents document GROUP BY 1
        ),
        document_type AS (
            SELECT coalesce(document.document_type, 'Unspecified') AS label, count(*) AS value
            FROM documents document GROUP BY 1
        ),
        document_verification AS (
            SELECT coalesce(document.verification_status, 'Unspecified') AS label, count(*) AS value
            FROM documents document GROUP BY 1
        ),
        document_trend AS (
            SELECT (document.created_at AT TIME ZONE 'UTC')::DATE::TEXT AS label, count(*) AS value
            FROM documents document GROUP BY 1
        ),
        verification_status AS (
            SELECT coalesce(task.status, 'Unspecified') AS label, count(*) AS value
            FROM verification_tasks task GROUP BY 1
        ),
        verification_workload AS (
            SELECT coalesce(task.assigned_to::TEXT, 'Unspecified') AS label, count(*) AS value
            FROM verification_tasks task GROUP BY 1
        ),
        verification_district AS (
            SELECT coalesce(district.name, record.district_id::TEXT, 'Unspecified') AS label,
                   count(*) AS value,
                   max(task.created_at) AS first_seen
            FROM verification_tasks task
            LEFT JOIN selected_records record ON record.id = task.land_record_id
            LEFT JOIN public.districts district ON district.id = record.district_id AND district.is_active = TRUE
            GROUP BY 1
        ),
        verification_trend AS (
            SELECT (task.created_at AT TIME ZONE 'UTC')::DATE::TEXT AS label, count(*) AS value
            FROM verification_tasks task GROUP BY 1
        ),
        duplicate_status AS (
            SELECT coalesce(candidate.status, 'Unspecified') AS label, count(*) AS value
            FROM duplicate_candidates candidate GROUP BY 1
        ),
        duplicate_similarity AS (
            SELECT CASE
                       WHEN percentage >= 80 THEN '>= 80%'
                       WHEN percentage >= 60 THEN '60-79%'
                       WHEN percentage >= 40 THEN '40-59%'
                       WHEN percentage > 0 THEN '1-39%'
                       ELSE '0%'
                   END AS label,
                   count(*) AS value,
                   max(candidate.created_at) AS first_seen
            FROM (
                SELECT candidate.created_at,
                       CASE WHEN coalesce(candidate.similarity_score, 0) <= 1
                            THEN coalesce(candidate.similarity_score, 0) * 100
                            ELSE candidate.similarity_score
                       END AS percentage
                FROM duplicate_candidates candidate
            ) candidate
            GROUP BY 1
        ),
        duplicate_trend AS (
            SELECT (candidate.created_at AT TIME ZONE 'UTC')::DATE::TEXT AS label, count(*) AS value
            FROM duplicate_candidates candidate GROUP BY 1
        ),
        risk_level AS (
            SELECT coalesce(assessment.risk_level, 'Unspecified') AS label, count(*) AS value
            FROM risk_assessments assessment GROUP BY 1
        ),
        risk_status AS (
            SELECT coalesce(assessment.status, 'Unspecified') AS label, count(*) AS value
            FROM risk_assessments assessment GROUP BY 1
        ),
        risk_signal_type AS (
            SELECT coalesce(signal.signal_type, 'Unspecified') AS label, count(*) AS value
            FROM public.risk_signals signal
            JOIN risk_assessments assessment ON assessment.id = signal.risk_assessment_id
            GROUP BY 1
        ),
        risk_district AS (
            SELECT coalesce(district.name, record.district_id::TEXT, 'Unspecified') AS label,
                   count(*) AS value,
                   max(assessment.calculated_at) AS first_seen
            FROM risk_assessments assessment
            LEFT JOIN selected_records record ON record.id = assessment.land_record_id
            LEFT JOIN public.districts district ON district.id = record.district_id AND district.is_active = TRUE
            GROUP BY 1
        ),
        risk_trend AS (
            SELECT (assessment.calculated_at AT TIME ZONE 'UTC')::DATE::TEXT AS label, count(*) AS value
            FROM risk_assessments assessment GROUP BY 1
        ),
        alert_status AS (
            SELECT coalesce(alert.status, 'Unspecified') AS label, count(*) AS value
            FROM alerts alert GROUP BY 1
        ),
        alert_priority AS (
            SELECT coalesce(alert.priority, 'Unspecified') AS label, count(*) AS value
            FROM alerts alert GROUP BY 1
        ),
        alert_district AS (
            SELECT coalesce(district.name, record.district_id::TEXT, 'Unspecified') AS label,
                   count(*) AS value,
                   max(alert.created_at) AS first_seen
            FROM alerts alert
            LEFT JOIN selected_records record ON record.id = alert.land_record_id
            LEFT JOIN public.districts district ON district.id = record.district_id AND district.is_active = TRUE
            GROUP BY 1
        ),
        alert_trend AS (
            SELECT (alert.created_at AT TIME ZONE 'UTC')::DATE::TEXT AS label, count(*) AS value
            FROM alerts alert GROUP BY 1
        )
        SELECT jsonb_build_object(
            'summary', jsonb_build_object(
                'totalLandRecords', (SELECT count(*) FROM selected_records),
                'activeRecords', (SELECT count(*) FROM selected_records WHERE record_status = 'ACTIVE'),
                'pendingRecords', (SELECT count(*) FROM selected_records WHERE verification_status = 'PENDING'),
                'approvedRecords', (SELECT count(*) FROM selected_records WHERE verification_status = 'APPROVED'),
                'rejectedRecords', (SELECT count(*) FROM selected_records WHERE verification_status = 'REJECTED'),
                'totalDocuments', (SELECT count(*) FROM documents),
                'pendingDocuments', (SELECT count(*) FROM documents WHERE processing_status = 'PENDING'),
                'totalVerificationTasks', (SELECT count(*) FROM verification_tasks),
                'pendingVerificationTasks', (SELECT count(*) FROM verification_tasks WHERE status IN ('QUEUED', 'ASSIGNED')),
                'totalDuplicateCandidates', (SELECT count(*) FROM duplicate_candidates),
                'totalRiskAssessments', (SELECT count(*) FROM risk_assessments),
                'totalAlerts', (SELECT count(*) FROM alerts),
                'activeAlerts', (SELECT count(*) FROM alerts WHERE status IS DISTINCT FROM 'RESOLVED')
            ),
            'landRecords', jsonb_build_object(
                'total', (SELECT count(*) FROM selected_records),
                'byStatus', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label COLLATE "C") FROM land_status), '[]'::JSONB),
                'byLandType', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label COLLATE "C") FROM land_type), '[]'::JSONB),
                'byDistrict', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label COLLATE "C") FROM land_district), '[]'::JSONB),
                'byTaluk', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label COLLATE "C") FROM land_taluk), '[]'::JSONB),
                'byVillage', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label COLLATE "C") FROM land_village), '[]'::JSONB),
                'totalLandArea', coalesce((SELECT sum(coalesce(land_area, 0)) FROM selected_records), 0),
                'landAreaByDistrict', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, first_seen DESC) FROM land_area_district), '[]'::JSONB),
                'trends', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY label) FROM land_trend), '[]'::JSONB)
            ),
            'documents', jsonb_build_object(
                'total', (SELECT count(*) FROM documents),
                'byStatus', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label COLLATE "C") FROM document_status), '[]'::JSONB),
                'byType', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label COLLATE "C") FROM document_type), '[]'::JSONB),
                'byVerificationStatus', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label COLLATE "C") FROM document_verification), '[]'::JSONB),
                'trends', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY label) FROM document_trend), '[]'::JSONB)
            ),
            'verification', jsonb_build_object(
                'total', (SELECT count(*) FROM verification_tasks),
                'byStatus', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label COLLATE "C") FROM verification_status), '[]'::JSONB),
                'workloadByAssigned', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label COLLATE "C") FROM verification_workload), '[]'::JSONB),
                'trends', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY label) FROM verification_trend), '[]'::JSONB)
            ),
            'duplicates', jsonb_build_object(
                'total', (SELECT count(*) FROM duplicate_candidates),
                'byStatus', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label COLLATE "C") FROM duplicate_status), '[]'::JSONB),
                'similarityDistribution', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, first_seen DESC) FROM duplicate_similarity), '[]'::JSONB),
                'trends', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY label) FROM duplicate_trend), '[]'::JSONB)
            ),
            'risk', jsonb_build_object(
                'total', (SELECT count(*) FROM risk_assessments),
                'byRiskLevel', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label COLLATE "C") FROM risk_level), '[]'::JSONB),
                'byStatus', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label COLLATE "C") FROM risk_status), '[]'::JSONB),
                'bySignalType', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label COLLATE "C") FROM risk_signal_type), '[]'::JSONB),
                'trends', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY label) FROM risk_trend), '[]'::JSONB)
            ),
            'monitoring', jsonb_build_object(
                'total', (SELECT count(*) FROM alerts),
                'byStatus', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label COLLATE "C") FROM alert_status), '[]'::JSONB),
                'byPriority', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label COLLATE "C") FROM alert_priority), '[]'::JSONB),
                'trends', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY label) FROM alert_trend), '[]'::JSONB)
            ),
            'geography', jsonb_build_object(
                'recordsByDistrict', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label COLLATE "C") FROM land_district), '[]'::JSONB),
                'recordsByTaluk', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label COLLATE "C") FROM land_taluk), '[]'::JSONB),
                'recordsByVillage', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label COLLATE "C") FROM land_village), '[]'::JSONB),
                'verificationByDistrict', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, first_seen DESC) FROM verification_district), '[]'::JSONB),
                'riskByDistrict', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, first_seen DESC) FROM risk_district), '[]'::JSONB),
                'alertsByDistrict', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, first_seen DESC) FROM alert_district), '[]'::JSONB)
            ),
            'trends', jsonb_build_object(
                'recordsCreated', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY label) FROM land_trend), '[]'::JSONB),
                'documentsUploaded', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY label) FROM document_trend), '[]'::JSONB),
                'verificationActivity', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY label) FROM verification_trend), '[]'::JSONB),
                'alertsCreated', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY label) FROM alert_trend), '[]'::JSONB),
                'riskAssessments', coalesce((SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY label) FROM risk_trend), '[]'::JSONB)
            )
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_analytics_dashboard_data(
    UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DATE
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_analytics_dashboard_data(
    UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DATE
) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_verification_tasks_created
    ON public.verification_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_duplicate_candidates_created
    ON public.duplicate_candidates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_calculated
    ON public.risk_assessments(calculated_at DESC);
