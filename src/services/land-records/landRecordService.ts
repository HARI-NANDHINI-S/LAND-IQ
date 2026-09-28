import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { toAppError } from '@/utils/errorHandler';

export type LandRecord = Database['public']['Tables']['land_records']['Row'];

export interface LandRecordFilters {
  district_id?: string;
  taluk_id?: string;
  village_id?: string;
  verification_status?: string;
  record_status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export const landRecordService = {
  async getLandRecords(filters: LandRecordFilters = {}) {
    const { page = 1, pageSize = 20, search, ...rest } = filters;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('land_records')
      .select('*, states(name), districts(name), taluks(name), villages(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (rest.district_id) query = query.eq('district_id', rest.district_id);
    if (rest.taluk_id) query = query.eq('taluk_id', rest.taluk_id);
    if (rest.village_id) query = query.eq('village_id', rest.village_id);
    if (rest.verification_status) query = query.eq('verification_status', rest.verification_status);
    if (rest.record_status) query = query.eq('record_status', rest.record_status);
    if (search) {
      query = query.or('survey_number.ilike.%' + search + '%,patta_number.ilike.%' + search + '%,record_number.ilike.%' + search + '%');
    }

    const { data, error, count } = await query;
    if (error) throw toAppError(error);
    return { data: (data ?? []) as LandRecord[], total: count ?? 0 };
  },

  async getLandRecord(id: string) {
    const { data, error } = await supabase
      .from('land_records')
      .select('*, states(name,code), districts(name,code), taluks(name,code), villages(name,code), land_record_owners(*, land_owners(*)), documents(id,document_type,original_filename,processing_status,verification_status,created_at), risk_assessments(*, risk_signals(*)), verification_tasks(id,status,priority,assigned_to,created_at)')
      .eq('id', id)
      .single();
    if (error) throw toAppError(error);
    return data;
  },

  async createLandRecord(record: Database['public']['Tables']['land_records']['Insert']) {
    const { data, error } = await supabase
      .from('land_records')
      .insert(record as any)
      .select()
      .single();
    if (error) throw toAppError(error);
    return data as LandRecord;
  },

  async updateLandRecord(id: string, updates: Database['public']['Tables']['land_records']['Update']) {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from('land_records')
      .update(payload as any)
      .eq('id', id)
      .select()
      .single();
    if (error) throw toAppError(error);
    return data as LandRecord;
  },
};
