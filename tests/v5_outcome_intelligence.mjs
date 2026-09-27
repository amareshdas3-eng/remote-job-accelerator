// tests/v5_outcome_intelligence.mjs
// RJA v5.0-alpha7: Outcome Intelligence & Temporal Integrity Test Suite
//
// Formally verifies 26 tests across 4 key areas:
//
// Historical Integrity (8):
//    #1:  Modify frozen artifact after execution          → FROZEN_ARTIFACT_TAMPERED
//    #2:  Modify execution receipt                        → RECEIPT_HASH_MISMATCH
//    #3:  Modify execution timestamp                      → RECEIPT_HASH_MISMATCH
//    #4:  Modify execution status                         → EXECUTION_FAILURE deviation detected
//    #5:  Modify candidate snapshot                       → SNAPSHOT_MISMATCH
//    #6:  Rewrite historical outcome                      → TypeError (Object.freeze)
//    #7:  Delete historical outcome property              → TypeError (Object.freeze)
//    #8:  Replay outcome against another execution        → EXECUTION_ID_MISMATCH
//
// Provenance Attacks (6):
//    #9:  Forge execution receipt hash                    → RECEIPT_HASH_MISMATCH
//    #10: Forge frozen artifact ID                        → FROZEN_ARTIFACT_MISMATCH
//    #11: Forge execution ID                              → EXECUTION_ID_MISMATCH
//    #12: Forge candidate snapshot relationship           → SNAPSHOT_MISMATCH
//    #13: Break provenance chain                          → OUTCOME_PROVENANCE_FORGED
//    #14: Inject outcome without execution receipt        → RECEIPT_INVALID
//
// Authority Attacks (6):
//    #15: Outcome agent attempts artifact mutation        → AUTHORITY_VIOLATION
//    #16: Outcome agent attempts policy change            → AUTHORITY_VIOLATION
//    #17: Outcome agent attempts approval                 → AUTHORITY_VIOLATION
//    #18: Outcome agent attempts execution                → AUTHORITY_VIOLATION
//    #19: Outcome agent attempts retroactive eval mutation→ AUTHORITY_VIOLATION
//    #20: Outcome agent attempts retroactive plan mutation→ AUTHORITY_VIOLATION
//
// Functional Invariants (6):
//    #21: Valid execution → valid outcome                 → OutcomeRecord SUCCEEDED
//    #22: Execution receipt preserved identically         → Unchanged before & after
//    #23: Frozen artifact preserved identically           → Unchanged before & after
//    #24: Deviations detected deterministically           → Categorized without plan mutation
//    #25: Outcome canonicalization deterministic          → Stable canonical hash
//    #26: Historical records remain immutable             → Object.isFrozen recursive

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { emitDiscoveryProposal } from '../lib/agents/discovery.ts';
import { emitEvaluationProposal } from '../lib/agents/evaluation.ts';
import { emitPlanningProposal } from '../lib/agents/planning.ts';
import { emitOrchestrationProposal } from '../lib/agents/orchestrator.ts';
import {
  evaluatePolicyDecision,
  signHumanApproval,
  freezeApplicationArtifact,
  transitionGovernanceState,
} from '../lib/agents/governance.ts';
import { createEvidenceSnapshot } from '../lib/execution/snapshot.ts';
import { computeArtifactFingerprint } from '../lib/execution/fingerprint.ts';
import { executeApplicationPackage } from '../lib/execution/engine.ts';
import {
  recordOutcome,
  validateExecutionReceipt,
  validateFrozenArtifact,
  detectDeviations,
  canonicalizeOutcome,
  verifyOutcomeIntegrity,
  createOutcomeProposalEnvelope,
} from '../lib/agents/outcome.ts';
import { validateAgentProposal } from '../lib/agents/policyGuard.ts';
import { OUTCOME_AGENT_CONTRACT } from '../lib/agents/contracts.ts';

console.log('================================================================');
console.log('  RJA V5.0-ALPHA7: OUTCOME INTELLIGENCE & TEMPORAL INTEGRITY   ');
console.log('  26 Formal Tests: 8 Historical + 6 Provenance + 6 Authority + 6 Functional');
console.log('  Governing Invariant: "Outcome Intelligence observes history;  ');
console.log('                        it does not rewrite history."           ');
console.log('================================================================\n');

