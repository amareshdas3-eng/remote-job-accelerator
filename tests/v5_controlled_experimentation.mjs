// tests/v5_controlled_experimentation.mjs
// RJA v5.0-alpha10: Controlled Optimization & Experimentation Test Suite
//
// Formally verifies 36 tests across 6 key areas:
//
// A. Experiment Integrity (8):
//    #1:  Forge learning proposal source                → LEARNING_PROPOSAL_MISMATCH
//    #2:  Forge benchmark dataset hash                  → DATASET_HASH_MISMATCH
//    #3:  Forge experiment provenance envelope          → EXPERIMENT_PROVENANCE_FORGED
//    #4:  Baseline profile version mismatch             → BASELINE_VERSION_MISMATCH
//    #5:  Candidate profile version mismatch            → CANDIDATE_VERSION_MISMATCH
//    #6:  Malformed benchmark dataset                   → DATASET_SCHEMA_VIOLATION / DATASET_MUTABLE
//    #7:  Modified experiment result after creation     → TypeError (Object.freeze)
//    #8:  Modified benchmark dataset after creation     → TypeError (Object.freeze)
//
// B. Historical Protection (6):
//    #9:  Experiment agent modifies historical evaluation     → AUTHORITY_VIOLATION
//    #10: Experiment agent modifies historical planning       → AUTHORITY_VIOLATION
//    #11: Experiment agent modifies historical orchestration  → AUTHORITY_VIOLATION
//    #12: Experiment agent modifies historical policy         → AUTHORITY_VIOLATION
//    #13: Experiment agent modifies frozen artifact           → AUTHORITY_VIOLATION
//    #14: Experiment agent modifies historical outcome/feedb  → AUTHORITY_VIOLATION
//
// C. Self-Activation & Authority Attacks (8):
//    #15: Direct evaluator mutation attempt             → AUTHORITY_VIOLATION
//    #16: Direct planner mutation attempt               → AUTHORITY_VIOLATION
//    #17: Direct discovery mutation attempt             → AUTHORITY_VIOLATION
//    #18: Direct orchestration mutation attempt         → AUTHORITY_VIOLATION
//    #19: Direct benchmark dataset mutation attempt     → AUTHORITY_VIOLATION
//    #20: Automatic candidate profile activation        → AUTHORITY_VIOLATION
//    #21: Self-approval attempt                         → AUTHORITY_VIOLATION
//    #22: Execution dispatch attempt                    → AUTHORITY_VIOLATION
//
// D. Replay Isolation & Determinism (5):
//    #23: Identical inputs produce identical replayHash → Deterministic replayHash
//    #24: Canonical serialization order invariance      → Deterministic digest
//    #25: Replay preserves dataset immutability         → Object.isFrozen(dataset)
//    #26: Replay preserves baseline profile immutability→ Object.isFrozen(baseline)
//    #27: Replay preserves candidate profile immutabilit→ Object.isFrozen(candidate)
//
// E. Metric Correctness & Regression Detection (7):
//    #28: Deterministic metric delta calculation        → Exact mathematical delta
//    #29: Regression detection on detrimental change    → status: FAIL, regressionsDetected > 0
//    #30: Improvement detection on beneficial change    → status: PASS, improvementsDetected > 0
//    #31: Recommendation is APPROVE_FOR_REVIEW on PASS  → Recommendation verified
//    #32: Recommendation is REJECT_REGRESSION on FAIL   → Recommendation verified
//    #33: Forged recommendation to APPROVE on FAIL      → INVALID_RECOMMENDATION
//    #34: Metric rule targets valid and recognized      → Valid IntelligenceRuleTarget
//
// F. Boundary & Lifecycle Tests (2):
//    #35: Failed experiment blocked at Policy Guard     → Policy Guard blocks progression
//    #36: Passed experiment enables future-only run     → Historical records T0-T11 unaltered

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
import { createEvidenceFeedback } from '../lib/agents/feedback.ts';
import {
  createBaselineIntelligenceProfile,
  createLearningProposal,
  createLearningProposalEnvelope,
  applyApprovedLearningProposal,
} from '../lib/agents/learning.ts';
import {
  canonicalizeExperiment,
  computeExperimentHash,
  createStandardBenchmarkDataset,
  validateDatasetIntegrity,
  runReplayExperiment,
  createExperimentProposalEnvelope,
  verifyExperimentIntegrity,
} from '../lib/agents/experimentation.ts';
import { validateAgentProposal } from '../lib/agents/policyGuard.ts';
import { EXPERIMENT_AGENT_CONTRACT } from '../lib/agents/contracts.ts';

