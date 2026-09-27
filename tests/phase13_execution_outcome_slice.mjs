// tests/phase13_execution_outcome_slice.mjs
// Phase 13 / v4.6: Controlled Application Execution & Outcome Intelligence Vertical Slice
// Verifies:
// 1. Evidence Snapshotting (immutable profile capture with SHA-256 hash)
// 2. Artifact Cryptographic Fingerprinting (deterministic SHA-256 over approved package)
// 3. Human Approval Enforcement (blocks execution if unsigned/unapproved)
// 4. Approved-Content Mutation Hard Block (SHA-256 mismatch halts dispatch)
// 5. Idempotent Execution Protection (blocks duplicate submission to same destination)
// 6. Auditable Submission Receipts (captures confirmation ID and verified fingerprint)
// 7. Event-Sourced Outcome State Machine (applied -> response -> interview -> offer)
// 8. Career ROI Conversion Analytics (app->response, interview->offer conversion rates & timelines)
// 9. Telemetry & Observability Pipeline
// 10. Complete End-to-End Vertical Slice Execution

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

console.log('================================================================');
console.log('  RJA V4.6 — PHASE 13: EXECUTION & OUTCOME INTELLIGENCE SUITE  ');
console.log('================================================================\n');

// -------------------------------------------------------------
// Test Fixtures
// -------------------------------------------------------------
const candidateProfile = {
  full_name: 'Jordan Vance, PE',
  headline: 'Principal Infrastructure Engineer & Grid Modernization Architect',
  years_experience: 14,
  technical_skills: ['Power Systems', 'SCADA', 'Substation Automation', 'Switchgear', 'Python', 'Go'],
  technical_domains: ['High Voltage', 'Testing & Commissioning', 'EPC'],
  pm_leadership_skills: ['Engineering Management', 'Tendering', 'Budget Governance'],
  certifications: ['PE License', 'PMP'],
  target_roles: ['Principal Systems Architect', 'Director of Engineering'],
  remote_preferences: { remote_only: true },
};

const approvedContent = {
  resume: {
    headline: 'Principal Infrastructure Engineer',
    summary: '14+ years directing high-voltage substation engineering and grid systems.',
    full_resume: 'Jordan Vance, PE, PMP. 14+ years directing high-voltage substation engineering.',
  },
  cover_letter: {
    recipient: 'Hiring Committee at GridScale Power',
    letter: 'Dear Hiring Committee, with 14 years in power distribution and verified PE licensure...',
  },
  screening_answers: {
    answers: [
      { question: 'Describe your remote autonomy.', answer: 'Over a decade leading asynchronous engineering teams.' },
      { question: 'What is your notice period?', answer: 'Ready to transition in standard 3 weeks notice.' },
    ],
  },
};

// -------------------------------------------------------------
// AREA 1: Immutable Evidence Snapshotting
// -------------------------------------------------------------
console.log('Area 1: Validating Immutable Evidence Snapshotting...');

const { createEvidenceSnapshot } = await import('../lib/execution/snapshot.ts');

const snapshot = createEvidenceSnapshot(
  'cand-jordan-77',
  candidateProfile,
  'Jordan Vance, PE, PMP. 14 years experience.'
);

assert.ok(snapshot.id.startsWith('ev-snap-'), 'Snapshot ID must have ev-snap- prefix');
assert.strictEqual(snapshot.candidate_id, 'cand-jordan-77');
assert.strictEqual(snapshot.evidence_hash.length, 64, 'Evidence hash must be 64-character SHA-256 hex string');
assert.strictEqual(snapshot.profile_data.full_name, 'Jordan Vance, PE');

// Test Deep Clone Immutability: Mutating candidateProfile after snapshot must NOT change snapshot
candidateProfile.years_experience = 99;
assert.strictEqual(snapshot.profile_data.years_experience, 14, 'Snapshot must be strictly immutable against candidate profile changes');
candidateProfile.years_experience = 14; // restore

