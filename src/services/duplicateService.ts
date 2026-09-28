import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { toAppError } from '@/utils/errorHandler';
import { auditService } from '@/services/audit/auditService';

export type DuplicateCandidate = Database['public']['Tables']['duplicate_candidates']['Row'];

export interface DuplicateCandidateFilters {
  status?: string;
  minSimilarity?: number;
  search?: string;
  page?: number;
  pageSize?: number;
}

const VALID_DUPLICATE_STATUSES = new Set([
  'PENDING',
  'UNDER_REVIEW',
  'CONFIRMED',
  'FALSE_POSITIVE',
  'LEGITIMATE_SUBDIVISION',
  'DISPUTED',
]);

export const duplicateService = {
  async getDuplicateCandidates(filters: DuplicateCandidateFilters = {}) {
    const { status, minSimilarity, search, page = 1, pageSize = 10 } = filters;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('duplicate_candidates')
      .select(
        `*,
        record_a:land_records!record_a_id(*, states(name), districts(name), taluks(name), villages(name), land_record_owners(*, land_owners(*))),
        record_b:land_records!record_b_id(*, states(name), districts(name), taluks(name), villages(name), land_record_owners(*, land_owners(*))),
        profiles!reviewed_by(full_name)`,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) query = query.eq('status', status);
    if (typeof minSimilarity === 'number') query = query.gte('similarity_score', minSimilarity);

    const { data, error, count } = await query;
    if (error) throw toAppError(error);

    const normalized = (data ?? []) as any[];
    const term = (search ?? '').trim().toLowerCase();
    const filtered = term
      ? normalized.filter((candidate) => {
          const recordA = candidate.record_a ?? {};
          const recordB = candidate.record_b ?? {};
          const aText = [recordA.record_number, recordA.survey_number, recordA.patta_number].filter(Boolean).join(' ');
          const bText = [recordB.record_number, recordB.survey_number, recordB.patta_number].filter(Boolean).join(' ');
          return `${aText} ${bText}`.toLowerCase().includes(term);
        })
      : normalized;

    return {
      data: filtered,
      total: filtered.length || (count ?? 0),
    };
  },

  async getDuplicateCandidate(candidateId: string) {
    const { data, error } = await supabase
      .from('duplicate_candidates')
      .select(
        `*,
        record_a:land_records!record_a_id(*, states(name), districts(name), taluks(name), villages(name), land_record_owners(*, land_owners(*))),
        record_b:land_records!record_b_id(*, states(name), districts(name), taluks(name), villages(name), land_record_owners(*, land_owners(*))),
        profiles!reviewed_by(full_name)`
      )
      .eq('id', candidateId)
      .single();

    if (error) throw toAppError(error);
    return data as any;
  },

  async getDuplicateCandidateHistory(candidateId: string) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*, profiles!actor_id(full_name)')
      .eq('entity_type', 'duplicate_candidates')
      .eq('entity_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(25);

    if (error) throw toAppError(error);
    return (data ?? []) as any[];
  },

  async getDuplicateStats() {
    const { data, error } = await supabase.from('duplicate_candidates').select('status');
    if (error) throw toAppError(error);

    const stats = {
      pending: 0,
      underReview: 0,
      confirmed: 0,
      notDuplicate: 0,
      total: (data ?? []).length,
    };

    for (const row of data ?? []) {
      switch (row.status) {
        case 'PENDING':
          stats.pending += 1;
          break;
        case 'UNDER_REVIEW':
          stats.underReview += 1;
          break;
        case 'CONFIRMED':
          stats.confirmed += 1;
          break;
        case 'FALSE_POSITIVE':
          stats.notDuplicate += 1;
          break;
        default:
          break;
      }
    }

    return stats;
  },

  async getCandidateDocuments(recordId: string) {
    const { data, error } = await supabase
      .from('documents')
      .select('*, profiles!uploaded_by(full_name)')
      .eq('land_record_id', recordId)
      .order('created_at', { ascending: false });

    if (error) throw toAppError(error);
    return (data ?? []) as any[];
  },

  async startReview(candidateId: string, actorId: string, actorRole: string, notes?: string) {
    return this.updateCandidateStatus(candidateId, 'UNDER_REVIEW', actorId, actorRole, notes);
  },

  async confirmDuplicate(candidateId: string, actorId: string, actorRole: string, notes?: string) {
    return this.updateCandidateStatus(candidateId, 'CONFIRMED', actorId, actorRole, notes);
  },

  async markNotDuplicate(candidateId: string, actorId: string, actorRole: string, notes?: string) {
    return this.updateCandidateStatus(candidateId, 'FALSE_POSITIVE', actorId, actorRole, notes);
  },

  async updateCandidateStatus(
    candidateId: string,
    status: DuplicateCandidate['status'],
    actorId: string,
    actorRole: string,
    notes?: string
  ) {
    if (!VALID_DUPLICATE_STATUSES.has(status)) {
      throw new Error(`Unsupported duplicate status: ${status}`);
    }

    const { data: existingCandidate, error: fetchError } = await supabase
      .from('duplicate_candidates')
      .select('status, resolution_notes')
      .eq('id', candidateId)
      .single();

    if (fetchError || !existingCandidate) {
      throw toAppError(fetchError ?? new Error('Duplicate candidate not found'));
    }

    const payload = {
      status,
      reviewed_by: actorId,
      reviewed_at: new Date().toISOString(),
      resolution_notes: notes ?? existingCandidate.resolution_notes ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('duplicate_candidates')
      .update(payload as any)
      .eq('id', candidateId)
      .select()
      .single();

    if (error) throw toAppError(error);

    await auditService.log({
      actor_id: actorId,
      actor_role: actorRole,
      action: `duplicate_candidate_${status.toLowerCase()}`,
      entity_type: 'duplicate_candidates',
      entity_id: candidateId,
      before_state: { status: existingCandidate.status },
      after_state: { status },
      metadata: { resolution_notes: notes ?? null },
    });

    return data as DuplicateCandidate;
  },
};
