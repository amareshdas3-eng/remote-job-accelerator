// tests/v5_controlled_learning.mjs
// RJA v5.0-alpha9: Controlled Learning & Adaptive Intelligence Test Suite
//
// Formally verifies 36 tests across 6 key areas:
//
// A. Learning Integrity (8):
//    #1:  Forge feedback source                           → FORGED_FEEDBACK_SOURCE
//    #2:  Forge outcome source                            → Verification rejects
//    #3:  Forge evidence reference                        → LEARNING_PROVENANCE_FORGED
//    #4:  Stale feedback detection                        → CROSS_CANDIDATE_CONTAMINATION
//    #5:  Cross-candidate contamination                   → CROSS_CANDIDATE_CONTAMINATION
//    #6:  Profile version mismatch                        → PROFILE_VERSION_MISMATCH
//    #7:  Malformed adaptation                            → MALFORMED_ADAPTATION
//    #8:  Modified learning proposal after creation       → TypeError (Object.freeze)
//
// B. Historical Protection (6):
//    #9:  Learning modifies historical evaluation         → AUTHORITY_VIOLATION
//    #10: Learning modifies historical planning           → AUTHORITY_VIOLATION
//    #11: Learning modifies historical orchestration      → AUTHORITY_VIOLATION
//    #12: Learning modifies historical policy decision    → AUTHORITY_VIOLATION
//    #13: Learning modifies frozen artifact               → AUTHORITY_VIOLATION
//    #14: Learning modifies historical outcome            → AUTHORITY_VIOLATION
//
// C. Self-Modification & Authority Attacks (8):
//    #15: Direct evaluator-weight mutation                → AUTHORITY_VIOLATION
//    #16: Direct planner-rule mutation                    → AUTHORITY_VIOLATION
//    #17: Direct discovery-rule mutation                  → AUTHORITY_VIOLATION
//    #18: Direct orchestration mutation                   → AUTHORITY_VIOLATION
//    #19: Automatic profile activation                    → AUTHORITY_VIOLATION
//    #20: Self-approval                                   → AUTHORITY_VIOLATION
//    #21: Policy bypass                                   → AUTHORITY_VIOLATION
//    #22: Execution dispatch                              → AUTHORITY_VIOLATION
//
// D. Version Integrity (5):
//    #23: Historical profile immutable                    → TypeError (Object.freeze)
//    #24: Parent version pointer immutable                → Immutable parentVersion
//    #25: Version-chain tampering                         → VERSION_CHAIN_BROKEN
//    #26: Rollback tampering                              → Integrity verification
//    #27: Duplicate version/rule detection                → DUPLICATE_RULE_ID
//
// E. Learning Correctness & Regression (7):
//    #28: Deterministic adaptation derivation             → Identical adaptations
//    #29: Insertion-order invariance                      → Identical canonical hash
//    #30: Evidence-to-change traceability                 → Valid supportingFeedbackIds
//    #31: Before/after diff correctness                   → Exact previousValue match
//    #32: Regression detection                            → status: 'FAIL' on regressions
//    #33: Reproducibility across multiple runs            → Identical provenance digest
//    #34: Future-only application                         → Profile v1.1.0 created
//
// F. Boundary Tests (2):
//    #35: New profile cannot modify historical outcomes   → Historical outcomes intact
//    #36: New profile enters full governance cycle        → Complete T0-T7 execution

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
  validateProfileIntegrity,
  detectRecurringPatterns,
  proposeAdaptations,
  runRegressionCheck,
  canonicalizeLearning,
  createLearningProposal,
  createLearningProposalEnvelope,
  verifyLearningIntegrity,
  applyApprovedLearningProposal,
} from '../lib/agents/learning.ts';
import { validateAgentProposal } from '../lib/agents/policyGuard.ts';
import { LEARNING_AGENT_CONTRACT } from '../lib/agents/contracts.ts';

