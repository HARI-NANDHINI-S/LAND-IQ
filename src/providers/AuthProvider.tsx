import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authService, type AuthLoadingPhase } from '@/services/auth/authService';
import { AuthContext, type AuthContextValue } from '@/hooks/auth/authContext';
import type { AuthUser } from '@/types';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [phase, setPhase] = useState<AuthLoadingPhase>('authenticating');
  const [error, setError] = useState<string | null>(null);
  const previousUserId = useRef<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: { subscription } } = authService.onAuthStateChange(
      (authUser, authError, sessionUserId, event, nextPhase = 'ready') => {
        if (event === 'SIGNED_OUT') {
          if (previousUserId.current) queryClient.clear();
          previousUserId.current = null;
        } else if (sessionUserId) {
          if (previousUserId.current && previousUserId.current !== sessionUserId) {
            queryClient.clear();
          }
          previousUserId.current = sessionUserId;
        }

        setPhase(nextPhase);
        setError(authError?.message ?? null);
        if (nextPhase === 'ready' || nextPhase === 'unauthenticated' || nextPhase === 'error') {
          setUser(authUser);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const signIn = useCallback(async (email: string, password: string) => {
    setPhase('authenticating');
    setError(null);
    try {
      await authService.signIn(email, password);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign in failed.';
      setError(message);
      setPhase('unauthenticated');
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authService.signOut();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign out failed.');
    }
  }, []);

  const loading = !['ready', 'unauthenticated', 'error'].includes(phase);
  const value = useMemo<AuthContextValue>(() => ({
    user,
    phase,
    loading,
    error,
    signIn,
    signOut,
    hasPermission: (permission) => phase === 'ready' && (user?.permissions.includes(permission) ?? false),
  }), [user, phase, loading, error, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
