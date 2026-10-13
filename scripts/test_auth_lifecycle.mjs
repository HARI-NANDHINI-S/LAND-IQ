// LAND-IQ End-to-End Registration, Profile Creation, RBAC, and Repeat Login Verification Test
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase credentials in environment.');
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

async function runAuthLifecycleTest() {
  const testId = Date.now();
  const testEmail = `landowner_${testId}@landiq.org`;
  const testPassword = `LandownerPass_${testId}!`;
  const testName = `Murugan Sundaram (${testId})`;

  console.log('========================================================');
  console.log('LAND-IQ REAL REGISTRATION & AUTHENTICATION LIFECYCLE TEST');
  console.log('========================================================');
  console.log(`Test Customer Email: ${testEmail}`);

  // Step 1: Self-Registration with Supabase Auth
  console.log('\n1. Registering new customer account via Supabase Auth...');
  const { data: signUpData, error: signUpError } = await client.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        full_name: testName,
        state_id: '109a3667-5740-45ef-a3c4-f0577f9b454b', // Tamil Nadu
        district_id: '0aa083a3-218f-4e22-b9b0-6e3fa3bfa9e4', // Coimbatore
      },
    },
  });

  if (signUpError) {
    console.error('Sign-up failed:', signUpError);
    process.exit(1);
  }

  const userId = signUpData.user?.id;
  console.log(`✓ User created in Supabase Auth (User ID: ${userId})`);

  // Confirm email according to Supabase project verification policy
  console.log('\n2. Simulating email verification via project policy...');
  const { execSync } = await import('child_process');
  execSync(`npx supabase db query "UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = '${userId}';" --linked`, {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  console.log('✓ Email confirmed.');

  // Step 3: Sign in with the newly registered user
  console.log('\n3. Signing in with customer credentials...');
  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (signInError) {
    console.error('Sign-in failed:', signInError);
    process.exit(1);
  }
  console.log('✓ Signed in successfully. Access token acquired.');

  // Authenticated client as the new customer
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${signInData.session.access_token}`,
      },
    },
  });

  // Step 3: Verify Profile Creation & Role Assignment
  console.log('\n3. Verifying database profile creation & least-privilege role assignment...');
  const { data: profile, error: profileError } = await authClient
    .from('profiles')
    .select('id, full_name, email, role_id, state_id, district_id, is_active, roles(code, name)')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    console.error('Profile query failed:', profileError);
    process.exit(1);
  }

  console.log('Retrieved profile from public.profiles:');
  console.log(`  - Full Name: ${profile.full_name}`);
  console.log(`  - Email: ${profile.email}`);
  console.log(`  - Assigned Role Code: ${profile.roles?.code} (${profile.roles?.name})`);
  console.log(`  - State ID: ${profile.state_id}`);
  console.log(`  - District ID: ${profile.district_id}`);
  console.log(`  - Active: ${profile.is_active}`);

  if (profile.roles?.code !== 'CUSTOMER') {
    console.error(`SECURITY VIOLATION: Expected role CUSTOMER, but found ${profile.roles?.code}`);
    process.exit(1);
  }
  console.log('✓ Least-privilege CUSTOMER role verified.');

  // Step 4: Verify Privilege Escalation Prevention
  console.log('\n4. Testing client-side privilege escalation prevention...');
  const { error: escalateError } = await authClient
    .from('profiles')
    .update({ role_id: '00000000-0000-0000-0000-000000000001' }) // Super Admin role
    .eq('id', userId);

  if (!escalateError) {
    console.error('CRITICAL FAILURE: User was able to update their role_id directly!');
    process.exit(1);
  }
  console.log(`✓ Privilege escalation correctly blocked: "${escalateError.message}"`);

  // Step 5: Test Sign-Out
  console.log('\n5. Testing user sign-out...');
  const { error: signOutError } = await client.auth.signOut();
  if (signOutError) {
    console.error('Sign-out failed:', signOutError);
    process.exit(1);
  }
  console.log('✓ Signed out successfully.');

  // Step 6: Test Repeat Sign-In
  console.log('\n6. Testing repeat sign-in (session persistence & recovery)...');
  const { data: repeatSignIn, error: repeatError } = await client.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (repeatError || !repeatSignIn.session) {
    console.error('Repeat sign-in failed:', repeatError);
    process.exit(1);
  }
  console.log('✓ Repeat sign-in succeeded. Session and user identity restored.');

  console.log('\n========================================================');
  console.log('ALL REGISTRATION, RBAC, AND PERSISTENT LOGIN TESTS PASSED!');
  console.log('========================================================\n');
}

runAuthLifecycleTest().catch((err) => {
  console.error('Test crashed:', err);
  process.exit(1);
});