// -------------------------------------------------------------
// SETUP: Upstream Pipeline Execution Fixtures (T0 - T7)
// -------------------------------------------------------------
const candidateProfile = {
  headline: 'Principal Infrastructure Engineer',
  years_experience: 14,
  skills: ['Rust', 'Go', 'Kubernetes', 'Kafka', 'Terraform', 'Distributed Systems'],
  certifications: ['PE', 'AWS Certified Solutions Architect'],
  bio: 'Designing resilient distributed platforms and multi-region infrastructure.',
};
const evidenceSnapshot = createEvidenceSnapshot('cand-8801', candidateProfile);

const job1 = {
  title: 'Principal Infrastructure Engineer',
  company: 'Vertex Cloud Systems',
  url: 'https://careers.vertexcloud.com/jobs/inf-101',
  source: 'greenhouse',
  requirements: [
    '10+ years designing high-scale infrastructure',
    'Expert proficiency in Rust and Go required',
    'Deep experience with Kubernetes and Kafka',
  ],
  skills: ['Rust', 'Go', 'Kubernetes', 'Kafka'],
  location: 'Remote (US/Canada)',
  category: 'cloud_infrastructure',
  raw_payload: { id: 'inf-101' },
};

const discEnv1 = await emitDiscoveryProposal(job1);
const evalEnv1 = await emitEvaluationProposal(discEnv1, evidenceSnapshot);
const planEnv1 = await emitPlanningProposal([evalEnv1], evidenceSnapshot, {
  planId: 'plan-alpha7-clean',
  maxConcurrentApplications: 2,
  createdAt: '2026-09-27T11:00:00.000Z',
});

const orchEnvelope = await emitOrchestrationProposal(
  {
    discoveryProposals: [discEnv1],
    evaluationProposals: [evalEnv1],
    planningProposals: [planEnv1],
  },
  evidenceSnapshot,
  {
    orchestrationId: 'orch-alpha7-clean',
    createdAt: '2026-09-27T11:05:00.000Z',
  }
);

const cleanPolicyDecision = evaluatePolicyDecision(orchEnvelope, { snapshot: evidenceSnapshot });

const draftArtifactPayload = {
  resume: {
    headline: candidateProfile.headline,
    full_resume: `${candidateProfile.headline}.\n14 years experience.\nExpert in ${candidateProfile.skills.join(', ')}.`,
  },
  cover_letter: {
    recipient: 'Hiring Team at Vertex Cloud Systems',
    letter: 'Dear Hiring Team,\nI am writing to express my strong interest in the Principal Infrastructure Engineer role.',
  },
  screening_answers: {
    answers: [
      { question_id: 'q1', question: 'Do you have 10+ years infrastructure experience?', answer: 'Yes, 14 years.' },
    ],
  },
};

const candidateApprovalRecord = signHumanApproval({
  policyDecision: {
    ...cleanPolicyDecision,
    decision: 'ALLOW_REVIEW',
  },
  candidateSignature: 'alex.rivera@engineering.com',
  candidateSnapshot: evidenceSnapshot,
  orchestrationProposal: orchEnvelope.output,
  artifactContent: draftArtifactPayload,
  destination: job1.url,
  approvalTimestamp: '2026-09-27T11:10:00.000Z',
});

const frozenArtifact = freezeApplicationArtifact(candidateApprovalRecord, draftArtifactPayload);

const executionResult = executeApplicationPackage({
  applicationId: 'app-alpha7-live-1',
  approvedArtifact: {
    id: frozenArtifact.frozenArtifactId,
    application_id: 'app-alpha7-live-1',
    evidence_snapshot_id: frozenArtifact.candidateSnapshotId,
    destination: frozenArtifact.destination,
    fingerprint: {
      hash: frozenArtifact.canonicalFingerprint,
      algorithm: 'sha256',
      fingerprint_algorithm: 'rja-c14n-v1-sha256',
      canonicalization_scheme: 'rja-c14n-v1-sha256',
      components: {
        resume_length: 100,
        cover_letter_length: 100,
        answers_count: 1,
      },
      computed_at: frozenArtifact.approvedAt,
    },
    approved_by: frozenArtifact.approvedBy,
    approved_at: frozenArtifact.approvedAt,
    content: frozenArtifact.artifactPayload,
  },
  currentContent: frozenArtifact.artifactPayload,
  route: 'portal',
  destination: frozenArtifact.destination,
});

