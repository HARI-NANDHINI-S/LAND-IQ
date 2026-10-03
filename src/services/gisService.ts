import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { landRecordService, type LandRecordFilters } from '@/services/land-records/landRecordService';
import { toAppError } from '@/utils/errorHandler';

export interface GISFilters extends LandRecordFilters {
  state_id?: string;
  land_type?: string;
}

export interface GISSummary {
  totalRecords: number;
  totalAreaByUnit: Record<string, number>;
  verificationStatuses: Record<string, number>;
  recordStatuses: Record<string, number>;
  landTypes: Record<string, number>;
}

export interface GeographyHierarchy {
  states: Array<Pick<Database['public']['Tables']['states']['Row'], 'id' | 'name' | 'code'>>;
  districts: Array<Pick<Database['public']['Tables']['districts']['Row'], 'id' | 'state_id' | 'name' | 'code'>>;
  taluks: Array<Pick<Database['public']['Tables']['taluks']['Row'], 'id' | 'district_id' | 'name' | 'code'>>;
  villages: Array<Pick<Database['public']['Tables']['villages']['Row'], 'id' | 'taluk_id' | 'name' | 'code'>>;
}

export interface SpatialBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface SpatialLandRecord {
  id: string;
  record_number: string;
  survey_number: string;
  verification_status: string;
  record_status: string;
  risk_level: string | null;
  has_duplicate: boolean;
  is_watched: boolean;
  geometry_geojson: Record<string, unknown> | null;
  latitude: number | null;
  longitude: number | null;
}

export interface NearbyLandRecord {
  id: string;
  record_number: string;
  survey_number: string;
  distance_meters: number;
  geometry_geojson: Record<string, unknown> | null;
}

const SUMMARY_BATCH_SIZE = 1000;

