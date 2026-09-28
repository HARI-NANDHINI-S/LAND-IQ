import { supabase } from '@/lib/supabase';
import type { AuthUser } from '@/types';
import { toAppError } from '@/utils/errorHandler';

export const authService = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw toAppError(error);
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw toAppError(error);
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw toAppError(error);
    return data.session;
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*, roles(*)')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) return null;

    const role = (profile as Record<string, any>).roles;
    
    const { data: rolePerms } = await supabase
      .from('role_permissions')
      .select('permissions(code)')
      .eq('role_id', (profile as Record<string, any>).role_id ?? '');

    const permissions = ((rolePerms ?? []) as Record<string, any>[])
      .flatMap((rp) => rp.permissions ? [rp.permissions.code as string] : []);

    return {
      id: user.id,
      email: user.email ?? '',
      profile: profile as any,
      role: role as any,
      permissions,
    };
  },

  onAuthStateChange(callback: (user: AuthUser | null) => void) {
    return supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const user = await authService.getCurrentUser();
        callback(user);
      } else {
        callback(null);
      }
    });
  },
};