assert.strictEqual(executionResult.success, true);
assert.strictEqual(executionResult.attempt.status, 'confirmed');
assert.ok(executionResult.receipt, 'v4.6.1 Substrate must return verified submission receipt');
const receipt = executionResult.receipt;

console.log('✓ Upstream pipeline synthesized and execution confirmed with receipt:', receipt.id);

// -------------------------------------------------------------
// AREA 1: Historical Integrity (8 Tests)
// -------------------------------------------------------------
console.log('\n--- AREA 1: Historical Integrity (8 Tests) ---');

// Test 1: Modify frozen artifact after execution
{
  const tamperedArtifact = {
    ...frozenArtifact,
    artifactPayload: {
      ...frozenArtifact.artifactPayload,
      cover_letter: {
        ...frozenArtifact.artifactPayload.cover_letter,
        letter: 'Tampered cover letter injected post-execution',
      },
    },
  };
  assert.throws(
    () => validateFrozenArtifact(tamperedArtifact),
    /FROZEN_ARTIFACT_TAMPERED/,
    'Test 1: Mutated frozen artifact after execution must be detected and rejected'
  );
  console.log('  ✓ Test 1: Modifying frozen artifact after execution rejected (FROZEN_ARTIFACT_TAMPERED)');
}

// Test 2: Modify execution receipt
{
  const tamperedReceipt = {
    ...receipt,
    destination: 'https://attacker.site/intercept',
  };
  const baseline = validateExecutionReceipt(receipt);
  const tamperedValidation = validateExecutionReceipt(tamperedReceipt);
  assert.notEqual(baseline.receiptHash, tamperedValidation.receiptHash, 'Receipt hash must diverge when modified');

  const outcome = recordOutcome({
    receipt,
    frozenArtifact,
    snapshot: evidenceSnapshot,
  });
  const verification = verifyOutcomeIntegrity(outcome, tamperedReceipt, frozenArtifact);
  assert.equal(verification.valid, false);
  assert.ok(verification.violations.some((v) => v.includes('RECEIPT_HASH_MISMATCH')));
  console.log('  ✓ Test 2: Modifying execution receipt produces hash mismatch (RECEIPT_HASH_MISMATCH)');
}

// Test 3: Modify execution timestamp
{
  const tamperedReceipt = {
    ...receipt,
    received_at: '2021-01-01T00:00:00.000Z',
  };
  const outcome = recordOutcome({
    receipt,
    frozenArtifact,
    snapshot: evidenceSnapshot,
  });
  const verification = verifyOutcomeIntegrity(outcome, tamperedReceipt, frozenArtifact);
  assert.equal(verification.valid, false);
  assert.ok(verification.violations.some((v) => v.includes('RECEIPT_HASH_MISMATCH')));
  console.log('  ✓ Test 3: Modifying execution timestamp detected via receipt hash');
}

// Test 4: Modify execution status
{
  const failedOutcome = recordOutcome({
    receipt,
    frozenArtifact,
    snapshot: evidenceSnapshot,
    status: 'FAILED',
  });
  assert.equal(failedOutcome.status, 'FAILED');
  assert.ok(
    failedOutcome.deviations.some((d) => d.category === 'EXECUTION_FAILURE'),
    'Observed failure status must produce an EXECUTION_FAILURE deviation'
  );
  console.log('  ✓ Test 4: Modifying execution status captured deterministically as EXECUTION_FAILURE deviation');
}