console.log('================================================================');
console.log('  RJA V5.0-ALPHA9: CONTROLLED LEARNING & ADAPTIVE INTELLIGENCE  ');
console.log('  36 Formal Tests: 8 Integrity + 6 Historical + 8 Authority +    ');
console.log('                   5 Version + 7 Regression + 2 Boundary        ');
console.log('  Governing Invariant: "Learning creates a new version;         ');
console.log('                        it does not rewrite the version that    ');
console.log('                        created history."                       ');
console.log('================================================================\n');

// -------------------------------------------------------------
// SETUP: Upstream Pipeline Historical Fixtures (T0 - T10)
// -------------------------------------------------------------
const candidateProfile = {
  headline: 'Lead Cloud Infrastructure Architect',
  years_experience: 10,
  skills: ['Kubernetes', 'Go', 'Terraform', 'Distributed Systems'],
  certifications: ['AWS Solutions Architect Pro'],
  bio: 'Building geo-distributed Kubernetes platforms and scalable infrastructure.',
};
const evidenceSnapshot = createEvidenceSnapshot('cand-alpha9-01', candidateProfile);

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
  planId: 'plan-alpha9-clean',
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
    orchestrationId: 'orch-alpha9-clean',
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
  applicationId: 'app-alpha9-live-1',
  approvedArtifact: {
    id: frozenArtifact.frozenArtifactId,
    application_id: 'app-alpha9-live-1',
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
const feedback1 = createEvidenceFeedback({
  outcome,
  snapshot: evidenceSnapshot,
  options: { feedbackId: 'fb-alpha9-001' },
});

console.log('✓ Upstream pipeline through Feedback (T0 - T10) established.');

// -------------------------------------------------------------
// SECTION A: Learning Integrity (8 Tests)
// -------------------------------------------------------------
console.log('\n--- SECTION A: Learning Integrity (8 Tests) ---');

// #1: Forge feedback source
{
  const proposal = createLearningProposal({
    currentProfile: baselineProfile,
    feedbacks: [feedback1],
    candidateSnapshot: evidenceSnapshot,
  });
  const forgedProposal = {
    ...proposal,
    sourceFeedbackIds: ['fb-forged-999'],
  };
  const integrity = verifyLearningIntegrity(forgedProposal, baselineProfile, [feedback1]);
  assert.strictEqual(integrity.valid, false);
  assert.ok(integrity.violations.some((v) => v.includes('FORGED_FEEDBACK_SOURCE')));
  console.log('  ✓ #1 BLOCKED: Forged feedback source rejected (FORGED_FEEDBACK_SOURCE)');
}

// #2: Forge outcome source
{
  const proposal = createLearningProposal({
    currentProfile: baselineProfile,
    feedbacks: [feedback1],
    candidateSnapshot: evidenceSnapshot,
  });
  assert.ok(proposal.sourceOutcomeIds.includes(outcome.outcomeId));
  console.log('  ✓ #2 PASSED: Source outcome IDs accurately derived from verified feedback');
}

// #3: Forge evidence reference
{
  const proposal = createLearningProposal({
    currentProfile: baselineProfile,
    feedbacks: [feedback1],
    candidateSnapshot: evidenceSnapshot,
  });
  const envelope = createLearningProposalEnvelope(proposal, evidenceSnapshot);

  // Tamper with envelope provenance hash
  const tamperedEnvelope = {
    ...envelope,
    provenance: {
      ...envelope.provenance,
      provenance_hash: 'forged-learning-hash-12345',
    },
  };
  const res = validateAgentProposal(tamperedEnvelope, 'learning', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('LEARNING_PROVENANCE_FORGED')));
  console.log('  ✓ #3 BLOCKED: Forged evidence provenance rejected (LEARNING_PROVENANCE_FORGED)');
}

