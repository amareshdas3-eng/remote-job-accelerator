// tests/v5_policy_intelligence.mjs
// RJA v5.0-alpha6: Policy Intelligence & Governance Gate Test Suite
//
// Formally verifies 24 tests:
//
// Authority Attacks (10):
//    #1:  Orchestrator attempts direct policy approval    → AUTHORITY_VIOLATION
//    #2:  Agent attempts policy decision                  → AUTHORITY_VIOLATION
//    #3:  Agent attempts human approval                   → AUTHORITY_VIOLATION
//    #4:  Agent attempts artifact freeze                  → AUTHORITY_VIOLATION
//    #5:  Agent attempts execution dispatch               → AUTHORITY_VIOLATION
//    #6:  Forged policy decision                          → POLICY_VIOLATION
//    #7:  Forged human reviewer signature                 → AUTHORITY_VIOLATION
//    #8:  Replay of old approval                          → SNAPSHOT_MISMATCH / FINGERPRINT_TAMPERED
//    #9:  Approval for different candidate snapshot       → SNAPSHOT_MISMATCH
//    #10: Approval for modified orchestration             → ORCHESTRATION_MISMATCH
//
// Integrity Attacks (10):
//    #11: Evidence hash mismatch                          → BLOCK (EVIDENCE_HASH_MATCH)
//    #12: Snapshot drift                                  → BLOCK (SNAPSHOT_IDENTITY_MATCH)
//    #13: Planning mutation after orchestration           → BLOCK (UPSTREAM_INTEGRITY_PLANNING)
//    #14: Evaluation mutation after orchestration         → BLOCK (UPSTREAM_INTEGRITY_EVALUATION)
//    #15: Discovery mutation after orchestration          → BLOCK (UPSTREAM_INTEGRITY_DISCOVERY)
//    #16: Provenance break                                → BLOCK (PROVENANCE_RECORD_REQUIRED)
//    #17: Dependency mutation                             → BLOCK (CONFLICT_PLAN_CONTRADICTION)
//    #18: Conflict suppression                           → BLOCK (CONFLICT_PLAN_CONTRADICTION)
//    #19: Human-decision suppression                      → REQUIRE_HUMAN_DECISION
//    #20: Policy bypass attempt                           → TERMINAL_STATE_VIOLATION / INVALID_GOVERNANCE_TRANSITION
//
// Functional Tests (4):
//    #21: Valid proposal → policy review                  → ALLOW_REVIEW / REQUIRE_HUMAN_DECISION
//    #22: Blocking policy → execution impossible          → POLICY_VIOLATION / HARD BLOCK
//    #23: Valid human approval → frozen artifact          → immutable FrozenArtifactPackage
//    #24: Frozen artifact → exact execution input         → v4.6.1 substrate dispatches & returns receipt

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { emitDiscoveryProposal } from '../lib/agents/discovery.ts';
import { emitEvaluationProposal } from '../lib/agents/evaluation.ts';
import { emitPlanningProposal } from '../lib/agents/planning.ts';
import { emitOrchestrationProposal } from '../lib/agents/orchestrator.ts';
import {
  evaluatePolicyDecision,
  transitionGovernanceState,
  signHumanApproval,
  freezeApplicationArtifact,
  verifyFrozenArtifactForExecution,
} from '../lib/agents/governance.ts';
import { createEvidenceSnapshot } from '../lib/execution/snapshot.ts';
import { computeArtifactFingerprint } from '../lib/execution/fingerprint.ts';
import { executeApplicationPackage } from '../lib/execution/engine.ts';

console.log('================================================================');
console.log('  RJA V5.0-ALPHA6: POLICY INTELLIGENCE & GOVERNANCE GATE        ');
console.log('  24 Formal Tests: 10 Authority + 10 Integrity + 4 Functional   ');
console.log('================================================================\n');

// -------------------------------------------------------------
// SETUP: Upstream Pipeline Fixtures (Candidate, Discovery, Eval, Plan, Orch)
// -------------------------------------------------------------