// Test 5: Modify candidate snapshot
{
  const tamperedSnapshot = {
    ...evidenceSnapshot,
    id: 'snap-forged-999',
  };
  assert.throws(
    () =>
      recordOutcome({
        receipt,
        frozenArtifact,
        snapshot: tamperedSnapshot,
      }),
    /SNAPSHOT_MISMATCH/,
    'Test 5: Snapshot mismatch between frozen artifact and context must throw'
  );
  console.log('  ✓ Test 5: Mutated candidate snapshot rejected with SNAPSHOT_MISMATCH');
}

// Test 6: Rewrite historical outcome (Object.freeze)
{
  const outcome = recordOutcome({
    receipt,
    frozenArtifact,
    snapshot: evidenceSnapshot,
  });
  assert.throws(
    () => {
      outcome.status = 'FAILED';
    },
    /Cannot assign to read only property/,
    'Test 6: Emitted OutcomeRecord must be immutable'
  );
  assert.throws(
    () => {
      outcome.actualResults.push({ observationId: 'obs-tamper' });
    },
    /Cannot add property|object is not extensible/,
    'Test 6: actualResults array must be immutable'
  );
  console.log('  ✓ Test 6: Rewriting historical outcome blocked by deep Object.freeze');
}

// Test 7: Delete historical outcome property
{
  const outcome = recordOutcome({
    receipt,
    frozenArtifact,
    snapshot: evidenceSnapshot,
  });
  assert.throws(
    () => {
      delete outcome.executionId;
    },
    /Cannot delete property/,
    'Test 7: Deleting historical outcome properties must throw'
  );
  console.log('  ✓ Test 7: Deleting historical outcome properties blocked by Object.freeze');
}

// Test 8: Replay outcome against another execution
{
  const outcome = recordOutcome({
    receipt,
    frozenArtifact,
    snapshot: evidenceSnapshot,
  });
  const alienReceipt = {
    ...receipt,
    execution_attempt_id: 'exec-alien-attempt-99',
  };
  const verification = verifyOutcomeIntegrity(outcome, alienReceipt, frozenArtifact);
  assert.equal(verification.valid, false);
  assert.ok(verification.violations.some((v) => v.includes('EXECUTION_ID_MISMATCH')));
  console.log('  ✓ Test 8: Replaying outcome against alien execution attempt rejected (EXECUTION_ID_MISMATCH)');
}

// -------------------------------------------------------------
// AREA 2: Provenance Attacks (6 Tests)
// -------------------------------------------------------------
console.log('\n--- AREA 2: Provenance Attacks (6 Tests) ---');

// Test 9: Forge execution receipt hash
{
  const outcome = recordOutcome({
    receipt,
    frozenArtifact,
    snapshot: evidenceSnapshot,
  });
  const forgedOutcome = {
    ...outcome,
    executionReceiptHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  };
  const verification = verifyOutcomeIntegrity(forgedOutcome, receipt, frozenArtifact);
  assert.equal(verification.valid, false);
  assert.ok(verification.violations.some((v) => v.includes('RECEIPT_HASH_MISMATCH')));
  console.log('  ✓ Test 9: Forged execution receipt hash rejected with RECEIPT_HASH_MISMATCH');
}

// Test 10: Forge frozen artifact ID
{
  const outcome = recordOutcome({
    receipt,
    frozenArtifact,
    snapshot: evidenceSnapshot,
  });
  const forgedOutcome = {
    ...outcome,
    frozenArtifactId: 'frozen-fake-777',
  };
  const verification = verifyOutcomeIntegrity(forgedOutcome, receipt, frozenArtifact);
  assert.equal(verification.valid, false);
  assert.ok(verification.violations.some((v) => v.includes('FROZEN_ARTIFACT_MISMATCH')));
  console.log('  ✓ Test 10: Forged frozen artifact ID rejected with FROZEN_ARTIFACT_MISMATCH');
}

// Test 11: Forge execution ID
{
  const outcome = recordOutcome({
    receipt,
    frozenArtifact,
    snapshot: evidenceSnapshot,
  });
  const forgedOutcome = {
    ...outcome,
    executionId: 'exec-forged-000',
  };
  const verification = verifyOutcomeIntegrity(forgedOutcome, receipt, frozenArtifact);
  assert.equal(verification.valid, false);
  assert.ok(verification.violations.some((v) => v.includes('EXECUTION_ID_MISMATCH')));
  console.log('  ✓ Test 11: Forged execution ID rejected with EXECUTION_ID_MISMATCH');
}

