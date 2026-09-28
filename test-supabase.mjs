
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(url, key);
async function test() {
  try {
    await supabase.from('nonexistent').select('*').limit(1);
    console.log('Connectivity check passed.');
  } catch (err) {
    console.error('Connectivity failed', err);
    process.exit(1);
  }
}
test();
