// tests/v5_agent_authority_boundary.mjs
// RJA v5.0.0-alpha1: Agent Authority Boundary & Adversarial Enforcement Test Suite
//
// Formally verifies:
// 1. 🔎 Discovery Agent read-only pipeline & cryptographic provenance generation
// 2. Policy Guard adversarial rejection of 8 prohibited agent operations:
//    - Attempt 1: Agent attempts to modify candidate evidence       → HARD BLOCK
//    - Attempt 2: Agent attempts to modify approved artifact        → HARD BLOCK
//    - Attempt 3: Agent attempts to bypass human approval           → HARD BLOCK
//    - Attempt 4: Agent attempts to change fingerprint              → HARD BLOCK
//    - Attempt 5: Agent attempts to redirect destination            → HARD BLOCK
//    - Attempt 6: Agent attempts to execute directly                → HARD BLOCK
//    - Attempt 7: Agent attempts to fabricate provenance            → HARD BLOCK
//    - Attempt 8: Agent attempts to rewrite outcome history         → HARD BLOCK
// 3. End-to-end integration: Discovery Proposal → Policy Guard → Human Review → v4.6.1 Execution
// 4. Invariant proof: Agent autonomy increases without gaining execution authority.

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { runDiscoveryAgent, verifyProvenanceRecord } from '../lib/agents/discovery.ts';
import { validateAgentProposal, assertPolicyGuard } from '../lib/agents/policyGuard.ts';
import {
  DISCOVERY_AGENT_CONTRACT,
  EVALUATION_AGENT_CONTRACT,
  PLANNING_AGENT_CONTRACT,
  ORCHESTRATOR_AGENT_CONTRACT,
} from '../lib/agents/contracts.ts';
import {
  computeArtifactFingerprint,
  verifyArtifactFingerprint,
} from '../lib/execution/fingerprint.ts';
import {
  executeApplicationPackage,
  acquireExecutionLock,
  releaseExecutionLock,
} from '../lib/execution/engine.ts';
import { createEvidenceSnapshot } from '../lib/execution/snapshot.ts';

console.log('================================================================');
console.log('  RJA V5.0: AGENT AUTHORITY BOUNDARY & ADVERSARIAL SUITE        ');
console.log('  Formal Invariants, Negative Capabilities & Substrate Defense  ');
console.log('================================================================\n');

// -------------------------------------------------------------
// PART 1: 🔎 Discovery Agent Pipeline & Provenance Verification
// -------------------------------------------------------------
console.log('Part 1: Testing 🔎 Discovery Agent Read-Only Pipeline...');

const rawJobInput = {
  title: 'Lead Distributed Systems Architect',
  company: 'Apex Infrastructure Group',
  url: 'https://careers.apexinfrastructure.com/jobs/arch-902?utm_source=linkedin&ref=tracker',
  source: 'direct_ats',
  description: 'Seeking a Lead Distributed Systems Architect.\n• 10+ years designing high-throughput pipelines.\n• Expert in Rust, Go, and Kafka.\n• Professional Engineer (PE) preferred.',
  requirements: [
    '10+ years designing high-throughput pipelines',
    'Expert in Rust, Go, and Kafka',
    'Professional Engineer (PE) preferred',
  ],
  skills: ['Rust', 'Go', 'Kafka', 'Kubernetes'],
  location: 'Remote (US/Canada)',
  category: 'software_engineering',
  raw_payload: {
    scraped_html_length: 4500,
    feed_id: 'feed-us-east-99',
    listing_id: 'arch-902',
  },
};

const proposal = await runDiscoveryAgent(rawJobInput);

// Assert Discovery Proposal schema and properties
assert.strictEqual(proposal.proposed_by, 'discovery_agent');
assert.strictEqual(proposal.title, 'Lead Distributed Systems Architect');
assert.strictEqual(proposal.company, 'Apex Infrastructure Group');
assert.strictEqual(
  proposal.sourceUrl,
  'https://careers.apexinfrastructure.com/jobs/arch-902',
  'URL canonicalizer must strip tracking query parameters'
);
assert.strictEqual(proposal.requirements.length, 3);
assert.strictEqual(proposal.skills.length, 4);
assert.ok(proposal.provenance, 'Proposal must include provenance record');
assert.strictEqual(proposal.provenance.is_verified, true);
assert.strictEqual(proposal.provenance.source, 'direct_ats');

