import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@landiq.local',
    password: 'Admin123!'
  });
  if (authError) {
    console.error('Auth error:', authError);
    return;
  }
  console.log('Logged in as:', authData.user.email);

  console.log('\n--- Testing RPC: get_spatial_land_record_extent ---');
  const extentRes = await supabase.rpc('get_spatial_land_record_extent');
  if (extentRes.error) {
    console.error('get_spatial_land_record_extent error:', extentRes.error);
  } else {
    console.log('get_spatial_land_record_extent result:', extentRes.data);
  }

  console.log('\n--- Testing RPC: get_spatial_land_records ---');
  const recordsRes = await supabase.rpc('get_spatial_land_records', {
    p_west: 60,
    p_south: 6,
    p_east: 100,
    p_north: 40,
  });
  if (recordsRes.error) {
    console.error('get_spatial_land_records error:', recordsRes.error);
  } else {
    console.log('get_spatial_land_records count:', recordsRes.data?.length);
    console.log('First record sample:', recordsRes.data?.[0]);
  }

  console.log('\n--- Testing land_records schema / sample row ---');
  const lrRes = await supabase.from('land_records').select('*').limit(2);
  if (lrRes.error) {
    console.error('land_records select error:', lrRes.error);
  } else {
    console.log('land_records columns in row 0:', Object.keys(lrRes.data?.[0] || {}));
    console.log('Row 0 coordinates / parcel info:', {
      id: lrRes.data?.[0]?.id,
      record_number: lrRes.data?.[0]?.record_number,
      survey_number: lrRes.data?.[0]?.survey_number,
      centroid_latitude: lrRes.data?.[0]?.centroid_latitude,
      centroid_longitude: lrRes.data?.[0]?.centroid_longitude,
      parcel_boundaries: lrRes.data?.[0]?.parcel_boundaries,
    });
  }
}

main().catch(console.error);
