import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { toAppError } from '@/utils/errorHandler';

export type SettingRow = Database['public']['Tables']['settings']['Row'];

async function assertSettingsManageAccess() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw toAppError(authError);
  if (!authData.user) throw new Error('Sign in to manage platform settings.');

  const { data: canManage, error: permissionError } = await supabase.rpc('has_permission', {
    required_permission: 'settings:manage',
  });

  if (permissionError) throw toAppError(permissionError);
  if (!canManage) throw new Error('You do not have permission to manage platform settings.');

  return authData.user;
}

export const settingsService = {
  async getSettings() {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw toAppError(authError);
    if (!authData.user) throw new Error('Sign in to view platform settings.');

    const { data: canManage, error: permissionError } = await supabase.rpc('has_permission', {
      required_permission: 'settings:manage',
    });

    if (permissionError) throw toAppError(permissionError);

    const query = supabase
      .from('settings')
      .select('*')
      .order('key');

    const { data, error } = canManage
      ? await query
      : await query.eq('is_public', true);

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

  async updateSetting(key: string, value: unknown) {
    const user = await assertSettingsManageAccess();

    const payload = {
      value,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('settings')
      .update(payload)
      .eq('key', key)
      .select('*')
      .single();

    if (error) throw toAppError(error);
    return data as SettingRow;
  },
};