export const gisService = {
  async getSpatialExtent(): Promise<SpatialBounds | null> {
    const { data, error } = await supabase.rpc('get_spatial_land_record_extent');
    if (error) throw toAppError(error);
    const extent = data?.[0];
    if (!extent) return null;
    return {
      west: extent.west,
      south: extent.south,
      east: extent.east,
      north: extent.north,
    };
  },

  async getSpatialLandRecords(bounds: SpatialBounds, filters: GISFilters = {}): Promise<SpatialLandRecord[]> {
    const { data, error } = await supabase.rpc('get_spatial_land_records', {
      p_west: bounds.west,
      p_south: bounds.south,
      p_east: bounds.east,
      p_north: bounds.north,
      p_state_id: filters.state_id ?? null,
      p_district_id: filters.district_id ?? null,
      p_taluk_id: filters.taluk_id ?? null,
      p_village_id: filters.village_id ?? null,
      p_land_type: filters.land_type ?? null,
      p_verification_status: filters.verification_status ?? null,
      p_record_status: filters.record_status ?? null,
      p_search: filters.search?.trim() || null,
      p_limit: 250,
    });
    if (error) throw toAppError(error);
    return (data ?? []) as unknown as SpatialLandRecord[];
  },

  async getNearbyLandRecords(latitude: number, longitude: number, radiusMeters = 1000): Promise<NearbyLandRecord[]> {
    const { data, error } = await supabase.rpc('get_nearby_land_records', {
      p_latitude: latitude,
      p_longitude: longitude,
      p_radius_meters: radiusMeters,
      p_limit: 100,
    });
    if (error) throw toAppError(error);
    return (data ?? []) as unknown as NearbyLandRecord[];
  },

  async importParcelGeoJSON(featureCollection: unknown): Promise<number> {
    const { data, error } = await supabase.rpc('import_land_record_geojson', {
      p_feature_collection: featureCollection,
    });
    if (error) throw toAppError(error);
    return data ?? 0;
  },

  async getMapLandRecords(filters: GISFilters = {}) {
    return landRecordService.getLandRecords(filters);
  },

  async getGeographyHierarchy(filters: { state_id?: string; district_id?: string; taluk_id?: string } = {}): Promise<GeographyHierarchy> {
    const { data: states, error: statesError } = await supabase
      .from('states').select('id, name, code').eq('is_active', true).order('name');
    if (statesError) throw toAppError(statesError);

    let districtQuery = supabase.from('districts').select('id, state_id, name, code').eq('is_active', true).order('name');
    if (filters.state_id) districtQuery = districtQuery.eq('state_id', filters.state_id);
    const { data: districts, error: districtsError } = await districtQuery;
    if (districtsError) throw toAppError(districtsError);

    const districtIds = filters.district_id
      ? [filters.district_id]
      : (districts ?? []).map((district) => district.id);
    let taluks: Array<{ id: string; district_id: string; name: string; code: string }> = [];
    if (districtIds.length) {
      const { data, error } = await supabase
        .from('taluks').select('id, district_id, name, code').eq('is_active', true).in('district_id', districtIds).order('name');
      if (error) throw toAppError(error);
      taluks = data ?? [];
    }

    const talukIds = filters.taluk_id ? [filters.taluk_id] : taluks.map((taluk) => taluk.id);
    let villages: Array<{ id: string; taluk_id: string; name: string; code: string }> = [];
    if (talukIds.length) {
      const { data, error } = await supabase
        .from('villages').select('id, taluk_id, name, code').eq('is_active', true).in('taluk_id', talukIds).order('name');
      if (error) throw toAppError(error);
      villages = data ?? [];
    }

    return {
      states: states ?? [],
      districts: districts ?? [],
      taluks,
      villages,
    };
  },

  async getLandTypeOptions() {
    const types = new Set<string>();
    for (let offset = 0; ; offset += SUMMARY_BATCH_SIZE) {
      const { data, error } = await supabase
        .from('land_records')
        .select('land_type')
        .order('id')
        .range(offset, offset + SUMMARY_BATCH_SIZE - 1);
      if (error) throw toAppError(error);
      const rows = data ?? [];
      for (const row of rows) {
        if (row.land_type?.trim()) types.add(row.land_type.trim());
      }
      if (rows.length < SUMMARY_BATCH_SIZE) break;
    }
    return [...types].sort((left, right) => left.localeCompare(right));
  },

  async getSummary(filters: GISFilters = {}): Promise<GISSummary> {
    const { data, error } = await supabase.rpc('get_gis_land_record_summary', {
      p_state_id: filters.state_id ?? null,
      p_district_id: filters.district_id ?? null,
      p_taluk_id: filters.taluk_id ?? null,
      p_village_id: filters.village_id ?? null,
      p_verification_status: filters.verification_status ?? null,
      p_record_status: filters.record_status ?? null,
      p_land_type: filters.land_type?.trim() || null,
      p_search: filters.search?.trim() || null,
    });
    if (error) throw toAppError(error);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('GIS summary aggregation returned an invalid response.');
    }

    const result = data as Record<string, unknown>;
    const readCounts = (value: unknown): Record<string, number> => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('GIS summary aggregation returned invalid grouped counts.');
      }
      const counts = Object.entries(value).map(([key, count]) => {
        if (typeof count !== 'number' || !Number.isFinite(count)) {
          throw new Error('GIS summary aggregation returned a non-numeric count.');
        }
        return [key, count] as const;
      });
      return Object.fromEntries(counts);
    };

    if (typeof result.totalRecords !== 'number' || !Number.isFinite(result.totalRecords)) {
      throw new Error('GIS summary aggregation returned an invalid total.');
    }

    return {
      totalRecords: result.totalRecords,
      totalAreaByUnit: readCounts(result.totalAreaByUnit),
      verificationStatuses: readCounts(result.verificationStatuses),
      recordStatuses: readCounts(result.recordStatuses),
      landTypes: readCounts(result.landTypes),
    };
  },

  async getRecordContext(landRecordId: string) {
    const [riskAssessments, documents, verificationTasks, duplicateCandidates] = await Promise.all([
      supabase.from('risk_assessments').select('id, risk_level, status, calculated_at').eq('land_record_id', landRecordId).order('calculated_at', { ascending: false }),
      supabase.from('documents').select('id, original_filename, document_type, verification_status, created_at').eq('land_record_id', landRecordId).order('created_at', { ascending: false }),
      supabase.from('verification_tasks').select('id, status, priority, created_at').eq('land_record_id', landRecordId).order('created_at', { ascending: false }),
      supabase.from('duplicate_candidates').select('id, record_a_id, record_b_id, status, similarity_score').or(`record_a_id.eq.${landRecordId},record_b_id.eq.${landRecordId}`).order('created_at', { ascending: false }),
    ]);

    const error = [riskAssessments.error, documents.error, verificationTasks.error, duplicateCandidates.error].find(Boolean);
    if (error) throw toAppError(error);

    return {
      riskAssessments: riskAssessments.data ?? [],
      documents: documents.data ?? [],
      verificationTasks: verificationTasks.data ?? [],
      duplicateCandidates: duplicateCandidates.data ?? [],
    };
  },
};