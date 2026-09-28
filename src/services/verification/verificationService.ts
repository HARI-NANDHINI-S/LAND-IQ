import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { toAppError } from '@/utils/errorHandler';
import { auditService } from '@/services/audit/auditService';

export type VerificationTask = Database['public']['Tables']['verification_tasks']['Row'];

export const verificationService = {
  async getVerificationTasks(filters: { status?: string; assigned_to?: string } = {}) {
    let query = supabase
      .from('verification_tasks')
      .select('*, documents(id,original_filename,document_type), land_records(id,record_number,survey_number), profiles!assigned_to(full_name)')
      .order('created_at', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to);

    const { data, error } = await query;
    if (error) throw toAppError(error);
    return (data ?? []) as any[];
  },

  async updateTaskStatus(
    taskId: string,
    status: string,
    actorId: string,
    actorRole: string,
    comment?: string
  ) {
    const { data: existing } = await supabase
      .from('verification_tasks')
      .select('status')
      .eq('id', taskId)
      .single();

    const updatePayload: Record<string, string> = { status, updated_at: new Date().toISOString() };
    if (status === 'APPROVED' || status === 'REJECTED') {
      updatePayload.completed_at = new Date().toISOString();
    }
    if (status === 'UNDER_REVIEW') {
      updatePayload.started_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('verification_tasks')
      .update(updatePayload as any)
      .eq('id', taskId)
      .select()
      .single();
    if (error) throw toAppError(error);

    await supabase.from('verification_actions').insert({
      verification_task_id: taskId,
      actor_id: actorId,
      action: status,
      comment,
    } as any);

    await auditService.log({
      actor_id: actorId,
      actor_role: actorRole,
      action: 'verification_task_' + status.toLowerCase(),
      entity_type: 'verification_tasks',
      entity_id: taskId,
      before_state: existing ? { status: (existing as any).status } : null,
      after_state: { status },
    });

    return data as VerificationTask;
  },
};