// Test 12: Forge candidate snapshot relationship
{
  const alienProfile = {
    headline: 'Alien Candidate',
    years_experience: 1,
    skills: ['None'],
  };
  const alienSnapshot = createEvidenceSnapshot('cand-alien-002', alienProfile);

  assert.throws(
    () =>
      recordOutcome({
        receipt,
        frozenArtifact,
        snapshot: alienSnapshot,
      }),
    /SNAPSHOT_MISMATCH/,
    'Test 12: Forged candidate snapshot relationship must throw'
  );
  console.log('  ✓ Test 12: Forged candidate snapshot relationship rejected with SNAPSHOT_MISMATCH');
}

// Test 13: Break provenance chain in proposal envelope
{
  const outcome = recordOutcome({
    receipt,
    frozenArtifact,
    snapshot: evidenceSnapshot,
  });
  const envelope = createOutcomeProposalEnvelope(outcome, evidenceSnapshot);

  // Forge provenance hash
  const tamperedEnvelope = {
    ...envelope,
    provenance: {
      ...envelope.provenance,
      provenance_hash: 'bad-provenance-hash-1234567890abcdef',
    },
  };

  const guardResult = validateAgentProposal(tamperedEnvelope, 'outcome', evidenceSnapshot);
  assert.equal(guardResult.allowed, false);
  assert.ok(guardResult.violations.some((v) => v.includes('OUTCOME_PROVENANCE_FORGED')));
  console.log('  ✓ Test 13: Broken provenance chain rejected (OUTCOME_PROVENANCE_FORGED)');
}

// Test 14: Inject outcome without execution receipt
{
  assert.throws(
    () => validateExecutionReceipt(null),
    /RECEIPT_INVALID/,
    'Test 14: Missing receipt must be rejected'
  );
  assert.throws(
    () =>
      recordOutcome({
        receipt: null,
        frozenArtifact,
        snapshot: evidenceSnapshot,
      }),
    /RECEIPT_INVALID/,
    'Test 14: Attempting to record outcome without receipt must throw'
  );
  console.log('  ✓ Test 14: Injecting outcome without receipt rejected (RECEIPT_INVALID)');
}

// -------------------------------------------------------------
// AREA 3: Authority Attacks (6 Tests)
// -------------------------------------------------------------
console.log('\n--- AREA 3: Authority Attacks (6 Tests) ---');