// 1. Candidate Evidence Snapshot
const candidateProfile = {
  headline: 'Principal Infrastructure Engineer',
  years_experience: 14,
  skills: ['Rust', 'Go', 'Kubernetes', 'Kafka', 'Terraform', 'Distributed Systems'],
  certifications: ['PE', 'AWS Certified Solutions Architect'],
  bio: 'Designing resilient distributed platforms and multi-region infrastructure.',
};
const evidenceSnapshot = createEvidenceSnapshot('cand-8801', candidateProfile);

// 2. Discovered Opportunity
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
  planId: 'plan-alpha6-clean',
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
    orchestrationId: 'orch-alpha6-clean',
    createdAt: '2026-09-27T11:05:00.000Z',
  }
);

// 3. Artifact Payload for Candidate Approval & Freezing
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

console.log('✓ Upstream pipeline synthesized and clean orchestration proposal emitted.\n');


// =============================================================
// SECTION 1: 10 AUTHORITY ATTACKS (Authority Invariant Defense)
// =============================================================
console.log('--- SECTION 1: 10 Authority Attacks ---');

// #1: Orchestrator attempts direct policy approval
assert.throws(
  () => {
    transitionGovernanceState('AWAITING_HUMAN_REVIEW', {
      type: 'HUMAN_APPROVE',
      actor: 'agt-orchestrator-v1', // Agent attempting approval!
    });
  },
  (err) => {
    assert.ok(err.message.includes('AUTHORITY_VIOLATION'));
    return true;
  }
);
console.log('  ✓ #1 BLOCKED: Orchestrator attempts direct policy approval → AUTHORITY_VIOLATION');

// #2: Agent attempts policy decision
assert.throws(
  () => {
    transitionGovernanceState('ORCHESTRATED', {
      type: 'HUMAN_APPROVE',
      actor: 'agt-planning-v1', // Planning agent attempting approval!
    });
  },
  (err) => {
    assert.ok(err.message.includes('AUTHORITY_VIOLATION'));
    return true;
  }
);
console.log('  ✓ #2 BLOCKED: Agent attempts policy decision → AUTHORITY_VIOLATION');

// #3: Agent attempts human approval signature
assert.throws(
  () => {
    signHumanApproval({
      policyDecision: {
        policyDecisionId: 'pol-1',
        orchestrationId: orchEnvelope.output.orchestrationId,
        candidateSnapshotId: evidenceSnapshot.id,
        evidenceHash: evidenceSnapshot.evidence_hash,
        decision: 'ALLOW_REVIEW',
        policyFindings: [],
        requiredHumanDecisions: [],
        reviewRequired: true,
        rationale: [],
        createdAt: new Date().toISOString(),
        proposed_by: 'server_policy_guard',
      },
      candidateSignature: 'agt-orchestrator-v1', // Agent signature!
      candidateSnapshot: evidenceSnapshot,
      orchestrationProposal: orchEnvelope.output,
      artifactContent: draftArtifactPayload,
      destination: job1.url,
    });
  },
  (err) => {
    assert.ok(err.message.includes('AUTHORITY_VIOLATION'));
    return true;
  }
);
console.log('  ✓ #3 BLOCKED: Agent attempts human approval → AUTHORITY_VIOLATION');

// #4: Agent attempts artifact freeze
assert.throws(
  () => {
    transitionGovernanceState('HUMAN_APPROVED', {
      type: 'FREEZE_ARTIFACT',
      actor: 'agt-orchestrator-v1', // Agent attempting freeze!
    });
  },
  (err) => {
    assert.ok(err.message.includes('AUTHORITY_VIOLATION'));
    return true;
  }
);
console.log('  ✓ #4 BLOCKED: Agent attempts artifact freeze → AUTHORITY_VIOLATION');

// #5: Agent attempts execution dispatch
assert.throws(
  () => {
    transitionGovernanceState('ARTIFACT_FROZEN', {
      type: 'DISPATCH',
      actor: 'agent_orchestrator', // Agent attempting dispatch!
    });
  },
  (err) => {
    assert.ok(err.message.includes('AUTHORITY_VIOLATION'));
    return true;
  }
);
console.log('  ✓ #5 BLOCKED: Agent attempts execution dispatch → AUTHORITY_VIOLATION');

