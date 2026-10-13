import { createClient } from '@supabase/supabase-js';

const url = "https://pmzipqjkzctsubrjlajj.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtemlwcWpremN0c3VicmpsYWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1Njc4OTAsImV4cCI6MjEwNjE0Mzg5MH0.I37MNs_lpbodQPRH3GiiJ3OXyEENcWM-gFhlFshRyG4";

const supabase = createClient(url, key);

async function testNewUser() {
  const email = `officer_${Date.now()}@tn.gov.in`;
  const password = 'Password@123';
  console.log(`Trying to signup new user: ${email}`);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: 'Test Officer',
      }
    }
  });

  console.log('Result:', JSON.stringify({ data, error }, null, 2));
}

testNewUser();
