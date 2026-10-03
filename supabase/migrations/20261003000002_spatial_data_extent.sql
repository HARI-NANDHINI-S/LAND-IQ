CREATE OR REPLACE FUNCTION public.get_spatial_land_record_extent()
RETURNS TABLE(west DOUBLE PRECISION, south DOUBLE PRECISION, east DOUBLE PRECISION, north DOUBLE PRECISION)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    IF NOT public.has_permission('land_record:read') THEN
        RAISE EXCEPTION 'You do not have permission to view land-record geography.';
    END IF;

    RETURN QUERY
    SELECT extensions.ST_XMin(bounds.extent),
           extensions.ST_YMin(bounds.extent),
           extensions.ST_XMax(bounds.extent),
           extensions.ST_YMax(bounds.extent)
    FROM (
        SELECT extensions.ST_3DExtent(coalesce(record.parcel_geometry, record.point_geometry)) AS extent
        FROM public.land_records record
        WHERE coalesce(record.parcel_geometry, record.point_geometry) IS NOT NULL
    ) bounds
    WHERE bounds.extent IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_spatial_land_record_extent() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_spatial_land_record_extent() TO authenticated;