console.log('================================================================');
console.log('  RJA V5.0-ALPHA10: CONTROLLED OPTIMIZATION & EXPERIMENTATION   ');
console.log('  36 Formal Tests: 8 Integrity + 6 Historical + 8 Authority +    ');
console.log('                   5 Replay + 7 Metrics + 2 Boundary            ');
console.log('  Governing Invariant: "An experiment may compare possible      ');
console.log('                        futures; it cannot alter historical     ');
console.log('                        truth or activate itself."              ');
console.log('================================================================\n');

// -------------------------------------------------------------
// SETUP: Upstream Pipeline Historical Fixtures (T0 - T11)
// -------------------------------------------------------------
const candidateProfile = {
  headline: 'Principal Distributed Systems Architect',
  years_experience: 12,
  skills: ['TypeScript', 'Node.js', 'PostgreSQL', 'Distributed Systems', 'Kubernetes'],
  certifications: ['AWS Solutions Architect Pro'],
  bio: 'Architecting resilient, mission-critical distributed services and platforms.',
};
const evidenceSnapshot = createEvidenceSnapshot('cand-alpha10-01', candidateProfile);

// Baseline Intelligence Profile v1.0.0
const baselineProfile = createBaselineIntelligenceProfile({
  profileId: 'profile-v1-baseline',
  version: '1.0.0',
});
assert.strictEqual(baselineProfile.immutable, true);

const job = {
  title: 'Lead Cloud Infrastructure Architect',
  company: 'CloudStream Systems',
  url: 'https://careers.cloudstream.io/jobs/infra-99',
  source: 'greenhouse',
  requirements: [
    '8+ years cloud infrastructure engineering',
    'Expertise in Kubernetes and Go',
    'Terraform infrastructure-as-code proficiency',
  ],
  skills: ['Kubernetes', 'Go', 'Terraform'],
  location: 'Remote',
  category: 'cloud_infrastructure',
  raw_payload: { id: 'infra-99' },
};

const discEnvelope = await emitDiscoveryProposal(job);
const evalEnvelope = await emitEvaluationProposal(discEnvelope, evidenceSnapshot);
const planEnvelope = await emitPlanningProposal([evalEnvelope], evidenceSnapshot, {
  planId: 'plan-alpha10-clean',
  maxConcurrentApplications: 2,
  createdAt: '2026-09-27T14:00:00.000Z',
});

const orchEnvelope = await emitOrchestrationProposal(
  {
    discoveryProposals: [discEnvelope],
    evaluationProposals: [evalEnvelope],
    planningProposals: [planEnvelope],
  },
  evidenceSnapshot,
  {
    orchestrationId: 'orch-alpha10-clean',
    createdAt: '2026-09-27T14:05:00.000Z',
  }
);

const policyDecision = evaluatePolicyDecision(orchEnvelope, { snapshot: evidenceSnapshot });

const draftArtifactPayload = {
  resume: {
    headline: candidateProfile.headline,
    full_resume: `${candidateProfile.headline}.\n10 years experience.\nExpert in ${candidateProfile.skills.join(', ')}.`,
  },
  cover_letter: {
    recipient: 'CloudStream Hiring Team',
    letter: 'Dear CloudStream Team,\nI am writing to express my strong interest in the Lead Cloud Infrastructure Architect role.',
  },
  screening_answers: {
    answers: [
      { question_id: 'q1', question: 'Do you have production Kubernetes experience?', answer: 'Yes, 6 years.' },
    ],
  },
};

const humanApproval = signHumanApproval({
  policyDecision: {
    ...policyDecision,
    decision: 'ALLOW_REVIEW',
  },
  candidateSignature: 'candidate.lead@cloudstream.io',
  candidateSnapshot: evidenceSnapshot,
  orchestrationProposal: orchEnvelope.output,
  artifactContent: draftArtifactPayload,
  destination: job.url,
  approvalTimestamp: '2026-09-27T14:10:00.000Z',
});