console.log(`  ✓ Test 1.1: Evidence snapshot generated with deterministic SHA-256 (${snapshot.id}).`);
console.log(`  ✓ Test 1.2: Deep clone immutability confirmed against subsequent profile mutations.`);
console.log('✓ Area 1 PASSED: Evidence snapshotting verified.\n');

// -------------------------------------------------------------
// AREA 2: Artifact Cryptographic Fingerprinting
// -------------------------------------------------------------
console.log('Area 2: Testing Artifact Cryptographic Fingerprinting...');

const { computeArtifactFingerprint, verifyArtifactFingerprint } = await import('../lib/execution/fingerprint.ts');

const fingerprint = computeArtifactFingerprint(approvedContent);

assert.strictEqual(fingerprint.algorithm, 'sha256');
assert.strictEqual(fingerprint.hash.length, 64, 'Artifact fingerprint must be 64-char hex string');
assert.strictEqual(fingerprint.components.answers_count, 2);

// Verification test
const verifyMatch = verifyArtifactFingerprint(approvedContent, fingerprint.hash);
assert.strictEqual(verifyMatch.valid, true, 'Original content must match its computed fingerprint');

// Character mutation test
const mutatedContent = JSON.parse(JSON.stringify(approvedContent));
mutatedContent.cover_letter.letter += ' Additional unapproved modification.';
const verifyMismatch = verifyArtifactFingerprint(mutatedContent, fingerprint.hash);
assert.strictEqual(verifyMismatch.valid, false, 'Mutated content must not match approved fingerprint');
assert.notStrictEqual(verifyMismatch.actualHash, fingerprint.hash);

console.log(`  ✓ Test 2.1: Artifact fingerprint generated (${fingerprint.hash.slice(0, 16)}...).`);
console.log(`  ✓ Test 2.2: Fingerprint verification accurately detects sub-string mutations.`);
console.log('✓ Area 2 PASSED: Cryptographic fingerprinting verified.\n');

// -------------------------------------------------------------
// AREA 3: Human Approval & Gate Enforcement
// -------------------------------------------------------------
console.log('Area 3: Testing Human Approval Enforcement...');

const { executeApplicationPackage } = await import('../lib/execution/engine.ts');

const validApprovedArtifact = {
  id: 'app-art-8821',
  application_id: 'app-7711',
  fingerprint,
  approved_by: 'Jordan Vance (Candidate)',
  approved_at: new Date().toISOString(),
  content: approvedContent,
};

// Case A: Unapproved artifact execution attempt
const unapprovedArtifact = {
  ...validApprovedArtifact,
  approved_by: '',
  approved_at: '',
};

const unapprovedResult = executeApplicationPackage({
  applicationId: 'app-7711',
  approvedArtifact: unapprovedArtifact,
  currentContent: approvedContent,
  destination: 'https://careers.gridscale.com/apply',
  route: 'website',
});

assert.strictEqual(unapprovedResult.success, false);
assert.strictEqual(unapprovedResult.code, 'APPROVAL_REQUIRED');
assert.ok(unapprovedResult.error.includes('human approval'));
console.log('  ✓ Test 3.1: Execution engine strictly blocks unapproved or unsigned artifacts.');

console.log('✓ Area 3 PASSED: Human approval gate verified.\n');

// -------------------------------------------------------------
// AREA 4: Approved-Content Mutation Hard Block
// -------------------------------------------------------------
console.log('Area 4: Auditing Approved-Content Mutation Hard Block...');

// Case B: Post-approval mutation attempt
const mutatedExecution = executeApplicationPackage({
  applicationId: 'app-7711',
  approvedArtifact: validApprovedArtifact,
  currentContent: mutatedContent,
  destination: 'https://careers.gridscale.com/apply',
  route: 'website',
});