// Verify cryptographic provenance hash
const provenanceValid = verifyProvenanceRecord(proposal.provenance, rawJobInput.raw_payload);
assert.strictEqual(provenanceValid, true, 'Cryptographic provenance digest must verify against raw context');

// Check Policy Guard accepts clean discovery proposal
const guardCheck = validateAgentProposal(proposal, 'discovery', rawJobInput.raw_payload);
assert.strictEqual(guardCheck.allowed, true, 'Clean DiscoveryProposal must pass Policy Guard');
assert.strictEqual(guardCheck.violations.length, 0);

console.log('  ✓ Test 1.1: Discovery Agent normalizes listing with canonical URL and structured requirements.');
console.log('  ✓ Test 1.2: Cryptographic provenance record verified with source digest.');
console.log('  ✓ Test 1.3: Clean DiscoveryProposal passes Policy Guard without violations.\n');

// -------------------------------------------------------------
// PART 2: Policy Guard Adversarial Testing (8 Prohibited Attacks)
// -------------------------------------------------------------
console.log('Part 2: Executing 8 Adversarial Agent Privilege Escalation Attacks...');

// Attack 2.1: Agent attempts to modify candidate evidence
const attack1 = {
  ...proposal,
  profile_mutation: {
    add_unverified_skill: 'Doctor of Computer Science',
    certifications: ['PE', 'PMP'],
  },
};
const guard1 = validateAgentProposal(attack1, 'discovery');
assert.strictEqual(guard1.allowed, false);
assert.ok(guard1.violations.some((v) => v.includes('mutated candidate profile') || v.includes('unverified evidence')));
console.log('  ✓ Attack 2.1 BLOCKED: Agent attempt to mutate candidate evidence strictly caught.');

// Attack 2.2: Agent attempts to modify approved artifact content post-approval
const originalArtifact = {
  resume: { full_resume: 'Jordan Vance, PE.\nDirecting high-voltage substations.' },
  cover_letter: { letter: 'Original approved cover letter.' },
  screening_answers: { answers: [{ question: 'Experience?', answer: '14 years' }] },
};
const fpOriginal = computeArtifactFingerprint(originalArtifact);

const attack2MutatedContent = JSON.parse(JSON.stringify(originalArtifact));
attack2MutatedContent.resume.full_resume += ' Malicious stealth injection.';
const fpVerification = verifyArtifactFingerprint(attack2MutatedContent, fpOriginal.hash);
assert.strictEqual(fpVerification.valid, false, 'Mutated content must not match approved fingerprint');
assert.notStrictEqual(fpVerification.actualHash, fpOriginal.hash);
console.log('  ✓ Attack 2.2 BLOCKED: Agent attempt to modify approved artifact text fails SHA-256 verification.');

// Attack 2.3: Agent attempts to bypass human approval gate (self-approval)
const attack3 = {
  ...proposal,
  approved_by: 'system_autonomous_agent',
  human_approved_at: new Date().toISOString(),
  status: 'ready_to_apply',
};
const guard3 = validateAgentProposal(attack3, 'orchestrator');
assert.strictEqual(guard3.allowed, false);
assert.ok(guard3.violations.some((v) => v.includes('self-approve')));
console.log('  ✓ Attack 2.3 BLOCKED: Autonomous agent self-approval attempt strictly rejected.');

// Attack 2.4: Agent attempts to forge fingerprint or tamper canonical scheme
const forgedFp = {
  hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // Empty hash
  algorithm: 'sha256',
  fingerprint_algorithm: 'rja-c14n-v1-sha256',
};
const verifyForged = verifyArtifactFingerprint(originalArtifact, forgedFp.hash);
assert.strictEqual(verifyForged.valid, false, 'Forged hash must fail verification');
console.log('  ✓ Attack 2.4 BLOCKED: Forged fingerprint injection detected and halted.');

