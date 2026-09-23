import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pftpqwndomydffsuxfje.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log('================================================================');
  console.log('  RJA v4.3 — PHASE 4: JOB MATCHING & CANDIDATE INTELLIGENCE     ');
  console.log('================================================================\n');

  const testRunId = Date.now();
  const testEmail = `rja.phase4.${testRunId}@gmail.com`;

  try {
    // -------------------------------------------------------------
    // SETUP: Create Verified Test Candidate with Structured Profile
    // -------------------------------------------------------------
    console.log('[Setup] Creating verified candidate with structured career evidence...');
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: testEmail,
      password: 'Phase4SecurePassword!2026',
      email_confirm: true,
      user_metadata: { full_name: 'Test Executive Candidate' },
    });
    if (authError || !authData.user) throw new Error(`Setup failed: ${authError?.message}`);
    const userId = authData.user.id;

    const candidateProfile = {
      full_name: 'Test Executive Candidate',
      headline: 'Senior Electrical Project Manager | High Voltage Substations & Commissioning',
      years_experience: 12,
      target_roles: ['Senior Electrical Project Manager', 'Engineering Project Manager', 'Grid Infrastructure Lead'],
      technical_domains: ['High Voltage Substations', 'Industrial Power Distribution', 'SCADA'],
      technical_skills: ['Electrical Engineering', 'Switchgear', 'Transformers', 'Protection Relays', 'Commissioning'],
      pm_leadership_skills: ['PMP', 'EPC Contract Management', 'Tendering', 'FAT/SAT Inspections'],
      certifications: ['PMP - Project Management Professional', 'Professional Engineer (PE)'],
      remote_preferences: {
        remote_only: true,
        timezones: ['UTC-5', 'UTC-8'],
        target_compensation: '$160,000 - $190,000',
      },
      shortlisted_jobs: [],
    };

    const { error: profErr } = await admin.from('profiles').upsert({
      id: userId,
      full_name: candidateProfile.full_name,
      headline: candidateProfile.headline,
      structured_profile: candidateProfile,
    });
    assert(!profErr, `Profile insertion failed: ${profErr?.message}`);
    console.log(`✓ Test candidate created: ${userId}`);

    // -------------------------------------------------------------
    // TEST 1: Candidate Intelligence Matching Engine Accuracy
    // -------------------------------------------------------------
    console.log('\n[Test 1] Verifying Candidate Intelligence Matching Engine...');
    const { computeCandidateJobMatch } = await import('../lib/matching/engine.ts');

    const highMatchJob = {
      title: 'Remote Senior Electrical Project Manager',
      company: 'GridScale Energy',
      description: 'Lead technical EPC execution, switchgear commissioning, and substation delivery remotely.',
      skills: ['Electrical Engineering', 'Commissioning', 'Switchgear', 'PMP'],
      location: '100% Remote',
      remote_status: '100% Remote',
      category: 'electrical',
    };

    const highMatchResult = computeCandidateJobMatch(highMatchJob, candidateProfile);

    assert(highMatchResult.fit_score >= 85, `Expected fit_score >= 85, got ${highMatchResult.fit_score}`);
    assert(highMatchResult.tier === 'exceptional' || highMatchResult.tier === 'strong', `Unexpected tier: ${highMatchResult.tier}`);
    assert.strictEqual(highMatchResult.dimensions.role_alignment, 25, 'Exact target role must yield 25 pts');
    assert(highMatchResult.dimensions.technical_skills >= 30, 'High technical overlap must yield >= 30 pts');
    assert(highMatchResult.dimensions.leadership >= 18, 'PMP + leadership skills must yield >= 18 pts');
    assert.strictEqual(highMatchResult.dimensions.seniority_remote, 20, 'Remote + 12 yrs exp must yield 20 pts');

    console.log(`✓ High-match job scored: ${highMatchResult.fit_score}% (${highMatchResult.tier})`);
    console.log(`  - Role Alignment: ${highMatchResult.dimensions.role_alignment}/25`);
    console.log(`  - Technical Skills: ${highMatchResult.dimensions.technical_skills}/35`);
    console.log(`  - Leadership: ${highMatchResult.dimensions.leadership}/20`);
    console.log(`  - Seniority & Remote: ${highMatchResult.dimensions.seniority_remote}/20`);

    // -------------------------------------------------------------
    // TEST 2: Explainability & Documented Evidence Alignment
    // -------------------------------------------------------------
    console.log('\n[Test 2] Verifying "Why You Match" Explainability...');
    assert(Array.isArray(highMatchResult.why_matched) && highMatchResult.why_matched.length >= 2, 'Must have at least 2 why_matched reasons');
    assert(highMatchResult.why_matched.some((w) => w.includes('target role')), 'Must mention target role alignment');
    assert(highMatchResult.why_matched.some((w) => w.includes('PMP') || w.includes('credentials')), 'Must mention PMP credential');
    assert(highMatchResult.matched_skills.includes('Electrical Engineering'), 'Must include matched skill');
    assert(typeof highMatchResult.strategic_advice === 'string' && highMatchResult.strategic_advice.length > 20, 'Must provide strategic advice');

    console.log('✓ Explainability statements verified:');
    highMatchResult.why_matched.forEach((w) => console.log(`  • ${w}`));
    console.log(`  💡 Strategic Advice: "${highMatchResult.strategic_advice}"`);

    // -------------------------------------------------------------
    // TEST 3: Low-Match Differentiation & Skill Gap Detection
    // -------------------------------------------------------------
    console.log('\n[Test 3] Verifying Low-Match Differentiation & Skill Gap Detection...');
    const lowMatchJob = {
      title: 'Pediatric Dental Anesthesiologist',
      company: 'Metro Dental Health',
      description: 'Provide clinical pediatric sedation, dental surgery support, and hospital credentialing.',
      skills: ['Pediatric Medicine', 'Anesthesia', 'Clinical Sedation', 'Dental Surgery'],
      location: 'Boston, MA (Onsite)',
      remote_status: 'Onsite',
      category: 'medical',
    };

    const lowMatchResult = computeCandidateJobMatch(lowMatchJob, candidateProfile);
    assert(lowMatchResult.fit_score < 70, `Expected low fit score < 70, got ${lowMatchResult.fit_score}`);
    assert.strictEqual(lowMatchResult.tier, 'exploratory');
    assert(lowMatchResult.missing_skills.length >= 3, 'Must identify clinical skills as missing gaps');
    console.log(`✓ Low-match role scored: ${lowMatchResult.fit_score}% (${lowMatchResult.tier}) with ${lowMatchResult.missing_skills.length} missing skill gaps`);

    // -------------------------------------------------------------
    // TEST 4: Live Discovered Jobs Database Seeding & Ingestion
    // -------------------------------------------------------------
    console.log('\n[Test 4] Seeding test discovered jobs in Supabase...');
    const testDiscoveredJobA = {
      external_id: `test:gridscale:elec-pm-${testRunId}`,
      title: `Director of Grid Infrastructure ${testRunId}`,
      company: 'GridScale Global',
      url: `https://gridscale.example.com/jobs/${testRunId}-a`,
      description: 'Executive leadership across utility grid interconnects and substation commissioning.',
      salary: '$180,000 - $210,000',
      location: '100% Remote',
      remote_status: '100% Remote',
      source: 'Greenhouse',
      category: 'electrical',
      skills: ['Electrical Engineering', 'Commissioning', 'Switchgear', 'PMP'],
      published_at: new Date(Date.now() - 3600000).toISOString(),
    };

    const testDiscoveredJobB = {
      external_id: `test:cloudsys:devops-${testRunId}`,
      title: `Junior Frontend QA Tester ${testRunId}`,
      company: 'CloudSys Apps',
      url: `https://cloudsys.example.com/jobs/${testRunId}-b`,
      description: 'Manual regression testing for consumer mobile apps.',
      salary: '$60,000 - $75,000',
      location: '100% Remote',
      remote_status: '100% Remote',
      source: 'Lever',
      category: 'software',
      skills: ['Manual QA', 'Jira', 'TestRail'],
      published_at: new Date(Date.now() - 7200000).toISOString(),
    };

    const { data: insertedJobs, error: insertError } = await admin
      .from('discovered_jobs')
      .upsert([testDiscoveredJobA, testDiscoveredJobB], { onConflict: 'external_id' })
      .select();

    if (insertError) throw new Error(`Database seeding failed: ${insertError.message}`);
    console.log(`✓ Seeded 2 test jobs into discovered_jobs`);

    const dbJobA = insertedJobs.find((j) => j.external_id === testDiscoveredJobA.external_id);
    const dbJobB = insertedJobs.find((j) => j.external_id === testDiscoveredJobB.external_id);

    // -------------------------------------------------------------
    // TEST 5: Ranking by Documented Fit Score
    // -------------------------------------------------------------
    console.log('\n[Test 5] Verifying Ranking by Documented Fit Score...');
    const matchA = computeCandidateJobMatch(dbJobA, candidateProfile);
    const matchB = computeCandidateJobMatch(dbJobB, candidateProfile);

    assert(matchA.fit_score > matchB.fit_score, `Job A score (${matchA.fit_score}) must exceed Job B score (${matchB.fit_score})`);
    console.log(`✓ Ranking verified: High-fit role ranked #1 (${matchA.fit_score}%) over low-fit role #2 (${matchB.fit_score}%)`);

    // -------------------------------------------------------------
    // TEST 6: Candidate Shortlisting System
    // -------------------------------------------------------------
    console.log('\n[Test 6] Verifying Candidate Shortlisting System...');
    // Shortlist Job A
    candidateProfile.shortlisted_jobs = [dbJobA.id];
    const { error: profileUpdateError } = await admin
      .from('profiles')
      .update({
        structured_profile: candidateProfile,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (profileUpdateError) throw new Error(`Shortlist update failed: ${profileUpdateError.message}`);

    // Read back
    const { data: verifyProfile } = await admin
      .from('profiles')
      .select('structured_profile')
      .eq('id', userId)
      .single();

    assert(verifyProfile.structured_profile.shortlisted_jobs.includes(dbJobA.id), 'Shortlist must persist job ID');
    console.log(`✓ Shortlist persisted successfully for job ${dbJobA.id}`);

    // -------------------------------------------------------------
    // TEST 7: 1-Click Select into Canonical Jobs & Applications
    // -------------------------------------------------------------
    console.log('\n[Test 7] Verifying 1-Click Select into Canonical Jobs & CRM...');
    const { data: canonicalJob, error: canJobError } = await admin
      .from('jobs')
      .insert({
        user_id: userId,
        title: dbJobA.title,
        company: dbJobA.company,
        url: dbJobA.url,
        application_url: dbJobA.url,
        description: dbJobA.description,
        salary: dbJobA.salary,
        location: dbJobA.location,
        remote_status: dbJobA.remote_status,
        source: dbJobA.source,
        metadata: {
          discovered_job_id: dbJobA.id,
          candidate_intelligence: matchA,
        },
      })
      .select()
      .single();

    if (canJobError) throw new Error(`Canonical job creation failed: ${canJobError.message}`);
    assert(canonicalJob.id, 'Canonical job must have UUID');

    const { data: appRow, error: appError } = await admin
      .from('applications')
      .insert({
        user_id: userId,
        job_id: canonicalJob.id,
        status: 'selected',
        route: 'website',
        applied_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (appError) throw new Error(`Application creation failed: ${appError.message}`);
    assert.strictEqual(appRow.status, 'selected');
    console.log(`✓ Canonical job created (${canonicalJob.id}) and linked to Application CRM (${appRow.id})`);

    // -------------------------------------------------------------
    // TEST 8: Teardown
    // -------------------------------------------------------------
    console.log('\n[Test 8] Cleaning up temporary test artifacts...');
    await admin.from('applications').delete().eq('id', appRow.id);
    await admin.from('jobs').delete().eq('id', canonicalJob.id);
    await admin.from('discovered_jobs').delete().ilike('external_id', `%${testRunId}%`);
    await admin.from('profiles').delete().eq('id', userId);
    await admin.auth.admin.deleteUser(userId);
    console.log('✓ Teardown complete: All temporary records deleted.');

    console.log('\n================================================================');
    console.log('  ALL 8 PHASE 4 MATCHING & INTELLIGENCE CHECKS PASSED!          ');
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n❌ PHASE 4 VERIFICATION FAILED:', err);
    process.exit(1);
  }
}

main();
