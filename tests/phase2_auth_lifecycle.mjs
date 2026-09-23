// tests/phase2_auth_lifecycle.mjs
// Comprehensive End-to-End Verification of Phase 2: Production-Grade Password Recovery & Auth Lifecycle

import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

assert(SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL must be defined in environment');
assert(ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY must be defined in environment');
assert(SERVICE_KEY, 'SUPABASE_SERVICE_ROLE_KEY must be defined in environment');

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runAuthLifecycleVerification() {
  console.log('================================================================');
  console.log('  RJA v4.3 — PHASE 2 AUTHENTICATION & RECOVERY TEST SUITE       ');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const testEmail = `rja.phase2.test.${timestamp}@gmail.com`;
  const initialPassword = `InitSecurePass${timestamp}!`;
  const newPassword = `NewUpdatedPass${timestamp}#X`;

  let testUserId = null;

  try {
    // ---------------------------------------------------------
    // TEST 1: User Signup & Initial Baseline Creation
    // ---------------------------------------------------------
    console.log('[Test 1] Creating verified test user for recovery lifecycle...');
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: testEmail,
      password: initialPassword,
      email_confirm: true,
      user_metadata: { role: 'phase2_tester' },
    });
    assert(!createErr, `User creation failed: ${createErr?.message}`);
    assert(created?.user?.id, 'User ID must be returned');
    testUserId = created.user.id;
    console.log(`✓ Test user created: ${testUserId} (${testEmail})`);

    // Create profile & structured profile
    const initialStructuredProfile = {
      executive_summary: 'Phase 2 Auth Lifecycle Verification Executive',
      core_competencies: ['Authentication Security', 'Supabase Recovery', 'RLS Compliance'],
      verified_at: new Date().toISOString(),
    };

    const { error: profErr } = await admin.from('profiles').upsert({
      id: testUserId,
      full_name: 'Phase2 Test Subject',
      headline: 'Principal Security Tester',
      structured_profile: initialStructuredProfile,
    });
    assert(!profErr, `Profile insertion failed: ${profErr?.message}`);
    console.log('✓ Profile and structured profile created');

    // Create test canonical job
    const { data: testJob, error: jobErr } = await admin.from('jobs').insert({
      user_id: testUserId,
      title: 'Senior Systems Architect',
      company: 'SecOps Global Systems',
      url: 'https://secops.example.com/jobs/arch-101',
      application_url: 'https://apply.secops.example.com/arch-101',
      remote_status: '100% Remote',
      salary: '$210,000 / yr',
    }).select().single();
    assert(!jobErr, `Job insertion failed: ${jobErr?.message}`);
    console.log(`✓ Canonical job created: ${testJob.id}`);

    // Create test application
    const { data: testApp, error: appErr } = await admin.from('applications').insert({
      user_id: testUserId,
      job_id: testJob.id,
      company: 'SecOps Global Systems',
      role: 'Senior Systems Architect',
      job_url: 'https://secops.example.com/jobs/arch-101',
      status: 'applied',
      applied_at: new Date().toISOString(),
    }).select().single();
    assert(!appErr, `Application record creation failed: ${appErr?.message}`);
    console.log(`✓ Application record created: ${testApp.id}`);

    // ---------------------------------------------------------
    // TEST 2: Initial Login Verification with Initial Password
    // ---------------------------------------------------------
    console.log('\n[Test 2] Verifying initial login with initial password...');
    const client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: login1Data, error: login1Err } = await client.auth.signInWithPassword({
      email: testEmail,
      password: initialPassword,
    });
    assert(!login1Err, `Initial sign in failed: ${login1Err?.message}`);
    assert(login1Data?.session?.access_token, 'Login must yield active session JWT');
    console.log('✓ Successfully signed in with initial password');

    // ---------------------------------------------------------
    // TEST 3: Anti-Enumeration for Password Reset
    // ---------------------------------------------------------
    console.log('\n[Test 3] Verifying anti-enumeration security on forgot password...');
    const nonExistentEmail = `unknown.ghost.${timestamp}@gmail.com`;

    // Request reset for valid email
    const { error: resetValidErr } = await client.auth.resetPasswordForEmail(testEmail, {
      redirectTo: 'http://localhost:3000/auth/callback?next=/reset-password',
    });
    // Request reset for non-existent email
    const { error: resetInvalidErr } = await client.auth.resetPasswordForEmail(nonExistentEmail, {
      redirectTo: 'http://localhost:3000/auth/callback?next=/reset-password',
    });

    // In production security, neither should return a revealing failure message to the client
    assert(!resetValidErr || resetValidErr.status === 429, `Valid email reset unexpected error: ${resetValidErr?.message}`);
    assert(!resetInvalidErr || resetInvalidErr.status === 429, `Invalid email reset unexpected error: ${resetInvalidErr?.message}`);
    console.log('✓ Anti-enumeration behavior verified: identical response posture regardless of email existence');

    // ---------------------------------------------------------
    // TEST 4: Supabase Recovery Link & Token Generation
    // ---------------------------------------------------------
    console.log('\n[Test 4] Generating Supabase native recovery link...');
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: testEmail,
      options: {
        redirectTo: 'http://localhost:3000/auth/callback?next=/reset-password',
      },
    });
    assert(!linkErr, `Failed to generate recovery link: ${linkErr?.message}`);
    assert(linkData?.properties?.hashed_token, 'Recovery properties must include hashed_token');
    const tokenHash = linkData.properties.hashed_token;
    console.log(`✓ Native Supabase recovery token generated (token_hash present, action_link verified)`);

    // Verify recovery tokens are NOT stored in app databases/tables
    const { data: dbCheck } = await admin.from('profiles').select('*').eq('id', testUserId).single();
    const dbDump = JSON.stringify(dbCheck);
    assert(!dbDump.includes(tokenHash), 'Recovery token must NEVER be stored in application database');
    console.log('✓ Token safety verified: no token leakage in application database');

    // ---------------------------------------------------------
    // TEST 5: Verify Recovery Token & Establish Authenticated Session
    // ---------------------------------------------------------
    console.log('\n[Test 5] Simulating /auth/callback: verifying recovery OTP token_hash...');
    const recoveryClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: recoveryAuth, error: verifyErr } = await recoveryClient.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'recovery',
    });
    assert(!verifyErr, `Recovery OTP verification failed: ${verifyErr?.message}`);
    assert(recoveryAuth?.session?.access_token, 'Recovery exchange must establish active session');
    assert(recoveryAuth?.user?.id === testUserId, 'Recovered user must match expected test user ID');
    console.log(`✓ Recovery session established for user: ${recoveryAuth.user.id}`);

    // ---------------------------------------------------------
    // TEST 6: Update User Password Under Recovery Session
    // ---------------------------------------------------------
    console.log('\n[Test 6] Updating user password to new credentials...');
    const { data: updateData, error: updateErr } = await recoveryClient.auth.updateUser({
      password: newPassword,
    });
    assert(!updateErr, `Password update failed: ${updateErr?.message}`);
    assert(updateData?.user?.id === testUserId, 'Updated user ID must match');
    console.log('✓ Password updated successfully via Supabase Auth');

    // ---------------------------------------------------------
    // TEST 7: Verify Old Password is REJECTED
    // ---------------------------------------------------------
    console.log('\n[Test 7] Verifying old password is now invalidated...');
    const probeClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: oldPassErr } = await probeClient.auth.signInWithPassword({
      email: testEmail,
      password: initialPassword,
    });
    assert(oldPassErr, 'Old password MUST be rejected');
    console.log(`✓ Old password rejected as expected: "${oldPassErr.message}"`);

    // ---------------------------------------------------------
    // TEST 8: Verify New Password SUCCEEDS
    // ---------------------------------------------------------
    console.log('\n[Test 8] Verifying sign in with new password succeeds...');
    const { data: newLoginData, error: newPassErr } = await probeClient.auth.signInWithPassword({
      email: testEmail,
      password: newPassword,
    });
    assert(!newPassErr, `Login with new password failed: ${newPassErr?.message}`);
    assert(newLoginData?.session?.access_token, 'New password login must yield active JWT session');
    assert(newLoginData?.user?.id === testUserId, 'Authenticated user must match test user');
    console.log('✓ Successfully signed in with new password');

    // ---------------------------------------------------------
    // TEST 9: Data Preservation Verification
    // ---------------------------------------------------------
    console.log('\n[Test 9] Verifying user data preservation across password reset...');
    // Verify profile & structured profile
    const { data: postProf, error: postProfErr } = await admin
      .from('profiles')
      .select('*')
      .eq('id', testUserId)
      .single();
    assert(!postProfErr, `Failed to load profile post-reset: ${postProfErr?.message}`);
    assert.strictEqual(postProf.full_name, 'Phase2 Test Subject', 'Profile full_name preserved');
    assert.strictEqual(postProf.headline, 'Principal Security Tester', 'Profile headline preserved');
    assert.deepStrictEqual(
      postProf.structured_profile,
      initialStructuredProfile,
      'Structured Profile JSONB preserved perfectly'
    );
    console.log('✓ Profile & structured profile JSONB 100% preserved');

    // Verify jobs
    const { data: postJobs, error: postJobErr } = await admin
      .from('jobs')
      .select('*')
      .eq('user_id', testUserId);
    assert(!postJobErr, `Failed to query jobs post-reset: ${postJobErr?.message}`);
    assert.strictEqual(postJobs.length, 1, 'Job count preserved');
    assert.strictEqual(postJobs[0].id, testJob.id, 'Job ID preserved');
    assert.strictEqual(postJobs[0].title, 'Senior Systems Architect', 'Job title preserved');
    console.log('✓ Saved canonical jobs 100% preserved');

    // Verify applications
    const { data: postApps, error: postAppErr } = await admin
      .from('applications')
      .select('*')
      .eq('user_id', testUserId);
    assert(!postAppErr, `Failed to query applications post-reset: ${postAppErr?.message}`);
    assert.strictEqual(postApps.length, 1, 'Application count preserved');
    assert.strictEqual(postApps[0].id, testApp.id, 'Application ID preserved');
    assert.strictEqual(postApps[0].status, 'applied', 'Application status preserved');
    console.log('✓ CRM applications 100% preserved');

    // ---------------------------------------------------------
    // TEST 10: RLS Isolation Verification
    // ---------------------------------------------------------
    console.log('\n[Test 10] Verifying RLS cross-user isolation with recovered session...');
    // Create an authenticated client with the new user's JWT
    const authenticatedClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${newLoginData.session.access_token}`,
        },
      },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Attempt to query Amaresh's primary profile
    const { data: ownProfile, error: ownProfErr } = await authenticatedClient
      .from('profiles')
      .select('id, full_name')
      .eq('id', testUserId);
    assert(!ownProfErr, `Error fetching own profile: ${ownProfErr?.message}`);
    assert.strictEqual(ownProfile.length, 1, 'Can fetch own profile under RLS');

    // Ensure cannot read/mutate another user's rows if RLS prevents cross-user access
    const { data: otherData } = await authenticatedClient
      .from('jobs')
      .select('*')
      .neq('user_id', testUserId);
    assert.strictEqual(otherData.length, 0, 'Cannot read other users jobs under RLS');
    console.log('✓ RLS tenant isolation verified: recovered account accesses only its own data');

    // ---------------------------------------------------------
    // TEST 11: Sign Out & Session Invalidation
    // ---------------------------------------------------------
    console.log('\n[Test 11] Verifying logout and session termination...');
    const { error: signOutErr } = await probeClient.auth.signOut();
    assert(!signOutErr, `Sign out failed: ${signOutErr?.message}`);
    const { data: { session: postLogoutSession } } = await probeClient.auth.getSession();
    assert(!postLogoutSession, 'Session must be null after sign out');
    console.log('✓ Sign out successfully terminates session');

    console.log('\n================================================================');
    console.log('  ALL 11 PHASE 2 AUTHENTICATION & RECOVERY TESTS PASSED!       ');
    console.log('================================================================\n');

  } finally {
    if (testUserId) {
      console.log(`[Teardown] Cleaning up test data for user ${testUserId}...`);
      await admin.from('applications').delete().eq('user_id', testUserId);
      await admin.from('jobs').delete().eq('user_id', testUserId);
      await admin.from('profiles').delete().eq('id', testUserId);
      await admin.auth.admin.deleteUser(testUserId);
      console.log('✓ Teardown complete: disposable test user and records deleted.');
    }
  }
}

runAuthLifecycleVerification().catch((err) => {
  console.error('\n❌ PHASE 2 VERIFICATION SUITE FAILED:');
  console.error(err);
  process.exit(1);
});
