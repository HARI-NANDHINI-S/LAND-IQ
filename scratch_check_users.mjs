import { createClient } from '@supabase/supabase-js';

const url = "https://pmzipqjkzctsubrjlajj.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtemlwcWpremN0c3VicmpsYWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1Njc4OTAsImV4cCI6MjEwNjE0Mzg5MH0.I37MNs_lpbodQPRH3GiiJ3OXyEENcWM-gFhlFshRyG4";

const supabase = createClient(url, key);

async function main() {
  const { data: profiles, error } = await supabase.from('profiles').select('id, full_name, email, is_active, roles(name)');
  console.log('Profiles:', JSON.stringify(profiles, null, 2), 'Error:', error);
}

main();