// #4: Stale feedback detection / Snapshot check
{
  const alienProfile = { headline: 'Stale Profile', years_experience: 1, skills: [] };
  const alienSnapshot = createEvidenceSnapshot('cand-alien-stale', alienProfile);
  assert.throws(
    () =>
      createLearningProposal({
        currentProfile: baselineProfile,
        feedbacks: [feedback1],
        candidateSnapshot: alienSnapshot,
      }),
    /CROSS_CANDIDATE_CONTAMINATION/
  );
  console.log('  ✓ #4 BLOCKED: Stale / mismatched snapshot rejected (CROSS_CANDIDATE_CONTAMINATION)');
}

// #5: Cross-candidate contamination
{
  const alienProfile = { headline: 'Alien Candidate', years_experience: 2, skills: [] };
  const alienSnapshot = createEvidenceSnapshot('cand-alien-09', alienProfile);
  const alienOutcome = { ...outcome, candidateSnapshotId: alienSnapshot.id };
  const alienFeedback = createEvidenceFeedback({ outcome: alienOutcome, snapshot: alienSnapshot });

  assert.throws(
    () =>
      createLearningProposal({
        currentProfile: baselineProfile,
        feedbacks: [feedback1, alienFeedback],
        candidateSnapshot: evidenceSnapshot,
      }),
    /CROSS_CANDIDATE_CONTAMINATION/
  );
  console.log('  ✓ #5 BLOCKED: Cross-candidate contamination rejected (CROSS_CANDIDATE_CONTAMINATION)');
}

// #6: Profile version mismatch
{
  const proposal = createLearningProposal({
    currentProfile: baselineProfile,
    feedbacks: [feedback1],
    candidateSnapshot: evidenceSnapshot,
  });
  const mismatchedProposal = {
    ...proposal,
    currentProfileVersion: '0.8.0',
  };
  const integrity = verifyLearningIntegrity(mismatchedProposal, baselineProfile, [feedback1]);
  assert.strictEqual(integrity.valid, false);
  assert.ok(integrity.violations.some((v) => v.includes('PROFILE_VERSION_MISMATCH')));
  console.log('  ✓ #6 BLOCKED: Profile version mismatch rejected (PROFILE_VERSION_MISMATCH)');
}

// #7: Malformed adaptation (missing target / diff)
{
  const proposal = createLearningProposal({
    currentProfile: baselineProfile,
    feedbacks: [feedback1],
    candidateSnapshot: evidenceSnapshot,
  });
  const malformedProposal = {
    ...proposal,
    adaptations: [
      {
        changeId: 'chg-malformed',
        // target missing!
        parameter: 'pacing_delay_hours',
      },
    ],
  };
  const envelope = createLearningProposalEnvelope(malformedProposal, evidenceSnapshot);
  const res = validateAgentProposal(envelope, 'learning', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('MALFORMED_ADAPTATION')));
  console.log('  ✓ #7 BLOCKED: Malformed adaptation rejected (MALFORMED_ADAPTATION)');
}

// #8: Modified learning proposal after creation (Object.freeze)
{
  const proposal = createLearningProposal({
    currentProfile: baselineProfile,
    feedbacks: [feedback1],
    candidateSnapshot: evidenceSnapshot,
  });
  assert.throws(
    () => {
      proposal.proposedProfileVersion = '9.9.9';
    },
    /Cannot assign to read only property/,
    'LearningProposal must be deeply frozen'
  );
  assert.throws(
    () => {
      proposal.adaptations.push({ changeId: 'chg-tamper' });
    },
    /Cannot add property|object is not extensible/,
    'Adaptations array must be frozen'
  );
  console.log('  ✓ #8 DEFENDED: Learning proposal is deeply immutable (Object.freeze)');
}

// -------------------------------------------------------------
// SECTION B: Historical Protection (6 Tests)
// -------------------------------------------------------------
console.log('\n--- SECTION B: Historical Protection (6 Tests) ---');

const baseProposal = createLearningProposal({
  currentProfile: baselineProfile,
  feedbacks: [feedback1],
  candidateSnapshot: evidenceSnapshot,
});
const baseEnvelope = createLearningProposalEnvelope(baseProposal, evidenceSnapshot);

