import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { toAppError } from '@/utils/errorHandler';

export type RecordChange = Database['public']['Tables']['record_changes']['Row'];
export type Alert = Database['public']['Tables']['alerts']['Row'];

export const monitoringService = {
  async getRecordChanges(filters: { land_record_id?: string; priority?: string; limit?: number } = {}) {
    let query = supabase
      .from('record_changes')
      .select('*, land_records(id,record_number,survey_number)')
      .order('changed_at', { ascending: false })
      .limit(filters.limit ?? 50);

    if (filters.land_record_id) query = query.eq('land_record_id', filters.land_record_id);
    if (filters.priority) query = query.eq('change_priority', filters.priority);

    const { data, error } = await query;
    if (error) throw toAppError(error);
    return (data ?? []) as any[];
  },

  async getAlerts(filters: { status?: string; priority?: string; assigned_to?: string } = {}) {
    let query = supabase
      .from('alerts')
      .select('*, land_records(id,record_number,survey_number)')
      .order('created_at', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.priority) query = query.eq('priority', filters.priority);
    if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to);

    const { data, error } = await query;
    if (error) throw toAppError(error);
    return (data ?? []) as Alert[];
  },

  async acknowledgeAlert(alertId: string) {
    const { error } = await supabase
      .from('alerts')
      .update({ status: 'ACKNOWLEDGED', acknowledged_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any)
      .eq('id', alertId);
    if (error) throw toAppError(error);
  },
};
