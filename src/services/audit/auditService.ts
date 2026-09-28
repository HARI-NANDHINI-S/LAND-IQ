import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { toAppError } from '@/utils/errorHandler';

export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];

export const auditService = {
  async log(entry: Database['public']['Tables']['audit_logs']['Insert']) {
    const { error } = await supabase.from('audit_logs').insert(entry as any);
    if (error) {
      console.error('[Audit] Failed to write audit log:', error.message);
    }
  },

  async getAuditLogs(filters: { entity_type?: string; entity_id?: string; actor_id?: string; limit?: number } = {}) {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(filters.limit ?? 100);

    if (filters.entity_type) query = query.eq('entity_type', filters.entity_type);
    if (filters.entity_id) query = query.eq('entity_id', filters.entity_id);
    if (filters.actor_id) query = query.eq('actor_id', filters.actor_id);

    const { data, error } = await query;
    if (error) throw toAppError(error);
    return (data ?? []) as AuditLog[];
  },
};
