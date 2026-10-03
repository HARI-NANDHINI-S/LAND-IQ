import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { toAppError } from '@/utils/errorHandler';

export type VerificationTask = Database['public']['Tables']['verification_tasks']['Row'];

export interface VerificationTaskFilters {
  status?: string;
  priority?: string;
  assigned_to?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

const VALID_TASK_STATUSES = new Set(['QUEUED', 'ASSIGNED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CORRECTION_REQUIRED']);

export const verificationService = {
  async getPendingVerificationTasks(pageSize = 8) {
    const { data, error, count } = await supabase
      .from('verification_tasks')
      .select('id, status, priority, created_at, land_record_id, land_records(id, record_number, survey_number)', { count: 'exact' })
      .in('status', ['QUEUED', 'ASSIGNED'])
      .order('created_at', { ascending: false })
      .range(0, pageSize - 1);
    if (error) throw toAppError(error);
    return { data: data ?? [], total: count ?? 0 };
  },

  async getVerificationTasks(filters: VerificationTaskFilters = {}) {
    const { status, priority, assigned_to, search, page = 1, pageSize = 10 } = filters;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('verification_tasks')
      .select(
        '*, documents(id, original_filename, document_type, processing_status, verification_status, land_record_id, land_records(id, record_number, survey_number, patta_number, land_area, land_type, record_status, verification_status, districts(name), taluks(name), villages(name)), profiles!uploaded_by(full_name)), land_records(id, record_number, survey_number, patta_number, land_area, land_type, record_status, verification_status, districts(name), taluks(name), villages(name)), profiles!assigned_to(full_name)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    if (assigned_to) query = query.eq('assigned_to', assigned_to);

    const { data, error, count } = await query;
    if (error) throw toAppError(error);

    const normalized = (data ?? []) as any[];
    const term = (search ?? '').trim().toLowerCase();
    const filtered = term
      ? normalized.filter((task) => {
          const recordNumber = task.land_records?.record_number ?? '';
          const surveyNumber = task.land_records?.survey_number ?? '';
          const docName = task.documents?.original_filename ?? '';
          return [recordNumber, surveyNumber, docName].some((value) => value.toLowerCase().includes(term));
        })
      : normalized;

    return {
      data: filtered,
      total: term ? filtered.length : (count ?? filtered.length),
    };
  },

  async getVerificationTask(taskId: string) {
    const { data, error } = await supabase
      .from('verification_tasks')
      .select(
        `*,
        documents(
          *,
          land_records(
            *,
            districts(name),
            taluks(name),
            villages(name),
            land_record_owners(*, land_owners(*))
          ),
          profiles!uploaded_by(full_name),
          extracted_fields(*, profiles!verified_by(full_name))
        ),
        land_records(
          *,
          districts(name),
          taluks(name),
          villages(name),
          land_record_owners(*, land_owners(*))
        ),
        profiles!assigned_to(full_name),
        verification_actions(*, profiles!actor_id(full_name))`
      )
      .eq('id', taskId)
      .single();

    if (error) throw toAppError(error);
    return data as any;
  },

  async getVerificationStats() {
    const [total, pending, inReview, approved, rejected] = await Promise.all([
      supabase.from('verification_tasks').select('id', { count: 'exact', head: true }),
      supabase.from('verification_tasks').select('id', { count: 'exact', head: true }).in('status', ['QUEUED', 'ASSIGNED']),
      supabase.from('verification_tasks').select('id', { count: 'exact', head: true }).eq('status', 'UNDER_REVIEW'),
      supabase.from('verification_tasks').select('id', { count: 'exact', head: true }).eq('status', 'APPROVED'),
      supabase.from('verification_tasks').select('id', { count: 'exact', head: true }).eq('status', 'REJECTED'),
    ]);
    const error = [total.error, pending.error, inReview.error, approved.error, rejected.error].find(Boolean);
    if (error) throw toAppError(error);

    return {
      total: total.count ?? 0,
      pending: pending.count ?? 0,
      inReview: inReview.count ?? 0,
      approved: approved.count ?? 0,
      rejected: rejected.count ?? 0,
    };
  },

  async updateTaskStatus(
    taskId: string,
    status: string,
    comment?: string
  ) {
    if (!VALID_TASK_STATUSES.has(status)) {
      throw new Error(`Unsupported verification status: ${status}`);
    }

    const { data, error } = await supabase.rpc('update_verification_task_status', {
      p_task_id: taskId,
      p_status: status,
      p_comment: comment ?? null,
    });
    if (error) throw toAppError(error);
    return data as VerificationTask;
  },
};
