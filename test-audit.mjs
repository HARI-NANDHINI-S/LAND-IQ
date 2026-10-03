import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;

async function testAuditSecurity() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Authenticate
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASSWORD,
  });

  if (authError) {
    console.error('Auth error:', authError.message);
    return;
  }

  const user = authData.user;
  console.log('Authenticated as:', user.email);

  // Test inserting an arbitrary fake audit log
  const { data: insertData, error: insertError } = await supabase.from('audit_logs').insert({
    actor_id: user.id,
    actor_role: 'SUPER_ADMIN', // using real role since policy enforces it
    action: 'FAKE_FABRICATED_ACTION',
    entity_type: 'documents',
    entity_id: '00000000-0000-0000-0000-000000000000',
    before_state: { malicious: 'data' },
    status: 'SUCCESS'
  }).select();

  if (insertError) {
    console.error('FAILED: Ordinary user cannot insert fake audit events.', insertError);
  } else {
    console.log('SECURITY VULNERABILITY FOUND: User can insert arbitrary fake audit events!', insertData);
  }

  // Attempt to delete an audit log
  if (insertData && insertData.length > 0) {
    const { error: deleteError } = await supabase.from('audit_logs').delete().eq('id', insertData[0].id);
    if (deleteError) {
      console.log('PASS: User cannot delete audit logs.', deleteError.message);
    } else {
      console.error('SECURITY VULNERABILITY FOUND: User can delete audit logs!');
    }
  }

}

testAuditSecurity();
