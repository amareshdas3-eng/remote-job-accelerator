// tests/phase3_job_ingestion.mjs
// Comprehensive End-to-End Verification of Phase 3: Production Real Job Ingestion & Discovery

import assert from 'node:assert';
import { createClient } from '@supabase/supabase-js';
import { normalizeJobRecord, stripHtml, detectCategory, extractSkills } from '../lib/jobs/normalizer.ts';
import { canonicalizeUrl, generateDeduplicationKey } from '../lib/jobs/dedup.ts';
import { extractJsonLdJob } from '../lib/jobs/adapters/jsonld.ts';
import { persistDiscoveredJobs } from '../lib/jobs/ingestion.ts';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

assert(SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL must be defined');
assert(SERVICE_KEY, 'SUPABASE_SERVICE_ROLE_KEY must be defined');

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('================================================================');
  console.log('  RJA v4.3 — PHASE 3 JOB INGESTION & DISCOVERY TEST SUITE       ');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const testPrefix = `phase3-test-${timestamp}`;

  try {
    // -------------------------------------------------------------
    // TEST 1: URL Canonicalization & Deduplication Keys
    // -------------------------------------------------------------
    console.log('[Test 1] Verifying URL canonicalization and deduplication keys...');
    const messyUrl = 'https://boards.greenhouse.io/automattic/jobs/12345/?utm_source=linkedin&ref=board#apply';
    const cleanUrl = canonicalizeUrl(messyUrl);
    assert.strictEqual(cleanUrl, 'https://boards.greenhouse.io/automattic/jobs/12345');

    const key1 = generateDeduplicationKey('Automattic Inc.', 'Senior Systems Architect', cleanUrl, '12345', 'greenhouse');
    const key2 = generateDeduplicationKey('Automattic Inc.', 'Senior Systems Architect', messyUrl, '12345', 'greenhouse');
    assert.strictEqual(key1, key2, 'Keys must be identical regardless of tracking query parameters');
    console.log(`✓ Deduplication key verified: ${key1}`);

    // -------------------------------------------------------------
    // TEST 2: Normalization, Category Detection & Skill Extraction
    // -------------------------------------------------------------
    console.log('\n[Test 2] Verifying canonical job normalization & categorization...');
    const rawHtmlDesc = `<p>We are seeking a <strong>Remote Electrical Project Manager</strong> to oversee substation commissioning, switchgear installation, and PMP schedule governance.</p><script>alert('malicious')</script>`;
    const stripped = stripHtml(rawHtmlDesc);
    assert(!stripped.includes('<script>'), 'HTML tags must be completely stripped');
    assert(stripped.includes('substation commissioning'), 'Content must be preserved');

    const detectedCat = detectCategory('Remote Senior Electrical Project Manager', stripped);
    assert.strictEqual(detectedCat, 'electrical', 'Category must be electrical');

    const skills = extractSkills('Remote Senior Electrical Project Manager', stripped);
    assert(skills.includes('Electrical Engineering'), 'Skills must detect Electrical Engineering');
    assert(skills.includes('Erection & Commissioning'), 'Skills must detect Erection & Commissioning');
    assert(skills.includes('Project Management'), 'Skills must detect Project Management');
    console.log(`✓ Skills extracted: [${skills.join(', ')}]`);

    const normalized = normalizeJobRecord({
      native_id: `${testPrefix}-1`,
      title: 'Principal Grid Systems Engineer',
      company: 'NextGrid Utilities',
      url: `https://nextgrid.example.com/jobs/${testPrefix}-1`,
      description: rawHtmlDesc,
      salary: '$180,000 – $220,000 / yr',
      location: '100% Remote (Global)',
      source: 'Greenhouse (NextGrid)',
    });
    assert.strictEqual(normalized.remote_status, '100% Remote (Global)');
    assert.strictEqual(normalized.category, 'electrical');
    assert(normalized.external_id.length > 0);
    console.log('✓ Normalization pipeline produced compliant NormalizedJob record');

    // -------------------------------------------------------------
    // TEST 3: Schema.org JSON-LD Web Extraction
    // -------------------------------------------------------------
    console.log('\n[Test 3] Verifying Schema.org JobPosting JSON-LD extractor...');
    const sampleHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org/",
              "@type": "JobPosting",
              "title": "Staff Cloud Systems Architect",
              "description": "<p>Lead technical execution for global distributed Kubernetes systems.</p>",
              "datePosted": "2026-09-20",
              "hiringOrganization": {
                "@type": "Organization",
                "name": "CloudScale Global"
              },
              "jobLocationType": "TELECOMMUTE",
              "baseSalary": {
                "@type": "MonetaryAmount",
                "currency": "USD",
                "value": {
                  "@type": "QuantitativeValue",
                  "minValue": 190000,
                  "maxValue": 230000,
                  "unitText": "YEAR"
                }
              }
            }
          </script>
        </head>
        <body>Job page content</body>
      </html>
    `;

    const extracted = extractJsonLdJob(sampleHtml, 'https://cloudscale.example.com/careers/staff-arch');
    assert(extracted !== null, 'JSON-LD extraction must succeed');
    assert.strictEqual(extracted.title, 'Staff Cloud Systems Architect');
    assert.strictEqual(extracted.company, 'CloudScale Global');
    assert.strictEqual(extracted.remote_status, '100% Remote');
    assert(extracted.salary?.includes('190000'));
    console.log(`✓ JSON-LD extracted: "${extracted.title}" at ${extracted.company} (${extracted.salary})`);

    // -------------------------------------------------------------
    // TEST 4: Supabase discovered_jobs Persistence & Upsert
    // -------------------------------------------------------------
    console.log('\n[Test 4] Testing live Supabase discovered_jobs persistence...');
    const testBatch = [
      normalizeJobRecord({
        native_id: `${testPrefix}-job1`,
        title: `Remote Grid Automation Lead ${timestamp}`,
        company: 'Apex Power Dynamics',
        url: `https://apexpower.example.com/jobs/${testPrefix}-1`,
        description: 'Lead remote substation and high-voltage grid automation projects.',
        salary: '$160,000 – $195,000 / yr',
        location: '100% Remote (US)',
        source: 'Lever (Apex Power)',
        category: 'electrical',
        skills: ['Electrical Engineering', 'SCADA', 'Project Management'],
      }),
      normalizeJobRecord({
        native_id: `${testPrefix}-job2`,
        title: `Remote EPC Project Director ${timestamp}`,
        company: 'Titan Infrastructure Partners',
        url: `https://titaninfra.example.com/jobs/${testPrefix}-2`,
        description: 'Supervise multi-site erection and commissioning schedules remotely.',
        salary: '$175,000 – $210,000 / yr',
        location: '100% Remote (Global)',
        source: 'RemoteOK',
        category: 'project_management',
        skills: ['Erection & Commissioning', 'Project Management', 'PMP'],
      }),
    ];

    const { inserted, errors } = await persistDiscoveredJobs(testBatch);
    assert.strictEqual(errors.length, 0, `Database errors occurred: ${errors.join(', ')}`);
    assert.strictEqual(inserted, 2, 'Must successfully insert 2 test jobs');
    console.log(`✓ Successfully persisted ${inserted} jobs into Supabase discovered_jobs`);

    // Re-upsert identical batch to test deduplication idempotency
    const { inserted: reInserted, errors: reErrors } = await persistDiscoveredJobs(testBatch);
    assert.strictEqual(reErrors.length, 0, 'Re-upsert must not cause conflicts');
    assert.strictEqual(reInserted, 2, 'Re-upsert successfully handles onConflict');
    console.log('✓ Idempotent upsert verified: zero duplicate entries created on re-ingestion');

    // -------------------------------------------------------------
    // TEST 5: Verify Querying from Supabase discovered_jobs
    // -------------------------------------------------------------
    console.log('\n[Test 5] Querying persisted jobs from discovered_jobs...');
    const { data: queriedJobs, count: totalFound, error: queryErr } = await admin
      .from('discovered_jobs')
      .select('*', { count: 'exact' })
      .ilike('company', '%Apex Power%');

    assert(!queryErr, `Query failed: ${queryErr?.message}`);
    assert(queriedJobs && queriedJobs.length > 0, 'Must retrieve the persisted Apex Power job');
    const targetJob = queriedJobs[0];
    assert(targetJob.title.includes('Remote Grid Automation Lead'));
    assert.strictEqual(targetJob.remote_status, '100% Remote (US)');
    assert.strictEqual(targetJob.source, 'Lever (Apex Power)');
    console.log(`✓ Retrieved persisted discovered job: ${targetJob.id} (${targetJob.title})`);

    // -------------------------------------------------------------
    // TEST 6: Discovered Job → Canonical Job Conversion
    // -------------------------------------------------------------
    console.log('\n[Test 6] Verifying conversion of discovered_job into canonical user job...');
    const { data: { users } } = await admin.auth.admin.listUsers();
    assert(users.length > 0, 'At least one user must exist for testing');
    const testUser = users[0];

    // Simulate /api/jobs/select with discovered_job_id
    const canonicalPayload = {
      user_id: testUser.id,
      title: targetJob.title,
      company: targetJob.company,
      url: targetJob.url,
      application_url: targetJob.url,
      description: targetJob.description,
      salary: targetJob.salary,
      location: targetJob.location,
      remote_status: targetJob.remote_status,
      source: targetJob.source,
      metadata: {
        discovered_job_id: targetJob.id,
        category: targetJob.category,
        skills: targetJob.skills,
      },
    };

    const { data: canonicalJob, error: canErr } = await admin
      .from('jobs')
      .insert(canonicalPayload)
      .select()
      .single();

    assert(!canErr, `Failed to create canonical job: ${canErr?.message}`);
    assert(canonicalJob.id, 'Canonical job must have UUID');
    assert.strictEqual(canonicalJob.metadata.discovered_job_id, targetJob.id);
    console.log(`✓ Canonical job created from discovered job: ${canonicalJob.id}`);

    // Create linked application record with status 'selected'
    const { data: appRow, error: appErr } = await admin
      .from('applications')
      .insert({
        user_id: testUser.id,
        job_id: canonicalJob.id,
        company: canonicalJob.company,
        role: canonicalJob.title,
        job_url: canonicalJob.url,
        status: 'selected',
        notes: `Selected from discovered job ${targetJob.id}`,
      })
      .select()
      .single();

    assert(!appErr, `Application creation failed: ${appErr?.message}`);
    assert.strictEqual(appRow.status, 'selected');
    console.log(`✓ Application pipeline dossier established: ${appRow.id} (status: selected)`);

    // -------------------------------------------------------------
    // TEST 7: Live Adapter Pipeline & Fallback Handling
    // -------------------------------------------------------------
    console.log('\n[Test 7] Verifying live job adapters and URL parsers...');
    const { GreenhouseAdapter } = await import('../lib/jobs/adapters/greenhouse.ts');
    const { LeverAdapter } = await import('../lib/jobs/adapters/lever.ts');
    const { RemoteOKAdapter } = await import('../lib/jobs/adapters/remoteok.ts');

    const gh = new GreenhouseAdapter();
    const lev = new LeverAdapter();
    const rok = new RemoteOKAdapter();

    assert.strictEqual(gh.name, 'greenhouse');
    assert.strictEqual(lev.name, 'lever');
    assert.strictEqual(rok.name, 'remoteok');

    // Test URL format parsing
    const invalidGh = await gh.fetchJobByUrl('https://invalid.domain.com/no-job');
    assert.strictEqual(invalidGh, null, 'Invalid domain must return null');

    const invalidLev = await lev.fetchJobByUrl('https://invalid.domain.com/no-job');
    assert.strictEqual(invalidLev, null, 'Invalid domain must return null');
    console.log('✓ Job source adapters verified with clean null fallbacks on unapproved URLs');

    // -------------------------------------------------------------
    // TEST 8: Single Job URL Ingest with Custom Text Fallback
    // -------------------------------------------------------------
    console.log('\n[Test 8] Verifying ingestJobFromUrl with custom text fallback...');
    const { ingestJobFromUrl } = await import('../lib/jobs/ingestion.ts');
    const customTestJob = await ingestJobFromUrl(
      `https://careers.spacex.example.com/jobs/${testPrefix}-custom`,
      `Senior Propulsion Test Director\nSpaceX Infrastructure\nResponsible for test and commissioning of Starship stage systems remotely.`
    );
    assert(customTestJob !== null, 'Ingest with custom text must succeed');
    assert.strictEqual(customTestJob.title, 'Senior Propulsion Test Director');
    console.log(`✓ Ingested custom job successfully: "${customTestJob.title}" at ${customTestJob.company}`);

    // -------------------------------------------------------------
    // TEST 9: Teardown Test Data
    // -------------------------------------------------------------
    console.log('\n[Test 9] Cleaning up test records...');
    await admin.from('applications').delete().eq('id', appRow.id);
    await admin.from('jobs').delete().eq('id', canonicalJob.id);
    await admin.from('discovered_jobs').delete().ilike('external_id', `%${testPrefix}%`);
    console.log('✓ Teardown complete: All temporary records removed.');

    console.log('\n================================================================');
    console.log('  ALL 9 PHASE 3 INGESTION & DISCOVERY CHECKS PASSED!            ');
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ PHASE 3 VERIFICATION FAILED:');
    console.error(err);
    process.exit(1);
  }
}

main();
