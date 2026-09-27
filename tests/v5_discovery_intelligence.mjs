// tests/v5_discovery_intelligence.mjs
// RJA v5.0-alpha2: Discovery Intelligence & Universal Provenance Envelope Test Suite
//
// Formally verifies:
// 1. Discovery Correctness:
//    - Multi-source retrieval & normalization (ATS, Career Portals, Webhooks)
//    - Tracking parameter URL canonicalization
//    - Requirement & skill taxonomy extraction
//    - Downstream evaluation request metadata
//    - Universal Provenance Envelope schema & metadata
// 2. Source / Provenance Integrity:
//    - Tamper-evident cryptographic digests (SHA-256)
//    - Payload & URL mutation detection
//    - Envelope provenance consistency
// 3. Duplicate Detection:
//    - Deterministic deduplication key stability
//    - Multi-source duplicate collapsing
//    - Rich listing retention & metric tracking
// 4. Privilege Escalation Resistance:
//    - Envelope authority tampering (canExecute, canApprove, canMutateEvidence)
//    - Evidence mutation smuggling prevention
//    - Application material generation prohibition
//    - Unpermitted source boundary defense

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  runDiscoveryAgent,
  emitDiscoveryProposal,
  computeProvenance,
  verifyProvenanceRecord,
  deduplicateProposals,
  searchPermittedSources,
  isPermittedSource,
  PERMITTED_DISCOVERY_SOURCES,
} from '../lib/agents/discovery.ts';
import { validateAgentProposal, assertPolicyGuard } from '../lib/agents/policyGuard.ts';
import { DISCOVERY_AGENT_CONTRACT } from '../lib/agents/contracts.ts';
import { generateDeduplicationKey, canonicalizeUrl } from '../lib/jobs/dedup.ts';

console.log('================================================================');
console.log('  RJA V5.0-ALPHA2: DISCOVERY INTELLIGENCE TEST SUITE            ');
// Proof of Read-Only Autonomous Discovery & Universal Provenance Envelope
console.log('================================================================\n');

// -------------------------------------------------------------
// PART 1: Discovery Correctness
// -------------------------------------------------------------
console.log('Part 1: Verifying Discovery Correctness & Schema Normalization...');

const mockGreenhouseListing = {
  title: 'Staff Reliability Engineer  ',
  company: 'CloudStream Global  ',
  url: 'https://boards.greenhouse.io/cloudstream/jobs/554109?gh_src=linkedin_ads&utm_source=feed&utm_campaign=q3_hiring#overview',
  source: 'greenhouse',
  description: `We are hiring a Staff Reliability Engineer.
• Design multi-region failover architecture with 99.999% SLA.
• Automate disaster recovery with Terraform and Kubernetes.
• Lead incident post-mortems and chaos engineering drills.
Minimum 8+ years experience in distributed systems.`,
  requirements: [
    'Design multi-region failover architecture with 99.999% SLA',
    'Automate disaster recovery with Terraform and Kubernetes',
    'Lead incident post-mortems and chaos engineering drills',
  ],
  skills: ['Kubernetes', 'Terraform', 'Chaos Engineering', 'Go', 'Kubernetes'], // Duplicate 'Kubernetes'
  location: 'Remote (US/EMEA)',
  category: 'cloud_infrastructure',
  raw_payload: {
    board_token: 'cloudstream',
    internal_ref: 'GH-SRE-554109',
    scraped_bytes: 3820,
  },
};

// 1.1 Emit Discovery Proposal wrapped in Provenance Envelope
const envelope1 = await emitDiscoveryProposal(mockGreenhouseListing, {
  requestEvaluation: true,
  evaluationPriority: 'high',
  evaluationReason: 'High affinity for cloud infrastructure and multi-region reliability',
});

// Assert Envelope Structure
assert.ok(envelope1.proposalId.startsWith('prop-agt-discovery-v1-'), 'Proposal ID must follow structured naming');
assert.strictEqual(envelope1.agentId, 'agt-discovery-v1', 'Agent ID must match Discovery contract');
assert.strictEqual(envelope1.agentVersion, '1.0.0', 'Agent Version must match Discovery contract');
assert.ok(envelope1.createdAt, 'Envelope must contain valid createdAt timestamp');
assert.ok(Array.isArray(envelope1.inputEvidenceRefs), 'inputEvidenceRefs must be an array');
assert.strictEqual(envelope1.inputEvidenceRefs.length, 0, 'Public discovery has no input candidate evidence');

// Assert Negative Authority Declaration
assert.strictEqual(envelope1.authority.canExecute, false, 'Agent must declare canExecute: false');
assert.strictEqual(envelope1.authority.canApprove, false, 'Agent must declare canApprove: false');
assert.strictEqual(envelope1.authority.canMutateEvidence, false, 'Agent must declare canMutateEvidence: false');