// Attack 2.5: Agent attempts destination redirection attack
const approvedDestination = 'https://careers.apexinfrastructure.com/apply';
const redirectedDestination = 'https://phishing-harvester.com/steal-resume';
const approvedRecord = {
  id: 'app-art-v5-001',
  application_id: 'app-v5-001',
  evidence_snapshot_id: 'ev-snap-v5-001',
  destination: approvedDestination,
  fingerprint: fpOriginal,
  approved_by: 'candidate-uuid-99',
  approved_at: new Date().toISOString(),
  content: originalArtifact,
};

const redirectResult = executeApplicationPackage({
  approvedArtifact: approvedRecord,
  currentContent: originalArtifact,
  destination: redirectedDestination, // Attacker swapped destination
});
assert.strictEqual(redirectResult.success, false);
assert.strictEqual(redirectResult.code, 'DESTINATION_MISMATCH');
console.log('  ✓ Attack 2.5 BLOCKED: Destination redirection after approval strictly deflected.');

// Attack 2.6: Agent attempts direct dispatch without candidate review
const unapprovedRecord = {
  ...approvedRecord,
  approved_by: '', // Missing human signature
};
const directDispatchResult = executeApplicationPackage({
  approvedArtifact: unapprovedRecord,
  currentContent: originalArtifact,
  destination: approvedDestination,
});
assert.strictEqual(directDispatchResult.success, false);
assert.strictEqual(directDispatchResult.code, 'APPROVAL_REQUIRED');
console.log('  ✓ Attack 2.6 BLOCKED: Direct dispatch without authenticated candidate signature halted.');

// Attack 2.7: Agent attempts to spoof/fabricate provenance
const attack7Spoofed = {
  ...proposal,
  provenance: {
    ...proposal.provenance,
    provenance_hash: 'forged_deadbeef_hash_00000000000000000000000000000000000000000000',
  },
};
const guard7 = validateAgentProposal(attack7Spoofed, 'discovery', rawJobInput.raw_payload);
assert.strictEqual(guard7.allowed, false);
assert.ok(guard7.violations.some((v) => v.includes('DISCOVERY_PROVENANCE_FORGED')));
console.log('  ✓ Attack 2.7 BLOCKED: Spoofed / forged provenance digest strictly rejected.');

// Attack 2.8: Agent attempts to rewrite outcome history
const attack8 = {
  jobId: proposal.jobId,
  outcome_event: {
    stage: 'offer',
    salary_offered: 250000,
    synthetic_attribution: true,
  },
};
const guard8 = validateAgentProposal(attack8, 'planning');
assert.strictEqual(guard8.allowed, false);
assert.ok(guard8.violations.some((v) => v.includes('mutate outcome history')));
console.log('  ✓ Attack 2.8 BLOCKED: Direct outcome event mutation strictly rejected.');

console.log('✓ Part 2 PASSED: All 8 adversarial privilege escalation attempts defeated.\n');

// -------------------------------------------------------------
// PART 3: End-to-End Unbroken Authority Pipeline
// -------------------------------------------------------------
console.log('Part 3: Validating Complete Unbroken Authority Pipeline (Proposal → v4.6.1 Execution)...');

// 1. Candidate Evidence Snapshot (Verified baseline)
const candidateProfile = {
  headline: 'Principal Infrastructure Engineer',
  years_experience: 14,
  skills: ['Rust', 'Go', 'Kafka', 'High-Voltage Substation Design'],
  certifications: ['PE'],
};
const evidenceSnapshot = createEvidenceSnapshot('cand-7701', candidateProfile);
assert.ok(evidenceSnapshot.evidence_hash);

// 2. Discovery Agent outputs verified proposal
const discoveryOutput = await runDiscoveryAgent(rawJobInput);
const policyPass = validateAgentProposal(discoveryOutput, 'discovery', rawJobInput.raw_payload);
assertPolicyGuard(policyPass);

