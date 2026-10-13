import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(url, key);

async function test() {
  try {
    const { data, error } = await supabase.from('roles').select('id, code, name');
    if (error) {
      console.error('Supabase connectivity failed:', error.code, error.message);
      process.exitCode = 1;
      return;
    }

    console.log(`Supabase connectivity check passed (${data.length} roles found).`);
  } catch (err) {
    console.error('Connectivity failed:', err instanceof Error ? err.message : 'Unknown error');
    process.exitCode = 1;
  }
}

test();