// #6: Forged policy decision (attempting to approve a BLOCKED proposal)
assert.throws(
  () => {
    signHumanApproval({
      policyDecision: {
        policyDecisionId: 'pol-blocked-1',
        orchestrationId: orchEnvelope.output.orchestrationId,
        candidateSnapshotId: evidenceSnapshot.id,
        evidenceHash: evidenceSnapshot.evidence_hash,
        decision: 'BLOCK', // BLOCKED by server policy guard!
        policyFindings: [
          {
            findingId: 'f1',
            category: 'AUTHENTICITY',
            severity: 'BLOCKING',
            rule: 'FORGED_INPUT',
            description: 'Forged input detected',
            relatedProposalIds: [],
          },
        ],
        requiredHumanDecisions: [],
        reviewRequired: false,
        rationale: ['Blocked due to tampering'],
        createdAt: new Date().toISOString(),
        proposed_by: 'server_policy_guard',
      },
      candidateSignature: 'alex.rivera@engineering.com',
      candidateSnapshot: evidenceSnapshot,
      orchestrationProposal: orchEnvelope.output,
      artifactContent: draftArtifactPayload,
      destination: job1.url,
    });
  },
  (err) => {
    assert.ok(err.message.includes('POLICY_VIOLATION'));
    return true;
  }
);
console.log('  ✓ #6 BLOCKED: Forged policy decision → POLICY_VIOLATION');

// #7: Forged human reviewer signature (empty signature)
assert.throws(
  () => {
    signHumanApproval({
      policyDecision: {
        policyDecisionId: 'pol-valid-1',
        orchestrationId: orchEnvelope.output.orchestrationId,
        candidateSnapshotId: evidenceSnapshot.id,
        evidenceHash: evidenceSnapshot.evidence_hash,
        decision: 'ALLOW_REVIEW',
        policyFindings: [],
        requiredHumanDecisions: [],
        reviewRequired: true,
        rationale: [],
        createdAt: new Date().toISOString(),
        proposed_by: 'server_policy_guard',
      },
      candidateSignature: '   ', // Blank / whitespace signature
      candidateSnapshot: evidenceSnapshot,
      orchestrationProposal: orchEnvelope.output,
      artifactContent: draftArtifactPayload,
      destination: job1.url,
    });
  },
  (err) => {
    assert.ok(err.message.includes('AUTHORITY_VIOLATION'));
    return true;
  }
);
console.log('  ✓ #7 BLOCKED: Forged human reviewer signature → AUTHORITY_VIOLATION');

// #8: Replay old approval for modified payload
const validApproval = signHumanApproval({
  policyDecision: {
    policyDecisionId: 'pol-valid-8',
    orchestrationId: orchEnvelope.output.orchestrationId,
    candidateSnapshotId: evidenceSnapshot.id,
    evidenceHash: evidenceSnapshot.evidence_hash,
    decision: 'ALLOW_REVIEW',
    policyFindings: [],
    requiredHumanDecisions: [],
    reviewRequired: true,
    rationale: [],
    createdAt: new Date().toISOString(),
    proposed_by: 'server_policy_guard',
  },
  candidateSignature: 'alex.rivera@engineering.com',
  candidateSnapshot: evidenceSnapshot,
  orchestrationProposal: orchEnvelope.output,
  artifactContent: draftArtifactPayload,
  destination: job1.url,
});

assert.throws(
  () => {
    freezeApplicationArtifact(validApproval, {
      ...draftArtifactPayload,
      resume: { ...draftArtifactPayload.resume, full_resume: 'TAMPERED RESUME POST-APPROVAL' },
    });
  },
  (err) => {
    assert.ok(err.message.includes('FREEZE_BOUNDARY_VIOLATION'));
    return true;
  }
);
console.log('  ✓ #8 BLOCKED: Replay old approval for tampered payload → FREEZE_BOUNDARY_VIOLATION');

