// LAND-IQ Comprehensive Test Suite: Risk Assessment & GIS Mapping Services
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase configuration in environment.');
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('===========================================================');
  console.log('LAND-IQ RISK ASSESSMENT & GIS MAPPING VERIFICATION SUITE');
  console.log('===========================================================');

  // --- SECTION 1: Unauthenticated Access Control ---
  console.log('\n--- 1. Testing Unauthenticated Access Restrictions ---');
  const { data: _anonExtent, error: anonExtentError } = await client.rpc('get_spatial_land_record_extent');
  assert(
    anonExtentError != null,
    'Anonymous access to get_spatial_land_record_extent is denied as required'
  );

  const { data: anonRisk, error: anonRiskError } = await client
    .from('risk_assessments')
    .select('id, risk_score')
    .limit(5);
  assert(
    anonRisk?.length === 0 || anonRiskError != null,
    'Anonymous access cannot read protected risk_assessments rows'
  );

  // --- SECTION 2: Authenticated Officer / Admin Access ---
  console.log('\n--- 2. Authenticating as Super Administrator ---');
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: 'admin@landiq.local',
    password: 'Admin123!',
  });
  assert(!authError && !!authData?.user?.id, 'Admin login succeeded');

  // --- SECTION 3: Risk Assessment Queries ---
  console.log('\n--- 3. Testing Risk Assessment Service Queries ---');
  
  // 3.1 getRiskAssessments (list)
  const { data: assessments, error: listError, count: totalCount } = await client
    .from('risk_assessments')
    .select(
      `*,
      risk_signals(*),
      land_records(
        *,
        districts(name),
        taluks(name),
        villages(name),
        land_record_owners(*, land_owners(*)),
        verification_tasks(id, status, priority, created_at, assigned_to, profiles!assigned_to(full_name))
      )`,
      { count: 'exact' }
    )
    .order('calculated_at', { ascending: false })
    .range(0, 9);

  assert(!listError, 'getRiskAssessments query executes without relationship errors');
  assert(Array.isArray(assessments) && assessments.length > 0, `Risk assessments loaded (${assessments?.length} rows, total: ${totalCount})`);
  assert(assessments[0]?.land_records?.record_number != null, 'Linked land record details properly nested');
  assert(Array.isArray(assessments[0]?.risk_signals), 'Linked risk signals properly loaded as array');

  // 3.2 getRiskAssessment (single with duplicate candidates)
  const firstId = assessments[0]?.id;
  const { data: singleAssessment, error: singleError } = await client
    .from('risk_assessments')
    .select(
      `*,
      risk_signals(*),
      assigned_officer:profiles!assigned_to(full_name, email),
      land_records(
        *,
        states(name),
        districts(name),
        taluks(name),
        villages(name),
        land_record_owners(*, land_owners(*)),
        documents(*),
        verification_tasks(*, profiles!assigned_to(full_name))
      )`
    )
    .eq('id', firstId)
    .single();

  assert(!singleError && !!singleAssessment, `Single risk assessment (${firstId}) fetched successfully`);
  
  // Test duplicate candidates resolution by land_record_id
  const { data: _duplicates, error: dupError } = await client
    .from('duplicate_candidates')
    .select(
      `*,
      record_a:land_records!record_a_id(id, record_number, survey_number, patta_number, districts(name), taluks(name), villages(name)),
      record_b:land_records!record_b_id(id, record_number, survey_number, patta_number, districts(name), taluks(name), villages(name))`
    )
    .or(`record_a_id.eq.${singleAssessment.land_record_id},record_b_id.eq.${singleAssessment.land_record_id}`);

  assert(!dupError, 'Duplicate candidates resolved by land_record_id without schema mismatch');

  // 3.3 getRiskStats
  const [totalRisk, highRisk, _modRisk, _lowRisk] = await Promise.all([
    client.from('risk_assessments').select('id', { count: 'exact', head: true }),
    client.from('risk_assessments').select('id', { count: 'exact', head: true }).in('risk_level', ['HIGH', 'CRITICAL']),
    client.from('risk_assessments').select('id', { count: 'exact', head: true }).eq('risk_level', 'MODERATE'),
    client.from('risk_assessments').select('id', { count: 'exact', head: true }).eq('risk_level', 'LOW'),
  ]);
  assert(totalRisk.count != null && totalRisk.count >= 3, `Risk stats aggregate counts returned (Total: ${totalRisk.count}, High: ${highRisk.count})`);

  // --- SECTION 4: GIS Mapping Queries & PostGIS RPCs ---
  console.log('\n--- 4. Testing GIS Mapping PostGIS RPCs ---');

  // 4.1 Spatial Extent
  const { data: extentData, error: extentError } = await client.rpc('get_spatial_land_record_extent');
  assert(!extentError, 'get_spatial_land_record_extent executes successfully');
  assert(Array.isArray(extentData) && extentData.length > 0, 'Spatial extent returned non-empty bounding box');
  const extent = extentData?.[0];
  assert(
    extent?.west != null && extent?.south != null && extent?.east != null && extent?.north != null,
    `Extent coordinates valid: [W: ${extent?.west}, S: ${extent?.south}, E: ${extent?.east}, N: ${extent?.north}]`
  );
  assert(extent?.west < extent?.east && extent?.south < extent?.north, 'Bounding box coordinate order is valid (west < east, south < north)');

  // 4.2 Spatial Records in Bounds
  const { data: spatialRecords, error: spatialError } = await client.rpc('get_spatial_land_records', {
    p_west: extent.west - 0.05,
    p_south: extent.south - 0.05,
    p_east: extent.east + 0.05,
    p_north: extent.north + 0.05,
  });
  assert(!spatialError, 'get_spatial_land_records executes successfully');
  assert(Array.isArray(spatialRecords) && spatialRecords.length > 0, `Spatial records found in extent: ${spatialRecords.length}`);
  const firstSpatial = spatialRecords[0];
  assert(firstSpatial.geometry_geojson != null, `Record ${firstSpatial.record_number} has valid GeoJSON geometry`);
  assert(firstSpatial.latitude != null && firstSpatial.longitude != null, `Record centroid coordinates valid (${firstSpatial.latitude}, ${firstSpatial.longitude})`);

  // 4.3 Nearby Records (Point Radius Search)
  const { data: nearbyRecords, error: nearbyError } = await client.rpc('get_nearby_land_records', {
    p_latitude: firstSpatial.latitude,
    p_longitude: firstSpatial.longitude,
    p_radius_meters: 15000,
  });
  assert(!nearbyError, 'get_nearby_land_records executes successfully');
  assert(Array.isArray(nearbyRecords) && nearbyRecords.length > 0, `Nearby records within radius: ${nearbyRecords.length}`);
  assert(nearbyRecords[0].distance_meters >= 0, `Distance calculation verified (${nearbyRecords[0].distance_meters} m)`);

  // 4.4 GIS Summary Aggregation
  const { data: summaryData, error: summaryError } = await client.rpc('get_gis_land_record_summary', {
    p_state_id: null,
    p_district_id: null,
    p_taluk_id: null,
    p_village_id: null,
    p_verification_status: null,
    p_record_status: null,
    p_land_type: null,
    p_search: null,
  });
  assert(!summaryError, 'get_gis_land_record_summary executes successfully');
  assert(summaryData?.totalRecords >= 3, `Total GIS records summary matches expected (${summaryData?.totalRecords})`);
  assert(summaryData?.totalAreaByUnit != null, 'Area by unit properly aggregated');

  // --- SECTION 5: Cleanup & Summary ---
  await client.auth.signOut();
  console.log('\n===========================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unexpected test error:', err);
  process.exit(1);
});
