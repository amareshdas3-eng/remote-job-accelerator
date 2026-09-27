// tests/v5_evidence_feedback.mjs
// RJA v5.0-alpha8: Evidence Feedback Intelligence Test Suite
//
// Formally verifies 28 tests across 4 key areas:
//
// Feedback Integrity (8):
//    #1:  Forge outcome source                            → OUTCOME_SOURCE_MISMATCH
//    #2:  Forge execution source                          → EXECUTION_SOURCE_MISMATCH
//    #3:  Forge evidence reference                        → SNAPSHOT_SOURCE_MISMATCH
//    #4:  Forge candidate snapshot                        → SNAPSHOT_MISMATCH
//    #5:  Inject feedback without outcome                 → OUTCOME_INVALID
//    #6:  Inject feedback without receipt                 → OUTCOME_SCHEMA_VIOLATION
//    #7:  Modify outcome after feedback                   → TypeError (Object.freeze)
//    #8:  Modify feedback after creation                  → TypeError (Object.freeze)
//
// Retroactive Mutation (8):
//    #9:  Feedback modifies evaluation                    → AUTHORITY_VIOLATION
//    #10: Feedback modifies planning                      → AUTHORITY_VIOLATION
//    #11: Feedback modifies orchestration                 → AUTHORITY_VIOLATION
//    #12: Feedback modifies policy                        → AUTHORITY_VIOLATION
//    #13: Feedback modifies human approval                → AUTHORITY_VIOLATION
//    #14: Feedback modifies frozen artifact               → AUTHORITY_VIOLATION
//    #15: Feedback modifies execution receipt             → AUTHORITY_VIOLATION
//    #16: Feedback modifies historical outcome            → AUTHORITY_VIOLATION
//
// Authority Attacks (6):
//    #17: Feedback agent attempts approval                → AUTHORITY_VIOLATION
//    #18: Feedback agent attempts execution               → AUTHORITY_VIOLATION
//    #19: Feedback agent attempts freeze                  → AUTHORITY_VIOLATION
//    #20: Feedback agent attempts policy override         → AUTHORITY_VIOLATION
//    #21: Feedback agent attempts candidate mutation      → AUTHORITY_VIOLATION
//    #22: Feedback agent attempts automatic re-planning   → AUTHORITY_VIOLATION
//
// Functional Invariants (6):
//    #23: Valid outcome → valid evidence                  → EvidenceFeedbackRecord
//    #24: Evidence retains outcome provenance             → Verifiable Envelope Provenance
//    #25: Deterministic feedback canonicalization         → Stable canonical string
//    #26: Insertion-order invariance                      → Identical canonical hash
//    #27: Historical immutability                         → Deep Object.freeze
//    #28: Feedback remains proposal/evidence only         → Negative capabilities preserved

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
} from '../lib/agents/governance.ts';
import { createEvidenceSnapshot } from '../lib/execution/snapshot.ts';
import { executeApplicationPackage } from '../lib/execution/engine.ts';
import { recordOutcome } from '../lib/agents/outcome.ts';
import {
  createEvidenceFeedback,
  validateOutcomeProvenance,
  deriveFeedbackSignals,
  canonicalizeFeedback,
  verifyFeedbackIntegrity,
  createFeedbackProposalEnvelope,
} from '../lib/agents/feedback.ts';
import { validateAgentProposal } from '../lib/agents/policyGuard.ts';
import { FEEDBACK_AGENT_CONTRACT } from '../lib/agents/contracts.ts';

console.log('================================================================');
console.log('  RJA V5.0-ALPHA8: EVIDENCE FEEDBACK INTELLIGENCE TEST SUITE   ');
console.log('  28 Formal Tests: 8 Integrity + 8 Retroactive + 6 Authority + 6 Functional');
console.log('  Governing Invariant: "Feedback creates evidence;              ');
console.log('                        it does not create authority."          ');
console.log('================================================================\n');

