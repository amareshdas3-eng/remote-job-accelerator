// tests/schema_reconciliation_e2e.mjs
// Comprehensive End-to-End Verification of Real Persistence after Schema Reconciliation

import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

assert(SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL must be defined');
assert(SERVICE_KEY, 'SUPABASE_SERVICE_ROLE_KEY must be defined');

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('=== STARTING SCHEMA RECONCILIATION END-TO-END VERIFICATION ===\n');

  // Step 1: User & Profile Verification
  console.log('[Step 1] Verifying user & structured profile...');
  const { data: { users }, error: userErr } = await admin.auth.admin.listUsers();
  assert(!userErr, `Failed to list users: ${userErr?.message}`);
  const user = users.find((u) => u.email === 'amaresh.das3@gmail.com');
  assert(user, 'User amaresh.das3@gmail.com must exist');
  console.log(`✓ User found: ${user.id} (${user.email})`);

  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('id, full_name, headline, structured_profile')
    .eq('id', user.id)
    .single();
  assert(!profErr, `Profile read failed: ${profErr?.message}`);
  console.log(`✓ Profile loaded: "${profile.full_name}" - ${profile.headline}`);

  // Step 2: Canonical Job Selection & Persistence
  console.log('\n[Step 2] Selecting & persisting canonical job with application_url...');
  const timestamp = Date.now();
  const testJobPayload = {
    user_id: user.id,
    title: `Director of Grid Infrastructure ${timestamp}`,
    company: 'NextGrid Global Utilities',
    url: 'https://nextgrid.com/careers/grid-director',
    application_url: 'https://apply.nextgrid.com/portal/grid-director',
    company_website: 'https://nextgrid.com',
    remote_status: '100% Remote',
    location: '100% Remote (Global)',
    salary: '$185,000 – $220,000 / yr',
    employment_type: 'Full-time',
    source: 'NextGrid Official Portal',
    description: `About the Role:
NextGrid Global is looking for a Director of Grid Infrastructure to oversee remote electrical engineering, substation erection, testing, and commissioning across industrial sites.
Key Responsibilities:
• Lead technical design reviews and single-line diagrams for 220kV/400kV substations.
• Coordinate remote vendor audits, FAT/SAT inspections, and energization clearance.
• Manage P&L, contract schedules, and stakeholder reporting.`,
    metadata: { test: true, run_id: `e2e-${timestamp}` },
  };

  const { data: savedJob, error: jobInsertErr } = await admin
    .from('jobs')
    .insert(testJobPayload)
    .select()
    .single();

  assert(!jobInsertErr, `Jobs insert failed: ${jobInsertErr?.message}`);
  assert(savedJob.id, 'Persisted job must have a real database UUID');
  assert.strictEqual(savedJob.application_url, testJobPayload.application_url, 'application_url must match');
  assert.strictEqual(savedJob.company_website, testJobPayload.company_website, 'company_website must match');
  assert.strictEqual(savedJob.remote_status, '100% Remote', 'remote_status must match');
  console.log(`✓ Canonical job successfully persisted in Supabase:`);
  console.log(`  - Database ID: ${savedJob.id}`);
  console.log(`  - Title: ${savedJob.title}`);
  console.log(`  - Application URL: ${savedJob.application_url}`);

  // Step 3: AI Job Match Update Persistence
  console.log('\n[Step 3] Simulating AI job-match persistence...');
  const simulatedMatch = {
    score: 96,
    verdict: 'STRONG_MATCH',
    strengths: ['Industrial Electrical Engineering', 'Substation Commissioning', 'Project Management'],
    gaps: [],
    actions: ['Emphasize 400kV energization experience in ATS resume'],
  };

  const { data: updatedJobMatch, error: matchErr } = await admin
    .from('jobs')
    .update({ match: simulatedMatch, updated_at: new Date().toISOString() })
    .eq('id', savedJob.id)
    .select()
    .single();

  assert(!matchErr, `Failed to update job match: ${matchErr?.message}`);
  assert.strictEqual(updatedJobMatch.match.score, 96, 'Match score must persist');
  console.log(`✓ AI Job Match successfully persisted in jobs.match (score: ${updatedJobMatch.match.score})`);

  // Step 4: AI Resume Tailor Update Persistence
  console.log('\n[Step 4] Simulating AI resume-tailor persistence...');
  const simulatedTailoredResume = {
    headline: 'Director of Grid Infrastructure',
    ats_audit: { ats_score: 99, matched_keywords: ['Substation', 'Commissioning', 'Single-line diagrams'] },
    summary: 'Executive Electrical Engineering Director with 10+ years leading utility-scale grid projects.',
  };

  const { data: updatedJobResume, error: tailorErr } = await admin
    .from('jobs')
    .update({ tailored_resume: simulatedTailoredResume, updated_at: new Date().toISOString() })
    .eq('id', savedJob.id)
    .select()
    .single();

  assert(!tailorErr, `Failed to update tailored resume: ${tailorErr?.message}`);
  assert.strictEqual(updatedJobResume.tailored_resume.ats_audit.ats_score, 99);
  console.log(`✓ AI Tailored Resume successfully persisted in jobs.tailored_resume`);

  // Step 5: AI Cover Letter Update Persistence
  console.log('\n[Step 5] Simulating AI cover-letter persistence...');
  const simulatedCoverLetter = {
    subject: `Application: Director of Grid Infrastructure – ${profile.full_name}`,
    salutation: 'Dear NextGrid Hiring Team,',
    letter: 'I am writing to express my strong interest in the Director of Grid Infrastructure position...',
  };

  const { data: updatedJobLetter, error: letterErr } = await admin
    .from('jobs')
    .update({ cover_letter: simulatedCoverLetter, updated_at: new Date().toISOString() })
    .eq('id', savedJob.id)
    .select()
    .single();

  assert(!letterErr, `Failed to update cover letter: ${letterErr?.message}`);
  assert(updatedJobLetter.cover_letter.subject.includes('Director of Grid Infrastructure'));
  console.log(`✓ AI Cover Letter successfully persisted in jobs.cover_letter`);

  // Step 6: Application Creation & Persistence with applied_at
  console.log('\n[Step 6] Creating and persisting application with applied_at & route...');
  const appliedTimestamp = new Date().toISOString();
  const testAppPayload = {
    user_id: user.id,
    job_id: savedJob.id,
    company: savedJob.company,
    role: savedJob.title,
    job_url: savedJob.url,
    status: 'applied',
    route: 'website',
    route_details: { direct_portal: true, portal_url: savedJob.application_url },
    applied_at: appliedTimestamp,
    notes: 'Submitted via NextGrid official Workday portal. Tailored resume & cover letter uploaded.',
    next_action: 'Follow up with talent lead on LinkedIn',
    next_action_date: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  };

  const { data: savedApp, error: appInsertErr } = await admin
    .from('applications')
    .insert(testAppPayload)
    .select()
    .single();

  assert(!appInsertErr, `Applications insert failed: ${appInsertErr?.message}`);
  assert(savedApp.id, 'Application must have a real database UUID');
  assert.strictEqual(savedApp.status, 'applied', 'Application status must be applied');
  assert.strictEqual(savedApp.route, 'website', 'Route must be website');
  assert.strictEqual(
    new Date(savedApp.applied_at).getTime(),
    new Date(appliedTimestamp).getTime(),
    'applied_at must represent the identical point in time'
  );
  console.log(`✓ Application successfully persisted in Supabase:`);
  console.log(`  - Database ID: ${savedApp.id}`);
  console.log(`  - Status: ${savedApp.status}`);
  console.log(`  - Route: ${savedApp.route}`);
  console.log(`  - Applied At: ${savedApp.applied_at}`);

  // Step 7: Application Read-Back
  console.log('\n[Step 7] Reading application back from database...');
  const { data: retrievedApp, error: readBackErr } = await admin
    .from('applications')
    .select('*')
    .eq('id', savedApp.id)
    .single();

  assert(!readBackErr, `Application read-back failed: ${readBackErr?.message}`);
  assert.strictEqual(retrievedApp.id, savedApp.id);
  assert.strictEqual(retrievedApp.job_id, savedJob.id);
  assert.strictEqual(
    new Date(retrievedApp.applied_at).getTime(),
    new Date(appliedTimestamp).getTime()
  );
  console.log(`✓ Application verified via real read-back: confirmed in Supabase!`);

  // Step 8: Application Lifecycle Update (Interview)
  console.log('\n[Step 8] Updating application lifecycle to interview...');
  const { data: interviewApp, error: stageUpdateErr } = await admin
    .from('applications')
    .update({
      status: 'interview',
      notes: 'Passed initial screening; 1st technical panel scheduled.',
      updated_at: new Date().toISOString(),
    })
    .eq('id', savedApp.id)
    .select()
    .single();

  assert(!stageUpdateErr, `Stage update failed: ${stageUpdateErr?.message}`);
  assert.strictEqual(interviewApp.status, 'interview');
  assert.strictEqual(
    new Date(interviewApp.applied_at).getTime(),
    new Date(appliedTimestamp).getTime(),
    'applied_at must be preserved across stages'
  );
  console.log(`✓ Lifecycle transition verified: status -> ${interviewApp.status}, applied_at preserved.`);

  // Step 9: Clean Up Test Artifacts
  console.log('\n[Step 9] Cleaning up test records...');
  const { error: delAppErr } = await admin.from('applications').delete().eq('id', savedApp.id);
  assert(!delAppErr, `App delete failed: ${delAppErr?.message}`);
  const { error: delJobErr } = await admin.from('jobs').delete().eq('id', savedJob.id);
  assert(!delJobErr, `Job delete failed: ${delJobErr?.message}`);
  console.log('✓ Cleanup complete: All test artifacts safely removed.');

  console.log('\n=== ALL 9 END-TO-END SCHEMA RECONCILIATION CHECKS PASSED! ===');
}

main().catch((err) => {
  console.error('\n❌ E2E VERIFICATION FAILED:', err);
  process.exit(1);
});
