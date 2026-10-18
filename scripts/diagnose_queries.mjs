import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  await supabase.auth.signInWithPassword({ email: 'admin@landiq.local', password: 'Admin123!' });

  console.log('--- 1. Testing get_spatial_land_record_extent ---');
  const extentRes = await supabase.rpc('get_spatial_land_record_extent');
  console.log('Extent result:', extentRes.data);

  const extent = extentRes.data?.[0];
  if (extent) {
    console.log('--- 2. Testing get_spatial_land_records within extent ---');
    const recordsRes = await supabase.rpc('get_spatial_land_records', {
      p_west: extent.west - 0.1,
      p_south: extent.south - 0.1,
      p_east: extent.east + 0.1,
      p_north: extent.north + 0.1,
    });
    console.log('Records returned count:', recordsRes.data?.length);
    console.log('Sample record 0:', {
      record_number: recordsRes.data?.[0]?.record_number,
      latitude: recordsRes.data?.[0]?.latitude,
      longitude: recordsRes.data?.[0]?.longitude,
      geometry_type: recordsRes.data?.[0]?.geometry_geojson?.type,
    });

    console.log('--- 3. Testing get_nearby_land_records (10.9712, 76.9184) within 5km ---');
    const nearbyRes = await supabase.rpc('get_nearby_land_records', {
      p_latitude: 10.9712,
      p_longitude: 76.9184,
      p_radius_meters: 20000,
    });
    console.log('Nearby records count:', nearbyRes.data?.length);
    console.log('Nearby sample:', nearbyRes.data?.[0]);
  }
}

main().catch(console.error);
