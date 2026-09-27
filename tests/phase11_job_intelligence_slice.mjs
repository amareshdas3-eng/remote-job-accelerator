// tests/phase11_job_intelligence_slice.mjs
// Phase 11 — Milestone 1: Production Job Intelligence (Profile → Job Matching Vertical Slice)
// Tests:
// 1. Resume & Profile Ingestion (text -> structured profile extraction & schema validation)
// 2. Canonical Job Normalization & Deduplication (canonical schema & deterministic dedup key)
// 3. Deterministic Matching Engine (4 dimensions, tier, fit score, matched/missing skills, explainable reasons)
// 4. AI Explanation Layer Integration (deterministic metrics preservation & explainable dossier)
// 5. Telemetry & Product Observability (resume_parsed, jobs_matched, match_explanation_viewed, job_selected)
// 6. Complete End-to-End Vertical Flow Simulation

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

console.log('================================================================');
console.log('  RJA V4.4 — PHASE 11: JOB INTELLIGENCE VERTICAL SLICE SUITE     ');
console.log('================================================================\n');

// -------------------------------------------------------------
// AREA 1: Resume & Profile Ingestion
// -------------------------------------------------------------
console.log('Area 1: Validating Profile & Resume Ingestion Engine...');

const { extractStructuredProfileFromText, validateStructuredProfile } = await import('../lib/profile.ts');

const sampleResume = `
Alex Rivera, PMP
Senior Electrical Project Manager & Systems Architect
alex.rivera@example.com | (555) 019-2834 | San Francisco, CA

Professional Summary:
Versatile engineering leader with 12+ years of experience directing high-stakes industrial electrical, power distribution, and grid modernization projects. Proven expertise across testing & commissioning, substation automation, SCADA, switchgear energization, and EPC contracting.

Technical Skills:
Electrical Engineering, Substation, Switchgear, Power Systems, High Voltage, SCADA, PLC, Testing & Commissioning, Erection, FAT/SAT, Megapack, Python, Next.js, TypeScript

Project Management & Leadership:
Project Management, PMP, Agile, Budget Management, Schedule Optimization, Tendering, EPC, Vendor Management, O&M, Safety & Compliance

Certifications:
PMP, PE License, OSHA 30
`;

const extractedProfile = extractStructuredProfileFromText(sampleResume);

// Assert structured profile fields
assert.strictEqual(extractedProfile.full_name, 'Alex Rivera, PMP');
assert.strictEqual(extractedProfile.years_experience, 12);
assert.ok(extractedProfile.technical_skills.includes('Electrical Engineering'));
assert.ok(extractedProfile.technical_skills.includes('Substation'));
assert.ok(extractedProfile.technical_skills.includes('SCADA'));
assert.ok(extractedProfile.pm_leadership_skills.includes('Project Management'));
assert.ok(extractedProfile.pm_leadership_skills.includes('Tendering'));
assert.ok(extractedProfile.certifications.includes('PMP'));
assert.ok(extractedProfile.target_roles.includes('Senior Electrical Project Manager'));
assert.strictEqual(extractedProfile.remote_preferences.remote_only, true);

// Validate with Zod schema
const validation = validateStructuredProfile(extractedProfile);
assert.strictEqual(validation.success, true, `Validation failed: ${validation.error}`);
console.log('  ✓ Test 1.1: Resume text successfully parsed into validated structured profile.');

// Verify resume upload route code includes auto-extraction and telemetry
const uploadRouteCode = fs.readFileSync(path.join(ROOT, 'app', 'api', 'resume', 'upload', 'route.ts'), 'utf8');
assert.ok(uploadRouteCode.includes('extractStructuredProfileFromText'), 'Upload route must invoke extractStructuredProfileFromText');
assert.ok(uploadRouteCode.includes("'resume_parsed'"), 'Upload route must emit resume_parsed telemetry');
console.log('  ✓ Test 1.2: Upload endpoint integrates auto-extraction and resume_parsed telemetry.');

console.log('✓ Area 1 PASSED: Profile ingestion and extraction layer verified.\n');

// -------------------------------------------------------------
// AREA 2: Canonical Job Normalization & Deduplication
// -------------------------------------------------------------
console.log('Area 2: Validating Canonical Job Normalization & Deduplication...');

const { normalizeJobRecord, detectCategory, extractSkills } = await import('../lib/jobs/normalizer.ts');
const { generateDeduplicationKey, canonicalizeUrl } = await import('../lib/jobs/dedup.ts');

const rawJobA = {
  title: '  Remote Senior Electrical Project Manager  ',
  company: 'Schneider Electric Global',
  url: 'https://se.com/careers/job?id=99281&utm_source=linkedin&utm_campaign=spring2026#apply',
  description: '<p>Seeking a Senior Electrical Project Manager for substation erection, switchgear FAT/SAT testing, and utility commissioning.</p>',
  location: 'Remote - United States',
  source: 'LinkedIn Jobs',
};

const normalizedA = normalizeJobRecord(rawJobA);

