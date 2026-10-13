import { createClient } from '@supabase/supabase-js';

const url = "https://pmzipqjkzctsubrjlajj.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtemlwcWpremN0c3VicmpsYWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1Njc4OTAsImV4cCI6MjEwNjE0Mzg5MH0.I37MNs_lpbodQPRH3GiiJ3OXyEENcWM-gFhlFshRyG4";

const supabase = createClient(url, key);

const passwords = ['Admin@123456', 'Admin@123', 'admin123', 'password', 'password123', 'LandIQ@2026', 'LandIQ@123'];
const emails = ['admin@landiq.local', 'admin@tn.gov.in', 'superadmin@tn.gov.in', 'officer@tn.gov.in'];

async function testLogins() {
  for (const email of emails) {
    for (const password of passwords) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error && data.user) {
        console.log(`SUCCESS! Email: ${email}, Password: ${password}`);
        return;
      }
    }
  }
  console.log('No default login worked. Testing signup for admin@landiq.local...');
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: 'admin@landiq.local',
    password: 'AdminPassword123!',
    options: {
      data: {
        full_name: 'Super Admin',
      }
    }
  });
  console.log('SignUp Result:', signUpData, signUpError);
}

testLogins();