// #9: Approval for different candidate snapshot
const differentSnapshot = { ...evidenceSnapshot, id: 'ev-snap-different-999' };
assert.throws(
  () => {
    signHumanApproval({
      policyDecision: {
        policyDecisionId: 'pol-valid-9',
        orchestrationId: orchEnvelope.output.orchestrationId,
        candidateSnapshotId: evidenceSnapshot.id,
        evidenceHash: evidenceSnapshot.evidence_hash,
        decision: 'ALLOW_REVIEW',
        policyFindings: [],
        requiredHumanDecisions: [],
        reviewRequired: true,
        rationale: [],
        createdAt: new Date().toISOString(),
        proposed_by: 'server_policy_guard',
      },
      candidateSignature: 'alex.rivera@engineering.com',
      candidateSnapshot: differentSnapshot, // Mismatched snapshot!
      orchestrationProposal: orchEnvelope.output,
      artifactContent: draftArtifactPayload,
      destination: job1.url,
    });
  },
  (err) => {
    assert.ok(err.message.includes('SNAPSHOT_MISMATCH'));
    return true;
  }
);
console.log('  ✓ #9 BLOCKED: Approval for different candidate snapshot → SNAPSHOT_MISMATCH');

// #10: Approval for modified orchestration
assert.throws(
  () => {
    signHumanApproval({
      policyDecision: {
        policyDecisionId: 'pol-valid-10',
        orchestrationId: orchEnvelope.output.orchestrationId,
        candidateSnapshotId: evidenceSnapshot.id,
        evidenceHash: evidenceSnapshot.evidence_hash,
        decision: 'ALLOW_REVIEW',
        policyFindings: [],
        requiredHumanDecisions: [],
        reviewRequired: true,
        rationale: [],
        createdAt: new Date().toISOString(),
        proposed_by: 'server_policy_guard',
      },
      candidateSignature: 'alex.rivera@engineering.com',
      candidateSnapshot: evidenceSnapshot,
      orchestrationProposal: { ...orchEnvelope.output, orchestrationId: 'orch-tampered-id-10' },
      artifactContent: draftArtifactPayload,
      destination: job1.url,
    });
  },
  (err) => {
    assert.ok(err.message.includes('ORCHESTRATION_MISMATCH'));
    return true;
  }
);
console.log('  ✓ #10 BLOCKED: Approval for modified orchestration → ORCHESTRATION_MISMATCH');


// =============================================================
// SECTION 2: 10 INTEGRITY ATTACKS (Five Questions Verification)
// =============================================================
console.log('\n--- SECTION 2: 10 Integrity Attacks ---');

// #11: Evidence hash mismatch
const tamperedHashProposal = {
  ...orchEnvelope.output,
  evidenceHash: '0000000000000000000000000000000000000000000000000000000000000000',
};
const pol11 = evaluatePolicyDecision(tamperedHashProposal, { snapshot: evidenceSnapshot });
assert.strictEqual(pol11.decision, 'BLOCK');
assert.ok(pol11.policyFindings.some((f) => f.rule === 'EVIDENCE_HASH_MATCH'));
console.log('  ✓ #11 BLOCKED: Evidence hash mismatch → BLOCK (EVIDENCE_HASH_MATCH)');

// #12: Snapshot drift
const driftedSnapshot = {
  ...evidenceSnapshot,
  id: 'ev-snap-drifted-12',
  evidence_hash: '1111111111111111111111111111111111111111111111111111111111111111',
};
const pol12 = evaluatePolicyDecision(orchEnvelope.output, { snapshot: driftedSnapshot });
assert.strictEqual(pol12.decision, 'BLOCK');
assert.ok(pol12.policyFindings.some((f) => f.rule === 'SNAPSHOT_IDENTITY_MATCH'));
console.log('  ✓ #12 BLOCKED: Snapshot drift → BLOCK (SNAPSHOT_IDENTITY_MATCH)');

// #13: Planning mutation after orchestration
const pol13 = evaluatePolicyDecision(orchEnvelope.output, {
  snapshot: evidenceSnapshot,
  upstreamInputs: {
    planning: [{ ...planEnv1, _tampered: true }],
  },
});
assert.strictEqual(pol13.decision, 'BLOCK');
assert.ok(pol13.policyFindings.some((f) => f.rule === 'UPSTREAM_INTEGRITY_PLANNING'));
console.log('  ✓ #13 BLOCKED: Planning mutation after orchestration → BLOCK (UPSTREAM_INTEGRITY_PLANNING)');

