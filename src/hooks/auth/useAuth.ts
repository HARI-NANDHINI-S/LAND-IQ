import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/auth/authService';
import type { AuthUser } from '@/types';

let activeAuthUserId: string | null | undefined;

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: { subscription } } = authService.onAuthStateChange((authUser, authError, sessionUserId, event) => {
      const identityChanged = Boolean(activeAuthUserId && sessionUserId && activeAuthUserId !== sessionUserId);
      const signedOut = event === 'SIGNED_OUT' && Boolean(activeAuthUserId);

      if ((event === 'SIGNED_IN' && identityChanged) || signedOut) {
        queryClient.clear();
      }

      if (event === 'SIGNED_OUT') {
        activeAuthUserId = null;
      } else if (sessionUserId) {
        activeAuthUserId = sessionUserId;
      }

      setUser(authUser);
      setError(authError?.message ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      await authService.signIn(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await authService.signOut();
      setUser(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign out failed.');
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permission: string) => user?.permissions.includes(permission) ?? false;

  return { user, loading, error, signIn, signOut, hasPermission };
}
