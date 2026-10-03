import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { toAppError } from '@/utils/errorHandler';

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
  async getOpenDuplicateCandidates(pageSize = 8) {
    const { data, error, count } = await supabase
      .from('duplicate_candidates')
      .select(
        'id, status, similarity_score, created_at, record_a_id, record_b_id, record_a:land_records!record_a_id(record_number), record_b:land_records!record_b_id(record_number)',
        { count: 'exact' }
      )
      .in('status', ['PENDING', 'UNDER_REVIEW'])
      .order('created_at', { ascending: false })
      .range(0, pageSize - 1);
    if (error) throw toAppError(error);
    return { data: data ?? [], total: count ?? 0 };
  },

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
      total: term ? filtered.length : (count ?? filtered.length),
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
    const [total, pending, underReview, confirmed, notDuplicate] = await Promise.all([
      supabase.from('duplicate_candidates').select('id', { count: 'exact', head: true }),
      supabase.from('duplicate_candidates').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
      supabase.from('duplicate_candidates').select('id', { count: 'exact', head: true }).eq('status', 'UNDER_REVIEW'),
      supabase.from('duplicate_candidates').select('id', { count: 'exact', head: true }).eq('status', 'CONFIRMED'),
      supabase.from('duplicate_candidates').select('id', { count: 'exact', head: true }).eq('status', 'FALSE_POSITIVE'),
    ]);
    const error = [total.error, pending.error, underReview.error, confirmed.error, notDuplicate.error].find(Boolean);
    if (error) throw toAppError(error);

    return {
      total: total.count ?? 0,
      pending: pending.count ?? 0,
      underReview: underReview.count ?? 0,
      confirmed: confirmed.count ?? 0,
      notDuplicate: notDuplicate.count ?? 0,
    };
  },

  async scanDuplicateCandidates(): Promise<number> {
    const { data, error } = await supabase.rpc('scan_duplicate_candidates');
    if (error) throw toAppError(error);
    return data ?? 0;
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

  async startReview(candidateId: string, notes?: string) {
    return this.updateCandidateStatus(candidateId, 'UNDER_REVIEW', notes);
  },

  async confirmDuplicate(candidateId: string, notes?: string) {
    return this.updateCandidateStatus(candidateId, 'CONFIRMED', notes);
  },

  async markNotDuplicate(candidateId: string, notes?: string) {
    return this.updateCandidateStatus(candidateId, 'FALSE_POSITIVE', notes);
  },

  async updateCandidateStatus(
    candidateId: string,
    status: DuplicateCandidate['status'],
    notes?: string
  ) {
    if (!VALID_DUPLICATE_STATUSES.has(status)) {
      throw new Error(`Unsupported duplicate status: ${status}`);
    }

    const { data, error } = await supabase.rpc('update_duplicate_candidate_status', {
      p_candidate_id: candidateId,
      p_status: status,
      p_notes: notes ?? null,
    });
    if (error) throw toAppError(error);
    return data as DuplicateCandidate;
  },
};
