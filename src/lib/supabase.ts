import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || supabaseUrl === 'your_supabase_project_url_here') {
  console.error(
    '[BhoomiAI] Supabase environment variables are not configured. ' +
    'Please create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

// Using untyped client — service layer handles type safety
export const supabase = createClient(
  supabaseUrl ?? '',
  supabaseAnonKey ?? '',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);

export async function checkSupabaseConnectivity(): Promise<{
  configured: boolean;
  authenticated: boolean;
  dbReachable: boolean;
  error?: string;
}> {
  const configured = Boolean(supabaseUrl && supabaseUrl !== 'your_supabase_project_url_here');
  if (!configured) {
    return { configured: false, authenticated: false, dbReachable: false, error: 'Not configured' };
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const authenticated = Boolean(sessionData?.session);
  const { error: dbError } = await supabase.from('roles').select('id').limit(1);
  return { configured, authenticated, dbReachable: !dbError, error: dbError?.message };
}