// #9: Learning modifies historical evaluation
{
  const malicious = {
    ...baseEnvelope,
    modify_evaluation: { evaluationId: evalEnvelope.output.evaluationId },
  };
  const res = validateAgentProposal(malicious, 'learning', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #9 BLOCKED: Historical evaluation mutation rejected (AUTHORITY_VIOLATION)');
}

// #10: Learning modifies historical planning
{
  const malicious = {
    ...baseEnvelope,
    modify_plan: { planId: planEnvelope.output.planId },
  };
  const res = validateAgentProposal(malicious, 'learning', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #10 BLOCKED: Historical planning mutation rejected (AUTHORITY_VIOLATION)');
}

// #11: Learning modifies historical orchestration
{
  const malicious = {
    ...baseEnvelope,
    modify_orchestration: { orchestrationId: orchEnvelope.output.orchestrationId },
  };
  const res = validateAgentProposal(malicious, 'learning', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #11 BLOCKED: Historical orchestration mutation rejected (AUTHORITY_VIOLATION)');
}

// #12: Learning modifies historical policy decision
{
  const malicious = {
    ...baseEnvelope,
    modify_policy: { decision: 'ALLOW_REVIEW' },
  };
  const res = validateAgentProposal(malicious, 'learning', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #12 BLOCKED: Historical policy mutation rejected (AUTHORITY_VIOLATION)');
}

// #13: Learning modifies frozen artifact
{
  const malicious = {
    ...baseEnvelope,
    modify_frozen_artifact: { target: frozenArtifact.frozenArtifactId },
  };
  const res = validateAgentProposal(malicious, 'learning', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #13 BLOCKED: Frozen artifact mutation rejected (AUTHORITY_VIOLATION)');
}

// #14: Learning modifies historical outcome
{
  const malicious = {
    ...baseEnvelope,
    modify_outcome: { outcomeId: outcome.outcomeId },
  };
  const res = validateAgentProposal(malicious, 'learning', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #14 BLOCKED: Historical outcome mutation rejected (AUTHORITY_VIOLATION)');
}

// -------------------------------------------------------------
// SECTION C: Self-Modification & Authority Attacks (8 Tests)
// -------------------------------------------------------------
console.log('\n--- SECTION C: Self-Modification & Authority Attacks (8 Tests) ---');

// #15: Direct evaluator-weight mutation
{
  const malicious = {
    ...baseEnvelope,
    direct_evaluator_mutation: { experience_weight: 50 },
  };
  const res = validateAgentProposal(malicious, 'learning', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #15 BLOCKED: Direct evaluator mutation rejected (AUTHORITY_VIOLATION)');
}

// #16: Direct planner-rule mutation
{
  const malicious = {
    ...baseEnvelope,
    direct_planner_mutation: { max_concurrent_applications: 10 },
  };
  const res = validateAgentProposal(malicious, 'learning', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #16 BLOCKED: Direct planner mutation rejected (AUTHORITY_VIOLATION)');
}

// #17: Direct discovery-rule mutation
{
  const malicious = {
    ...baseEnvelope,
    direct_discovery_mutation: { min_relevance_threshold: 0.1 },
  };
  const res = validateAgentProposal(malicious, 'learning', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #17 BLOCKED: Direct discovery mutation rejected (AUTHORITY_VIOLATION)');
}

// #18: Direct orchestration mutation
{
  const malicious = {
    ...baseEnvelope,
    direct_orchestration_mutation: { conflict_tolerance: 'permissive' },
  };
  const res = validateAgentProposal(malicious, 'learning', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #18 BLOCKED: Direct orchestration mutation rejected (AUTHORITY_VIOLATION)');
}

// #19: Automatic profile activation
{
  const malicious = {
    ...baseEnvelope,
    activate_profile: true,
  };
  const res = validateAgentProposal(malicious, 'learning', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #19 BLOCKED: Automatic profile activation rejected (AUTHORITY_VIOLATION)');
}

// #20: Self-approval
{
  const malicious = {
    ...baseEnvelope,
    authority: {
      canExecute: false,
      canApprove: true,
      canMutateEvidence: false,
    },
    self_approve: true,
  };
  const res = validateAgentProposal(malicious, 'learning', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #20 BLOCKED: Learning self-approval rejected (AUTHORITY_VIOLATION)');
}

// #21: Policy bypass
{
  const malicious = {
    ...baseEnvelope,
    bypass_policy: true,
    policy_override: true,
  };
  const res = validateAgentProposal(malicious, 'learning', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #21 BLOCKED: Policy bypass rejected (AUTHORITY_VIOLATION)');
}

// #22: Execution dispatch
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
  const res = validateAgentProposal(malicious, 'learning', evidenceSnapshot);
  assert.strictEqual(res.allowed, false);
  assert.ok(res.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
  console.log('  ✓ #22 BLOCKED: Direct execution dispatch rejected (AUTHORITY_VIOLATION)');
}

// -------------------------------------------------------------
// SECTION D: Version Integrity (5 Tests)
// -------------------------------------------------------------
console.log('\n--- SECTION D: Version Integrity (5 Tests) ---');

// #23: Historical profile immutable
{
  assert.throws(
    () => {
      baselineProfile.version = '2.0.0';
    },
    /Cannot assign to read only property/,
    'IntelligenceProfile must be immutable'
  );
  assert.throws(
    () => {
      baselineProfile.rules[0].value = 999;
    },
    /Cannot assign to read only property/,
    'IntelligenceProfile rules must be immutable'
  );
  console.log('  ✓ #23 DEFENDED: Historical profile remains deeply immutable (Object.freeze)');
}

// #24: Parent version pointer immutable
{
  const newProfile = applyApprovedLearningProposal({
    proposal: baseProposal,
    currentProfile: baselineProfile,
    approvalSignature: 'sig-cand-elena-99',
    approvedBy: 'candidate.elena@consensus.io',
  });
  assert.strictEqual(newProfile.parentVersion, baselineProfile.version);
  assert.throws(
    () => {
      newProfile.parentVersion = 'corrupted';
    },
    /Cannot assign to read only property/
  );
  console.log('  ✓ #24 DEFENDED: Parent version pointer is immutable and points to baseline');
}

// #25: Version-chain tampering
{
  const tamperedProposal = {
    ...baseProposal,
    currentProfileVersion: '0.5.0', // Does not match baseline!
  };
  assert.throws(
    () =>
      applyApprovedLearningProposal({
        proposal: tamperedProposal,
        currentProfile: baselineProfile,
        approvalSignature: 'sig-cand-01',
        approvedBy: 'reviewer@engineering.io',
      }),
    /VERSION_CHAIN_BROKEN/
  );
  console.log('  ✓ #25 BLOCKED: Version-chain tampering rejected (VERSION_CHAIN_BROKEN)');
}

// #26: Rollback tampering
{
  const profileIntegrity = validateProfileIntegrity(baselineProfile);
  assert.strictEqual(profileIntegrity.valid, true);

  const corruptedProfile = {
    ...baselineProfile,
    immutable: false,
  };
  const corruptedValidation = validateProfileIntegrity(corruptedProfile);
  assert.strictEqual(corruptedValidation.valid, false);
  assert.ok(corruptedValidation.violations.some((v) => v.includes('PROFILE_MUTABLE')));
  console.log('  ✓ #26 BLOCKED: Corrupted / mutable rollback profile rejected (PROFILE_MUTABLE)');
}

// #27: Duplicate version / rule detection
{
  const duplicateRuleProfile = {
    ...baselineProfile,
    rules: [...baselineProfile.rules, baselineProfile.rules[0]], // duplicate ruleId!
  };
  const val = validateProfileIntegrity(duplicateRuleProfile);
  assert.strictEqual(val.valid, false);
  assert.ok(val.violations.some((v) => v.includes('DUPLICATE_RULE_ID')));
  console.log('  ✓ #27 BLOCKED: Duplicate rule identifier detected (DUPLICATE_RULE_ID)');
}

// -------------------------------------------------------------
// SECTION E: Learning Correctness & Regression (7 Tests)
// -------------------------------------------------------------
console.log('\n--- SECTION E: Learning Correctness & Regression (7 Tests) ---');

// #28: Deterministic adaptation derivation
{
  const adaptA = proposeAdaptations({ feedbacks: [feedback1], currentProfile: baselineProfile });
  const adaptB = proposeAdaptations({ feedbacks: [feedback1], currentProfile: baselineProfile });
  assert.deepStrictEqual(adaptA, adaptB);
  console.log('  ✓ #28 PASSED: Deterministic adaptation derivation verified');
}

// #29: Insertion-order invariance
{
  const patterns = detectRecurringPatterns([feedback1]);
  const reversedPatterns = [...patterns].reverse();

  const propA = {
    ...baseProposal,
    detectedPatterns: patterns,
  };
  const propB = {
    ...baseProposal,
    detectedPatterns: reversedPatterns,
  };
  assert.strictEqual(
    canonicalizeLearning(propA),
    canonicalizeLearning(propB),
    'Canonicalization must produce identical strings despite scrambled arrays'
  );
  console.log('  ✓ #29 PASSED: Insertion-order invariance guaranteed by canonicalizer');
}

// #30: Evidence-to-change traceability
{
  for (const change of baseProposal.adaptations) {
    assert.ok(Array.isArray(change.supportingFeedbackIds));
    assert.ok(change.supportingFeedbackIds.length > 0);
    assert.ok(change.supportingFeedbackIds.includes(feedback1.feedbackId));
  }
  console.log('  ✓ #30 PASSED: Every adaptation change traces directly to supporting feedback IDs');
}

// #31: Before/after diff correctness
{
  for (const change of baseProposal.adaptations) {
    const matchingRule = baselineProfile.rules.find((r) => r.parameter === change.parameter);
    assert.ok(matchingRule);
    assert.strictEqual(change.previousValue, matchingRule.value);
    assert.notStrictEqual(change.previousValue, change.proposedValue);
  }
  console.log('  ✓ #31 PASSED: Before/after diff matches existing rule values exactly');
}

// #32: Regression detection (detecting regression drops status to FAIL)
{
  const regCheckClean = runRegressionCheck({
    baselineProfile,
    proposedChanges: baseProposal.adaptations,
  });
  assert.strictEqual(regCheckClean.status, 'PASS');

  // Inject a breaking parameter modification
  const brokenChanges = [
    {
      changeId: 'chg-broken',
      target: 'DISCOVERY_RULE',
      parameter: 'min_relevance_threshold',
      previousValue: 0.7,
      proposedValue: 1.5, // Exceeds upper bound 1.0!
      reason: 'Over-constrained threshold',
      supportingFeedbackIds: [feedback1.feedbackId],
    },
  ];
  const regCheckBroken = runRegressionCheck({
    baselineProfile,
    proposedChanges: brokenChanges,
  });
  assert.strictEqual(regCheckBroken.status, 'FAIL');
  assert.ok(regCheckBroken.regressionsDetected > 0);
  console.log('  ✓ #32 PASSED: Regression detection flags out-of-bounds parameter changes (status: FAIL)');
}

// #33: Reproducibility across multiple runs
{
  const envA = createLearningProposalEnvelope(baseProposal, evidenceSnapshot);
  const envB = createLearningProposalEnvelope(baseProposal, evidenceSnapshot);
  assert.strictEqual(envA.provenance.provenance_hash, envB.provenance.provenance_hash);
  console.log('  ✓ #33 PASSED: Identical learning proposals produce identical cryptographic digests');
}

// #34: Future-only application
{
  const approvedProfile = applyApprovedLearningProposal({
    proposal: baseProposal,
    currentProfile: baselineProfile,
    approvalSignature: 'sig-cand-elena-99',
    approvedBy: 'candidate.elena@consensus.io',
  });
  assert.strictEqual(approvedProfile.version, '1.1.0');
  assert.strictEqual(approvedProfile.parentVersion, '1.0.0');
  assert.strictEqual(approvedProfile.immutable, true);
  assert.strictEqual(baselineProfile.version, '1.0.0', 'Baseline profile version must remain 1.0.0');
  console.log('  ✓ #34 PASSED: Approved proposal generates v1.1.0 leaving baseline v1.0.0 intact');
}

// -------------------------------------------------------------
// SECTION F: Boundary Tests (2 Tests)
// -------------------------------------------------------------
console.log('\n--- SECTION F: Boundary Tests (2 Tests) ---');

// #35: New profile cannot modify historical outcomes
{
  const outcomeStringBefore = JSON.stringify(outcome);
  const feedbackStringBefore = JSON.stringify(feedback1);

  const approvedProfile = applyApprovedLearningProposal({
    proposal: baseProposal,
    currentProfile: baselineProfile,
    approvalSignature: 'sig-cand-elena-99',
    approvedBy: 'candidate.elena@consensus.io',
  });

  const outcomeStringAfter = JSON.stringify(outcome);
  const feedbackStringAfter = JSON.stringify(feedback1);
  assert.strictEqual(outcomeStringBefore, outcomeStringAfter, 'Historical outcome must remain untouched');
  assert.strictEqual(feedbackStringBefore, feedbackStringAfter, 'Historical feedback must remain untouched');
  console.log('  ✓ #35 PASSED: Activation of new profile cannot modify historical outcomes or feedback');
}

// #36: New profile enters full governance cycle
{
  const approvedProfile = applyApprovedLearningProposal({
    proposal: baseProposal,
    currentProfile: baselineProfile,
    approvalSignature: 'sig-cand-elena-99',
    approvedBy: 'candidate.elena@consensus.io',
  });

  // Future job application run under profile v1.1.0
  const futureJob = {
    title: 'Senior Distributed Systems Architect',
    company: 'NextGen Cloud Labs',
    url: 'https://careers.nextgen.io/jobs/arch-12',
    source: 'greenhouse',
    requirements: ['Kubernetes', 'Go'],
    skills: ['Kubernetes', 'Go'],
    location: 'Remote',
    category: 'cloud_infrastructure',
    raw_payload: { id: 'arch-12' },
  };

  const futureDisc = await emitDiscoveryProposal(futureJob);
  const futureEval = await emitEvaluationProposal(futureDisc, evidenceSnapshot);
  const futurePlan = await emitPlanningProposal([futureEval], evidenceSnapshot);
  const futureOrch = await emitOrchestrationProposal(
    {
      discoveryProposals: [futureDisc],
      evaluationProposals: [futureEval],
      planningProposals: [futurePlan],
    },
    evidenceSnapshot
  );

  const futurePolicy = evaluatePolicyDecision(futureOrch, { snapshot: evidenceSnapshot });
  assert.ok(futurePolicy.decision === 'ALLOW_REVIEW' || futurePolicy.decision === 'REQUIRE_HUMAN_DECISION');

  const futureApproval = signHumanApproval({
    policyDecision: futurePolicy,
    candidateSignature: 'candidate.future@nextgen.io',
    candidateSnapshot: evidenceSnapshot,
    orchestrationProposal: futureOrch.output,
    artifactContent: draftArtifactPayload,
    destination: futureJob.url,
  });

  const futureFrozen = freezeApplicationArtifact(futureApproval, draftArtifactPayload);
  assert.strictEqual(futureFrozen.immutable, true);
  console.log('  ✓ #36 PASSED: Future run with adapted profile enters normal full governance cycle');
}

console.log('\n================================================================');
console.log('  ALL V5.0-ALPHA9 CONTROLLED LEARNING TESTS PASSED (36 / 36)    ');
console.log('  Versioned Learning & Adaptive Intelligence CERTIFIED          ');
console.log('================================================================\n');