assert.strictEqual(mutatedExecution.success, false);
assert.strictEqual(mutatedExecution.code, 'MUTATION_BLOCKED');
assert.ok(mutatedExecution.error.includes('HARD BLOCK'));
assert.ok(mutatedExecution.attempt && mutatedExecution.attempt.status === 'blocked');
assert.strictEqual(mutatedExecution.attempt.verified_fingerprint, verifyMismatch.actualHash);
console.log('  ✓ Test 4.1: HARD BLOCK triggered on post-approval content mutation.');
console.log('  ✓ Test 4.2: Blocked execution attempt logged with verified fingerprint for audit trail.');

console.log('✓ Area 4 PASSED: Approved-content mutation defense verified.\n');

// -------------------------------------------------------------
// AREA 5: Idempotency Protection & Execution Receipts
// -------------------------------------------------------------
console.log('Area 5: Testing Idempotency & Submission Receipt Issuance...');

// Case C: Valid first-time dispatch
const validExecution = executeApplicationPackage({
  applicationId: 'app-7711',
  approvedArtifact: validApprovedArtifact,
  currentContent: approvedContent,
  destination: 'https://careers.gridscale.com/apply',
  route: 'website',
});

assert.strictEqual(validExecution.success, true);
assert.ok(validExecution.receipt);
assert.ok(validExecution.receipt.id.startsWith('rcpt-'));
assert.ok(validExecution.receipt.external_confirmation_id.startsWith('CONF-WEBSITE-'));
assert.strictEqual(validExecution.receipt.verified_fingerprint, fingerprint.hash);
assert.strictEqual(validExecution.attempt.status, 'confirmed');
console.log(`  ✓ Test 5.1: Successful dispatch produced auditable SubmissionReceipt (${validExecution.receipt.external_confirmation_id}).`);

// Case D: Duplicate execution attempt to same destination
const duplicateExecution = executeApplicationPackage({
  applicationId: 'app-7711',
  approvedArtifact: validApprovedArtifact,
  currentContent: approvedContent,
  destination: 'https://careers.gridscale.com/apply',
  route: 'website',
  existingReceipts: [validExecution.receipt],
});

assert.strictEqual(duplicateExecution.success, false);
assert.strictEqual(duplicateExecution.code, 'DUPLICATE_SUBMISSION');
assert.ok(duplicateExecution.error.includes('Duplicate submission blocked'));
console.log('  ✓ Test 5.2: Idempotency guard strictly blocks duplicate submission to the same destination.');

console.log('✓ Area 5 PASSED: Idempotency and receipt issuance verified.\n');

// -------------------------------------------------------------
// AREA 6: Event-Sourced Outcome State Machine
// -------------------------------------------------------------
console.log('Area 6: Testing Event-Sourced Outcome State Machine...');

const { createOutcomeEvent } = await import('../lib/execution/stateMachine.ts');

const event1 = createOutcomeEvent({
  applicationId: 'app-7711',
  userId: 'usr-jordan',
  type: 'applied',
  metadata: { receipt_id: validExecution.receipt.id },
});
assert.strictEqual(event1.type, 'applied');
assert.strictEqual(event1.stage, 'Application Dispatched');

const event2 = createOutcomeEvent({
  applicationId: 'app-7711',
  userId: 'usr-jordan',
  type: 'recruiter_response',
  metadata: { notes: 'Recruiter requested initial phone sync' },
});
assert.strictEqual(event2.type, 'recruiter_response');

const event3 = createOutcomeEvent({
  applicationId: 'app-7711',
  userId: 'usr-jordan',
  type: 'interview',
  metadata: { round: 'Technical Architecture Panel' },
});
assert.strictEqual(event3.type, 'interview');

const event4 = createOutcomeEvent({
  applicationId: 'app-7711',
  userId: 'usr-jordan',
  type: 'offer',
  metadata: { baseSalary: '$225,000', bonus: '15%' },
});
assert.strictEqual(event4.type, 'offer');
assert.strictEqual(event4.stage, 'Formal Offer Extended');

console.log('  ✓ Test 6.1: Discrete outcome state transitions created with immutable timestamps and stages.');
console.log('✓ Area 6 PASSED: Event-sourced outcome state machine verified.\n');

