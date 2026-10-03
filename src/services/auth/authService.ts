import { supabase } from '@/lib/supabase';
import type { AuthUser } from '@/types';
import { toAppError, type AppError } from '@/utils/errorHandler';

let currentUserLoad: { userId: string; promise: Promise<AuthUser | null> } | null = null;

export type AuthLoadingPhase =
  | 'authenticating'
  | 'loading_profile'
  | 'loading_role'
  | 'loading_permissions'
  | 'ready'
  | 'unauthenticated'
  | 'error';

function loadCurrentUserForSession(
  userId: string,
  onPhase: (phase: AuthLoadingPhase) => void,
) {
  if (currentUserLoad?.userId === userId) return currentUserLoad.promise;

  const promise = authService.getCurrentUser(onPhase)
    .then((user) => user?.id === userId ? user : null)
    .finally(() => {
      if (currentUserLoad?.promise === promise) currentUserLoad = null;
    });

  currentUserLoad = { userId, promise };
  return promise;
}

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

  async getCurrentUser(onPhase?: (phase: AuthLoadingPhase) => void): Promise<AuthUser | null> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw toAppError(userError);
    if (!user) return null;

    onPhase?.('loading_profile');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*, roles(*)')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw new Error(profileError.code === '42501'
        ? 'You do not have permission to load your account profile.'
        : 'Unable to load your account profile. Try again or contact an administrator.');
    }
    if (!profile) throw new Error('Your account profile could not be loaded. Contact an administrator.');
    if (!profile.is_active) throw new Error('This account is inactive. Contact an administrator.');

    onPhase?.('loading_role');
    const role = (profile as Record<string, any>).roles;
    if (!role) throw new Error('Your account does not have an active role. Contact an administrator.');
    
    onPhase?.('loading_permissions');
    const { data: rolePerms, error: permissionsError } = await supabase
      .from('role_permissions')
      .select('permissions(code)')
      .eq('role_id', (profile as Record<string, any>).role_id ?? '');
    if (permissionsError) {
      throw new Error(permissionsError.code === '42501'
        ? 'You do not have permission to load your account permissions.'
        : 'Unable to load account permissions. Try again or contact an administrator.');
    }

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

  onAuthStateChange(callback: (
    user: AuthUser | null,
    error?: AppError | Error,
    sessionUserId?: string | null,
    event?: string,
    phase?: AuthLoadingPhase,
  ) => void) {
    let latestSessionUserId: string | null = null;

    return supabase.auth.onAuthStateChange((_event, session) => {
      latestSessionUserId = session?.user.id ?? null;
      const sessionUserId = latestSessionUserId;

      if (!sessionUserId) {
        callback(null, undefined, null, _event, 'unauthenticated');
        return;
      }

      callback(null, undefined, sessionUserId, _event, 'loading_profile');
      queueMicrotask(() => {
        const updatePhase = (phase: AuthLoadingPhase) => {
          if (latestSessionUserId === sessionUserId) callback(null, undefined, sessionUserId, _event, phase);
        };
        void loadCurrentUserForSession(sessionUserId, updatePhase)
          .then((user) => {
            if (latestSessionUserId === sessionUserId) callback(user, undefined, sessionUserId, _event, user ? 'ready' : 'unauthenticated');
          })
          .catch((error: unknown) => {
            if (latestSessionUserId === sessionUserId) callback(null, toAppError(error), sessionUserId, _event, 'error');
          });
      });
    });
  },
};