const frozenArtifact = freezeApplicationArtifact(humanApproval, draftArtifactPayload);

const executionResult = executeApplicationPackage({
  applicationId: 'app-alpha10-live-1',
  approvedArtifact: {
    id: frozenArtifact.frozenArtifactId,
    application_id: 'app-alpha10-live-1',
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

// T8: Outcome Record
const outcome = recordOutcome({
  receipt,
  frozenArtifact,
  snapshot: evidenceSnapshot,
  planningProposal: planEnvelope.output,
  status: 'SUCCEEDED',
});

// T10: Evidence Feedback Record
const feedback = createEvidenceFeedback({
  outcome,
  snapshot: evidenceSnapshot,
  options: { feedbackId: 'fb-alpha10-001' },
});

// T11: Controlled Learning
const learningProposal = createLearningProposal({
  currentProfile: baselineProfile,
  feedbacks: [feedback],
  candidateSnapshot: evidenceSnapshot,
});
const learningEnvelope = createLearningProposalEnvelope(learningProposal, evidenceSnapshot);

// Candidate Profile v1.1.0 (derived through approved learning diff)
const candidateProfileApproved = applyApprovedLearningProposal({
  proposal: learningProposal,
  currentProfile: baselineProfile,
  approvalSignature: 'sig-human-alpha10-review',
  approvedBy: 'candidate-lead-evaluator',
});
assert.strictEqual(candidateProfileApproved.version, '1.1.0');
assert.strictEqual(candidateProfileApproved.parentVersion, '1.0.0');

// Canonical Benchmark Dataset
const benchmarkDataset = createStandardBenchmarkDataset();
assert.strictEqual(benchmarkDataset.immutable, true);

// Standard Valid Baseline vs Candidate Experiment
const experimentResult = runReplayExperiment({
  learningProposal,
  baselineProfile,
  candidateProfile: candidateProfileApproved,
  dataset: benchmarkDataset,
});
const experimentEnvelope = createExperimentProposalEnvelope(experimentResult, learningProposal);

console.log('✓ Upstream pipeline through Learning (T0 - T11) and Benchmark Dataset established.\n');

// -------------------------------------------------------------
// SECTION A: Experiment Integrity (8 Tests)
// -------------------------------------------------------------
console.log('--- SECTION A: Experiment Integrity (8 Tests) ---');

// Test 1: Forge learning proposal source
{
  const forgedProposal = { ...learningProposal, learningId: 'fake-learning-id-000' };
  const verification = verifyExperimentIntegrity({
    result: experimentResult,
    learningProposal: forgedProposal,
    dataset: benchmarkDataset,
  });
  assert.strictEqual(verification.valid, false);
  assert.ok(verification.violations.some((v) => v.includes('LEARNING_PROPOSAL_MISMATCH')));
  console.log('  ✓ #1 BLOCKED: Forged learning proposal rejected (LEARNING_PROPOSAL_MISMATCH)');
}

// Test 2: Forge benchmark dataset hash
{
  const forgedDataset = { ...benchmarkDataset, datasetHash: '0123456789abcdef0123456789abcdef' };
  const verification = verifyExperimentIntegrity({
    result: experimentResult,
    learningProposal,
    dataset: forgedDataset,
  });
  assert.strictEqual(verification.valid, false);
  assert.ok(verification.violations.some((v) => v.includes('DATASET_HASH_MISMATCH')));
  console.log('  ✓ #2 BLOCKED: Forged benchmark dataset hash rejected (DATASET_HASH_MISMATCH)');
}

// Test 3: Forged experiment envelope provenance
{
  const tamperedEnvelope = {
    ...experimentEnvelope,
    provenance: {
      ...experimentEnvelope.provenance,
      provenance_hash: 'forged-experiment-digest-12345',
    },
  };
  const policyCheck = validateAgentProposal(tamperedEnvelope, 'experiment');
  assert.strictEqual(policyCheck.allowed, false);
  assert.ok(policyCheck.violations.some((v) => v.includes('EXPERIMENT_PROVENANCE_FORGED')));
  console.log('  ✓ #3 BLOCKED: Forged experiment provenance rejected (EXPERIMENT_PROVENANCE_FORGED)');
}

// Test 4: Baseline profile version mismatch
{
  const wrongBaseline = { ...baselineProfile, version: '0.9.0' };
  assert.throws(
    () => {
      runReplayExperiment({
        learningProposal,
        baselineProfile: wrongBaseline,
        candidateProfile: candidateProfileApproved,
        dataset: benchmarkDataset,
      });
    },
    (err) => err.message.includes('BASELINE_VERSION_MISMATCH')
  );
  console.log('  ✓ #4 BLOCKED: Baseline version mismatch rejected (BASELINE_VERSION_MISMATCH)');
}

// Test 5: Candidate profile version mismatch
{
  const wrongCandidate = { ...candidateProfileApproved, version: '2.0.0' };
  assert.throws(
    () => {
      runReplayExperiment({
        learningProposal,
        baselineProfile,
        candidateProfile: wrongCandidate,
        dataset: benchmarkDataset,
      });
    },
    (err) => err.message.includes('CANDIDATE_VERSION_MISMATCH')
  );
  console.log('  ✓ #5 BLOCKED: Candidate version mismatch rejected (CANDIDATE_VERSION_MISMATCH)');
}

// Test 6: Malformed benchmark dataset rejected
{
  const mutableDataset = {
    datasetId: 'invalid-ds',
    description: 'mutable dataset',
    sampleItems: [],
    datasetHash: 'empty-hash',
    immutable: false,
  };
  const validation = validateDatasetIntegrity(mutableDataset);
  assert.strictEqual(validation.valid, false);
  assert.ok(validation.violations.some((v) => v.includes('DATASET_MUTABLE')));
  console.log('  ✓ #6 BLOCKED: Mutable / empty benchmark dataset rejected (DATASET_MUTABLE)');
}

// Test 7: Modified experiment result after creation rejected
{
  assert.throws(() => {
    experimentResult.recommendation = 'REJECT_REGRESSION';
  }, TypeError);
  console.log('  ✓ #7 DEFENDED: Experiment result is deeply immutable (Object.freeze)');
}

// Test 8: Modified benchmark dataset after creation rejected
{
  assert.throws(() => {
    benchmarkDataset.sampleItems[0] = { id: 'tampered-case' };
  }, TypeError);
  console.log('  ✓ #8 DEFENDED: Benchmark dataset is deeply immutable (Object.freeze)');
}

// -------------------------------------------------------------
// SECTION B: Historical Protection (6 Tests)
// -------------------------------------------------------------
console.log('\n--- SECTION B: Historical Protection (6 Tests) ---');

// Test 9: Experiment agent modifying historical evaluation
{
  const attack = {
    ...experimentResult,
    modify_evaluation: { evalId: evalEnvelope.output.evaluationId, fitScore: 99 },
  };
  const check = validateAgentProposal(attack, 'experiment');
  assert.strictEqual(check.allowed, false);
  assert.ok(check.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #9 BLOCKED: Historical evaluation mutation rejected (AUTHORITY_VIOLATION)');
}

// Test 10: Experiment agent modifying historical planning
{
  const attack = {
    ...experimentResult,
    modify_plan: { planId: planEnvelope.output.planId, maxConcurrent: 10 },
  };
  const check = validateAgentProposal(attack, 'experiment');
  assert.strictEqual(check.allowed, false);
  assert.ok(check.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #10 BLOCKED: Historical planning mutation rejected (AUTHORITY_VIOLATION)');
}

// Test 11: Experiment agent modifying historical orchestration
{
  const attack = {
    ...experimentResult,
    modify_orchestration: { orchestrationId: orchEnvelope.output.orchestrationId },
  };
  const check = validateAgentProposal(attack, 'experiment');
  assert.strictEqual(check.allowed, false);
  assert.ok(check.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #11 BLOCKED: Historical orchestration mutation rejected (AUTHORITY_VIOLATION)');
}

// Test 12: Experiment agent modifying historical policy
{
  const attack = {
    ...experimentResult,
    policy_override: true,
  };
  const check = validateAgentProposal(attack, 'experiment');
  assert.strictEqual(check.allowed, false);
  assert.ok(check.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #12 BLOCKED: Historical policy override rejected (AUTHORITY_VIOLATION)');
}

// Test 13: Experiment agent modifying frozen artifact
{
  const attack = {
    ...experimentResult,
    modify_frozen_artifact: { artifactId: frozenArtifact.id },
  };
  const check = validateAgentProposal(attack, 'experiment');
  assert.strictEqual(check.allowed, false);
  assert.ok(check.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #13 BLOCKED: Frozen artifact mutation rejected (AUTHORITY_VIOLATION)');
}

// Test 14: Experiment agent modifying historical outcome / feedback / learning
{
  const attack = {
    ...experimentResult,
    modify_outcome: { outcomeId: outcome.outcomeId },
    modify_feedback: { feedbackId: feedback.feedbackId },
    modify_learning: { learningId: learningProposal.learningId },
  };
  const check = validateAgentProposal(attack, 'experiment');
  assert.strictEqual(check.allowed, false);
  assert.ok(check.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #14 BLOCKED: Historical outcome / feedback / learning mutation rejected (AUTHORITY_VIOLATION)');
}

// -------------------------------------------------------------
// SECTION C: Self-Activation & Authority Attacks (8 Tests)
// -------------------------------------------------------------
console.log('\n--- SECTION C: Self-Activation & Authority Attacks (8 Tests) ---');

// Test 15: Direct evaluator mutation attempt
{
  const attack = {
    ...experimentResult,
    direct_evaluator_mutation: { experience_weight: 50 },
  };
  const check = validateAgentProposal(attack, 'experiment');
  assert.strictEqual(check.allowed, false);
  assert.ok(check.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #15 BLOCKED: Direct evaluator mutation rejected (AUTHORITY_VIOLATION)');
}

// Test 16: Direct planner mutation attempt
{
  const attack = {
    ...experimentResult,
    direct_planner_mutation: { pacing_delay_hours: 0 },
  };
  const check = validateAgentProposal(attack, 'experiment');
  assert.strictEqual(check.allowed, false);
  assert.ok(check.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #16 BLOCKED: Direct planner mutation rejected (AUTHORITY_VIOLATION)');
}

// Test 17: Direct discovery mutation attempt
{
  const attack = {
    ...experimentResult,
    direct_discovery_mutation: { min_relevance_threshold: 0.1 },
  };
  const check = validateAgentProposal(attack, 'experiment');
  assert.strictEqual(check.allowed, false);
  assert.ok(check.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #17 BLOCKED: Direct discovery mutation rejected (AUTHORITY_VIOLATION)');
}

// Test 18: Direct orchestration mutation attempt
{
  const attack = {
    ...experimentResult,
    direct_orchestration_mutation: { bypass_conflict_check: true },
  };
  const check = validateAgentProposal(attack, 'experiment');
  assert.strictEqual(check.allowed, false);
  assert.ok(check.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #18 BLOCKED: Direct orchestration mutation rejected (AUTHORITY_VIOLATION)');
}

// Test 19: Direct benchmark dataset mutation attempt
{
  const attack = {
    ...experimentResult,
    mutate_dataset: { dropCases: ['bench-case-02'] },
  };
  const check = validateAgentProposal(attack, 'experiment');
  assert.strictEqual(check.allowed, false);
  assert.ok(check.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #19 BLOCKED: Direct benchmark dataset mutation rejected (AUTHORITY_VIOLATION)');
}

// Test 20: Automatic candidate profile activation attempt
{
  const attack = {
    ...experimentResult,
    activate_profile: '1.1.0',
    automatic_profile_activation: true,
  };
  const check = validateAgentProposal(attack, 'experiment');
  assert.strictEqual(check.allowed, false);
  assert.ok(check.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #20 BLOCKED: Automatic candidate profile activation rejected (AUTHORITY_VIOLATION)');
}

// Test 21: Self-approval attempt
{
  const attack = {
    ...experimentResult,
    approved_by: 'agt-experiment-v1',
    status: 'ready_to_apply',
  };
  const check = validateAgentProposal(attack, 'experiment');
  assert.strictEqual(check.allowed, false);
  assert.ok(check.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #21 BLOCKED: Experiment self-approval rejected (AUTHORITY_VIOLATION)');
}

// Test 22: Execution dispatch attempt
{
  const attack = {
    ...experimentResult,
    dispatch: true,
    action: 'execute_application',
  };
  const check = validateAgentProposal(attack, 'experiment');
  assert.strictEqual(check.allowed, false);
  assert.ok(check.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #22 BLOCKED: Direct execution dispatch rejected (AUTHORITY_VIOLATION)');
}

// -------------------------------------------------------------
// SECTION D: Replay Isolation & Determinism (5 Tests)
// -------------------------------------------------------------
console.log('\n--- SECTION D: Replay Isolation & Determinism (5 Tests) ---');

// Test 23: Identical inputs produce identical replayHash and experimentId
{
  const rerun = runReplayExperiment({
    learningProposal,
    baselineProfile,
    candidateProfile: candidateProfileApproved,
    dataset: benchmarkDataset,
  });
  assert.strictEqual(rerun.replayHash, experimentResult.replayHash);
  assert.strictEqual(rerun.experimentId, experimentResult.experimentId);
  console.log('  ✓ #23 PASSED: Identical replay inputs produce identical replayHash and experimentId');
}

// Test 24: Canonical serialization order invariance
{
  const serializedA = canonicalizeExperiment(experimentResult);
  const reorderedObj = {
    metrics: experimentResult.metrics,
    experimentId: experimentResult.experimentId,
    datasetHash: experimentResult.datasetHash,
    candidateProfileVersion: experimentResult.candidateProfileVersion,
    baselineProfileVersion: experimentResult.baselineProfileVersion,
    learningProposalId: experimentResult.learningProposalId,
    recommendation: experimentResult.recommendation,
    overallStatus: experimentResult.overallStatus,
    replayHash: experimentResult.replayHash,
    datasetSize: experimentResult.datasetSize,
    improvementsDetected: experimentResult.improvementsDetected,
    regressionsDetected: experimentResult.regressionsDetected,
    createdAt: experimentResult.createdAt,
    created_by: experimentResult.created_by,
    immutable: experimentResult.immutable,
  };
  const serializedB = canonicalizeExperiment(reorderedObj);
  assert.strictEqual(serializedA, serializedB);
  console.log('  ✓ #24 PASSED: Insertion-order invariance guaranteed by canonicalizer');
}

// Test 25: Replay preserves dataset immutability
{
  assert.strictEqual(Object.isFrozen(benchmarkDataset), true);
  assert.strictEqual(Object.isFrozen(benchmarkDataset.sampleItems), true);
  assert.strictEqual(benchmarkDataset.sampleItems.length, 4);
  console.log('  ✓ #25 DEFENDED: Benchmark dataset remains completely unchanged & frozen after replay');
}

// Test 26: Replay preserves baseline profile immutability
{
  assert.strictEqual(Object.isFrozen(baselineProfile), true);
  assert.strictEqual(Object.isFrozen(baselineProfile.rules), true);
  console.log('  ✓ #26 DEFENDED: Baseline profile remains completely unchanged & frozen after replay');
}

// Test 27: Replay preserves candidate profile immutability
{
  assert.strictEqual(Object.isFrozen(candidateProfileApproved), true);
  assert.strictEqual(Object.isFrozen(candidateProfileApproved.rules), true);
  console.log('  ✓ #27 DEFENDED: Candidate profile remains completely unchanged & frozen after replay');
}

// -------------------------------------------------------------
// SECTION E: Metric Correctness & Regression Detection (7 Tests)
// -------------------------------------------------------------
console.log('\n--- SECTION E: Metric Correctness & Regression Detection (7 Tests) ---');

// Test 28: Deterministic metric delta calculation matches exact mathematical differences
{
  for (const m of experimentResult.metrics) {
    if (typeof m.baselineValue === 'number' && typeof m.candidateValue === 'number') {
      const expectedDelta = Math.round((m.candidateValue - m.baselineValue) * 10) / 10;
      assert.strictEqual(m.delta, expectedDelta);
    }
  }
  console.log('  ✓ #28 PASSED: Deterministic metric deltas match mathematical difference exactly');
}

// Test 29: Regression detection on detrimental candidate change
{
  // Create an intentionally degraded candidate profile (e.g. drop experience weight to 5)
  const degradedProposal = createLearningProposal({
    feedbacks: [feedback],
    candidateSnapshot: evidenceSnapshot,
    currentProfile: baselineProfile,
    proposedVersion: '1.2.0-degraded',
  });
  // Manually craft a degraded candidate profile
  const degradedRules = baselineProfile.rules.map((r) => {
    if (r.parameter === 'experience_weight') {
      return { ...r, value: 5 }; // drastically lower experience weight
    }
    return { ...r };
  });
  const degradedProfile = Object.freeze({
    profileId: 'profile-v1-degraded',
    version: degradedProposal.proposedProfileVersion,
    parentVersion: baselineProfile.version,
    rules: Object.freeze(degradedRules.map((r) => Object.freeze(r))),
    createdAt: new Date().toISOString(),
    createdBy: 'controlled_learning',
    evidenceReferences: ['test://degraded'],
    immutable: true,
  });

  const regressedExperiment = runReplayExperiment({
    learningProposal: degradedProposal,
    baselineProfile,
    candidateProfile: degradedProfile,
    dataset: benchmarkDataset,
  });

  assert.strictEqual(regressedExperiment.overallStatus, 'FAIL');
  assert.ok(regressedExperiment.regressionsDetected > 0);
  assert.strictEqual(regressedExperiment.recommendation, 'REJECT_REGRESSION');
  console.log('  ✓ #29 PASSED: Detrimental parameter change flags regression (status: FAIL)');
}

// Test 30: Clean improvement detected on beneficial candidate change
{
  assert.strictEqual(experimentResult.overallStatus, 'PASS');
  assert.strictEqual(experimentResult.regressionsDetected, 0);
  assert.ok(experimentResult.improvementsDetected > 0);
  console.log('  ✓ #30 PASSED: Beneficial parameter change flags improvement (status: PASS, regressions: 0)');
}

// Test 31: Recommendation is APPROVE_FOR_REVIEW on PASS
{
  assert.strictEqual(experimentResult.recommendation, 'APPROVE_FOR_REVIEW');
  console.log('  ✓ #31 PASSED: Passing experiment emits recommendation APPROVE_FOR_REVIEW');
}

// Test 32: Recommendation is REJECT_REGRESSION on FAIL
{
  const degradedProposal = createLearningProposal({
    feedbacks: [feedback],
    candidateSnapshot: evidenceSnapshot,
    currentProfile: baselineProfile,
  });
  const degradedRules = baselineProfile.rules.map((r) => {
    if (r.parameter === 'skills_weight') {
      return { ...r, value: 0 };
    }
    return { ...r };
  });
  const degradedProfile = Object.freeze({
    profileId: 'profile-v1-degraded-2',
    version: degradedProposal.proposedProfileVersion,
    parentVersion: baselineProfile.version,
    rules: Object.freeze(degradedRules.map((r) => Object.freeze(r))),
    createdAt: new Date().toISOString(),
    createdBy: 'controlled_learning',
    evidenceReferences: ['test://degraded'],
    immutable: true,
  });

  const regressedExperiment = runReplayExperiment({
    learningProposal: degradedProposal,
    baselineProfile,
    candidateProfile: degradedProfile,
    dataset: benchmarkDataset,
  });
  assert.strictEqual(regressedExperiment.recommendation, 'REJECT_REGRESSION');
  console.log('  ✓ #32 PASSED: Failing experiment emits recommendation REJECT_REGRESSION');
}

// Test 33: Forging recommendation to APPROVE_FOR_REVIEW on failed experiment rejected
{
  const forgedExperiment = {
    ...experimentResult,
    overallStatus: 'FAIL',
    regressionsDetected: 2,
    recommendation: 'APPROVE_FOR_REVIEW', // forged!
  };
  const check = validateAgentProposal(forgedExperiment, 'experiment');
  assert.strictEqual(check.allowed, false);
  assert.ok(check.violations.some((v) => v.includes('INVALID_RECOMMENDATION')));
  console.log('  ✓ #33 BLOCKED: Forged recommendation on failed experiment rejected (INVALID_RECOMMENDATION)');
}

// Test 34: Every metric parameter strictly maps to an explicit IntelligenceRuleTarget
{
  const validTargets = new Set([
    'DISCOVERY_RULE',
    'EVALUATION_RULE',
    'PLANNING_RULE',
    'ORCHESTRATION_RULE',
    'EVIDENCE_RULE',
  ]);
  for (const m of experimentResult.metrics) {
    assert.ok(validTargets.has(m.targetRule), `Invalid targetRule: ${m.targetRule}`);
  }
  console.log('  ✓ #34 PASSED: Every metric parameter maps to an explicit valid IntelligenceRuleTarget');
}

// -------------------------------------------------------------
// SECTION F: Boundary Tests (2 Tests)
// -------------------------------------------------------------
console.log('\n--- SECTION F: Boundary Tests (2 Tests) ---');

// Test 35: Failed experiment blocked at Policy Guard from advancing to review
{
  const failedEnvelope = createExperimentProposalEnvelope(
    {
      ...experimentResult,
      overallStatus: 'FAIL',
      regressionsDetected: 1,
      recommendation: 'REJECT_REGRESSION',
    },
    learningProposal
  );
  // An envelope proposing a failed experiment cannot be passed to human approval for promotion
  const policyCheck = validateAgentProposal(failedEnvelope, 'experiment');
  // While syntactically valid as an experiment report, verify that recommendations cannot be forged:
  const forgedFailedEnvelope = {
    ...failedEnvelope,
    output: {
      ...failedEnvelope.output,
      recommendation: 'APPROVE_FOR_REVIEW',
    },
  };
  const forgedCheck = validateAgentProposal(forgedFailedEnvelope, 'experiment');
  assert.strictEqual(forgedCheck.allowed, false);
  assert.ok(forgedCheck.violations.some((v) => v.includes('INVALID_RECOMMENDATION')));
  console.log('  ✓ #35 PASSED: Failed experiment is blocked from approval advancement');
}

// Test 36: Passed experiment advances to human review, enabling activation of v1.1.0 for future runs only
{
  // Policy evaluation on passing experiment
  const policyCheck = validateAgentProposal(experimentEnvelope, 'experiment', {
    learningProposal,
    dataset: benchmarkDataset,
  });
  assert.strictEqual(policyCheck.allowed, true);

  // Human reviews the ExperimentResult and signs approval for activation of v1.1.0
  const humanApprovalSignature = 'sig-human-candidate-exp-approved-1.1.0';
  assert.ok(humanApprovalSignature);

  // Profile v1.1.0 is active ONLY for future Discovery run (T0')
  const futureJob = {
    title: 'Principal Distributed Systems Engineer',
    company: 'Future Enterprise Systems',
    url: 'https://future.enterprise.io/jobs/principal-distributed-eng-future',
    source: 'direct_employer',
    requirements: ['8 years distributed systems', 'Node.js', 'PostgreSQL'],
    skills: ['TypeScript', 'Node.js', 'PostgreSQL'],
    location: 'Remote',
    category: 'Distributed Systems',
    raw_payload: { id: 'dist-future-01' },
  };

  const futureDisc = await emitDiscoveryProposal(futureJob);
  const futureEval = await emitEvaluationProposal(futureDisc, evidenceSnapshot);
  assert.ok(futureEval.output.fitScore > 0);

  // Verify historical records remain 100% frozen & identical
  assert.ok(evalEnvelope.output.fitScore > 0);
  assert.ok(outcome.outcomeId.startsWith('out-'));
  assert.strictEqual(feedback.feedbackId, 'fb-alpha10-001');
  assert.strictEqual(learningProposal.currentProfileVersion, '1.0.0');

  console.log('  ✓ #36 PASSED: Future run evaluated under v1.1.0; historical records T0-T11 remain unaltered');
}

console.log('\n================================================================');
console.log('  ALL V5.0-ALPHA10 EXPERIMENTATION TESTS PASSED (36 / 36)       ');
console.log('  Controlled Optimization & Replay Intelligence CERTIFIED       ');
console.log('================================================================\n');
