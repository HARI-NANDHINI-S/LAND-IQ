import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { toAppError } from '@/utils/errorHandler';
import { auditService } from '@/services/audit/auditService';

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
      total: filtered.length || (count ?? 0),
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
    const { data, error } = await supabase
      .from('verification_tasks')
      .select('status');

    if (error) throw toAppError(error);

    const stats = {
      pending: 0,
      inReview: 0,
      approved: 0,
      rejected: 0,
      total: (data ?? []).length,
    };

    for (const row of data ?? []) {
      switch (row.status) {
        case 'QUEUED':
        case 'ASSIGNED':
          stats.pending += 1;
          break;
        case 'UNDER_REVIEW':
          stats.inReview += 1;
          break;
        case 'APPROVED':
          stats.approved += 1;
          break;
        case 'REJECTED':
          stats.rejected += 1;
          break;
        default:
          break;
      }
    }

    return stats;
  },

  async updateTaskStatus(
    taskId: string,
    status: string,
    actorId: string,
    actorRole: string,
    comment?: string
  ) {
    if (!VALID_TASK_STATUSES.has(status)) {
      throw new Error(`Unsupported verification status: ${status}`);
    }

    const { data: existingTask, error: existingError } = await supabase
      .from('verification_tasks')
      .select('status, started_at, completed_at, assigned_to')
      .eq('id', taskId)
      .single();

    if (existingError || !existingTask) {
      throw toAppError(existingError ?? new Error('Verification task not found'));
    }

    const updatePayload: Record<string, string | null> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'UNDER_REVIEW') {
      updatePayload.started_at = existingTask.started_at ?? new Date().toISOString();
    }
    if (status === 'APPROVED' || status === 'REJECTED') {
      updatePayload.completed_at = existingTask.completed_at ?? new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('verification_tasks')
      .update(updatePayload as any)
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw toAppError(error);

    const { error: actionError } = await supabase.from('verification_actions').insert({
      verification_task_id: taskId,
      actor_id: actorId,
      action: status,
      comment: comment ?? null,
    } as any);

    if (actionError) throw toAppError(actionError);

    await auditService.log({
      actor_id: actorId,
      actor_role: actorRole,
      action: `verification_task_${status.toLowerCase()}`,
      entity_type: 'verification_tasks',
      entity_id: taskId,
      before_state: { status: existingTask.status },
      after_state: { status },
      metadata: { comment: comment ?? null },
    });

    return data as VerificationTask;
  },
};