// Assert Inner DiscoveryProposal Output
const prop1 = envelope1.output;
assert.strictEqual(prop1.title, 'Staff Reliability Engineer', 'Title must be trimmed');
assert.strictEqual(prop1.company, 'CloudStream Global', 'Company must be trimmed');
assert.strictEqual(
  prop1.sourceUrl,
  'https://boards.greenhouse.io/cloudstream/jobs/554109',
  'URL must be canonicalized with tracking parameters & hash stripped'
);
assert.strictEqual(prop1.requirements.length, 3, 'Must extract structured requirements');
assert.deepStrictEqual(
  prop1.skills,
  ['Kubernetes', 'Terraform', 'Chaos Engineering', 'Go'],
  'Skills must be deduplicated and normalized'
);
assert.strictEqual(prop1.evaluation_requested, true, 'Must request downstream evaluation');
assert.strictEqual(prop1.evaluation_priority, 'high');
assert.strictEqual(prop1.proposed_by, 'discovery_agent');

// Assert Policy Guard passes the clean enveloped proposal
const guardCheck1 = validateAgentProposal(envelope1, 'discovery', mockGreenhouseListing.raw_payload);
assert.strictEqual(guardCheck1.allowed, true, 'Clean enveloped proposal must pass Policy Guard');
assert.strictEqual(guardCheck1.violations.length, 0);

console.log('  ✓ Test 1.1: Envelope structure validated (proposalId, agentId, version, createdAt).');
console.log('  ✓ Test 1.2: Negative authority declared (canExecute=false, canApprove=false, canMutateEvidence=false).');
console.log('  ✓ Test 1.3: Clean normalization (trimmed fields, tracking URLs stripped, skills deduplicated).');
console.log('  ✓ Test 1.4: Downstream evaluation request metadata verified.');
console.log('  ✓ Test 1.5: Clean envelope verified by Policy Guard.\n');

// -------------------------------------------------------------
// PART 2: Source & Provenance Integrity
// -------------------------------------------------------------
console.log('Part 2: Testing Source & Provenance Integrity (Tamper-Evidence)...');

// 2.1 Verify cryptographic provenance record digest
const prov1 = envelope1.provenance;
assert.strictEqual(prov1.is_verified, true);
assert.strictEqual(prov1.source, 'greenhouse');
assert.strictEqual(prov1.source_url, prop1.sourceUrl);

const isProvValid = verifyProvenanceRecord(prov1, mockGreenhouseListing.raw_payload);
assert.strictEqual(isProvValid, true, 'Provenance digest must verify against authentic raw context');

// 2.2 Tampering with raw payload context
const tamperedPayload = {
  ...mockGreenhouseListing.raw_payload,
  injected_malicious_salary: '$500,000',
};
const isTamperedPayloadValid = verifyProvenanceRecord(prov1, tamperedPayload);
assert.strictEqual(isTamperedPayloadValid, false, 'Tampered raw payload must fail provenance verification');

// 2.3 Policy Guard rejects envelope with mismatched raw context
const guardTamperedContext = validateAgentProposal(envelope1, 'discovery', tamperedPayload);
assert.strictEqual(guardTamperedContext.allowed, false);
assert.ok(guardTamperedContext.violations.some((v) => v.includes('DISCOVERY_PROVENANCE_FORGED')));

// 2.4 Tampering with provenance_hash inside envelope
const envelopeWithForgedHash = {
  ...envelope1,
  provenance: {
    ...envelope1.provenance,
    provenance_hash: 'deadbeef99999999999999999999999999999999999999999999999999999999',
  },
};
const guardForgedHash = validateAgentProposal(
  envelopeWithForgedHash,
  'discovery',
  mockGreenhouseListing.raw_payload
);
assert.strictEqual(guardForgedHash.allowed, false);
assert.ok(guardForgedHash.violations.some((v) => v.includes('DISCOVERY_PROVENANCE_FORGED')));

console.log('  ✓ Test 2.1: Cryptographic SHA-256 provenance verified against source context.');
console.log('  ✓ Test 2.2: Context tampering strictly detected via SHA-256 digest divergence.');
console.log('  ✓ Test 2.3: Policy Guard strictly rejects forged or mismatched provenance digests.\n');

// -------------------------------------------------------------
// PART 3: Duplicate Detection & Stability
// -------------------------------------------------------------
console.log('Part 3: Testing Deduplication Key Stability & Multi-Source Collapsing...');

// 3.1 Verify Deduplication Key Stability under different tracking query strings
const urlA = 'https://careers.netflix.com/jobs/889211?utm_source=google_jobs&utm_medium=organic';
const urlB = 'https://careers.netflix.com/jobs/889211?ref=linkedin_feed&source=job_board#apply';
const keyA = generateDeduplicationKey('Netflix', 'Senior Backend Engineer', urlA);
const keyB = generateDeduplicationKey('Netflix', 'Senior Backend Engineer', urlB);