// -------------------------------------------------------------
// AREA 7: Career ROI Conversion Analytics
// -------------------------------------------------------------
console.log('Area 7: Testing Career ROI Conversion Analytics Engine...');

const { computeCareerRoiMetrics } = await import('../lib/execution/stateMachine.ts');

const nowTime = Date.now();
const dayMs = 24 * 60 * 60 * 1000;

const mockPipelineEvents = [
  // App 1: applied -> response -> interview -> offer
  { id: '1', application_id: 'app-1', user_id: 'usr-1', type: 'applied', timestamp: new Date(nowTime - 20 * dayMs).toISOString() },
  { id: '2', application_id: 'app-1', user_id: 'usr-1', type: 'recruiter_response', timestamp: new Date(nowTime - 17 * dayMs).toISOString() }, // 3 days
  { id: '3', application_id: 'app-1', user_id: 'usr-1', type: 'interview', timestamp: new Date(nowTime - 12 * dayMs).toISOString() },
  { id: '4', application_id: 'app-1', user_id: 'usr-1', type: 'offer', timestamp: new Date(nowTime - 5 * dayMs).toISOString() }, // 15 days

  // App 2: applied -> response -> interview (no offer)
  { id: '5', application_id: 'app-2', user_id: 'usr-1', type: 'applied', timestamp: new Date(nowTime - 15 * dayMs).toISOString() },
  { id: '6', application_id: 'app-2', user_id: 'usr-1', type: 'recruiter_response', timestamp: new Date(nowTime - 10 * dayMs).toISOString() }, // 5 days
  { id: '7', application_id: 'app-2', user_id: 'usr-1', type: 'interview', timestamp: new Date(nowTime - 7 * dayMs).toISOString() },

  // App 3: applied (no response yet)
  { id: '8', application_id: 'app-3', user_id: 'usr-1', type: 'applied', timestamp: new Date(nowTime - 4 * dayMs).toISOString() },

  // App 4: applied (no response yet)
  { id: '9', application_id: 'app-4', user_id: 'usr-1', type: 'applied', timestamp: new Date(nowTime - 2 * dayMs).toISOString() },
];

const roi = computeCareerRoiMetrics(mockPipelineEvents);

assert.strictEqual(roi.total_applications, 4);
assert.strictEqual(roi.responses_count, 2);
assert.strictEqual(roi.interviews_count, 2);
assert.strictEqual(roi.offers_count, 1);

// Conversion rates
assert.strictEqual(roi.application_to_response_rate, 50, '2 responses / 4 applications = 50%');
assert.strictEqual(roi.interview_to_offer_rate, 50, '1 offer / 2 interviews = 50%');
assert.strictEqual(roi.application_to_offer_rate, 25, '1 offer / 4 applications = 25%');

// Average timelines: (3 + 5)/2 = 4.0 days to response
assert.strictEqual(roi.avg_time_to_response_days, 4.0);
assert.strictEqual(roi.avg_time_to_offer_days, 15.0);

console.log(`  ✓ Test 7.1: Career ROI conversions verified: App->Response ${roi.application_to_response_rate}%, Interview->Offer ${roi.interview_to_offer_rate}%, App->Offer ${roi.application_to_offer_rate}%.`);
console.log(`  ✓ Test 7.2: Factual turnaround timelines calculated (${roi.avg_time_to_response_days} days to response, ${roi.avg_time_to_offer_days} days to offer).`);
console.log('✓ Area 7 PASSED: Career ROI analytics verified.\n');

// -------------------------------------------------------------
// AREA 8: Telemetry & Observability Pipeline
// -------------------------------------------------------------
console.log('Area 8: Auditing Phase 13 Telemetry Funnel Events...');

const analyticsCode = fs.readFileSync(path.join(ROOT, 'lib', 'analytics.ts'), 'utf8');

