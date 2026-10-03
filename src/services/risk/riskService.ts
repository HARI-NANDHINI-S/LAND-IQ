import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { toAppError } from '@/utils/errorHandler';

export type RiskAssessment = Database['public']['Tables']['risk_assessments']['Row'];
export type RiskSignal = Database['public']['Tables']['risk_signals']['Row'];

export interface RiskAssessmentFilters {
  risk_level?: string;
  status?: string;
  district_id?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

const VALID_RISK_STATUS = new Set(['ACTIVE', 'UNDER_REVIEW', 'RESOLVED', 'REOPENED']);

export const riskService = {
  async getHighRiskAssessments(pageSize = 8) {
    const { data, error, count } = await supabase
      .from('risk_assessments')
      .select(
        'id, risk_level, status, land_record_id, land_records(id, record_number, districts(name))',
        { count: 'exact' }
      )
      .in('risk_level', ['HIGH', 'CRITICAL'])
      .order('calculated_at', { ascending: false })
      .range(0, pageSize - 1);
    if (error) throw toAppError(error);
    return { data: data ?? [], total: count ?? 0 };
  },

  async getRiskAssessments(filters: RiskAssessmentFilters = {}) {
    const { risk_level, status, district_id, search, page = 1, pageSize = 10 } = filters;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('risk_assessments')
      .select(
        `*,
        risk_signals(*),
        land_records(
          *,
          districts(name),
          taluks(name),
          villages(name),
          land_record_owners(*, land_owners(*))
        ),
        verification_tasks(id, status, priority, created_at, assigned_to, profiles!assigned_to(full_name))`,
        { count: 'exact' }
      )
      .order('calculated_at', { ascending: false })
      .range(from, to);

    if (risk_level) query = query.eq('risk_level', risk_level);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw toAppError(error);

    const normalized = (data ?? []) as any[];
    const term = (search ?? '').trim().toLowerCase();
    const filtered = term
      ? normalized.filter((assessment) => {
          const record = assessment.land_records ?? {};
          const text = [
            record.record_number,
            record.survey_number,
            record.patta_number,
            record.districts?.name,
            record.taluks?.name,
            record.villages?.name,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return text.includes(term);
        })
      : normalized;

    const scoped = district_id
      ? filtered.filter((assessment) => assessment.land_records?.district_id === district_id)
      : filtered;

    return {
      data: scoped,
      total: term || district_id ? scoped.length : (count ?? scoped.length),
    };
  },

  async getRiskAssessment(assessmentId: string) {
    const { data, error } = await supabase
      .from('risk_assessments')
      .select(
        `*,
        risk_signals(*),
        assigned_officer:profiles!assigned_to(full_name, email),
        land_records(
          *,
          states(name),
          districts(name),
          taluks(name),
          villages(name),
          land_record_owners(*, land_owners(*)),
          documents(*),
          verification_tasks(*, profiles!assigned_to(full_name))
        ),
        duplicate_candidates(
          *,
          record_a:land_records!record_a_id(id, record_number, survey_number, patta_number, districts(name), taluks(name), villages(name)),
          record_b:land_records!record_b_id(id, record_number, survey_number, patta_number, districts(name), taluks(name), villages(name))
        )`
      )
      .eq('id', assessmentId)
      .single();

    if (error) throw toAppError(error);
    return data as any;
  },

  async getRiskStats() {
    const [total, highRisk, moderateRisk, lowRisk, underInvestigation, resolved, activeSignals] = await Promise.all([
      supabase.from('risk_assessments').select('id', { count: 'exact', head: true }),
      supabase.from('risk_assessments').select('id', { count: 'exact', head: true }).in('risk_level', ['HIGH', 'CRITICAL']),
      supabase.from('risk_assessments').select('id', { count: 'exact', head: true }).eq('risk_level', 'MODERATE'),
      supabase.from('risk_assessments').select('id', { count: 'exact', head: true }).eq('risk_level', 'LOW'),
      supabase.from('risk_assessments').select('id', { count: 'exact', head: true }).eq('status', 'UNDER_REVIEW'),
      supabase.from('risk_assessments').select('id', { count: 'exact', head: true }).eq('status', 'RESOLVED'),
      supabase.from('risk_signals').select('id', { count: 'exact', head: true }),
    ]);
    const error = [total.error, highRisk.error, moderateRisk.error, lowRisk.error, underInvestigation.error, resolved.error, activeSignals.error].find(Boolean);
    if (error) throw toAppError(error);

    return {
      total: total.count ?? 0,
      highRisk: highRisk.count ?? 0,
      moderateRisk: moderateRisk.count ?? 0,
      lowRisk: lowRisk.count ?? 0,
      underInvestigation: underInvestigation.count ?? 0,
      resolved: resolved.count ?? 0,
      activeSignals: activeSignals.count ?? 0,
    };
  },

  async recomputeRiskAssessment(landRecordId: string): Promise<string> {
    const { data, error } = await supabase.rpc('recompute_risk_assessment', {
      p_land_record_id: landRecordId,
    });
    if (error) throw toAppError(error);
    return data;
  },

  async updateRiskStatus(
    assessmentId: string,
    status: RiskAssessment['status'],
    notes?: string,
    assignedTo?: string | null
  ) {
    if (!VALID_RISK_STATUS.has(status ?? 'ACTIVE')) {
      throw new Error(`Unsupported risk status: ${status}`);
    }

    const { data, error } = await supabase.rpc('update_risk_assessment_status', {
      p_assessment_id: assessmentId,
      p_status: status ?? 'ACTIVE',
      p_notes: notes ?? null,
      p_assigned_to: assignedTo ?? null,
    });
    if (error) throw toAppError(error);
    return data as RiskAssessment;
  },
};