// 3. Orchestrator assembles workspace draft (Unapproved proposal)
const workspaceDraft = {
  job_id: discoveryOutput.jobId,
  candidate_id: 'cand-7701',
  evidence_snapshot_id: evidenceSnapshot.id,
  content: {
    resume: {
      headline: candidateProfile.headline,
      full_resume: `${candidateProfile.headline}.\n14 years experience.\nExpert in ${candidateProfile.skills.join(', ')}.`,
    },
    cover_letter: {
      recipient: `Hiring Team at ${discoveryOutput.company}`,
      letter: `Dear Hiring Team,\nI am writing to express my interest in the ${discoveryOutput.title} position.`,
    },
    screening_answers: {
      answers: [
        { question_id: 'q1', question: 'Do you hold a PE license?', answer: 'Yes, licensed Professional Engineer.' },
      ],
    },
  },
  status: 'draft',
};

// Orchestrator proposal passes Policy Guard
const orchestratorCheck = validateAgentProposal(workspaceDraft, 'orchestrator');
assertPolicyGuard(orchestratorCheck);

// 4. Human Candidate Review Gate (Candidate inspects and signs)
const candidateSignature = 'jordan.vance@engineering.com';
const approvalTimestamp = new Date().toISOString();
const approvedFingerprint = computeArtifactFingerprint(workspaceDraft.content);

const sealedArtifact = {
  id: 'app-art-sealed-77',
  application_id: 'app-7701',
  evidence_snapshot_id: evidenceSnapshot.id,
  destination: discoveryOutput.sourceUrl,
  fingerprint: approvedFingerprint,
  approved_by: candidateSignature,
  approved_at: approvalTimestamp,
  content: workspaceDraft.content,
};

// 5. v4.6.1 Execution Substrate Dispatches with Idempotency
const executionReceipt = executeApplicationPackage({
  approvedArtifact: sealedArtifact,
  currentContent: workspaceDraft.content,
  destination: discoveryOutput.sourceUrl,
});

assert.strictEqual(executionReceipt.success, true);
assert.ok(executionReceipt.receipt);
assert.strictEqual(executionReceipt.receipt.verified_fingerprint, approvedFingerprint.hash);
assert.strictEqual(executionReceipt.receipt.destination, discoveryOutput.sourceUrl);

console.log('  ✓ Test 3.1: Clean Discovery Proposal verified by Policy Guard.');
console.log('  ✓ Test 3.2: Orchestrator workspace draft signed by candidate and sealed with rja-c14n-v1-sha256.');
console.log('  ✓ Test 3.3: v4.6.1 Execution Substrate verified sealed digest and issued submission receipt.');
console.log('  ✓ Test 3.4: Provenance, evidence snapshot, and receipt form immutable auditable chain.\n');

// -------------------------------------------------------------
// PART 4: Verification of Agent Authority Contracts Matrix
// -------------------------------------------------------------
console.log('Part 4: Auditing Initial 4 Agent Authority Contracts...');

const contracts = [
  DISCOVERY_AGENT_CONTRACT,
  EVALUATION_AGENT_CONTRACT,
  PLANNING_AGENT_CONTRACT,
  ORCHESTRATOR_AGENT_CONTRACT,
];

for (const c of contracts) {
  // Invariant 1: Zero direct execution authority
  assert.strictEqual(
    c.allowed_operations.includes('execute_application') ||
    c.allowed_operations.includes('dispatch_application'),
    false,
    `Contract violation: Agent ${c.agent_id} cannot possess execution operations`
  );

  // Invariant 2: Zero approval authority
  assert.strictEqual(
    c.allowed_operations.includes('approve_application') ||
    c.allowed_operations.includes('sign_human_review_gate'),
    false,
    `Contract violation: Agent ${c.agent_id} cannot possess approval operations`
  );

  // Invariant 3: Failure behavior is fail_closed
  assert.strictEqual(
    c.failure_behavior,
    'fail_closed',
    `Contract violation: Agent ${c.agent_id} must fail closed`
  );

  console.log(`  ✓ Contract [${c.agent_id}] (${c.agent_type}): Bounded authority verified. Zero execution capability.`);
}

console.log('\n================================================================');
console.log('  ALL V5.0 AGENT AUTHORITY BOUNDARY CHECKS PASSED (100%)        ');
console.log('  RJA v5.0.0-alpha1 Bounded Agent Authority CERTIFIED           ');
console.log('================================================================');