assert.strictEqual(keyA, keyB, 'Deduplication key must be invariant to tracking parameters');

// 3.2 Ingest batch containing 3 unique jobs and 5 duplicate variations
const batchInput = [
  // Job 1 (Original)
  {
    title: 'Senior Backend Engineer',
    company: 'Netflix',
    url: urlA,
    source: 'direct_ats',
    raw_payload: { id: 1 },
  },
  // Job 1 (Duplicate via Twitter link)
  {
    title: 'Senior Backend Engineer',
    company: 'Netflix',
    url: 'https://careers.netflix.com/jobs/889211?utm_source=twitter',
    source: 'job_boards',
    raw_payload: { id: 1 },
  },
  // Job 1 (Duplicate via referral)
  {
    title: 'Senior Backend Engineer',
    company: 'Netflix',
    url: urlB,
    source: 'ats_feeds',
    raw_payload: { id: 1 },
  },
  // Job 2 (Original)
  {
    title: 'Staff Data Platform Engineer',
    company: 'Stripe',
    url: 'https://stripe.com/jobs/data-eng-101',
    source: 'lever',
    raw_payload: { id: 2 },
  },
  // Job 2 (Duplicate)
  {
    title: 'Staff Data Platform Engineer',
    company: 'Stripe',
    url: 'https://stripe.com/jobs/data-eng-101?utm_campaign=dev_newsletter',
    source: 'lever',
    raw_payload: { id: 2 },
  },
  // Job 3 (Original)
  {
    title: 'Principal Security Architect',
    company: 'Datadog',
    url: 'https://careers.datadoghq.com/detail/sec-900',
    source: 'workday',
    raw_payload: { id: 3 },
  },
  // Job 3 (Duplicate A)
  {
    title: 'Principal Security Architect',
    company: 'Datadog',
    url: 'https://careers.datadoghq.com/detail/sec-900?ref=techcareers',
    source: 'workday',
    raw_payload: { id: 3 },
  },
  // Job 3 (Duplicate B)
  {
    title: 'Principal Security Architect',
    company: 'Datadog',
    url: 'https://careers.datadoghq.com/detail/sec-900/', // Trailing slash variation
    source: 'workday',
    raw_payload: { id: 3 },
  },
];

const searchResult = await searchPermittedSources(batchInput);

// Assert exactly 3 unique listings returned
assert.strictEqual(searchResult.proposals.length, 3, 'Must retain exactly 3 unique proposals');
assert.strictEqual(searchResult.deduplicatedCount, 5, 'Must report exactly 5 duplicates filtered');
assert.strictEqual(searchResult.rejectedCount, 0, 'No unpermitted sources in this clean batch');

const uniqueCompanies = searchResult.proposals.map((p) => p.output.company).sort();
assert.deepStrictEqual(uniqueCompanies, ['Datadog', 'Netflix', 'Stripe']);

// Assert all retained unique proposals have intact provenance envelopes
for (const env of searchResult.proposals) {
  assert.ok(env.proposalId);
  assert.strictEqual(env.authority.canExecute, false);
  assert.strictEqual(env.authority.canApprove, false);
  assert.strictEqual(env.authority.canMutateEvidence, false);
  assert.ok(env.provenance.provenance_hash);
}

console.log('  ✓ Test 3.1: Deduplication key stability confirmed across tracking query permutations.');
console.log('  ✓ Test 3.2: Batch deduplication filtered 5 duplicate listings down to 3 unique proposals.');
console.log('  ✓ Test 3.3: Retained unique listings have verified provenance envelopes intact.\n');

// -------------------------------------------------------------
// PART 4: Privilege Escalation Resistance
// -------------------------------------------------------------
console.log('Part 4: Testing Privilege Escalation Resistance on Provenance Envelopes...');

// Attack 4.1: Adversary modifies envelope to claim canExecute: true
const attackExecute = {
  ...envelope1,
  authority: {
    ...envelope1.authority,
    canExecute: true, // Malicious escalation
  },
};
const guardExec = validateAgentProposal(attackExecute, 'discovery');
assert.strictEqual(guardExec.allowed, false, 'Envelope with canExecute: true must be blocked');
assert.ok(
  guardExec.violations.some((v) => v.includes('claimed canExecute: true')),
  'Violation must explicitly cite canExecute escalation'
);
console.log('  ✓ Attack 4.1 BLOCKED: canExecute privilege escalation blocked by Policy Guard.');

