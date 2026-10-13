import { createClient } from '@supabase/supabase-js';

const url = "https://pmzipqjkzctsubrjlajj.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtemlwcWpremN0c3VicmpsYWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1Njc4OTAsImV4cCI6MjEwNjE0Mzg5MH0.I37MNs_lpbodQPRH3GiiJ3OXyEENcWM-gFhlFshRyG4";

const supabase = createClient(url, key);

async function testBootstrap() {
  const email = 'admin@landiq.local';
  const password = 'AdminPassword123!';

  // Try signing in
  console.log('Attempting sign in...');
  let { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  
  if (authError) {
    console.log('SignIn Error:', authError);
  } else {
    console.log('SignIn Successful! User:', authData.user.id);
    // Call bootstrap RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc('bootstrap_initial_super_admin');
    console.log('Bootstrap RPC result:', { rpcData, rpcError });
  }
}

testBootstrap();
