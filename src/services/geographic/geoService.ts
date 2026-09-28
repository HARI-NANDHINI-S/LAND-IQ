import { supabase } from '@/lib/supabase';
import { toAppError } from '@/utils/errorHandler';

export const geoService = {
  async getStates() {
    const { data, error } = await supabase.from('states').select('*').eq('is_active', true).order('name');
    if (error) throw toAppError(error);
    return data ?? [];
  },

  async getDistricts(stateId?: string) {
    let query = supabase.from('districts').select('*').eq('is_active', true).order('name');
    if (stateId) query = query.eq('state_id', stateId);
    const { data, error } = await query;
    if (error) throw toAppError(error);
    return data ?? [];
  },

  async getTaluks(districtId?: string) {
    let query = supabase.from('taluks').select('*').eq('is_active', true).order('name');
    if (districtId) query = query.eq('district_id', districtId);
    const { data, error } = await query;
    if (error) throw toAppError(error);
    return data ?? [];
  },

  async getVillages(talukId?: string) {
    let query = supabase.from('villages').select('*').eq('is_active', true).order('name');
    if (talukId) query = query.eq('taluk_id', talukId);
    const { data, error } = await query;
    if (error) throw toAppError(error);
    return data ?? [];
  },
};