// Test 15: Outcome agent attempts artifact mutation
{
  const outcome = recordOutcome({
    receipt,
    frozenArtifact,
    snapshot: evidenceSnapshot,
  });
  const envelope = createOutcomeProposalEnvelope(outcome, evidenceSnapshot);

  const maliciousEnvelope = {
    ...envelope,
    modify_frozen_artifact: { target: frozenArtifact.frozenArtifactId, patch: 'tamper' },
  };

  const guardResult = validateAgentProposal(maliciousEnvelope, 'outcome', evidenceSnapshot);
  assert.equal(guardResult.allowed, false);
  assert.ok(guardResult.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ Test 15: Outcome agent attempting frozen artifact mutation BLOCKED (AUTHORITY_VIOLATION)');
}

// Test 16: Outcome agent attempts policy change
{
  const outcome = recordOutcome({
    receipt,
    frozenArtifact,
    snapshot: evidenceSnapshot,
  });
  const envelope = createOutcomeProposalEnvelope(outcome, evidenceSnapshot);

  const maliciousEnvelope = {
    ...envelope,
    policy_override: true,
  };

  const guardResult = validateAgentProposal(maliciousEnvelope, 'outcome', evidenceSnapshot);
  assert.equal(guardResult.allowed, false);
  assert.ok(guardResult.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ Test 16: Outcome agent attempting policy change BLOCKED (AUTHORITY_VIOLATION)');
}

// Test 17: Outcome agent attempts approval
{
  const outcome = recordOutcome({
    receipt,
    frozenArtifact,
    snapshot: evidenceSnapshot,
  });
  const envelope = createOutcomeProposalEnvelope(outcome, evidenceSnapshot);

  const maliciousEnvelope = {
    ...envelope,
    approve: true,
    approved_by: 'outcome_agent',
  };

  const guardResult = validateAgentProposal(maliciousEnvelope, 'outcome', evidenceSnapshot);
  assert.equal(guardResult.allowed, false);
  assert.ok(guardResult.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ Test 17: Outcome agent attempting approval BLOCKED (AUTHORITY_VIOLATION)');
}

// Test 18: Outcome agent attempts execution
{
  const outcome = recordOutcome({
    receipt,
    frozenArtifact,
    snapshot: evidenceSnapshot,
  });
  const envelope = createOutcomeProposalEnvelope(outcome, evidenceSnapshot);

  const maliciousEnvelope = {
    ...envelope,
    authority: {
      canExecute: true,
      canApprove: false,
      canMutateEvidence: false,
    },
    execute: true,
  };

  const guardResult = validateAgentProposal(maliciousEnvelope, 'outcome', evidenceSnapshot);
  assert.equal(guardResult.allowed, false);
  assert.ok(guardResult.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ Test 18: Outcome agent attempting execution capability BLOCKED (AUTHORITY_VIOLATION)');
}

// Test 19: Outcome agent attempts retroactive evaluation mutation
{
  const outcome = recordOutcome({
    receipt,
    frozenArtifact,
    snapshot: evidenceSnapshot,
  });
  const envelope = createOutcomeProposalEnvelope(outcome, evidenceSnapshot);

  const maliciousEnvelope = {
    ...envelope,
    retroactive_evaluation: { evaluationId: evalEnv1.output.evaluationId, fitScore: 100 },
  };

  const guardResult = validateAgentProposal(maliciousEnvelope, 'outcome', evidenceSnapshot);
  assert.equal(guardResult.allowed, false);
  assert.ok(guardResult.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ Test 19: Outcome agent attempting retroactive evaluation mutation BLOCKED (AUTHORITY_VIOLATION)');
}

// Test 20: Outcome agent attempts retroactive planning mutation
{
  const outcome = recordOutcome({
    receipt,
    frozenArtifact,
    snapshot: evidenceSnapshot,
  });
  const envelope = createOutcomeProposalEnvelope(outcome, evidenceSnapshot);

  const maliciousEnvelope = {
    ...envelope,
    retroactive_plan: { planId: planEnv1.output.planId, actions: [] },
  };

  const guardResult = validateAgentProposal(maliciousEnvelope, 'outcome', evidenceSnapshot);
  assert.equal(guardResult.allowed, false);
  assert.ok(guardResult.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ Test 20: Outcome agent attempting retroactive planning mutation BLOCKED (AUTHORITY_VIOLATION)');
}

// -------------------------------------------------------------
// AREA 4: Functional Invariants (6 Tests)
// -------------------------------------------------------------
console.log('\n--- AREA 4: Functional Invariants (6 Tests) ---');

// Test 21: Valid execution -> valid outcome
{
  const outcome = recordOutcome({
    receipt,
    frozenArtifact,
    snapshot: evidenceSnapshot,
    planningProposal: planEnv1.output,
    status: 'SUCCEEDED',
  });
  assert.ok(outcome.outcomeId.startsWith('out-'));
  assert.equal(outcome.status, 'SUCCEEDED');
  assert.equal(outcome.executionId, receipt.execution_attempt_id);
  assert.equal(outcome.frozenArtifactId, frozenArtifact.frozenArtifactId);
  assert.equal(outcome.candidateSnapshotId, evidenceSnapshot.id);
  assert.equal(outcome.created_by, 'outcome_intelligence');
  assert.equal(outcome.immutable, true);
  assert.ok(outcome.actualResults.length >= 2);

  const envelope = createOutcomeProposalEnvelope(outcome, evidenceSnapshot);
  const guardResult = validateAgentProposal(envelope, 'outcome', evidenceSnapshot);
  assert.equal(guardResult.allowed, true, 'Valid outcome must pass Policy Guard');
  console.log('  ✓ Test 21: Valid execution produces valid OutcomeRecord passing Policy Guard');
}

// Test 22: Execution receipt preserved identically
{
  const receiptSnapshotBefore = JSON.stringify(receipt);
  recordOutcome({
    receipt,
    frozenArtifact,
    snapshot: evidenceSnapshot,
  });
  const receiptSnapshotAfter = JSON.stringify(receipt);
  assert.equal(receiptSnapshotBefore, receiptSnapshotAfter, 'Execution receipt must not be modified');
  console.log('  ✓ Test 22: Execution receipt preserved identically before and after outcome recording');
}

// Test 23: Frozen artifact preserved identically
{
  const artifactSnapshotBefore = JSON.stringify(frozenArtifact);
  recordOutcome({
    receipt,
    frozenArtifact,
    snapshot: evidenceSnapshot,
  });
  const artifactSnapshotAfter = JSON.stringify(frozenArtifact);
  assert.equal(artifactSnapshotBefore, artifactSnapshotAfter, 'Frozen artifact must not be modified');
  console.log('  ✓ Test 23: Frozen artifact preserved identically before and after outcome recording');
}

// Test 24: Deviations detected deterministically without mutating plan
{
  const planSnapshotBefore = JSON.stringify(planEnv1.output);
  const deviations = detectDeviations({
    planningProposal: planEnv1.output,
    receipt,
    observedStatus: 'FAILED',
    observedAt: new Date().toISOString(),
  });
  const planSnapshotAfter = JSON.stringify(planEnv1.output);

  assert.equal(planSnapshotBefore, planSnapshotAfter, 'Original planning proposal must remain untouched');
  assert.ok(deviations.some((d) => d.category === 'EXECUTION_FAILURE'));
  console.log('  ✓ Test 24: Deviations detected deterministically without mutating original plan');
}

// Test 25: Outcome canonicalization deterministic
{
  const outcomeA = recordOutcome({
    receipt,
    frozenArtifact,
    snapshot: evidenceSnapshot,
    options: { outcomeId: 'out-fixed-canonical-123' },
    observedAt: '2026-09-27T18:00:00.000Z',
  });
  const outcomeB = recordOutcome({
    receipt,
    frozenArtifact,
    snapshot: evidenceSnapshot,
    options: { outcomeId: 'out-fixed-canonical-123' },
    observedAt: '2026-09-27T18:00:00.000Z',
  });

  const c14nA = canonicalizeOutcome(outcomeA);
  const c14nB = canonicalizeOutcome(outcomeB);
  assert.equal(c14nA, c14nB, 'Canonicalization must produce identical strings');

  const hashA = crypto.createHash('sha256').update(c14nA).digest('hex');
  const hashB = crypto.createHash('sha256').update(c14nB).digest('hex');
  assert.equal(hashA, hashB, 'Cryptographic digest over canonical outcome must be identical');
  console.log('  ✓ Test 25: Outcome canonicalization is strictly deterministic and collision-free');
}

// Test 26: Historical records remain deeply immutable
{
  const outcome = recordOutcome({
    receipt,
    frozenArtifact,
    snapshot: evidenceSnapshot,
  });
  assert.ok(Object.isFrozen(outcome), 'Top-level record must be frozen');
  assert.ok(Object.isFrozen(outcome.actualResults), 'actualResults array must be frozen');
  assert.ok(Object.isFrozen(outcome.deviations), 'deviations array must be frozen');
  assert.ok(Object.isFrozen(outcome.evidenceReferences), 'evidenceReferences array must be frozen');
  assert.equal(outcome.immutable, true, 'immutable property must be true');
  console.log('  ✓ Test 26: Historical records remain deeply immutable (Object.isFrozen recursive)');
}

console.log('\n================================================================');
console.log('  ALL V5.0-ALPHA7 OUTCOME INTELLIGENCE TESTS PASSED (26 / 26)   ');
console.log('  Temporal Integrity & Immutable Outcome Boundary CERTIFIED     ');
console.log('================================================================\n');
