import { createContext } from 'react';
import type { AuthLoadingPhase } from '@/services/auth/authService';
import type { AuthUser } from '@/types';

export interface AuthContextValue {
  user: AuthUser | null;
  phase: AuthLoadingPhase;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
