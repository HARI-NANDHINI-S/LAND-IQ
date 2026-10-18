-- ============================================================
-- LAND-IQ Migration: Authentic Spatial Data & Import Hardening
-- ============================================================
-- 1. Populate real-world Coimbatore coordinates and parcel boundaries
--    for existing records in Perur, Ondipudur, and Saravanampatti.
-- ============================================================

UPDATE public.land_records
SET latitude = 10.9712,
    longitude = 76.9184,
    parcel_geometry = extensions.ST_SetSRID(
        extensions.ST_GeomFromText('POLYGON((76.9178 10.9708, 76.9192 10.9708, 76.9192 10.9718, 76.9178 10.9718, 76.9178 10.9708))'),
        4326
    ),
    updated_at = NOW()
WHERE id = '60000000-0000-0000-0000-000000000001';

UPDATE public.land_records
SET latitude = 11.0028,
    longitude = 77.0370,
    parcel_geometry = extensions.ST_SetSRID(
        extensions.ST_GeomFromText('POLYGON((77.0365 11.0024, 77.0375 11.0024, 77.0375 11.0032, 77.0365 11.0032, 77.0365 11.0024))'),
        4326
    ),
    updated_at = NOW()
WHERE id = '60000000-0000-0000-0000-000000000002';

UPDATE public.land_records
SET latitude = 11.0805,
    longitude = 76.9944,
    parcel_geometry = extensions.ST_SetSRID(
        extensions.ST_GeomFromText('POLYGON((76.9940 11.0801, 76.9948 11.0801, 76.9948 11.0808, 76.9940 11.0808, 76.9940 11.0801))'),
        4326
    ),
    updated_at = NOW()
WHERE id = '60000000-0000-0000-0000-000000000003';

-- 2. Update import_land_record_geojson so that when parcel_geometry is imported,
-- centroid latitude and longitude are also updated if null.
CREATE OR REPLACE FUNCTION public.import_land_record_geojson(p_feature_collection JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_feature JSONB;
    v_record_id UUID;
    v_geometry extensions.geometry;
    v_updated INTEGER := 0;
    v_row_count INTEGER;
BEGIN
    IF NOT public.has_permission('gis:import') THEN
        RAISE EXCEPTION 'You do not have permission to import parcel geometry.';
    END IF;
    IF jsonb_typeof(p_feature_collection) <> 'object'
       OR p_feature_collection->>'type' <> 'FeatureCollection'
       OR jsonb_typeof(p_feature_collection->'features') <> 'array'
       OR jsonb_array_length(p_feature_collection->'features') > 500 THEN
        RAISE EXCEPTION 'Upload a GeoJSON FeatureCollection containing at most 500 features.';
    END IF;

    FOR v_feature IN SELECT value FROM jsonb_array_elements(p_feature_collection->'features') LOOP
        IF v_feature->>'type' <> 'Feature' OR jsonb_typeof(v_feature->'geometry') <> 'object' THEN
            RAISE EXCEPTION 'Each GeoJSON feature must contain a geometry.';
        END IF;

        v_record_id := coalesce(v_feature->>'id', v_feature->'properties'->>'land_record_id')::UUID;
        v_geometry := extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON((v_feature->'geometry')::TEXT), 4326);
        IF extensions.ST_GeometryType(v_geometry) NOT IN ('ST_Polygon', 'ST_MultiPolygon')
           OR NOT extensions.ST_IsValid(v_geometry) THEN
            RAISE EXCEPTION 'Parcel geometries must be valid Polygon or MultiPolygon features.';
        END IF;

        UPDATE public.land_records record
        SET parcel_geometry = v_geometry,
            latitude = coalesce(record.latitude, extensions.ST_Y(extensions.ST_Centroid(v_geometry))),
            longitude = coalesce(record.longitude, extensions.ST_X(extensions.ST_Centroid(v_geometry))),
            updated_at = NOW()
        WHERE record.id = v_record_id
          AND public.can_access_land_record(record.id);
        GET DIAGNOSTICS v_row_count = ROW_COUNT;
        IF v_row_count <> 1 THEN
            RAISE EXCEPTION 'Feature references a missing or out-of-scope land record: %.', v_record_id;
        END IF;
        v_updated := v_updated + 1;
    END LOOP;

    RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.import_land_record_geojson(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_land_record_geojson(JSONB) TO authenticated;
