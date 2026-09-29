import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { Profile, Role } from '@/types/auth';
import { toAppError } from '@/utils/errorHandler';
import { auditService } from '@/services/audit/auditService';

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
type AdminProfileUpdate = Database['public']['Functions']['admin_update_profile_authorization']['Args'];

export interface ProfileDirectoryEntry extends Profile {
  role: Pick<Role, 'code' | 'name'> | null;
  state: { name: string } | null;
  district: { name: string } | null;
  village: { name: string } | null;
}

export interface ProfileDirectory {
  profiles: ProfileDirectoryEntry[];
  roles: Pick<Role, 'id' | 'code' | 'name'>[];
  states: Pick<Database['public']['Tables']['states']['Row'], 'id' | 'name'>[];
  districts: Pick<Database['public']['Tables']['districts']['Row'], 'id' | 'state_id' | 'name'>[];
  villages: (Pick<Database['public']['Tables']['villages']['Row'], 'id' | 'taluk_id' | 'name'> & {
    district_id: string;
    state_id: string;
  })[];
}

const profileColumns = 'id,full_name,email,phone,avatar_url,role_id,state_id,district_id,village_id,employee_code,designation,is_active,created_at,updated_at';

export const profileService = {
  async listDirectory(): Promise<ProfileDirectory> {
    const [profilesResult, rolesResult, statesResult, districtsResult, taluksResult, villagesResult] = await Promise.all([
      supabase.from('profiles').select(profileColumns).order('full_name'),
      supabase.from('roles').select('id,code,name').order('name'),
      supabase.from('states').select('id,name').eq('is_active', true).order('name'),
      supabase.from('districts').select('id,state_id,name').eq('is_active', true).order('name'),
      supabase.from('taluks').select('id,district_id').eq('is_active', true),
      supabase.from('villages').select('id,taluk_id,name').eq('is_active', true).order('name'),
    ]);

    const results = [profilesResult, rolesResult, statesResult, districtsResult, taluksResult, villagesResult];
    const failedResult = results.find((result) => result.error);
    if (failedResult?.error) throw toAppError(failedResult.error);

    const roles = rolesResult.data ?? [];
    const states = statesResult.data ?? [];
    const districts = districtsResult.data ?? [];
    const talukDistricts = new Map((taluksResult.data ?? []).map((taluk) => [taluk.id, taluk.district_id]));
    const districtStates = new Map(districts.map((district) => [district.id, district.state_id]));
    const roleById = new Map(roles.map((role) => [role.id, role]));
    const stateById = new Map(states.map((state) => [state.id, state]));
    const districtById = new Map(districts.map((district) => [district.id, district]));

    const villages = (villagesResult.data ?? []).flatMap((village) => {
      const districtId = talukDistricts.get(village.taluk_id);
      const stateId = districtId ? districtStates.get(districtId) : undefined;
      return districtId && stateId ? [{ ...village, district_id: districtId, state_id: stateId }] : [];
    });
    const villageById = new Map(villages.map((village) => [village.id, village]));
    const profiles = ((profilesResult.data ?? []) as unknown as Profile[]).map((profile) => {
      const role = roleById.get(profile.role_id ?? '');
      const state = stateById.get(profile.state_id ?? '');
      const district = districtById.get(profile.district_id ?? '');
      const village = villageById.get(profile.village_id ?? '');
      return {
        ...profile,
        role: role ? { code: role.code, name: role.name } : null,
        state: state ? { name: state.name } : null,
        district: district ? { name: district.name } : null,
        village: village ? { name: village.name } : null,
      };
    });

    return { profiles, roles, states, districts, villages };
  },

  async updateSafeFields(profileId: string, updates: ProfileUpdate, actorId?: string, actorRole?: string): Promise<Profile> {
    const { data: beforeData } = await supabase.from('profiles').select('*').eq('id', profileId).single();

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profileId)
      .select('*')
      .single();
    if (error) throw toAppError(error);

    if (actorId && actorRole) {
      await auditService.log({
        actor_id: actorId,
        actor_role: actorRole,
        action: 'profile_updated',
        entity_type: 'profiles',
        entity_id: profileId,
        before_state: beforeData,
        after_state: updates as any,
        status: 'SUCCESS',
      });
    }

    return data as Profile;
  },

  async updateAuthorization(args: AdminProfileUpdate, actorId?: string, actorRole?: string): Promise<Profile> {
    const { data: beforeData } = await supabase.from('profiles').select('*').eq('id', args.p_profile_id).single();

    const { data, error } = await supabase.rpc('admin_update_profile_authorization', args);
    if (error) throw toAppError(error);
    if (!data) throw new Error('The profile authorization update returned no profile.');

    if (actorId && actorRole) {
      await auditService.log({
        actor_id: actorId,
        actor_role: actorRole,
        action: 'profile_authorization_updated',
        entity_type: 'profiles',
        entity_id: args.p_profile_id,
        before_state: beforeData,
        after_state: { role_id: args.p_role_id, is_active: args.p_is_active, state_id: args.p_state_id, district_id: args.p_district_id, village_id: args.p_village_id },
        status: 'SUCCESS',
      });
    }

    return data as Profile;
  },
};