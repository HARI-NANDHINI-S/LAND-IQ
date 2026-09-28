import { checkSupabaseConnectivity } from '@/lib/supabase';

export interface DiagnosticsResult {
  timestamp: string;
  supabase: {
    configured: boolean;
    authenticated: boolean;
    dbReachable: boolean;
    error?: string;
  };
  env: {
    hasUrl: boolean;
    hasAnonKey: boolean;
  };
}

export async function runDiagnostics(): Promise<DiagnosticsResult> {
  const connectivity = await checkSupabaseConnectivity();

  return {
    timestamp: new Date().toISOString(),
    supabase: connectivity,
    env: {
      hasUrl: Boolean(import.meta.env.VITE_SUPABASE_URL),
      hasAnonKey: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY),
    },
  };
}
