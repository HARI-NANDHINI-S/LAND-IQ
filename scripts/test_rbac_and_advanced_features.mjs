/**
 * LAND-IQ Comprehensive Test Suite:
 * 1. Unauthenticated RLS Access Restrictions
 * 2. Role-Based Access Control (RBAC) & Security Integrity
 * 3. Geospatial Land-Record Cross-Validation (PostGIS / Cadastral Consistency)
 * 4. Record Versioning & Change-Impact Tracking (Append-Only Audit Lineage)
 * 5. Citizen Application Tracking & Discrepancy Resolution Lifecycle
 * 6. Multi-Role Authorization, Anti-Escalation, & Horizontal Isolation Audit
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://pmzipqjkzctsubrjlajj.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_ANON_KEY) {
  console.error('[ERROR] VITE_SUPABASE_ANON_KEY is missing from environment.');
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

console.log('========================================================================');
console.log('LAND-IQ — RBAC + ADVANCED FEATURES AUTOMATED TEST SUITE');
console.log('========================================================================');

async function runTests() {
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passedCount++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failedCount++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST SECTION 1: UNAUTHENTICATED ACCESS RESTRICTIONS (RLS BOUNDARY)
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing Unauthenticated Access Restrictions (RLS Security Boundary) ---');

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    const { data: anonApps, error: anonAppsErr } = await anonClient
      .from('citizen_applications')
      .select('id, application_number')
      .limit(5);

    assert(
      (anonApps?.length || 0) === 0 || anonAppsErr !== null,
      'Anonymous access cannot read protected citizen_applications table'
    );

    const { data: anonVersions, error: anonVerErr } = await anonClient
      .from('land_record_versions')
      .select('id')
      .limit(5);

    assert(
      (anonVersions?.length || 0) === 0 || anonVerErr !== null,
      'Anonymous access cannot read protected land_record_versions table'
    );

    const { data: anonGis, error: anonGisErr } = await anonClient
      .from('gis_cross_validations')
      .select('id')
      .limit(5);

    assert(
      (anonGis?.length || 0) === 0 || anonGisErr !== null,
      'Anonymous access cannot read protected gis_cross_validations table'
    );

    // -------------------------------------------------------------------------
    // TEST SECTION 2: AUTHENTICATED STAFF / ADMIN SIGN-IN & RBAC VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Authenticating as Super Administrator & Verifying RBAC ---');

    const { data: authData, error: authErr } = await adminClient.auth.signInWithPassword({
      email: 'admin@landiq.local',
      password: 'Admin123!',
    });

    assert(!authErr && !!authData?.user?.id, 'Staff administrator authentication succeeded');

    const { data: roles, error: rolesErr } = await adminClient
      .from('roles')
      .select('code, name');

    assert(!rolesErr, 'Fetch roles from public.roles without error');
    const roleCodes = (roles || []).map(r => r.code);
    assert(roleCodes.includes('CITIZEN'), 'Role "CITIZEN" exists in database');
    assert(roleCodes.includes('DATA_ENTRY_OFFICER'), 'Role "DATA_ENTRY_OFFICER" (Clerk) exists');
    assert(roleCodes.includes('VERIFICATION_OFFICER'), 'Role "VERIFICATION_OFFICER" (Registrar) exists');
    assert(roleCodes.includes('DISTRICT_OFFICER'), 'Role "DISTRICT_OFFICER" (Supervisor) exists');
    assert(roleCodes.includes('SUPER_ADMIN'), 'Role "SUPER_ADMIN" (System Administrator) exists');

    // Check citizen permissions in role_permissions
    const { data: citizenRole } = await adminClient
      .from('roles')
      .select('id, code')
      .eq('code', 'CITIZEN')
      .single();

    if (citizenRole) {
      const { data: rolePerms } = await adminClient
        .from('role_permissions')
        .select('permission_id, permissions(code)')
        .eq('role_id', citizenRole.id);

      const permCodes = (rolePerms || []).map(rp => rp.permissions?.code).filter(Boolean);
      assert(permCodes.includes('application:create'), 'Citizen has application:create permission');
      assert(permCodes.includes('application:read'), 'Citizen has application:read permission');
      assert(!permCodes.includes('verification:approve'), 'Citizen DOES NOT have verification:approve permission');
      assert(!permCodes.includes('gis:resolve'), 'Citizen DOES NOT have gis:resolve permission');
      assert(!permCodes.includes('gis:validate'), 'Citizen DOES NOT have gis:validate permission');
      assert(!permCodes.includes('application:decide'), 'Citizen DOES NOT have application:decide permission');
    }

    // -------------------------------------------------------------------------
    // TEST SECTION 3: CADASTRAL DATA & POSTGIS SPATIAL PARCEL CONSISTENCY
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Geospatial Cadastral Parcellary Cross-Validation ---');

    const { data: parcels, error: parcelsErr } = await adminClient
      .from('cadastral_parcels')
      .select('*')
      .limit(10);

    assert(!parcelsErr && (parcels?.length || 0) > 0, `Authoritative cadastral parcels loaded (${parcels?.length} parcels in benchmark)`);
    console.log('  Loaded cadastral parcels:', (parcels || []).map(p => `${p.parcel_id} (Survey: ${p.survey_number})`).join(', '));

    const benchmarkParcel = (parcels || []).find(p => p.survey_number.includes('102') || p.survey_number.includes('204') || p.boundary_geojson);
    assert(!!benchmarkParcel, `Cadastral benchmark parcel found (${benchmarkParcel?.parcel_id}, Survey ${benchmarkParcel?.survey_number})`);
    assert(benchmarkParcel?.boundary_geojson !== null, 'Cadastral parcel has valid boundary GeoJSON polygon');

    // Find an active land record to run GIS validation against
    const { data: sampleRecord } = await adminClient
      .from('land_records')
      .select('id, record_number, survey_number, land_area, village_id, district_id')
      .limit(1)
      .maybeSingle();

    if (sampleRecord) {
      console.log(`  Evaluating land record ${sampleRecord.record_number} (Survey: ${sampleRecord.survey_number})`);
      const { data: gisResult, error: gisErr } = await adminClient.rpc('perform_gis_cross_validation', {
        p_land_record_id: sampleRecord.id,
      });

      assert(!gisErr && !!gisResult, 'perform_gis_cross_validation RPC executed successfully');
      assert(
        ['MATCHED', 'POSSIBLE_MISMATCH', 'AMBIGUOUS_MATCH', 'NO_MATCH', 'SOURCE_DATA_UNAVAILABLE'].includes(gisResult?.validation_status),
        `GIS validation returned standardized status: ${gisResult?.validation_status}`
      );
      assert(typeof gisResult?.is_duplicate_parcel === 'boolean', 'Duplicate parcel reference checked');
      assert(typeof gisResult?.has_geometry_overlap === 'boolean', 'Spatial geometry overlap evaluated');

      // Test Officer Resolution RPC
      if (gisResult?.id) {
        const { data: resolvedGis, error: resErr } = await adminClient.rpc('resolve_gis_discrepancy', {
          p_validation_id: gisResult.id,
          p_resolution_status: 'ACCEPTED_OVERRIDE',
          p_notes: 'Automated test suite verification: Discrepancy reviewed and override logged with statutory audit trail.',
        });

        assert(!resErr && resolvedGis?.officer_resolution_status === 'ACCEPTED_OVERRIDE', 'resolve_gis_discrepancy RPC successfully recorded officer decision');
        assert(resolvedGis?.officer_notes?.includes('override logged'), 'Officer resolution notes preserved in audit');
      }
    }

    // -------------------------------------------------------------------------
    // TEST SECTION 4: RECORD VERSIONING & AUDIT IMMUTABILITY
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing Immutable Record Versioning & Lineage ---');

    if (sampleRecord) {
      // Create version snapshot
      const { data: newVersion, error: verErr } = await adminClient.rpc('create_record_version', {
        p_land_record_id: sampleRecord.id,
        p_event_type: 'MANUAL_EDIT',
        p_reason: 'Automated test suite snapshot creation',
        p_field_changes: {
          test_field: { old_value: 'initial_val', new_value: 'updated_val' },
        },
      });

      assert(!verErr && !!newVersion, 'create_record_version RPC successfully captured snapshot');
      assert(newVersion?.version_number >= 1, `Version number incremented properly (v${newVersion?.version_number})`);
      assert(newVersion?.event_type === 'MANUAL_EDIT', 'Event type correctly recorded as MANUAL_EDIT');

      // Test Append-Only Immutability: Attempting UPDATE on land_record_versions MUST FAIL
      const { error: updateErr } = await adminClient
        .from('land_record_versions')
        .update({ reason: 'tampered reason' })
        .eq('id', newVersion.id);

      assert(!!updateErr, 'Security check: Direct UPDATE on land_record_versions was rejected by database');

      // Test Append-Only Immutability: Attempting DELETE on land_record_versions MUST FAIL
      const { error: deleteErr } = await adminClient
        .from('land_record_versions')
        .delete()
        .eq('id', newVersion.id);

      assert(!!deleteErr, 'Security check: Direct DELETE on land_record_versions was rejected by database');
    }

    // -------------------------------------------------------------------------
    // TEST SECTION 5: CITIZEN APPLICATION LIFECYCLE & DISCREPANCY RESOLUTION
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing Citizen Application Lifecycle & State Transitions ---');

    // Fetch geographic IDs for administrative testing
    let { data: stateData } = await adminClient.from('states').select('id, name').ilike('name', '%Tamil Nadu%').limit(1).maybeSingle();
    if (!stateData) {
      const { data: anyState } = await adminClient.from('states').select('id, name').limit(1).single();
      stateData = anyState;
    }

    let { data: districtData } = await adminClient.from('districts').select('id, name').eq('state_id', stateData.id).ilike('name', '%Coimbatore%').limit(1).maybeSingle();
    if (!districtData) {
      const { data: anyDistrict } = await adminClient.from('districts').select('id, name').eq('state_id', stateData.id).limit(1).single();
      districtData = anyDistrict;
    }

    const { data: taluks } = await adminClient.from('taluks').select('id, name').eq('district_id', districtData.id);
    const talukIds = (taluks || []).map(t => t.id);
    const { data: villageData } = await adminClient.from('villages').select('id, name').in('taluk_id', talukIds).limit(1).single();

    assert(!!stateData && !!districtData && !!villageData, `Authoritative administrative geography loaded (${stateData?.name} -> ${districtData?.name} -> ${villageData?.name})`);

    if (stateData && districtData && villageData) {
      // 1. Submit Application
      const testSurvey = `TEST-${Date.now().toString().slice(-4)}`;
      const { data: appData, error: appErr } = await adminClient.rpc('submit_citizen_application', {
        p_request_type: 'CORRECTION',
        p_state_id: stateData.id,
        p_district_id: districtData.id,
        p_village_id: villageData.id,
        p_survey_number: testSurvey,
        p_applicant_name: 'Test Citizen User',
        p_applicant_phone: '+91 99887 76655',
        p_description: 'Automated test suite submission: boundary area correction request.',
        p_document_ids: [],
      });

      if (appErr) console.error('  [DEBUG appErr]:', appErr);

      assert(!appErr && !!appData, `submit_citizen_application RPC executed: Created ${appData?.application_number}`);
      assert(appData?.status === 'SUBMITTED', 'Initial application status is SUBMITTED');
      testAppId = appData?.id;

      // Check timeline event
      const { data: timelineEvents } = await adminClient
        .from('application_timeline')
        .select('*')
        .eq('application_id', appData.id);

      assert((timelineEvents?.length || 0) > 0, 'Timeline event automatically recorded for SUBMITTED');

      // 2. Officer requests clarification
      const { data: clarifyApp, error: clarifyErr } = await adminClient.rpc('request_application_clarification', {
        p_application_id: appData.id,
        p_message: 'Please provide certified copy of sale deed or tax receipt for boundary validation.',
      });

      assert(!clarifyErr && clarifyApp?.status === 'ACTION_REQUIRED', 'request_application_clarification transitioned status to ACTION_REQUIRED');
      assert(clarifyApp?.clarification_request?.includes('certified copy'), 'Clarification message preserved');

      // 3. Citizen responds to clarification
      const { data: resubmittedApp, error: respErr } = await adminClient.rpc('respond_application_clarification', {
        p_application_id: appData.id,
        p_response: 'Here is the referenced tax receipt and confirmation of survey bounds.',
      });

      assert(!respErr && resubmittedApp?.status === 'RESUBMITTED', 'respond_application_clarification transitioned status to RESUBMITTED');

      // 4. Officer decides application (Approved)
      const { data: approvedApp, error: decideErr } = await adminClient.rpc('decide_citizen_application', {
        p_application_id: appData.id,
        p_decision: 'APPROVE',
        p_reason: 'All boundary attributes and cadastral survey numbers verified against village settlement register.',
      });

      assert(!decideErr && approvedApp?.status === 'APPROVED', 'decide_citizen_application transitioned status to APPROVED');
      assert(approvedApp?.officer_decision_reason?.includes('verified against'), 'Officer statutory approval rationale preserved');

      // Verify timeline sequence
      const { data: fullTimeline } = await adminClient
        .from('application_timeline')
        .select('status, event_title')
        .eq('application_id', appData.id)
        .order('created_at', { ascending: true });

      const timelineStatuses = (fullTimeline || []).map(t => t.status);
      assert(timelineStatuses.includes('SUBMITTED'), 'Timeline contains SUBMITTED event');
      assert(timelineStatuses.includes('ACTION_REQUIRED'), 'Timeline contains ACTION_REQUIRED event');
      assert(timelineStatuses.includes('RESUBMITTED'), 'Timeline contains RESUBMITTED event');
      assert(timelineStatuses.includes('APPROVED'), 'Timeline contains APPROVED event');

      // Test Timeline Immutability: Attempting UPDATE on application_timeline MUST FAIL
      const { error: timelineUpdateErr } = await adminClient
        .from('application_timeline')
        .update({ event_title: 'tampered title' })
        .eq('application_id', appData.id);

      assert(!!timelineUpdateErr, 'Security check: Direct UPDATE on application_timeline was rejected by database');
    }

    // -------------------------------------------------------------------------
    // TEST SECTION 6: RIGOROUS MULTI-ROLE SECURITY & HORIZONTAL ISOLATION AUDIT
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Multi-Role Authorization, Anti-Escalation & Horizontal Isolation Audit ---');

    const citizenClientA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    const { data: signInA, error: signInAErr } = await citizenClientA.auth.signInWithPassword({
      email: 'test_cit_1792314866710@landiq.org',
      password: 'Citizen123!',
    });
    assert(!signInAErr && !!signInA?.user?.id, 'Citizen A authenticated successfully');

    // Verify assigned role is strictly CITIZEN (least privilege default), NOT a staff role
    const { data: profileA } = await adminClient
      .from('profiles')
      .select('id, role:roles(code), is_active')
      .eq('id', signInA.user.id)
      .single();

    assert(profileA?.role?.code === 'CITIZEN', `Account has assigned role "${profileA?.role?.code}" (Least-privilege citizen default)`);

    // Test Self-Privilege Escalation: Citizen A tries to update their own role_id to SUPER_ADMIN
    const { error: escalateErr } = await citizenClientA
      .from('profiles')
      .update({ role_id: '00000000-0000-0000-0000-000000000001' })
      .eq('id', signInA.user.id);

    assert(!!escalateErr, 'Security check: Direct profile role_id self-promotion was BLOCKED');

    // Sign in Citizen B
    const citizenClientB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    const { data: signInB, error: signInBErr } = await citizenClientB.auth.signInWithPassword({
      email: 'landowner_1791915876764@landiq.org',
      password: 'Citizen123!',
    });
    assert(!signInBErr && !!signInB?.user?.id, 'Citizen B authenticated successfully');

    // Citizen A submits an application
    const { data: appA, error: appAErr } = await citizenClientA.rpc('submit_citizen_application', {
      p_request_type: 'DIGITIZATION',
      p_state_id: stateData.id,
      p_district_id: districtData.id,
      p_village_id: villageData.id,
      p_survey_number: 'SURV-CIT-A-01',
      p_applicant_name: 'Audit Citizen User A',
      p_applicant_phone: '+91 91234 56789',
      p_description: 'Private citizen record request',
      p_document_ids: [],
    });

    assert(!appAErr && !!appA?.id, `Citizen A created application ${appA?.application_number}`);

    // Citizen B queries citizen_applications: Must NOT see Citizen A's application
    const { data: appsSeenByB } = await citizenClientB
      .from('citizen_applications')
      .select('id, application_number')
      .eq('id', appA.id);

    assert(
      (appsSeenByB || []).length === 0,
      'Horizontal Isolation: Citizen B CANNOT view Citizen A application (RLS strictly enforced)'
    );

    // Citizen B tries to respond to clarification on Citizen A's application
    const { error: bRespondErr } = await citizenClientB.rpc('respond_application_clarification', {
      p_application_id: appA.id,
      p_response: 'Unauthorized response attempt by Citizen B',
    });

    assert(!!bRespondErr, 'Security check: Citizen B cannot modify Citizen A application');

    // Citizen A tries to decide an official application (Unauthorized clerk/officer decision)
    const { error: citizenDecideErr } = await citizenClientA.rpc('decide_citizen_application', {
      p_application_id: appA.id,
      p_decision: 'APPROVE',
      p_reason: 'Self-approval exploit attempt',
    });

    assert(!!citizenDecideErr, 'Security check: Citizen CANNOT decide/approve official applications');

    // Citizen tries to create a record version directly
    if (sampleRecord) {
      const { error: citizenVerErr } = await citizenClientA.rpc('create_record_version', {
        p_land_record_id: sampleRecord.id,
        p_event_type: 'MANUAL_EDIT',
        p_reason: 'Unauthorized citizen version injection',
      });

      assert(!!citizenVerErr, 'Security check: Citizen CANNOT invoke create_record_version (RPC Authorization enforced)');

      // Citizen tries to perform GIS cross-validation
      const { error: citizenGisErr } = await citizenClientA.rpc('perform_gis_cross_validation', {
        p_land_record_id: sampleRecord.id,
      });

      assert(!!citizenGisErr, 'Security check: Citizen CANNOT invoke perform_gis_cross_validation (RPC Authorization enforced)');
    }

    // Citizen reads verified land records: Must succeed (transparency for citizens)
    const { data: verifiedRecords, error: verifiedRecErr } = await citizenClientA
      .from('land_records')
      .select('id, record_number, verification_status, record_status')
      .eq('record_status', 'ACTIVE')
      .eq('verification_status', 'APPROVED')
      .limit(5);

    assert(
      !verifiedRecErr && (verifiedRecords?.length || 0) > 0,
      `Citizen can query verified active land records (Found ${verifiedRecords?.length || 0} records)`
    );

    // Citizen queries staff-only GIS cross validations: Must return 0 rows
    const { data: staffGisSeenByCitizen } = await citizenClientA
      .from('gis_cross_validations')
      .select('id')
      .limit(5);

    assert(
      (staffGisSeenByCitizen || []).length === 0,
      'Security check: Citizen CANNOT read staff GIS cross-validation discrepancies table'
    );

    console.log('\n========================================================================');
    console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('========================================================================\n');

    if (failedCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('[FATAL EXCEPTION]', err);
    process.exit(1);
  }
}

runTests();