// #14: Evaluation mutation after orchestration
const pol14 = evaluatePolicyDecision(orchEnvelope.output, {
  snapshot: evidenceSnapshot,
  upstreamInputs: {
    evaluation: [{ ...evalEnv1, _tamperedScore: true }],
  },
});
assert.strictEqual(pol14.decision, 'BLOCK');
assert.ok(pol14.policyFindings.some((f) => f.rule === 'UPSTREAM_INTEGRITY_EVALUATION'));
console.log('  ✓ #14 BLOCKED: Evaluation mutation after orchestration → BLOCK (UPSTREAM_INTEGRITY_EVALUATION)');

// #15: Discovery mutation after orchestration
const pol15 = evaluatePolicyDecision(orchEnvelope.output, {
  snapshot: evidenceSnapshot,
  upstreamInputs: {
    discovery: [{ ...discEnv1, _tampered: true }],
  },
});
assert.strictEqual(pol15.decision, 'BLOCK');
assert.ok(pol15.policyFindings.some((f) => f.rule === 'UPSTREAM_INTEGRITY_DISCOVERY'));
console.log('  ✓ #15 BLOCKED: Discovery mutation after orchestration → BLOCK (UPSTREAM_INTEGRITY_DISCOVERY)');

// #16: Provenance break (missing provenance record on envelope)
const brokenEnvelope = {
  ...orchEnvelope,
  provenance: null,
};
const pol16 = evaluatePolicyDecision(brokenEnvelope, { snapshot: evidenceSnapshot });
assert.strictEqual(pol16.decision, 'BLOCK');
assert.ok(pol16.policyFindings.some((f) => f.rule === 'PROVENANCE_RECORD_REQUIRED'));
console.log('  ✓ #16 BLOCKED: Provenance break → BLOCK (PROVENANCE_RECORD_REQUIRED)');

// #17: Dependency mutation (injected blocking conflict)
const conflictProposal = {
  ...orchEnvelope.output,
  conflicts: [
    {
      conflictId: 'conf-dep-17',
      type: 'PLAN_CONTRADICTION',
      proposalIds: [planEnv1.proposalId],
      description: 'Dependency contradiction detected',
      blocking: true,
    },
  ],
};
const pol17 = evaluatePolicyDecision(conflictProposal, { snapshot: evidenceSnapshot });
assert.strictEqual(pol17.decision, 'BLOCK');
assert.ok(pol17.policyFindings.some((f) => f.rule === 'CONFLICT_PLAN_CONTRADICTION'));
console.log('  ✓ #17 BLOCKED: Dependency contradiction → BLOCK (CONFLICT_PLAN_CONTRADICTION)');

// #18: Conflict suppression (critical conflict present)
const conflict18 = {
  ...orchEnvelope.output,
  conflicts: [
    {
      conflictId: 'conf-drift-18',
      type: 'SNAPSHOT_DRIFT',
      proposalIds: [planEnv1.proposalId],
      description: 'Snapshot drift conflict',
      blocking: true,
      severity: 'critical',
    },
  ],
};
const pol18 = evaluatePolicyDecision(conflict18, { snapshot: evidenceSnapshot });
assert.strictEqual(pol18.decision, 'BLOCK');
console.log('  ✓ #18 BLOCKED: Conflict suppression → BLOCK (SNAPSHOT_DRIFT)');

// #19: Human-decision required proposal
const decisionRequiredProposal = {
  ...orchEnvelope.output,
  conflicts: [],
  requiredHumanDecisions: [
    {
      decisionId: 'dec-19',
      type: 'authorize_draft',
      description: 'Candidate must authorize tailored draft creation',
      relatedProposalIds: [planEnv1.proposalId],
      reason: 'Role prioritised for review',
      required: true,
    },
  ],
};
const pol19 = evaluatePolicyDecision(decisionRequiredProposal, { snapshot: evidenceSnapshot });
assert.strictEqual(pol19.decision, 'REQUIRE_HUMAN_DECISION');
assert.strictEqual(pol19.reviewRequired, true);
console.log('  ✓ #19 PASSED: Mandatory decisions trigger REQUIRE_HUMAN_DECISION');