const requiredPhase13Events = [
  'execution_dispatched',
  'execution_confirmed',
  'execution_blocked',
  'recruiter_response_recorded',
  'interview_scheduled',
  'offer_received',
];

for (const evt of requiredPhase13Events) {
  assert.ok(analyticsCode.includes(`'${evt}'`), `lib/analytics.ts FunnelEvent must define '${evt}'`);
}
console.log('  ✓ Test 8.1: All Phase 13 execution & outcome events declared in FunnelEvent.');

// Verify route wiring
const executeRouteCode = fs.readFileSync(path.join(ROOT, 'app', 'api', 'applications', 'execute', 'route.ts'), 'utf8');
assert.ok(executeRouteCode.includes("'execution_dispatched'"), 'Execute route must emit execution_dispatched');
assert.ok(executeRouteCode.includes("'execution_confirmed'"), 'Execute route must emit execution_confirmed');
assert.ok(executeRouteCode.includes("'execution_blocked'"), 'Execute route must emit execution_blocked on mutation block');

const outcomesRouteCode = fs.readFileSync(path.join(ROOT, 'app', 'api', 'applications', 'outcomes', 'route.ts'), 'utf8');
assert.ok(outcomesRouteCode.includes("'recruiter_response_recorded'"), 'Outcomes route must emit recruiter_response_recorded');
assert.ok(outcomesRouteCode.includes("'interview_scheduled'"), 'Outcomes route must emit interview_scheduled');
assert.ok(outcomesRouteCode.includes("'offer_received'"), 'Outcomes route must emit offer_received');

console.log('  ✓ Test 8.2: Execute and outcome routes properly emit telemetry events.');
console.log('✓ Area 8 PASSED: Observability pipeline verified.\n');

// -------------------------------------------------------------
// AREA 9: Complete End-to-End Vertical Slice Execution
// -------------------------------------------------------------
console.log('Area 9: Executing Complete Phase 13 End-to-End Simulation...');

// Flow:
// 1. Evidence Snapshot taken at approval
const snap = createEvidenceSnapshot('usr-sim', candidateProfile, 'Evidence text');
assert.ok(snap.id);

// 2. Artifact approved by candidate and fingerprinted
const approvedFp = computeArtifactFingerprint(approvedContent);
const approvedArt = {
  id: 'art-sim-1',
  application_id: 'app-sim-1',
  fingerprint: approvedFp,
  approved_by: 'Jordan Vance',
  approved_at: new Date().toISOString(),
  content: approvedContent,
};

// 3. Execution Engine verifies fingerprint and dispatches
const exec = executeApplicationPackage({
  applicationId: 'app-sim-1',
  approvedArtifact: approvedArt,
  currentContent: approvedContent,
  destination: 'https://careers.company.com/apply',
  route: 'website',
});
assert.strictEqual(exec.success, true);
assert.strictEqual(exec.receipt.verified_fingerprint, approvedFp.hash);

// 4. Outcome state machine records progression
const appEvents = [
  createOutcomeEvent({ applicationId: 'app-sim-1', userId: 'usr-sim', type: 'applied' }),
  createOutcomeEvent({ applicationId: 'app-sim-1', userId: 'usr-sim', type: 'recruiter_response' }),
  createOutcomeEvent({ applicationId: 'app-sim-1', userId: 'usr-sim', type: 'interview' }),
  createOutcomeEvent({ applicationId: 'app-sim-1', userId: 'usr-sim', type: 'offer' }),
];

// 5. Final Career ROI calculated
const careerRoi = computeCareerRoiMetrics(appEvents);
assert.strictEqual(careerRoi.application_to_offer_rate, 100);
console.log('  ✓ Test 9.1: End-to-end v4.6 journey executed seamlessly: Snapshot -> Fingerprint -> Execute -> Receipt -> Outcome Events -> Career ROI.');

console.log('\n================================================================');
console.log('  ALL PHASE 13 EXECUTION & OUTCOME CHECKS PASSED (9/9 AREAS)   ');
console.log('================================================================\n');