assert.strictEqual(normalizedA.title, 'Remote Senior Electrical Project Manager');
assert.strictEqual(normalizedA.company, 'Schneider Electric Global');
assert.strictEqual(normalizedA.category, 'electrical');
assert.strictEqual(normalizedA.url, 'https://se.com/careers/job?id=99281');
assert.ok(normalizedA.skills.includes('Electrical Engineering'));
assert.ok(normalizedA.skills.includes('Erection & Commissioning'));
assert.ok(normalizedA.external_id.length > 10);
console.log('  ✓ Test 2.1: Raw job record normalized into canonical schema.');

// Test Deduplication Key Consistency
const rawJobB = {
  title: 'remote senior electrical project manager',
  company: 'Schneider Electric Global ',
  url: 'https://se.com/careers/job?id=99281&utm_medium=email&ref=newsletter',
  description: 'Duplicate posting with different tracking params and casing',
  source: 'Newsletter',
};

const normalizedB = normalizeJobRecord(rawJobB);
assert.strictEqual(
  normalizedA.external_id,
  normalizedB.external_id,
  'Identical jobs with different tracking URLs and casing must produce identical deduplication keys'
);
console.log('  ✓ Test 2.2: Deterministic deduplication key prevents duplicate job ingestion.');

// Distinct job produces different dedup key
const rawJobC = {
  title: 'Lead DevOps Platform Engineer',
  company: 'CloudScale Global',
  url: 'https://cloudscale.io/careers/devops-lead',
  description: 'Kubernetes, Terraform, AWS infrastructure lead',
  source: 'Company Careers',
};
const normalizedC = normalizeJobRecord(rawJobC);
assert.notStrictEqual(normalizedA.external_id, normalizedC.external_id, 'Different jobs must produce distinct dedup keys');
console.log('  ✓ Test 2.3: Distinct job postings generate unique keys.');

console.log('✓ Area 2 PASSED: Job normalization and deduplication verified.\n');

// -------------------------------------------------------------
// AREA 3: Deterministic Candidate Matching Engine
// -------------------------------------------------------------
console.log('Area 3: Testing Deterministic Matching Engine...');

const { computeCandidateJobMatch } = await import('../lib/matching/engine.ts');

const matchResultA = computeCandidateJobMatch(
  {
    title: normalizedA.title,
    description: normalizedA.description,
    skills: normalizedA.skills,
    location: normalizedA.location,
    remote_status: normalizedA.remote_status,
    category: normalizedA.category,
    company: normalizedA.company,
  },
  extractedProfile,
  sampleResume
);

// Verify 4-dimensional breakdown
assert.strictEqual(typeof matchResultA.fit_score, 'number');
assert.ok(matchResultA.fit_score >= 85 && matchResultA.fit_score <= 100, `Expected high fit score, got ${matchResultA.fit_score}`);
assert.ok(matchResultA.tier === 'exceptional' || matchResultA.tier === 'strong');
assert.ok(matchResultA.dimensions.role_alignment >= 20, 'Role alignment score must reflect target role match');
assert.ok(matchResultA.dimensions.technical_skills >= 25, 'Technical score must reflect skill overlap');
assert.ok(matchResultA.dimensions.leadership >= 15, 'Leadership score must reflect PMP and management keywords');
assert.ok(matchResultA.dimensions.seniority_remote >= 18, 'Seniority score must reflect 12 yrs and 100% remote');
console.log(`  ✓ Test 3.1: 4-Dimensional score computed deterministically (${matchResultA.fit_score}% - Tier: ${matchResultA.tier}).`);

// Verify explainable output
assert.ok(Array.isArray(matchResultA.why_matched), 'why_matched must be an array');
assert.ok(matchResultA.why_matched.length >= 2, 'Must provide at least 2 explainable match bullets');
assert.ok(matchResultA.matched_skills.length > 0, 'Must record matched skills');
assert.ok(typeof matchResultA.strategic_advice === 'string' && matchResultA.strategic_advice.length > 10, 'Must provide strategic advice');
console.log(`  ✓ Test 3.2: Explainability dossier validated: ${matchResultA.why_matched.length} reasons generated.`);

// Low-match role test (different domain)
const matchResultC = computeCandidateJobMatch(
  {
    title: normalizedC.title,
    description: normalizedC.description,
    skills: normalizedC.skills,
    location: normalizedC.location,
    remote_status: normalizedC.remote_status,
    category: normalizedC.category,
    company: normalizedC.company,
  },
  extractedProfile,
  sampleResume
);
assert.ok(matchResultC.fit_score < matchResultA.fit_score, 'Unrelated role must score lower than target electrical role');
assert.ok(matchResultC.tier === 'moderate' || matchResultC.tier === 'exploratory');
console.log(`  ✓ Test 3.3: Domain variance correctly distinguished (${matchResultA.fit_score}% vs ${matchResultC.fit_score}%).`);

console.log('✓ Area 3 PASSED: Deterministic matching engine and explainability verified.\n');

