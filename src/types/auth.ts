import type { Database } from './database';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Role = Database['public']['Tables']['roles']['Row'];
export type Permission = Database['public']['Tables']['permissions']['Row'];

export interface AuthUser {
  id: string;
  email: string;
  profile: Profile;
  role: Role;
  permissions: string[];
}

export type UserRole = 'SUPER_ADMIN' | 'STATE_ADMIN' | 'DISTRICT_OFFICER' | 'DATA_ENTRY_OFFICER' | 'VERIFICATION_OFFICER' | 'VIEWER';