// -------------------------------------------------------------
// SETUP: Upstream Pipeline Execution Fixtures (T0 - T8)
// -------------------------------------------------------------
const candidateProfile = {
  headline: 'Staff Distributed Systems Engineer',
  years_experience: 12,
  skills: ['Go', 'Rust', 'Raft', 'Kubernetes', 'gRPC'],
  certifications: ['AWS Solutions Architect Pro'],
  bio: 'Building geo-distributed stateful storage systems and fault-tolerant consensus engines.',
};
const evidenceSnapshot = createEvidenceSnapshot('cand-alpha8-01', candidateProfile);

const job = {
  title: 'Staff Distributed Systems Engineer',
  company: 'Consensus Labs Inc.',
  url: 'https://careers.consensuslabs.io/jobs/dist-88',
  source: 'greenhouse',
  requirements: [
    '10+ years distributed systems engineering',
    'Deep expertise in Go or Rust',
    'Production consensus protocol experience (Raft/Paxos)',
  ],
  skills: ['Go', 'Rust', 'Raft'],
  location: 'Remote',
  category: 'systems_engineering',
  raw_payload: { id: 'dist-88' },
};

const discEnvelope = await emitDiscoveryProposal(job);
const evalEnvelope = await emitEvaluationProposal(discEnvelope, evidenceSnapshot);
const planEnvelope = await emitPlanningProposal([evalEnvelope], evidenceSnapshot, {
  planId: 'plan-alpha8-clean',
  maxConcurrentApplications: 2,
  createdAt: '2026-09-27T12:00:00.000Z',
});

const orchEnvelope = await emitOrchestrationProposal(
  {
    discoveryProposals: [discEnvelope],
    evaluationProposals: [evalEnvelope],
    planningProposals: [planEnvelope],
  },
  evidenceSnapshot,
  {
    orchestrationId: 'orch-alpha8-clean',
    createdAt: '2026-09-27T12:05:00.000Z',
  }
);

const policyDecision = evaluatePolicyDecision(orchEnvelope, { snapshot: evidenceSnapshot });

const draftArtifactPayload = {
  resume: {
    headline: candidateProfile.headline,
    full_resume: `${candidateProfile.headline}.\n12 years experience.\nExpert in ${candidateProfile.skills.join(', ')}.`,
  },
  cover_letter: {
    recipient: 'Consensus Labs Hiring Team',
    letter: 'Dear Consensus Labs Team,\nI am writing to express my strong interest in the Staff Distributed Systems Engineer role.',
  },
  screening_answers: {
    answers: [
      { question_id: 'q1', question: 'Do you have production Raft/Paxos experience?', answer: 'Yes, 8 years.' },
    ],
  },
};

const humanApproval = signHumanApproval({
  policyDecision: {
    ...policyDecision,
    decision: 'ALLOW_REVIEW',
  },
  candidateSignature: 'candidate.elena@consensus.io',
  candidateSnapshot: evidenceSnapshot,
  orchestrationProposal: orchEnvelope.output,
  artifactContent: draftArtifactPayload,
  destination: job.url,
  approvalTimestamp: '2026-09-27T12:10:00.000Z',
});

const frozenArtifact = freezeApplicationArtifact(humanApproval, draftArtifactPayload);

