import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { toAppError } from '@/utils/errorHandler';
import { auditService } from '@/services/audit/auditService';

export type SettingRow = Database['public']['Tables']['settings']['Row'];

export const settingsService = {
  async getSettings() {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .order('key');
      
    if (error) throw toAppError(error);
    return data as SettingRow[];
  },

  async getPublicSettings() {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('is_public', true)
      .order('key');
      
    if (error) throw toAppError(error);
    return data as SettingRow[];
  },

  async updateSetting(key: string, value: any, actorId: string, actorRole: string) {
    const { data: beforeData } = await supabase.from('settings').select('*').eq('key', key).single();

    const payload = {
      value,
      updated_by: actorId,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('settings')
      .update(payload)
      .eq('key', key)
      .select('*')
      .single();
      
    if (error) throw toAppError(error);

    await auditService.log({
      actor_id: actorId,
      actor_role: actorRole,
      action: 'setting_updated',
      entity_type: 'settings',
      entity_id: key,
      before_state: beforeData,
      after_state: payload as any,
      status: 'SUCCESS',
    });

    return data as SettingRow;
  }
};
