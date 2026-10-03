CREATE OR REPLACE FUNCTION public.get_gis_land_record_summary(
    p_state_id UUID DEFAULT NULL,
    p_district_id UUID DEFAULT NULL,
    p_taluk_id UUID DEFAULT NULL,
    p_village_id UUID DEFAULT NULL,
    p_verification_status TEXT DEFAULT NULL,
    p_record_status TEXT DEFAULT NULL,
    p_land_type TEXT DEFAULT NULL,
    p_search TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
SET row_security = on
AS $$
BEGIN
    IF NOT public.has_permission('land_record:read') THEN
        RAISE EXCEPTION 'You do not have permission to view land record summaries.'
            USING ERRCODE = '42501';
    END IF;

    RETURN (
        WITH filtered_records AS MATERIALIZED (
            SELECT record.land_area,
                   record.land_area_unit,
                   record.verification_status,
                   record.record_status,
                   record.land_type
            FROM public.land_records record
            WHERE (p_state_id IS NULL OR record.state_id = p_state_id)
              AND (p_district_id IS NULL OR record.district_id = p_district_id)
              AND (p_taluk_id IS NULL OR record.taluk_id = p_taluk_id)
              AND (p_village_id IS NULL OR record.village_id = p_village_id)
              AND (p_verification_status IS NULL OR record.verification_status = p_verification_status)
              AND (p_record_status IS NULL OR record.record_status = p_record_status)
              AND (p_land_type IS NULL OR record.land_type ILIKE p_land_type)
              AND (
                  p_search IS NULL
                  OR strpos(lower(record.survey_number), lower(p_search)) > 0
                  OR strpos(lower(record.patta_number), lower(p_search)) > 0
                  OR strpos(lower(record.record_number), lower(p_search)) > 0
              )
        )
        SELECT jsonb_build_object(
            'totalRecords', (SELECT count(*) FROM filtered_records),
            'totalAreaByUnit', coalesce((
                SELECT jsonb_object_agg(areas.unit, areas.total_area)
                FROM (
                    SELECT coalesce(land_area_unit, 'Unspecified unit') AS unit,
                           sum(land_area) AS total_area
                    FROM filtered_records
                    WHERE land_area IS NOT NULL
                    GROUP BY coalesce(land_area_unit, 'Unspecified unit')
                ) areas
            ), '{}'::JSONB),
            'verificationStatuses', coalesce((
                SELECT jsonb_object_agg(statuses.status, statuses.total)
                FROM (
                    SELECT coalesce(verification_status, 'UNKNOWN') AS status, count(*) AS total
                    FROM filtered_records
                    GROUP BY coalesce(verification_status, 'UNKNOWN')
                ) statuses
            ), '{}'::JSONB),
            'recordStatuses', coalesce((
                SELECT jsonb_object_agg(statuses.status, statuses.total)
                FROM (
                    SELECT coalesce(record_status, 'UNKNOWN') AS status, count(*) AS total
                    FROM filtered_records
                    GROUP BY coalesce(record_status, 'UNKNOWN')
                ) statuses
            ), '{}'::JSONB),
            'landTypes', coalesce((
                SELECT jsonb_object_agg(types.land_type, types.total)
                FROM (
                    SELECT coalesce(land_type, 'Unspecified') AS land_type, count(*) AS total
                    FROM filtered_records
                    GROUP BY coalesce(land_type, 'Unspecified')
                ) types
            ), '{}'::JSONB)
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_gis_land_record_summary(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_gis_land_record_summary(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