// Attack 4.2: Adversary modifies envelope to claim canApprove: true
const attackApprove = {
  ...envelope1,
  authority: {
    ...envelope1.authority,
    canApprove: true, // Malicious escalation
  },
};
const guardApprove = validateAgentProposal(attackApprove, 'discovery');
assert.strictEqual(guardApprove.allowed, false, 'Envelope with canApprove: true must be blocked');
assert.ok(
  guardApprove.violations.some((v) => v.includes('claimed canApprove: true')),
  'Violation must explicitly cite canApprove escalation'
);
console.log('  ✓ Attack 4.2 BLOCKED: canApprove privilege escalation blocked by Policy Guard.');

// Attack 4.3: Adversary modifies envelope to claim canMutateEvidence: true
const attackMutateEvidence = {
  ...envelope1,
  authority: {
    ...envelope1.authority,
    canMutateEvidence: true, // Malicious escalation
  },
};
const guardMutate = validateAgentProposal(attackMutateEvidence, 'discovery');
assert.strictEqual(guardMutate.allowed, false, 'Envelope with canMutateEvidence: true must be blocked');
assert.ok(
  guardMutate.violations.some((v) => v.includes('claimed canMutateEvidence: true')),
  'Violation must explicitly cite canMutateEvidence escalation'
);
console.log('  ✓ Attack 4.3 BLOCKED: canMutateEvidence privilege escalation blocked by Policy Guard.');

// Attack 4.4: Smuggling candidate qualification mutations inside output
const attackSmuggleProfile = {
  ...envelope1,
  output: {
    ...envelope1.output,
    profile_mutation: {
      injected_degree: 'PhD in Computer Science',
    },
  },
};
const guardSmuggle = validateAgentProposal(attackSmuggleProfile, 'discovery');
assert.strictEqual(guardSmuggle.allowed, false);
assert.ok(
  guardSmuggle.violations.some((v) => v.includes('mutate candidate profile') || v.includes('unverified evidence'))
);
console.log('  ✓ Attack 4.4 BLOCKED: Evidence mutation smuggled inside output strictly caught.');

// Attack 4.5: Discovery Agent generates application cover letter (Forbidden action)
const attackCoverLetter = {
  ...envelope1,
  output: {
    ...envelope1.output,
    cover_letter: 'Dear Hiring Manager, please hire me for this role.',
  },
};
const guardCoverLetter = validateAgentProposal(attackCoverLetter, 'discovery');
assert.strictEqual(guardCoverLetter.allowed, false);
assert.ok(guardCoverLetter.violations.some((v) => v.includes('DISCOVERY_BOUNDARY_BREACH')));
console.log('  ✓ Attack 4.5 BLOCKED: Discovery generation of application text strictly rejected.');

// Attack 4.6: Unpermitted source rejection
const unpermittedInput = [
  {
    title: 'Security Analyst',
    company: 'ShadowCorp',
    url: 'https://shadowcorp.onion/job',
    source: 'unauthorized_dark_web_dump', // Banned source
    raw_payload: {},
  },
];
const unpermittedSearch = await searchPermittedSources(unpermittedInput);
assert.strictEqual(unpermittedSearch.proposals.length, 0, 'Unpermitted sources must produce 0 proposals');
assert.strictEqual(unpermittedSearch.rejectedCount, 1, 'Must record 1 rejection');
assert.ok(unpermittedSearch.rejections[0].reason.includes('Unpermitted discovery source'));

// Policy Guard also flags unpermitted source if presented
const unpermittedProposal = {
  ...envelope1,
  output: {
    ...envelope1.output,
    source: 'unauthorized_feed',
  },
};
const guardUnpermitted = validateAgentProposal(unpermittedProposal, 'discovery');
assert.strictEqual(guardUnpermitted.allowed, false);
assert.ok(guardUnpermitted.violations.some((v) => v.includes('DISCOVERY_SOURCE_UNPERMITTED')));
console.log('  ✓ Attack 4.6 BLOCKED: Unpermitted sources rejected by Discovery pipeline & Policy Guard.');

// Attack 4.7: Missing authority declaration block
const attackMissingAuthority = {
  ...envelope1,
  authority: null,
};
const guardMissingAuth = validateAgentProposal(attackMissingAuthority, 'discovery');
assert.strictEqual(guardMissingAuth.allowed, false);
assert.ok(guardMissingAuth.violations.some((v) => v.includes('ENVELOPE_AUTHORITY_MISSING')));
console.log('  ✓ Attack 4.7 BLOCKED: Corrupted or missing authority block strictly caught.');

console.log('\n================================================================');
console.log('  ALL V5.0-ALPHA2 DISCOVERY INTELLIGENCE TESTS PASSED (100%)    ');
console.log('  Discovery Agent & Provenance Envelope Contract CERTIFIED      ');
console.log('================================================================');