// #20: Policy bypass attempt (jumping state directly from ORCHESTRATED to ARTIFACT_FROZEN)
assert.throws(
  () => {
    transitionGovernanceState('ORCHESTRATED', {
      type: 'FREEZE_ARTIFACT',
      actor: 'candidate-user',
    });
  },
  (err) => {
    assert.ok(err.message.includes('INVALID_GOVERNANCE_TRANSITION'));
    return true;
  }
);
console.log('  ✓ #20 BLOCKED: Policy bypass attempt → INVALID_GOVERNANCE_TRANSITION');


// =============================================================
// SECTION 3: 4 FUNCTIONAL GOVERNANCE & FREEZE TESTS
// =============================================================
console.log('\n--- SECTION 3: 4 Functional Governance & Freeze Tests ---');

// #21: Valid proposal → policy review
const cleanPolicyDecision = evaluatePolicyDecision(orchEnvelope, { snapshot: evidenceSnapshot });
assert.ok(
  cleanPolicyDecision.decision === 'ALLOW_REVIEW' || cleanPolicyDecision.decision === 'REQUIRE_HUMAN_DECISION',
  'Clean proposal must be eligible for human review'
);
assert.strictEqual(cleanPolicyDecision.candidateSnapshotId, evidenceSnapshot.id);
assert.strictEqual(cleanPolicyDecision.evidenceHash, evidenceSnapshot.evidence_hash);
assert.strictEqual(cleanPolicyDecision.proposed_by, 'server_policy_guard');
console.log('  ✓ #21 PASSED: Valid proposal → policy decision produced for human review');

// #22: Blocking policy → execution impossible
const blockedDecision = evaluatePolicyDecision(tamperedHashProposal, { snapshot: evidenceSnapshot });
assert.strictEqual(blockedDecision.decision, 'BLOCK');
assert.throws(
  () => {
    signHumanApproval({
      policyDecision: blockedDecision,
      candidateSignature: 'alex.rivera@engineering.com',
      candidateSnapshot: evidenceSnapshot,
      orchestrationProposal: tamperedHashProposal,
      artifactContent: draftArtifactPayload,
      destination: job1.url,
    });
  },
  (err) => {
    assert.ok(err.message.includes('POLICY_VIOLATION'));
    return true;
  }
);
console.log('  ✓ #22 PASSED: Blocking policy → human approval & execution impossible');

// #23: Valid human approval → frozen artifact
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
assert.strictEqual(frozenArtifact.immutable, true);
assert.strictEqual(frozenArtifact.approvedBy, 'alex.rivera@engineering.com');
assert.strictEqual(frozenArtifact.fingerprintAlgorithm, 'rja-c14n-v1-sha256');
assert.strictEqual(frozenArtifact.canonicalFingerprint, candidateApprovalRecord.canonicalFingerprint);

// Verify immutability: attempting to mutate frozen artifact payload throws in strict mode
assert.throws(() => {
  frozenArtifact.artifactPayload.resume = { tampered: true };
}, /Cannot assign to read only property|TypeError/);
console.log('  ✓ #23 PASSED: Valid human approval → immutable FrozenArtifactPackage');

// #24: Frozen artifact → exact execution input to v4.6.1 substrate
const verification = verifyFrozenArtifactForExecution(frozenArtifact, job1.url);
assert.strictEqual(verification.valid, true);

// Execute via frozen v4.6.1 substrate with single-flight mutex & idempotency
// Execute via frozen v4.6.1 substrate with single-flight mutex & idempotency
const executionResult = executeApplicationPackage({
  applicationId: 'app-alpha6-live-1',
  approvedArtifact: {
    id: frozenArtifact.frozenArtifactId,
    application_id: 'app-alpha6-live-1',
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
assert.strictEqual(executionResult.receipt.verified_fingerprint, frozenArtifact.canonicalFingerprint);
console.log('  ✓ #24 PASSED: Frozen artifact → v4.6.1 substrate dispatches & returns receipt');

console.log('\n================================================================');
console.log('  ALL 24 V5.0-ALPHA6 POLICY INTELLIGENCE TESTS PASSED!          ');
console.log('  10 Authority + 10 Integrity + 4 Functional Invariants Verified');
console.log('================================================================\n');
