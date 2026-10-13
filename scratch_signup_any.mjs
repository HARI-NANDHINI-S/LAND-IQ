import { createClient } from '@supabase/supabase-js';

const url = "https://pmzipqjkzctsubrjlajj.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtemlwcWpremN0c3VicmpsYWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1Njc4OTAsImV4cCI6MjEwNjE0Mzg5MH0.I37MNs_lpbodQPRH3GiiJ3OXyEENcWM-gFhlFshRyG4";

const supabase = createClient(url, key);

async function test() {
  const email = `admin_${Date.now()}@tn.gov.in`;
  const password = `AdminPass123!`;
  console.log(`Signing up ${email}...`);
  const res = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: 'System Admin' }
    }
  });

  console.log('Result:', res);
}

test();
