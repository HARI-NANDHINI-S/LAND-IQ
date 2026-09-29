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

async function inspectDb() {
  console.log("Checking states:");
  const { data: states, error: statesErr } = await supabase.from('states').select('*').limit(3);
  console.log(statesErr || states);

  console.log("\nChecking districts:");
  const { data: dist, error: distErr } = await supabase.from('districts').select('*').limit(3);
  console.log(distErr || dist);

  console.log("\nChecking land_records:");
  const { data: records, error: recErr } = await supabase.from('land_records').select('id, state_id, district_id, taluk_id, village_id').limit(3);
  console.log(recErr || records);
}

inspectDb();
