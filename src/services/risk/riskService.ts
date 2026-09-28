import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { toAppError } from '@/utils/errorHandler';

export type RiskAssessment = Database['public']['Tables']['risk_assessments']['Row'];
export type RiskSignal = Database['public']['Tables']['risk_signals']['Row'];

export const riskService = {
  async getRiskAssessments(filters: { risk_level?: string; district_id?: string } = {}) {
    let query = supabase
      .from('risk_assessments')
      .select(`
        *,
        risk_signals(*),
        land_records(id, record_number, survey_number, district_id, districts(name))
      `)
      .order('risk_score', { ascending: false });

    if (filters.risk_level) query = query.eq('risk_level', filters.risk_level);

    const { data, error } = await query;
    if (error) throw toAppError(error);

    if (filters.district_id) {
      return (data ?? []).filter((ra: any) => ra.land_records?.district_id === filters.district_id);
    }
    return data ?? [];
  },

  async getRiskAssessment(recordId: string) {
    const { data, error } = await supabase
      .from('risk_assessments')
      .select('*, risk_signals(*)')
      .eq('land_record_id', recordId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') throw toAppError(error);
    return data;
  },
};