const executionResult = executeApplicationPackage({
  applicationId: 'app-alpha8-live-1',
  approvedArtifact: {
    id: frozenArtifact.frozenArtifactId,
    application_id: 'app-alpha8-live-1',
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
const receipt = executionResult.receipt;
assert.ok(receipt);

// T8: Emit Immutable Outcome
const outcome = recordOutcome({
  receipt,
  frozenArtifact,
  snapshot: evidenceSnapshot,
  planningProposal: planEnvelope.output,
  status: 'SUCCEEDED',
});
assert.strictEqual(outcome.immutable, true);

console.log('✓ Upstream pipeline through Outcome (T0 - T8) established.');

// -------------------------------------------------------------
// SECTION 1: Feedback Integrity (8 Tests)
// -------------------------------------------------------------
console.log('\n--- SECTION 1: Feedback Integrity (8 Tests) ---');

// #1: Forge outcome source
{
  const fb = createEvidenceFeedback({ outcome, snapshot: evidenceSnapshot });
  const forgedFb = {
    ...fb,
    sourceOutcomeId: 'out-forged-999',
  };
  const integrity = verifyFeedbackIntegrity(forgedFb, outcome);
  assert.strictEqual(integrity.valid, false);
  assert.ok(integrity.violations.some((v) => v.includes('OUTCOME_SOURCE_MISMATCH')));
  console.log('  ✓ #1 BLOCKED: Forged outcome source detected (OUTCOME_SOURCE_MISMATCH)');
}

// #2: Forge execution source
{
  const fb = createEvidenceFeedback({ outcome, snapshot: evidenceSnapshot });
  const forgedFb = {
    ...fb,
    sourceExecutionId: 'exec-forged-888',
  };
  const integrity = verifyFeedbackIntegrity(forgedFb, outcome);
  assert.strictEqual(integrity.valid, false);
  assert.ok(integrity.violations.some((v) => v.includes('EXECUTION_SOURCE_MISMATCH')));
  console.log('  ✓ #2 BLOCKED: Forged execution source detected (EXECUTION_SOURCE_MISMATCH)');
}

// #3: Forge evidence reference
{
  const fb = createEvidenceFeedback({ outcome, snapshot: evidenceSnapshot });
  const forgedFb = {
    ...fb,
    candidateSnapshotId: 'snap-alien-777',
  };
  const integrity = verifyFeedbackIntegrity(forgedFb, outcome);
  assert.strictEqual(integrity.valid, false);
  assert.ok(integrity.violations.some((v) => v.includes('SNAPSHOT_SOURCE_MISMATCH')));
  console.log('  ✓ #3 BLOCKED: Forged snapshot reference detected (SNAPSHOT_SOURCE_MISMATCH)');
}

// #4: Forge candidate snapshot
{
  const alienProfile = { headline: 'Alien Candidate', years_experience: 1, skills: [] };
  const alienSnapshot = createEvidenceSnapshot('cand-alien-02', alienProfile);
  assert.throws(
    () => createEvidenceFeedback({ outcome, snapshot: alienSnapshot }),
    /SNAPSHOT_MISMATCH/
  );
  console.log('  ✓ #4 BLOCKED: Candidate snapshot mismatch rejected (SNAPSHOT_MISMATCH)');
}

// #5: Inject feedback without outcome
{
  assert.throws(
    () => createEvidenceFeedback({ outcome: null, snapshot: evidenceSnapshot }),
    /OUTCOME_INVALID/
  );
  console.log('  ✓ #5 BLOCKED: Missing outcome object rejected (OUTCOME_INVALID)');
}

// #6: Inject feedback without receipt
{
  const outcomeWithoutReceiptHash = {
    ...outcome,
    executionReceiptHash: '',
  };
  assert.throws(
    () => validateOutcomeProvenance(outcomeWithoutReceiptHash, evidenceSnapshot),
    /OUTCOME_SCHEMA_VIOLATION/
  );
  console.log('  ✓ #6 BLOCKED: Outcome lacking execution receipt hash rejected (OUTCOME_SCHEMA_VIOLATION)');
}

// #7: Modify outcome after feedback
{
  assert.throws(
    () => {
      outcome.status = 'FAILED';
    },
    /Cannot assign to read only property/,
    'OutcomeRecord must be immutable'
  );
  console.log('  ✓ #7 DEFENDED: Outcome remains immutable after feedback creation (Object.freeze)');
}

// #8: Modify feedback after creation
{
  const fb = createEvidenceFeedback({ outcome, snapshot: evidenceSnapshot });
  assert.throws(
    () => {
      fb.sourceOutcomeId = 'out-mutated';
    },
    /Cannot assign to read only property/,
    'EvidenceFeedbackRecord must be deeply immutable'
  );
  assert.throws(
    () => {
      fb.observations.push({ observationId: 'obs-tamper' });
    },
    /Cannot add property|object is not extensible/,
    'Feedback observations array must be deeply immutable'
  );
  console.log('  ✓ #8 DEFENDED: Feedback record is deeply immutable post-creation (Object.freeze)');
}

// -------------------------------------------------------------
// SECTION 2: Retroactive Mutation Attacks (8 Tests)
// -------------------------------------------------------------
console.log('\n--- SECTION 2: Retroactive Mutation Attacks (8 Tests) ---');

const baseFeedback = createEvidenceFeedback({ outcome, snapshot: evidenceSnapshot });
const baseEnvelope = createFeedbackProposalEnvelope(baseFeedback, evidenceSnapshot);

// #9: Feedback modifies evaluation
{
  const malicious = {
    ...baseEnvelope,
    modify_evaluation: { evaluationId: evalEnvelope.output.evaluationId, fitScore: 100 },
  };
  const res = validateAgentProposal(malicious, 'feedback', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #9 BLOCKED: Retroactive evaluation mutation rejected (AUTHORITY_VIOLATION)');
}

// #10: Feedback modifies planning
{
  const malicious = {
    ...baseEnvelope,
    modify_plan: { planId: planEnvelope.output.planId, actions: [] },
  };
  const res = validateAgentProposal(malicious, 'feedback', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #10 BLOCKED: Retroactive planning mutation rejected (AUTHORITY_VIOLATION)');
}

// #11: Feedback modifies orchestration
{
  const malicious = {
    ...baseEnvelope,
    modify_orchestration: { orchestrationId: orchEnvelope.output.orchestrationId },
  };
  const res = validateAgentProposal(malicious, 'feedback', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #11 BLOCKED: Retroactive orchestration mutation rejected (AUTHORITY_VIOLATION)');
}

// #12: Feedback modifies policy
{
  const malicious = {
    ...baseEnvelope,
    modify_policy: { decision: 'ALLOW_REVIEW' },
  };
  const res = validateAgentProposal(malicious, 'feedback', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #12 BLOCKED: Policy decision mutation rejected (AUTHORITY_VIOLATION)');
}

// #13: Feedback modifies human approval
{
  const malicious = {
    ...baseEnvelope,
    approve: true,
    grant_approval: 'candidate.elena@consensus.io',
  };
  const res = validateAgentProposal(malicious, 'feedback', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #13 BLOCKED: Human approval forging rejected (AUTHORITY_VIOLATION)');
}

// #14: Feedback modifies frozen artifact
{
  const malicious = {
    ...baseEnvelope,
    modify_frozen_artifact: { target: frozenArtifact.frozenArtifactId },
  };
  const res = validateAgentProposal(malicious, 'feedback', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #14 BLOCKED: Frozen artifact mutation rejected (AUTHORITY_VIOLATION)');
}

// #15: Feedback modifies execution receipt
{
  const malicious = {
    ...baseEnvelope,
    modify_receipt: { receiptId: receipt.id },
  };
  const res = validateAgentProposal(malicious, 'feedback', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #15 BLOCKED: Execution receipt mutation rejected (AUTHORITY_VIOLATION)');
}

// #16: Feedback modifies historical outcome
{
  const malicious = {
    ...baseEnvelope,
    modify_outcome: { outcomeId: outcome.outcomeId },
  };
  const res = validateAgentProposal(malicious, 'feedback', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #16 BLOCKED: Historical outcome mutation rejected (AUTHORITY_VIOLATION)');
}

// -------------------------------------------------------------
// SECTION 3: Authority Attacks (6 Tests)
// -------------------------------------------------------------
console.log('\n--- SECTION 3: Authority Attacks (6 Tests) ---');

// #17: Feedback agent attempts approval
{
  const malicious = {
    ...baseEnvelope,
    authority: {
      canExecute: false,
      canApprove: true,
      canMutateEvidence: false,
    },
  };
  const res = validateAgentProposal(malicious, 'feedback', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #17 BLOCKED: Feedback agent claiming canApprove rejected (AUTHORITY_VIOLATION)');
}

// #18: Feedback agent attempts execution
{
  const malicious = {
    ...baseEnvelope,
    authority: {
      canExecute: true,
      canApprove: false,
      canMutateEvidence: false,
    },
    execute: true,
  };
  const res = validateAgentProposal(malicious, 'feedback', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #18 BLOCKED: Feedback agent claiming canExecute rejected (AUTHORITY_VIOLATION)');
}

// #19: Feedback agent attempts freeze
{
  const malicious = {
    ...baseEnvelope,
    freeze: true,
  };
  const res = validateAgentProposal(malicious, 'feedback', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #19 BLOCKED: Feedback agent attempting artifact freeze rejected (AUTHORITY_VIOLATION)');
}

// #20: Feedback agent attempts policy override
{
  const malicious = {
    ...baseEnvelope,
    policy_override: true,
  };
  const res = validateAgentProposal(malicious, 'feedback', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #20 BLOCKED: Feedback agent attempting policy override rejected (AUTHORITY_VIOLATION)');
}

// #21: Feedback agent attempts candidate mutation
{
  const malicious = {
    ...baseEnvelope,
    authority: {
      canExecute: false,
      canApprove: false,
      canMutateEvidence: true,
    },
    candidate_profile: { skills: ['Injected Experience'] },
  };
  const res = validateAgentProposal(malicious, 'feedback', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #21 BLOCKED: Feedback agent attempting candidate mutation rejected (AUTHORITY_VIOLATION)');
}

// #22: Feedback agent attempts automatic re-planning
{
  const malicious = {
    ...baseEnvelope,
    automatic_replanning: true,
    replan: true,
  };
  const res = validateAgentProposal(malicious, 'feedback', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #22 BLOCKED: Feedback agent attempting automatic re-planning rejected (AUTHORITY_VIOLATION)');
}

// -------------------------------------------------------------
// SECTION 4: Functional Invariants (6 Tests)
// -------------------------------------------------------------
console.log('\n--- SECTION 4: Functional Invariants (6 Tests) ---');

// #23: Valid outcome -> valid evidence
{
  const fb = createEvidenceFeedback({ outcome, snapshot: evidenceSnapshot });
  assert.ok(fb.feedbackId.startsWith('fb-'));
  assert.strictEqual(fb.sourceOutcomeId, outcome.outcomeId);
  assert.strictEqual(fb.sourceExecutionId, outcome.executionId);
  assert.strictEqual(fb.candidateSnapshotId, evidenceSnapshot.id);
  assert.strictEqual(fb.created_by, 'evidence_feedback');
  assert.strictEqual(fb.immutable, true);
  assert.ok(fb.observations.length >= 1);
  assert.ok(fb.derivedSignals.length >= 1);

  const env = createFeedbackProposalEnvelope(fb, evidenceSnapshot);
  const guard = validateAgentProposal(env, 'feedback', evidenceSnapshot);
  assert.strictEqual(guard.allowed, true, 'Valid feedback proposal must pass Policy Guard');
  console.log('  ✓ #23 PASSED: Valid outcome produces valid EvidenceFeedbackRecord passing Policy Guard');
}

// #24: Evidence retains outcome provenance
{
  const fb = createEvidenceFeedback({ outcome, snapshot: evidenceSnapshot });
  const env = createFeedbackProposalEnvelope(fb, evidenceSnapshot);
  assert.ok(env.provenance.provenance_hash);
  assert.strictEqual(env.provenance.source, 'evidence_feedback');
  assert.strictEqual(env.provenance.source_url, `outcome://${outcome.outcomeId}`);

  // Tampering with the provenance hash fails validation
  const tamperedEnv = {
    ...env,
    provenance: {
      ...env.provenance,
      provenance_hash: 'forged-hash-1234567890abcdef',
    },
  };
  const guard = validateAgentProposal(tamperedEnv, 'feedback', evidenceSnapshot);
  assert.strictEqual(guard.allowed, false);
  assert.ok(guard.violations.some((v) => v.includes('FEEDBACK_PROVENANCE_FORGED')));
  console.log('  ✓ #24 PASSED: Evidence retains cryptographic outcome provenance envelope');
}

// #25: Deterministic feedback canonicalization
{
  const fbA = createEvidenceFeedback({
    outcome,
    snapshot: evidenceSnapshot,
    options: { feedbackId: 'fb-fixed-canonical-1', createdAt: '2026-09-27T18:00:00.000Z' },
  });
  const fbB = createEvidenceFeedback({
    outcome,
    snapshot: evidenceSnapshot,
    options: { feedbackId: 'fb-fixed-canonical-1', createdAt: '2026-09-27T18:00:00.000Z' },
  });

  const c14nA = canonicalizeFeedback(fbA);
  const c14nB = canonicalizeFeedback(fbB);
  assert.strictEqual(c14nA, c14nB);

  const hashA = crypto.createHash('sha256').update(c14nA).digest('hex');
  const hashB = crypto.createHash('sha256').update(c14nB).digest('hex');
  assert.strictEqual(hashA, hashB);
  console.log('  ✓ #25 PASSED: Deterministic feedback canonicalization verified');
}

// #26: Insertion-order invariance
{
  const derived = deriveFeedbackSignals(outcome);
  // Reverse the order
  const reversedObservations = [...derived.observations].reverse();
  const reversedSignals = [...derived.signals].reverse();

  const recordA = {
    feedbackId: 'fb-invariance-test',
    sourceOutcomeId: outcome.outcomeId,
    sourceExecutionId: outcome.executionId,
    candidateSnapshotId: evidenceSnapshot.id,
    evidenceReferences: [evidenceSnapshot.id, outcome.outcomeId],
    observations: derived.observations,
    derivedSignals: derived.signals,
    createdAt: '2026-09-27T18:00:00.000Z',
    created_by: 'evidence_feedback',
    immutable: true,
  };
  const recordB = {
    feedbackId: 'fb-invariance-test',
    sourceOutcomeId: outcome.outcomeId,
    sourceExecutionId: outcome.executionId,
    candidateSnapshotId: evidenceSnapshot.id,
    evidenceReferences: [outcome.outcomeId, evidenceSnapshot.id],
    observations: reversedObservations,
    derivedSignals: reversedSignals,
    createdAt: '2026-09-27T18:00:00.000Z',
    created_by: 'evidence_feedback',
    immutable: true,
  };

  assert.strictEqual(
    canonicalizeFeedback(recordA),
    canonicalizeFeedback(recordB),
    'Canonical representations must match despite scrambled insertion orders'
  );
  console.log('  ✓ #26 PASSED: Insertion-order invariance guaranteed by canonicalizer');
}

// #27: Historical immutability
{
  const fb = createEvidenceFeedback({ outcome, snapshot: evidenceSnapshot });
  assert.ok(Object.isFrozen(fb), 'Feedback record must be frozen');
  assert.ok(Object.isFrozen(fb.observations), 'Observations array must be frozen');
  assert.ok(Object.isFrozen(fb.derivedSignals), 'Signals array must be frozen');
  assert.ok(Object.isFrozen(fb.evidenceReferences), 'References array must be frozen');
  assert.strictEqual(fb.immutable, true);
  console.log('  ✓ #27 PASSED: Historical immutability enforced recursively via Object.freeze');
}

// #28: Feedback remains proposal/evidence only
{
  const fb = createEvidenceFeedback({ outcome, snapshot: evidenceSnapshot });
  const env = createFeedbackProposalEnvelope(fb, evidenceSnapshot);
  assert.strictEqual(env.authority.canExecute, false);
  assert.strictEqual(env.authority.canApprove, false);
  assert.strictEqual(env.authority.canMutateEvidence, false);
  assert.strictEqual(FEEDBACK_AGENT_CONTRACT.mutable_state_scope, 'none');
  assert.deepStrictEqual(FEEDBACK_AGENT_CONTRACT.external_actions, []);
  console.log('  ✓ #28 PASSED: Feedback remains proposal/evidence only (zero execution/approval authority)');
}

console.log('\n================================================================');
console.log('  ALL V5.0-ALPHA8 EVIDENCE FEEDBACK TESTS PASSED (28 / 28)      ');
console.log('  Controlled Feedback Boundary & Temporal Truth CERTIFIED       ');
console.log('================================================================\n');