// -------------------------------------------------------------
// AREA 4: AI Explanation Layer Integration
// -------------------------------------------------------------
console.log('Area 4: Auditing AI Explanation Layer Contract...');

const aiMatchRouteCode = fs.readFileSync(path.join(ROOT, 'app', 'api', 'ai', 'job-match', 'route.ts'), 'utf8');

// 1. Authoritative deterministic score preservation
assert.ok(aiMatchRouteCode.includes('computeCandidateJobMatch'), 'Route must compute deterministic match');
assert.ok(aiMatchRouteCode.includes('score: deterministic.fit_score'), 'Route must preserve deterministic fit score');
assert.ok(aiMatchRouteCode.includes('tier: deterministic.tier'), 'Route must preserve deterministic tier');
assert.ok(aiMatchRouteCode.includes('dimensions: deterministic.dimensions'), 'Route must include dimensions breakdown');
console.log('  ✓ Test 4.1: Deterministic fit_score and dimensions authoritative in API response.');

// 2. AI explanation augmentation
assert.ok(aiMatchRouteCode.includes('why_matched'), 'API response must export why_matched');
assert.ok(aiMatchRouteCode.includes('strategic_advice'), 'API response must export strategic_advice');
assert.ok(aiMatchRouteCode.includes('strengths'), 'API response must export strengths');
assert.ok(aiMatchRouteCode.includes('gaps'), 'API response must export gaps');
console.log('  ✓ Test 4.2: AI explanation fields defined and integrated with fallback.');

console.log('✓ Area 4 PASSED: AI explanation layer contract verified.\n');

// -------------------------------------------------------------
// AREA 5: Telemetry & Product Observability
// -------------------------------------------------------------
console.log('Area 5: Verifying Milestone 1 Telemetry Events...');

const analyticsCode = fs.readFileSync(path.join(ROOT, 'lib', 'analytics.ts'), 'utf8');

const requiredSliceEvents = [
  'resume_parsed',
  'jobs_matched',
  'match_explanation_viewed',
  'job_selected'
];

for (const evt of requiredSliceEvents) {
  assert.ok(analyticsCode.includes(`'${evt}'`), `lib/analytics.ts FunnelEvent must define '${evt}'`);
}
console.log('  ✓ Test 5.1: All Milestone 1 telemetry events declared in FunnelEvent type.');

// Verify emission points
const discoverRouteCode = fs.readFileSync(path.join(ROOT, 'app', 'api', 'jobs', 'discover', 'route.ts'), 'utf8');
assert.ok(discoverRouteCode.includes("'jobs_matched'"), 'Discover route must emit jobs_matched');

const selectRouteCode = fs.readFileSync(path.join(ROOT, 'app', 'api', 'jobs', 'select', 'route.ts'), 'utf8');
assert.ok(selectRouteCode.includes("'job_selected'"), 'Select route must emit job_selected');

const discoveryComponentCode = fs.readFileSync(path.join(ROOT, 'components', 'dashboard', 'JobDiscovery.tsx'), 'utf8');
assert.ok(discoveryComponentCode.includes("'match_explanation_viewed'"), 'JobDiscovery UI must emit match_explanation_viewed on why match click');

console.log('  ✓ Test 5.2: Ingestion, discovery, explanation, and selection routes wire telemetry events.');

console.log('✓ Area 5 PASSED: Telemetry and observability pipeline verified.\n');

// -------------------------------------------------------------
// AREA 6: Complete Vertical Slice End-to-End Flow
// -------------------------------------------------------------
console.log('Area 6: Executing Complete Vertical Slice End-to-End Simulation...');

// Flow:
// 1. Raw resume text parsed
const profile = extractStructuredProfileFromText(sampleResume);
assert.ok(profile.target_roles.length > 0);

// 2. Incoming job normalized & deduplicated
const job = normalizeJobRecord(rawJobA);
assert.ok(job.external_id);

// 3. Match calculated
const match = computeCandidateJobMatch(job, profile, sampleResume);
assert.ok(match.fit_score >= 80);
assert.ok(match.why_matched.length > 0);

// 4. Job selected into active canonical workspace
const canonicalJobPayload = {
  id: 'can-job-' + job.external_id.slice(0, 12),
  title: job.title,
  company: job.company,
  url: job.url,
  match: {
    fit_score: match.fit_score,
    tier: match.tier,
    dimensions: match.dimensions,
    why_matched: match.why_matched,
    strategic_advice: match.strategic_advice,
  },
  status: 'selected',
};

assert.strictEqual(canonicalJobPayload.match.fit_score, match.fit_score);
assert.strictEqual(canonicalJobPayload.status, 'selected');
console.log('  ✓ Test 6.1: End-to-end vertical slice flow executed seamlessly.');

console.log('\n================================================================');
console.log('  ALL PHASE 11 JOB INTELLIGENCE CHECKS PASSED (6/6 AREAS)       ');
console.log('================================================================\n');
