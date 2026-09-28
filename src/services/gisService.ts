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

const SUMMARY_BATCH_SIZE = 1000;

function filteredRecordsQuery(filters: GISFilters) {
  let query = supabase
    .from('land_records')
    .select('land_area, land_area_unit, verification_status, record_status, land_type')
    .order('id');

  if (filters.state_id) query = query.eq('state_id', filters.state_id);
  if (filters.district_id) query = query.eq('district_id', filters.district_id);
  if (filters.taluk_id) query = query.eq('taluk_id', filters.taluk_id);
  if (filters.village_id) query = query.eq('village_id', filters.village_id);
  if (filters.land_type?.trim()) query = query.ilike('land_type', filters.land_type.trim());
  if (filters.verification_status) query = query.eq('verification_status', filters.verification_status);
  if (filters.record_status) query = query.eq('record_status', filters.record_status);
  if (filters.search?.trim()) {
    const term = filters.search.trim().replace(/[%_]/g, '\\$&');
    query = query.or(`survey_number.ilike.%${term}%,patta_number.ilike.%${term}%,record_number.ilike.%${term}%`);
  }
  return query;
}

export const gisService = {
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
    const summary: GISSummary = {
      totalRecords: 0,
      totalAreaByUnit: {},
      verificationStatuses: {},
      recordStatuses: {},
      landTypes: {},
    };

    for (let offset = 0; ; offset += SUMMARY_BATCH_SIZE) {
      const { data, error } = await filteredRecordsQuery(filters).range(offset, offset + SUMMARY_BATCH_SIZE - 1);
      if (error) throw toAppError(error);
      const rows = data ?? [];
      summary.totalRecords += rows.length;

      for (const row of rows) {
        const verificationStatus = row.verification_status || 'UNKNOWN';
        const recordStatus = row.record_status || 'UNKNOWN';
        const landType = row.land_type || 'Unspecified';
        summary.verificationStatuses[verificationStatus] = (summary.verificationStatuses[verificationStatus] ?? 0) + 1;
        summary.recordStatuses[recordStatus] = (summary.recordStatuses[recordStatus] ?? 0) + 1;
        summary.landTypes[landType] = (summary.landTypes[landType] ?? 0) + 1;

        if (row.land_area != null) {
          const unit = row.land_area_unit || 'Unspecified unit';
          summary.totalAreaByUnit[unit] = (summary.totalAreaByUnit[unit] ?? 0) + Number(row.land_area);
        }
      }

      if (rows.length < SUMMARY_BATCH_SIZE) break;
    }

    return summary;
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