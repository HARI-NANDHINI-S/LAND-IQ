import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { toAppError } from '@/utils/errorHandler';

export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];
export type AuditLogInsert = Database['public']['Tables']['audit_logs']['Insert'];

export interface AuditFilters {
  search?: string;
  action?: string;
  entity_type?: string;
  status?: string;
  actor_id?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export const auditService = {
  async log(entry: Omit<AuditLogInsert, 'id' | 'created_at'>) {
    try {
      const { error } = await supabase.from('audit_logs').insert({
        ...entry,
        status: entry.status || 'SUCCESS',
      } as AuditLogInsert);
      
      if (error) {
        console.error('[Audit] Failed to write audit log:', error.message);
      }
    } catch (err) {
      console.error('[Audit] Exception writing audit log:', err);
    }
  },

  async getAuditLogs(filters: AuditFilters = {}) {
    const { page = 1, pageSize = 50 } = filters;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('audit_logs')
      .select('*, profiles!actor_id(full_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filters.action) query = query.eq('action', filters.action);
    if (filters.entity_type) query = query.eq('entity_type', filters.entity_type);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.actor_id) query = query.eq('actor_id', filters.actor_id);
    if (filters.startDate) query = query.gte('created_at', filters.startDate);
    if (filters.endDate) query = query.lte('created_at', filters.endDate);

    // Apply pagination
    query = query.range(from, to);

    const { data, error, count } = await query;
    
    if (error) throw toAppError(error);

    const normalized = (data ?? []) as any[];

    // In-memory search fallback for text fields not easily searchable via PostgREST
    const term = (filters.search ?? '').trim().toLowerCase();
    const filtered = term
      ? normalized.filter((log) => {
          const action = log.action ?? '';
          const entity = log.entity_type ?? '';
          const actorName = log.profiles?.full_name ?? '';
          const remarks = log.remarks ?? '';
          
          return [action, entity, actorName, remarks].some((value) => 
            value.toLowerCase().includes(term)
          );
        })
      : normalized;

    return {
      data: filtered,
      total: count ?? 0,
    };
  },

  async getAuditLog(id: string) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*, profiles!actor_id(full_name, email)')
      .eq('id', id)
      .single();

    if (error) throw toAppError(error);
    return data as any;
  },

  async exportAuditLogs(filters: AuditFilters = {}) {
    // Similar to getAuditLogs but without pagination (or with high limit)
    let query = supabase
      .from('audit_logs')
      .select('*, profiles!actor_id(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(10000); // Reasonable limit for CSV export

    if (filters.action) query = query.eq('action', filters.action);
    if (filters.entity_type) query = query.eq('entity_type', filters.entity_type);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.actor_id) query = query.eq('actor_id', filters.actor_id);
    if (filters.startDate) query = query.gte('created_at', filters.startDate);
    if (filters.endDate) query = query.lte('created_at', filters.endDate);

    const { data, error } = await query;
    if (error) throw toAppError(error);

    return (data ?? []) as any[];
  }
};
