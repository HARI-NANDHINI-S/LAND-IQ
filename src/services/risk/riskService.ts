import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { toAppError } from '@/utils/errorHandler';
import { auditService } from '@/services/audit/auditService';

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
      total: scoped.length || (count ?? 0),
    };
  },

  async getRiskAssessment(assessmentId: string) {
    const { data, error } = await supabase
      .from('risk_assessments')
      .select(
        `*,
        risk_signals(*),
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
    const { data, error } = await supabase.from('risk_assessments').select('risk_level, status');
    if (error) throw toAppError(error);

    const stats = {
      total: (data ?? []).length,
      highRisk: 0,
      moderateRisk: 0,
      lowRisk: 0,
      underInvestigation: 0,
      resolved: 0,
      activeSignals: 0,
    };

    for (const row of data ?? []) {
      if (row.risk_level === 'HIGH' || row.risk_level === 'CRITICAL') stats.highRisk += 1;
      if (row.risk_level === 'MODERATE') stats.moderateRisk += 1;
      if (row.risk_level === 'LOW') stats.lowRisk += 1;
      if (row.status === 'UNDER_REVIEW') stats.underInvestigation += 1;
      if (row.status === 'RESOLVED') stats.resolved += 1;
    }

    const { data: signalRows, error: signalError } = await supabase.from('risk_signals').select('id');
    if (signalError) throw toAppError(signalError);
    stats.activeSignals = signalRows?.length ?? 0;

    return stats;
  },

  async updateRiskStatus(
    assessmentId: string,
    status: RiskAssessment['status'],
    actorId: string,
    actorRole: string,
    notes?: string
  ) {
    if (!VALID_RISK_STATUS.has(status ?? 'ACTIVE')) {
      throw new Error(`Unsupported risk status: ${status}`);
    }

    const { data: current, error: currentError } = await supabase
      .from('risk_assessments')
      .select('status, risk_level')
      .eq('id', assessmentId)
      .single();

    if (currentError || !current) {
      throw toAppError(currentError ?? new Error('Risk assessment not found'));
    }

    const { data, error } = await supabase
      .from('risk_assessments')
      .update({
        status,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', assessmentId)
      .select()
      .single();

    if (error) throw toAppError(error);

    await auditService.log({
      actor_id: actorId,
      actor_role: actorRole,
      action: `risk_assessment_${status?.toLowerCase() ?? 'updated'}`,
      entity_type: 'risk_assessments',
      entity_id: assessmentId,
      before_state: { status: current.status },
      after_state: { status },
      metadata: { notes: notes ?? null },
    });

    return data as RiskAssessment;
  },
};
