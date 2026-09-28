import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { toAppError } from '@/utils/errorHandler';
import { auditService } from '@/services/audit/auditService';

export type RecordChange = Database['public']['Tables']['record_changes']['Row'];
export type Alert = Database['public']['Tables']['alerts']['Row'];
export type AlertListItem = Alert & {
  land_records: { id: string; record_number: string; survey_number: string } | null;
};
export type WatchlistEntry = Database['public']['Tables']['watchlists']['Row'];

export interface AlertFilters {
  status?: string;
  priority?: string;
  alert_type?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface WatchlistFilters {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

const MANAGEMENT_ROLES = new Set(['SUPER_ADMIN', 'STATE_ADMIN', 'DISTRICT_OFFICER']);

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

  async getAlerts(filters: AlertFilters = {}) {
    const { page = 1, pageSize = 10, search, ...criteria } = filters;
    const from = (page - 1) * pageSize;

    let query = supabase
      .from('alerts')
      .select('*, land_records(id,record_number,survey_number)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (criteria.status) query = query.eq('status', criteria.status);
    if (criteria.priority) query = query.eq('priority', criteria.priority);
    if (criteria.alert_type) query = query.eq('alert_type', criteria.alert_type);
    if (search?.trim()) {
      const term = search.trim().replace(/[%_]/g, '\\$&');
      query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
    }

    const { data, error, count } = await query;
    if (error) throw toAppError(error);
    return { data: (data ?? []) as AlertListItem[], total: count ?? 0 };
  },

  async getAlertById(alertId: string) {
    const { data, error } = await supabase
      .from('alerts')
      .select('*, land_records(*, districts(name), taluks(name), villages(name))')
      .eq('id', alertId)
      .single();
    if (error) throw toAppError(error);
    return data as any;
  },

  async getAlertStats() {
    const [active, critical, unacknowledged, resolved] = await Promise.all([
      supabase.from('alerts').select('id', { count: 'exact', head: true }).in('status', ['NEW', 'ACKNOWLEDGED', 'UNDER_REVIEW', 'ESCALATED']),
      supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('priority', 'CRITICAL').neq('status', 'RESOLVED'),
      supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('status', 'NEW'),
      supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('status', 'RESOLVED'),
    ]);

    const resultErrors = [active.error, critical.error, unacknowledged.error, resolved.error];
    const error = resultErrors.find(Boolean);
    if (error) throw toAppError(error);

    return {
      active: active.count ?? 0,
      critical: critical.count ?? 0,
      unacknowledged: unacknowledged.count ?? 0,
      resolved: resolved.count ?? 0,
    };
  },

  async getAlertContext(alert: Pick<Alert, 'id' | 'land_record_id'>, includeAuditHistory = false) {
    const recordId = alert.land_record_id;
    const [riskAssessments, documents, verificationTasks, duplicateCandidates, changes, history] = await Promise.all([
      recordId
        ? supabase.from('risk_assessments').select('id, risk_level, status, calculated_at').eq('land_record_id', recordId).order('calculated_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      recordId
        ? supabase.from('documents').select('id, original_filename, document_type, processing_status, verification_status, created_at').eq('land_record_id', recordId).order('created_at', { ascending: false }).limit(20)
        : Promise.resolve({ data: [], error: null }),
      recordId
        ? supabase.from('verification_tasks').select('id, status, priority, created_at').eq('land_record_id', recordId).order('created_at', { ascending: false }).limit(20)
        : Promise.resolve({ data: [], error: null }),
      recordId
        ? supabase.from('duplicate_candidates').select('id, record_a_id, record_b_id, status, similarity_score, created_at').or(`record_a_id.eq.${recordId},record_b_id.eq.${recordId}`).order('created_at', { ascending: false }).limit(20)
        : Promise.resolve({ data: [], error: null }),
      recordId
        ? supabase.from('record_changes').select('*').eq('land_record_id', recordId).order('changed_at', { ascending: false }).limit(20)
        : Promise.resolve({ data: [], error: null }),
      includeAuditHistory
        ? supabase.from('audit_logs').select('*').eq('entity_type', 'alerts').eq('entity_id', alert.id).order('created_at', { ascending: false }).limit(20)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const contextErrors = [riskAssessments.error, documents.error, verificationTasks.error, duplicateCandidates.error, changes.error, history.error];
    const contextError = contextErrors.find(Boolean);
    if (contextError) throw toAppError(contextError);

    return {
      riskAssessments: riskAssessments.data ?? [],
      documents: documents.data ?? [],
      verificationTasks: verificationTasks.data ?? [],
      duplicateCandidates: duplicateCandidates.data ?? [],
      changes: changes.data ?? [],
      history: history.data ?? [],
    };
  },

  async acknowledgeAlert(alertId: string, actorId: string, actorRole: string) {
    if (!MANAGEMENT_ROLES.has(actorRole)) throw new Error('Your role cannot manage alerts.');
    const { data: current, error: currentError } = await supabase.from('alerts').select('status').eq('id', alertId).single();
    if (currentError) throw toAppError(currentError);
    if (current.status === 'RESOLVED') throw new Error('A resolved alert cannot be acknowledged.');

    const acknowledgedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from('alerts')
      .update({ status: 'ACKNOWLEDGED', acknowledged_at: acknowledgedAt, updated_at: acknowledgedAt } as any)
      .eq('id', alertId)
      .select()
      .single();
    if (error) throw toAppError(error);

    await auditService.log({
      actor_id: actorId,
      actor_role: actorRole,
      action: 'alert_acknowledged',
      entity_type: 'alerts',
      entity_id: alertId,
      before_state: { status: current.status },
      after_state: { status: data.status },
    });
    return data as Alert;
  },

  async resolveAlert(alertId: string, actorId: string, actorRole: string) {
    if (!MANAGEMENT_ROLES.has(actorRole)) throw new Error('Your role cannot manage alerts.');
    const { data: current, error: currentError } = await supabase.from('alerts').select('status').eq('id', alertId).single();
    if (currentError) throw toAppError(currentError);

    const resolvedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from('alerts')
      .update({ status: 'RESOLVED', resolved_at: resolvedAt, updated_at: resolvedAt } as any)
      .eq('id', alertId)
      .select()
      .single();
    if (error) throw toAppError(error);

    await auditService.log({
      actor_id: actorId,
      actor_role: actorRole,
      action: 'alert_resolved',
      entity_type: 'alerts',
      entity_id: alertId,
      before_state: { status: current.status },
      after_state: { status: data.status },
    });
    return data as Alert;
  },

  async getWatchlists(userId: string, filters: WatchlistFilters = {}) {
    const { page = 1, pageSize = 10, status, search } = filters;
    const from = (page - 1) * pageSize;
    let query = supabase
      .from('watchlists')
      .select('*, land_records(id, record_number, survey_number, patta_number, record_status, verification_status, districts(name), taluks(name), villages(name))', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (status) query = query.eq('status', status);
    if (search?.trim()) {
      const term = search.trim().replace(/[%_]/g, '\\$&');
      query = query.ilike('reason', `%${term}%`);
    }

    const { data, error, count } = await query;
    if (error) throw toAppError(error);
    return { data: (data ?? []) as any[], total: count ?? 0 };
  },

  async getWatchlistById(watchlistId: string) {
    const { data, error } = await supabase
      .from('watchlists')
      .select('*, land_records(*, states(name), districts(name), taluks(name), villages(name), land_record_owners(*, land_owners(*)))')
      .eq('id', watchlistId)
      .single();
    if (error) throw toAppError(error);
    return data as any;
  },

  async getWatchlistContext(landRecordId: string) {
    const [riskAssessments, documents, verificationTasks, duplicateCandidates] = await Promise.all([
      supabase.from('risk_assessments').select('id, risk_level, status, calculated_at').eq('land_record_id', landRecordId).order('calculated_at', { ascending: false }),
      supabase.from('documents').select('id, original_filename, document_type, verification_status, created_at').eq('land_record_id', landRecordId).order('created_at', { ascending: false }).limit(20),
      supabase.from('verification_tasks').select('id, status, priority, created_at').eq('land_record_id', landRecordId).order('created_at', { ascending: false }).limit(20),
      supabase.from('duplicate_candidates').select('id, record_a_id, record_b_id, status, similarity_score').or(`record_a_id.eq.${landRecordId},record_b_id.eq.${landRecordId}`).order('created_at', { ascending: false }).limit(20),
    ]);
    const contextError = [riskAssessments.error, documents.error, verificationTasks.error, duplicateCandidates.error].find(Boolean);
    if (contextError) throw toAppError(contextError);
    return {
      riskAssessments: riskAssessments.data ?? [],
      documents: documents.data ?? [],
      verificationTasks: verificationTasks.data ?? [],
      duplicateCandidates: duplicateCandidates.data ?? [],
    };
  },

  async createWatchlist(entry: Database['public']['Tables']['watchlists']['Insert'], actorRole: string) {
    if (!MANAGEMENT_ROLES.has(actorRole) && actorRole !== 'DATA_ENTRY_OFFICER' && actorRole !== 'VERIFICATION_OFFICER' && actorRole !== 'VIEWER') {
      throw new Error('Your role cannot manage watchlists.');
    }
    const { data, error } = await supabase.from('watchlists').insert(entry).select().single();
    if (error) throw toAppError(error);
    return data as WatchlistEntry;
  },

  async updateWatchlist(watchlistId: string, updates: Database['public']['Tables']['watchlists']['Update']) {
    const { data, error } = await supabase
      .from('watchlists')
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq('id', watchlistId)
      .select()
      .single();
    if (error) throw toAppError(error);
    return data as WatchlistEntry;
  },

  async deleteWatchlist(watchlistId: string) {
    const { data, error } = await supabase.from('watchlists').delete().eq('id', watchlistId).select().single();
    if (error) throw toAppError(error);
    return data as WatchlistEntry;
  },
};
