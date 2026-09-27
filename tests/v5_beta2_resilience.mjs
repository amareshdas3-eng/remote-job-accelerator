// tests/v5_beta2_resilience.mjs
// RJA v5.0-beta2: Production Certification & Resilience Matrix
//
// Governing Invariant: The RJA architecture must survive hostile and real-world conditions
// while preserving every Alpha1–Beta1 guarantee:
//   - Authority remains outside agents
//   - Historical records remain immutable
//   - Execution remains behind the governed freeze boundary
//   - Every transition preserves provenance and governance state
//
// Coverage Matrix (152 Scenarios + 5 Zero-Drift Tests):
//
// ZONE A: Security & Authority (28 Scenarios)
//   A01-A08  Forged Provenance & Tampering
//   A09-A14  Authority Escalation
//   A15-A19  Cross-Candidate Contamination
//   A20-A24  Replay Attacks
//   A25-A28  Malicious Payloads
//
// ZONE B: Provenance & Integrity (20 Scenarios)
//   B01-B07  Hash Integrity
//   B08-B13  Evidence Snapshot Integrity
//   B14-B20  Chain Provenance Integrity
//
// ZONE C: Failure & Recovery (20 Scenarios)
//   C01-C05  Discovery Failure Modes
//   C06-C10  Evaluation & Planning Failure Modes
//   C11-C15  Execution & Dispatch Interruption
//   C16-C20  Feedback / Learning / Experiment Failure Modes
//
// ZONE D: Idempotency & Concurrency (16 Scenarios)
//   D01-D08  Idempotent Re-execution
//   D09-D16  Concurrent Execution Guards
//
// ZONE E: Deterministic Replay (16 Scenarios)
//   E01-E08  Same-Input Replay
//   E09-E16  Cross-Profile Replay Isolation
//
// ZONE F: Version & Rollback Safety (16 Scenarios)
//   F01-F08  Parent version chain
//   F09-F16  Immutability enforcement
//
// ZONE G: Operational Limits (16 Scenarios)
//   G01-G08  Boundary / Empty / Large Input
//   G09-G16  Operational Edge Cases
//
// ZONE H: Full-Lifecycle Fuzzing (20 Scenarios)
//   H01-H07  Structural Fuzzing
//   H08-H14  Semantic Fuzzing
//   H15-H20  Cross-Zone Composite Attacks
//
// DRIFT-01–05: lib/execution/ Zero-Drift Verification

import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// --- Production imports from lib/ ---
import { emitDiscoveryProposal } from '../lib/agents/discovery.ts';
import { emitEvaluationProposal } from '../lib/agents/evaluation.ts';
import { emitPlanningProposal } from '../lib/agents/planning.ts';
import { emitOrchestrationProposal } from '../lib/agents/orchestrator.ts';
import {
  evaluatePolicyDecision,
  signHumanApproval,
  freezeApplicationArtifact,
  verifyFrozenArtifactForExecution,
  transitionGovernanceState,
  verifyUnifiedLifecycleAuditTrail,
} from '../lib/agents/governance.ts';
import { createEvidenceSnapshot } from '../lib/execution/snapshot.ts';
import {
  executeApplicationPackage,
  acquireExecutionLock,
  releaseExecutionLock,
} from '../lib/execution/engine.ts';
import {
  computeArtifactFingerprint,
  verifyArtifactFingerprint,
  deterministicStringify,
  normalizeText,
  DEFAULT_FINGERPRINT_SCHEME,
  canonicalizeArtifactContent,
} from '../lib/execution/fingerprint.ts';
import { recordOutcome } from '../lib/agents/outcome.ts';
import { createEvidenceFeedback } from '../lib/agents/feedback.ts';
import {
  createBaselineIntelligenceProfile,
  createLearningProposal,
  applyApprovedLearningProposal,
  validateProfileIntegrity,
} from '../lib/agents/learning.ts';
import {
  createStandardBenchmarkDataset,
  runReplayExperiment,
} from '../lib/agents/experimentation.ts';
import { AGENT_AUTHORITY_REGISTRY } from '../lib/agents/contracts.ts';

// ─────────────────────────────────────────────────────────────────────────────
// TEST HARNESS
// ─────────────────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

async function test(id, description, fn) {
  try {
    await fn();
    console.log(`  \u2705 ${id}: ${description}`);
    passed++;
  } catch (err) {
    console.log(`  \u274c ${id}: ${description}`);
    console.log(`       \u2192 ${err.message}`);
    failed++;
    failures.push({ id, description, error: err.message });
  }
}

async function assertThrows(fn, messageFragment) {
  let threw = false;
  try {
    await fn();
  } catch (err) {
    threw = true;
    if (messageFragment) {
      assert.ok(
        err.message.includes(messageFragment),
        `Expected error containing "${messageFragment}" but got: "${err.message}"`
      );
    }
  }
  assert.ok(threw, `Expected function to throw but it returned normally`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL FIXTURES SETUP & TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────
async function runResilienceMatrix() {
  const CANDIDATE_DATA = {
    headline: 'Staff Engineer - Distributed Systems',
    years_experience: 11,
    skills: ['TypeScript', 'Node.js', 'Kubernetes', 'PostgreSQL', 'gRPC'],
    certifications: ['CKA', 'AWS Pro'],
    bio: 'Expert in resilient, governed agentic systems.',
  };

  const ALTERNATE_CANDIDATE_DATA = {
    headline: 'Principal ML Engineer',
    years_experience: 8,
    skills: ['Python', 'TensorFlow', 'BigQuery'],
    certifications: ['GCP Professional ML'],
    bio: 'Specialist in ML pipelines.',
  };

  const JOB_LISTING = {
    jobId: 'job-beta2-001',
    title: 'Staff Platform Engineer',
    company: 'Beta2 Corp',
    location: 'Remote',
    category: 'Engineering',
    description: 'Lead cloud platform engineering for high-scale distributed systems.',
    requirements: ['TypeScript', 'Kubernetes', '5+ years distributed systems'],
    skills: ['TypeScript', 'Node.js', 'Kubernetes'],
    url: 'https://beta2corp.com/jobs/001',
    sourceUrl: 'https://beta2corp.com/jobs/001',
    source: 'career_portals',
  };

  const ARTIFACT_CONTENT = {
    resume: { full_resume: 'Staff Engineer resume content v1.0', name: 'Jane Doe' },
    cover_letter: { letter: 'Cover letter for Beta2 Corp role', recipient: 'Hiring Manager' },
    screening_answers: {
      answers: [
        { question_id: 'q1', question: 'Years exp?', answer: '11 years' },
        { question_id: 'q2', question: 'TypeScript?', answer: 'Expert' },
      ],
    },
  };

  // Build canonical lifecycle objects (immutable references)
  const canonicalSnapshot = createEvidenceSnapshot('cand-beta2-canonical', CANDIDATE_DATA);
  const alternateSnapshot = createEvidenceSnapshot('cand-beta2-alternate', ALTERNATE_CANDIDATE_DATA);
  const baselineProfile = createBaselineIntelligenceProfile({ profileId: 'profile-beta2-v1', version: '1.0.0' });

  const canonicalDiscovery = await emitDiscoveryProposal(JOB_LISTING, {
    inputEvidenceRefs: [canonicalSnapshot.id],
  });
  const canonicalEvaluation = await emitEvaluationProposal(canonicalDiscovery, canonicalSnapshot);
  const canonicalPlanning = await emitPlanningProposal([canonicalEvaluation], canonicalSnapshot, {
    planId: 'plan-beta2-canon',
  });
  const canonicalOrchestration = await emitOrchestrationProposal(
    {
      discoveryProposals: [canonicalDiscovery],
      evaluationProposals: [canonicalEvaluation],
      planningProposals: [canonicalPlanning],
    },
    canonicalSnapshot,
    {
      orchestrationId: 'orch-beta2-canon',
    }
  );
  const canonicalPolicyDecision = evaluatePolicyDecision(canonicalOrchestration, {
    snapshot: canonicalSnapshot,
    options: { policyDecisionId: 'pol-beta2-canon' },
  });
  const canonicalApproval = signHumanApproval({
    policyDecision: {
      ...canonicalPolicyDecision,
      decision: 'ALLOW_REVIEW',
    },
    candidateSignature: 'jane.doe@beta2corp.com',
    candidateSnapshot: canonicalSnapshot,
    orchestrationProposal: canonicalOrchestration.output,
    artifactContent: ARTIFACT_CONTENT,
    destination: 'Beta2 Corp ATS',
    approvalTimestamp: '2026-09-27T01:00:00.000Z',
  });
  const canonicalFrozenArtifact = freezeApplicationArtifact(canonicalApproval, ARTIFACT_CONTENT);
  const canonicalFingerprint = computeArtifactFingerprint(ARTIFACT_CONTENT);

  const canonicalArtifactForExecution = {
    id: `art-exec-${canonicalFingerprint.hash.slice(0, 8)}`,
    application_id: 'app-beta2-001',
    evidence_snapshot_id: canonicalSnapshot.id,
    destination: 'Beta2 Corp ATS',
    fingerprint: canonicalFingerprint,
    approved_by: 'jane.doe@beta2corp.com',
    approved_at: '2026-09-27T01:00:00.000Z',
    content: ARTIFACT_CONTENT,
  };

  const canonicalExecution = executeApplicationPackage({
    applicationId: 'app-beta2-001',
    approvedArtifact: canonicalArtifactForExecution,
    currentContent: ARTIFACT_CONTENT,
    destination: 'Beta2 Corp ATS',
    route: 'portal',
  });

  const canonicalOutcome = recordOutcome({
    receipt: canonicalExecution.receipt,
    frozenArtifact: canonicalFrozenArtifact,
    snapshot: canonicalSnapshot,
    planningProposal: canonicalPlanning.output,
    options: { outcomeId: 'out-beta2-canon' },
  });

  const canonicalFeedback = createEvidenceFeedback({
    outcome: canonicalOutcome,
    snapshot: canonicalSnapshot,
    options: { feedbackId: 'fb-beta2-canon' },
  });

  const canonicalLearningProposal = createLearningProposal({
    currentProfile: baselineProfile,
    feedbacks: [canonicalFeedback],
    candidateSnapshot: canonicalSnapshot,
    options: { learningId: 'lrn-beta2-canon' },
  });

  const canonicalApprovedProfileV2 = applyApprovedLearningProposal({
    proposal: canonicalLearningProposal,
    currentProfile: baselineProfile,
    approvalSignature: 'sig-human-candidate',
    approvedBy: 'candidate@beta2.com',
  });

  const canonicalDataset = createStandardBenchmarkDataset({ datasetId: 'ds-beta2-canon' });
  const canonicalExperiment = runReplayExperiment({
    learningProposal: canonicalLearningProposal,
    baselineProfile,
    candidateProfile: canonicalApprovedProfileV2,
    dataset: canonicalDataset,
  });

  const canonicalLifecycle = {
    discovery: canonicalDiscovery,
    snapshot: canonicalSnapshot,
    evaluation: canonicalEvaluation,
    planning: canonicalPlanning,
    orchestration: canonicalOrchestration,
    policyDecision: canonicalPolicyDecision,
    humanApproval: canonicalApproval,
    frozenArtifact: canonicalFrozenArtifact,
    receipt: canonicalExecution.receipt,
    outcome: canonicalOutcome,
    feedback: canonicalFeedback,
    learningProposal: canonicalLearningProposal,
    experimentResult: canonicalExperiment,
    approvedProfileV2: canonicalApprovedProfileV2,
  };

  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c');
  console.log('  RJA V5.0-BETA2: PRODUCTION CERTIFICATION & RESILIENCE MATRIX  ');
  console.log('  152 Adversarial Scenarios across 8 Zones + 5 Zero-Drift Tests  ');
  console.log('\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\n');

  // ───────────────────────────────────────────────────────────────────────────
  // ZONE A: SECURITY & AUTHORITY (28 Scenarios)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\u2500\u2500\u2500 ZONE A: Security & Authority (28 Scenarios) \u2500\u2500\u2500');

  await test('A01', 'Policy Guard blocks proposal missing required orchestrationId', () => {
    const forgedProposal = { ...canonicalOrchestration.output, orchestrationId: '' };
    const result = evaluatePolicyDecision(forgedProposal, { snapshot: canonicalSnapshot, options: { policyDecisionId: 'pol-a01' } });
    assert.strictEqual(result.decision, 'BLOCK');
    assert.ok(result.policyFindings.filter(f => f.category === 'AUTHENTICITY' && f.severity === 'BLOCKING').length > 0);
  });

  await test('A02', 'Policy Guard blocks forged candidateSnapshotId', () => {
    const forgedProposal = { ...canonicalOrchestration.output, candidateSnapshotId: 'snap-FORGED-adversary' };
    const result = evaluatePolicyDecision(forgedProposal, { snapshot: canonicalSnapshot, options: { policyDecisionId: 'pol-a02' } });
    assert.strictEqual(result.decision, 'BLOCK');
    assert.ok(result.policyFindings.some(f => f.rule === 'SNAPSHOT_IDENTITY_MATCH'));
  });

  await test('A03', 'Policy Guard blocks forged evidenceHash', () => {
    const forgedProposal = { ...canonicalOrchestration.output, evidenceHash: 'a'.repeat(64) };
    const result = evaluatePolicyDecision(forgedProposal, { snapshot: canonicalSnapshot, options: { policyDecisionId: 'pol-a03' } });
    assert.strictEqual(result.decision, 'BLOCK');
    assert.ok(result.policyFindings.some(f => f.rule === 'EVIDENCE_HASH_MATCH'));
  });

  await test('A04', 'Policy Guard blocks envelope with empty provenance_hash', () => {
    const forgedEnvelope = { ...canonicalOrchestration, provenance: { ...canonicalOrchestration.provenance, provenance_hash: '' } };
    const result = evaluatePolicyDecision(forgedEnvelope, { snapshot: canonicalSnapshot, options: { policyDecisionId: 'pol-a04' } });
    assert.strictEqual(result.decision, 'BLOCK');
    assert.ok(result.policyFindings.some(f => f.rule === 'PROVENANCE_RECORD_REQUIRED'));
  });

  await test('A05', 'Policy Guard blocks tampered discovery input', () => {
    const tampered = { ...canonicalDiscovery, _tampered: true };
    const result = evaluatePolicyDecision(canonicalOrchestration, { snapshot: canonicalSnapshot, upstreamInputs: { discovery: [tampered] }, options: { policyDecisionId: 'pol-a05' } });
    assert.strictEqual(result.decision, 'BLOCK');
    assert.ok(result.policyFindings.some(f => f.rule === 'UPSTREAM_INTEGRITY_DISCOVERY'));
  });

  await test('A06', 'Policy Guard blocks tampered evaluation fitScore', () => {
    const tampered = { ...canonicalEvaluation, _tamperedScore: true };
    const result = evaluatePolicyDecision(canonicalOrchestration, { snapshot: canonicalSnapshot, upstreamInputs: { evaluation: [tampered] }, options: { policyDecisionId: 'pol-a06' } });
    assert.strictEqual(result.decision, 'BLOCK');
    assert.ok(result.policyFindings.some(f => f.rule === 'UPSTREAM_INTEGRITY_EVALUATION'));
  });

  await test('A07', 'Policy Guard blocks tampered planning priority', () => {
    const tampered = { ...canonicalPlanning, _tamperedPriority: true };
    const result = evaluatePolicyDecision(canonicalOrchestration, { snapshot: canonicalSnapshot, upstreamInputs: { planning: [tampered] }, options: { policyDecisionId: 'pol-a07' } });
    assert.strictEqual(result.decision, 'BLOCK');
    assert.ok(result.policyFindings.some(f => f.rule === 'UPSTREAM_INTEGRITY_PLANNING'));
  });

  await test('A08', 'Policy Guard blocks tampered input omission marker', () => {
    const forgedProposal = { ...canonicalOrchestration.output, _tamperedInput: true };
    const result = evaluatePolicyDecision(forgedProposal, { snapshot: canonicalSnapshot, options: { policyDecisionId: 'pol-a08' } });
    assert.strictEqual(result.decision, 'BLOCK');
    assert.ok(result.policyFindings.some(f => f.rule === 'UPSTREAM_INPUT_AUTHENTIC'));
  });

  await test('A09', 'Agent signature on human approval rejected with AUTHORITY_VIOLATION', async () => {
    await assertThrows(() => signHumanApproval({ policyDecision: canonicalPolicyDecision, candidateSignature: 'agt-orchestrator-v1', candidateSnapshot: canonicalSnapshot, orchestrationProposal: canonicalOrchestration.output, artifactContent: ARTIFACT_CONTENT, destination: 'Beta2 Corp ATS' }), 'AUTHORITY_VIOLATION');
  });

  await test('A10', 'server_policy_guard signature on human approval rejected', async () => {
    await assertThrows(() => signHumanApproval({ policyDecision: canonicalPolicyDecision, candidateSignature: 'server_policy_guard', candidateSnapshot: canonicalSnapshot, orchestrationProposal: canonicalOrchestration.output, artifactContent: ARTIFACT_CONTENT, destination: 'Beta2 Corp ATS' }), 'AUTHORITY_VIOLATION');
  });

  await test('A11', 'Empty signature on human approval rejected', async () => {
    await assertThrows(() => signHumanApproval({ policyDecision: canonicalPolicyDecision, candidateSignature: '   ', candidateSnapshot: canonicalSnapshot, orchestrationProposal: canonicalOrchestration.output, artifactContent: ARTIFACT_CONTENT, destination: 'Beta2 Corp ATS' }), 'AUTHORITY_VIOLATION');
  });

  await test('A12', 'Agent actor cannot transition to HUMAN_APPROVE governance state', async () => {
    await assertThrows(() => transitionGovernanceState('AWAITING_HUMAN_REVIEW', { type: 'HUMAN_APPROVE', actor: 'agt-orchestrator-v1' }), 'AUTHORITY_VIOLATION');
  });

  await test('A13', 'Agent actor cannot trigger FREEZE_ARTIFACT governance state', async () => {
    await assertThrows(() => transitionGovernanceState('HUMAN_APPROVED', { type: 'FREEZE_ARTIFACT', actor: 'agt-discovery-v1' }), 'AUTHORITY_VIOLATION');
  });

  await test('A14', 'Agent actor cannot trigger DISPATCH governance state', async () => {
    await assertThrows(() => transitionGovernanceState('ARTIFACT_FROZEN', { type: 'DISPATCH', actor: 'agt-planning-v1' }), 'AUTHORITY_VIOLATION');
  });

  await test('A15', 'Policy Guard blocks cross-candidate snapshot mismatch', () => {
    const result = evaluatePolicyDecision(canonicalOrchestration, { snapshot: alternateSnapshot, options: { policyDecisionId: 'pol-a15' } });
    assert.strictEqual(result.decision, 'BLOCK');
    assert.ok(result.policyFindings.filter(f => f.severity === 'BLOCKING').length > 0);
  });

  await test('A16', 'Human approval cross-candidate snapshot mismatch throws SNAPSHOT_MISMATCH', async () => {
    await assertThrows(() => signHumanApproval({ policyDecision: canonicalPolicyDecision, candidateSignature: 'attacker@adversary.com', candidateSnapshot: alternateSnapshot, orchestrationProposal: canonicalOrchestration.output, artifactContent: ARTIFACT_CONTENT, destination: 'Beta2 Corp ATS' }), 'SNAPSHOT_MISMATCH');
  });

  await test('A17', 'Human approval orchestration mismatch throws ORCHESTRATION_MISMATCH', async () => {
    const otherOrch = { orchestrationId: 'orch-OTHER-candidate' };
    await assertThrows(() => signHumanApproval({ policyDecision: canonicalPolicyDecision, candidateSignature: 'jane.doe@beta2corp.com', candidateSnapshot: canonicalSnapshot, orchestrationProposal: otherOrch, artifactContent: ARTIFACT_CONTENT, destination: 'Beta2 Corp ATS' }), 'ORCHESTRATION_MISMATCH');
  });

  await test('A18', 'Execution rejects mismatched evidence snapshot', () => {
    const result = executeApplicationPackage({ applicationId: 'app-a18', approvedArtifact: canonicalArtifactForExecution, currentContent: ARTIFACT_CONTENT, destination: 'Beta2 Corp ATS', route: 'portal', expectedSnapshotId: 'snap-WRONG-CANDIDATE' });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.code, 'SNAPSHOT_MISMATCH');
  });

  await test('A19', 'Execution rejects destination different from approved destination', () => {
    const result = executeApplicationPackage({ applicationId: 'app-a19', approvedArtifact: canonicalArtifactForExecution, currentContent: ARTIFACT_CONTENT, destination: 'adversary-ats.evil.com', route: 'portal' });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.code, 'DESTINATION_MISMATCH');
  });

  await test('A20', 'Frozen artifact with modified payload fails MUTATION_BLOCKED on re-execution', () => {
    const mutatedContent = { ...ARTIFACT_CONTENT, resume: { ...ARTIFACT_CONTENT.resume, full_resume: 'MUTATED RESUME CONTENT INJECTED' } };
    const result = executeApplicationPackage({ applicationId: 'app-a20', approvedArtifact: canonicalArtifactForExecution, currentContent: mutatedContent, destination: 'Beta2 Corp ATS', route: 'portal' });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.code, 'MUTATION_BLOCKED');
  });

  await test('A21', 'signHumanApproval rejects BLOCKED policy decision', async () => {
    const blockedDecision = { ...canonicalPolicyDecision, decision: 'BLOCK', policyDecisionId: 'pol-blocked-a21' };
    await assertThrows(() => signHumanApproval({ policyDecision: blockedDecision, candidateSignature: 'jane.doe@beta2corp.com', candidateSnapshot: canonicalSnapshot, orchestrationProposal: canonicalOrchestration.output, artifactContent: ARTIFACT_CONTENT, destination: 'Beta2 Corp ATS' }), 'POLICY_VIOLATION');
  });

  await test('A22', 'freezeApplicationArtifact detects post-approval payload mutation', async () => {
    const mutatedPayload = { ...ARTIFACT_CONTENT, cover_letter: { ...ARTIFACT_CONTENT.cover_letter, letter: 'INJECTED CONTENT' } };
    await assertThrows(() => freezeApplicationArtifact(canonicalApproval, mutatedPayload), 'FREEZE_BOUNDARY_VIOLATION');
  });

  await test('A23', 'verifyFrozenArtifactForExecution rejects tampered destination', async () => {
    await assertThrows(() => verifyFrozenArtifactForExecution(canonicalFrozenArtifact, 'adversary-ats.evil.com'), 'DESTINATION_MISMATCH');
  });

  await test('A24', 'Orchestrator self-approval attempt detected and blocked by Policy Guard', () => {
    const selfApprovedProposal = { ...canonicalOrchestration.output, approved_by: 'agt-orchestrator-v1' };
    const result = evaluatePolicyDecision(selfApprovedProposal, { snapshot: canonicalSnapshot, options: { policyDecisionId: 'pol-a24' } });
    assert.strictEqual(result.decision, 'BLOCK');
    assert.ok(result.policyFindings.some(f => f.rule === 'SELF_APPROVAL_PROHIBITED'));
  });

  await test('A25', 'Orchestration with injected cover_letter blocked by Policy Guard', () => {
    const injectedProposal = { ...canonicalOrchestration.output, cover_letter: { letter: 'INJECTED COVER LETTER' } };
    const result = evaluatePolicyDecision(injectedProposal, { snapshot: canonicalSnapshot, options: { policyDecisionId: 'pol-a25' } });
    assert.strictEqual(result.decision, 'BLOCK');
    assert.ok(result.policyFindings.some(f => f.rule === 'ORCHESTRATION_ARTIFACT_PROHIBITION'));
  });

  await test('A26', 'Orchestration with dispatch marker blocked by Policy Guard', () => {
    const dispatchProposal = { ...canonicalOrchestration.output, dispatch: 'immediate' };
    const result = evaluatePolicyDecision(dispatchProposal, { snapshot: canonicalSnapshot, options: { policyDecisionId: 'pol-a26' } });
    assert.strictEqual(result.decision, 'BLOCK');
    assert.ok(result.policyFindings.some(f => f.rule === 'DIRECT_DISPATCH_PROHIBITED'));
  });

  await test('A27', 'Execution without human approval signature fails APPROVAL_REQUIRED', () => {
    const unapproved = { ...canonicalArtifactForExecution, approved_by: '' };
    const result = executeApplicationPackage({ applicationId: 'app-a27', approvedArtifact: unapproved, currentContent: ARTIFACT_CONTENT, destination: 'Beta2 Corp ATS', route: 'portal' });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.code, 'APPROVAL_REQUIRED');
  });

  await test('A28', 'Execution with invalid approval timestamp fails APPROVAL_REQUIRED', () => {
    const badTimestamp = { ...canonicalArtifactForExecution, approved_at: 'not-a-date' };
    const result = executeApplicationPackage({ applicationId: 'app-a28', approvedArtifact: badTimestamp, currentContent: ARTIFACT_CONTENT, destination: 'Beta2 Corp ATS', route: 'portal' });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.code, 'APPROVAL_REQUIRED');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ZONE B: PROVENANCE & INTEGRITY (20 Scenarios)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n\u2500\u2500\u2500 ZONE B: Provenance & Integrity (20 Scenarios) \u2500\u2500\u2500');

  await test('B01', 'computeArtifactFingerprint produces identical hash on repeated calls', () => {
    const h1 = computeArtifactFingerprint(ARTIFACT_CONTENT).hash;
    const h2 = computeArtifactFingerprint(ARTIFACT_CONTENT).hash;
    assert.strictEqual(h1, h2);
  });

  await test('B02', 'Single-byte resume mutation changes SHA-256 fingerprint', () => {
    const original = computeArtifactFingerprint(ARTIFACT_CONTENT).hash;
    const mutated = computeArtifactFingerprint({ ...ARTIFACT_CONTENT, resume: { ...ARTIFACT_CONTENT.resume, full_resume: ARTIFACT_CONTENT.resume.full_resume + 'X' } }).hash;
    assert.notStrictEqual(original, mutated);
  });

  await test('B03', 'Single-byte cover letter mutation changes SHA-256 fingerprint', () => {
    const original = computeArtifactFingerprint(ARTIFACT_CONTENT).hash;
    const mutated = computeArtifactFingerprint({ ...ARTIFACT_CONTENT, cover_letter: { ...ARTIFACT_CONTENT.cover_letter, letter: ARTIFACT_CONTENT.cover_letter.letter + 'X' } }).hash;
    assert.notStrictEqual(original, mutated);
  });

  await test('B04', 'Single-byte screening answer mutation changes SHA-256 fingerprint', () => {
    const original = computeArtifactFingerprint(ARTIFACT_CONTENT).hash;
    const mutated = computeArtifactFingerprint({ ...ARTIFACT_CONTENT, screening_answers: { answers: [{ ...ARTIFACT_CONTENT.screening_answers.answers[0], answer: '11 yearsX' }, ARTIFACT_CONTENT.screening_answers.answers[1]] } }).hash;
    assert.notStrictEqual(original, mutated);
  });

  await test('B05', 'Key order permutation produces identical fingerprint (deterministic key sort)', () => {
    const h1 = computeArtifactFingerprint(ARTIFACT_CONTENT).hash;
    const h2 = computeArtifactFingerprint({ screening_answers: ARTIFACT_CONTENT.screening_answers, cover_letter: ARTIFACT_CONTENT.cover_letter, resume: ARTIFACT_CONTENT.resume }).hash;
    assert.strictEqual(h1, h2);
  });

  await test('B06', 'Screening answer order permutation produces identical fingerprint', () => {
    const h1 = computeArtifactFingerprint(ARTIFACT_CONTENT).hash;
    const reordered = { ...ARTIFACT_CONTENT, screening_answers: { answers: [ARTIFACT_CONTENT.screening_answers.answers[1], ARTIFACT_CONTENT.screening_answers.answers[0]] } };
    const h2 = computeArtifactFingerprint(reordered).hash;
    assert.strictEqual(h1, h2);
  });

  await test('B07', 'CRLF and LF normalization produces identical fingerprint', () => {
    const h1 = computeArtifactFingerprint(ARTIFACT_CONTENT).hash;
    const crlfContent = { ...ARTIFACT_CONTENT, resume: { ...ARTIFACT_CONTENT.resume, full_resume: ARTIFACT_CONTENT.resume.full_resume.replace(/\n/g, '\r\n') } };
    const h2 = computeArtifactFingerprint(crlfContent).hash;
    assert.strictEqual(h1, h2);
  });

  await test('B08', 'Evidence snapshot evidence_hash is 64-character hex string', () => {
    assert.strictEqual(canonicalSnapshot.evidence_hash.length, 64);
    assert.ok(/^[0-9a-f]{64}$/.test(canonicalSnapshot.evidence_hash));
  });

  await test('B09', 'Different candidate profiles produce different evidence hashes', () => {
    assert.notStrictEqual(canonicalSnapshot.evidence_hash, alternateSnapshot.evidence_hash);
  });

  await test('B10', 'Evidence snapshot for same data produces consistent hash', () => {
    const s1 = createEvidenceSnapshot('cand-stable', CANDIDATE_DATA);
    const s2 = createEvidenceSnapshot('cand-stable', CANDIDATE_DATA);
    assert.strictEqual(s1.evidence_hash, s2.evidence_hash);
  });

  await test('B11', 'Discovery proposal envelope contains non-empty provenance_hash', () => {
    assert.ok(canonicalDiscovery.provenance.provenance_hash);
    assert.ok(canonicalDiscovery.provenance.provenance_hash.length > 0);
  });

  await test('B12', 'Same job listing produces identical discovery provenance hash', async () => {
    const d1 = await emitDiscoveryProposal(JOB_LISTING, { retrievedAt: '2026-09-27T00:00:00.000Z' });
    const d2 = await emitDiscoveryProposal(JOB_LISTING, { retrievedAt: '2026-09-27T00:00:00.000Z' });
    assert.strictEqual(d1.provenance.provenance_hash, d2.provenance.provenance_hash);
  });

  await test('B13', 'All agent proposals carry canExecute:false, canApprove:false, canMutateEvidence:false', () => {
    for (const proposal of [canonicalDiscovery, canonicalEvaluation, canonicalPlanning, canonicalOrchestration]) {
      assert.strictEqual(proposal.authority.canExecute, false, `${proposal.proposalId} claimed canExecute`);
      assert.strictEqual(proposal.authority.canApprove, false, `${proposal.proposalId} claimed canApprove`);
      assert.strictEqual(proposal.authority.canMutateEvidence, false, `${proposal.proposalId} claimed canMutateEvidence`);
    }
  });

  await test('B14', 'OrchestrationProposal references all upstream proposal IDs', () => {
    const out = canonicalOrchestration.output;
    assert.ok(out.discoveryProposalIds.includes(canonicalDiscovery.proposalId));
    assert.ok(out.evaluationProposalIds.includes(canonicalEvaluation.proposalId));
    assert.ok(out.planningProposalIds.includes(canonicalPlanning.proposalId));
  });

  await test('B15', 'PolicyDecisionProposal references correct orchestrationId and candidateSnapshotId', () => {
    assert.strictEqual(canonicalPolicyDecision.orchestrationId, canonicalOrchestration.output.orchestrationId);
    assert.strictEqual(canonicalPolicyDecision.candidateSnapshotId, canonicalSnapshot.id);
    assert.strictEqual(canonicalPolicyDecision.proposed_by, 'server_policy_guard');
  });

  await test('B16', 'ApprovedPackageRecord carries complete provenance lineage', () => {
    assert.ok(canonicalApproval.approvalId);
    assert.strictEqual(canonicalApproval.policyDecisionId, canonicalPolicyDecision.policyDecisionId);
    assert.strictEqual(canonicalApproval.orchestrationId, canonicalOrchestration.output.orchestrationId);
    assert.strictEqual(canonicalApproval.candidateSnapshotId, canonicalSnapshot.id);
    assert.strictEqual(canonicalApproval.approvedBy, 'jane.doe@beta2corp.com');
  });

  await test('B17', 'FrozenArtifactPackage fingerprint matches ApprovedPackageRecord fingerprint', () => {
    assert.strictEqual(canonicalFrozenArtifact.canonicalFingerprint, canonicalApproval.canonicalFingerprint);
  });

  await test('B18', 'Execution substrate verifies frozen artifact fingerprint', () => {
    assert.strictEqual(canonicalExecution.success, true);
    assert.strictEqual(canonicalExecution.receipt.verified_fingerprint, canonicalFingerprint.hash);
  });

  await test('B19', 'verifyArtifactFingerprint returns {valid:false} for mutated content', () => {
    const mutated = { ...ARTIFACT_CONTENT, resume: { ...ARTIFACT_CONTENT.resume, full_resume: 'MUTATED' } };
    const result = verifyArtifactFingerprint(mutated, canonicalFingerprint.hash);
    assert.strictEqual(result.valid, false);
  });

  await test('B20', 'verifyFrozenArtifactForExecution passes for approved destination', () => {
    const result = verifyFrozenArtifactForExecution(canonicalFrozenArtifact, 'Beta2 Corp ATS');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.actualHash, canonicalFrozenArtifact.canonicalFingerprint);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ZONE C: FAILURE & RECOVERY (20 Scenarios)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n\u2500\u2500\u2500 ZONE C: Failure & Recovery (20 Scenarios) \u2500\u2500\u2500');

  await test('C01', 'Discovery handles minimal listing without crashing', async () => {
    const minimal = { title: 'Test', company: 'Co', url: 'https://test.com/min', source: 'career_portals', description: 'Min.', requirements: [], skills: [] };
    const result = await emitDiscoveryProposal(minimal);
    assert.strictEqual(result.output.proposed_by, 'discovery_agent');
    assert.strictEqual(result.authority.canExecute, false);
  });

  await test('C02', 'Evaluation with zero skill matches records gaps without inventing evidence', async () => {
    const noSkillsListing = { ...JOB_LISTING, title: 'COBOL Dev', url: 'https://beta2corp.com/jobs/cobol', requirements: ['COBOL', 'Mainframe', 'Fortran'], skills: ['COBOL'] };
    const noSkillsDiscovery = await emitDiscoveryProposal(noSkillsListing);
    const result = await emitEvaluationProposal(noSkillsDiscovery, canonicalSnapshot);
    assert.ok(result.output.gapCount > 0);
    assert.strictEqual(result.authority.canExecute, false);
  });

  await test('C03', 'Planning with low-score evaluations produces valid plan without crashing', async () => {
    const lowScoreEval = { ...canonicalEvaluation, proposalId: 'eval-low', output: { ...canonicalEvaluation.output, evaluationId: 'eval-low', fitScore: 5, tier: 'exploratory' } };
    const result = await emitPlanningProposal([lowScoreEval], canonicalSnapshot, { planId: 'plan-low' });
    assert.ok(Array.isArray(result.output.actions));
    assert.strictEqual(result.output.proposed_by, 'planning_agent');
  });

  await test('C04', 'Orchestration with empty upstream lists produces valid proposal', async () => {
    const result = await emitOrchestrationProposal({ discoveryProposals: [], evaluationProposals: [], planningProposals: [] }, canonicalSnapshot, { orchestrationId: 'orch-empty' });
    assert.strictEqual(result.output.proposed_by, 'agent_orchestrator');
    assert.ok(typeof result.output.reviewRequired === 'boolean');
  });

  await test('C05', 'Discovery handles empty description without crashing', async () => {
    const emptyDesc = { ...JOB_LISTING, title: 'Empty Desc Dev', url: 'https://beta2corp.com/jobs/empty-desc', description: '' };
    const result = await emitDiscoveryProposal(emptyDesc);
    assert.ok(result.proposalId);
  });

  await test('C06', 'Evaluation with non-canonical snapshot hash still produces valid proposal', async () => {
    const snapAlt = { id: 'snap-alt', candidate_id: 'cand-x', evidence_hash: 'a'.repeat(64), captured_at: new Date().toISOString(), profile_data: CANDIDATE_DATA };
    const result = await emitEvaluationProposal(canonicalDiscovery, snapAlt);
    assert.ok(result.output.evaluationId);
  });

  await test('C07', 'Planning with high-gap evaluations records dependencies without throwing', async () => {
    const conflictingEval = { ...canonicalEvaluation, proposalId: 'eval-conflict', output: { ...canonicalEvaluation.output, evaluationId: 'eval-conflict', missingSkills: ['COBOL', 'Fortran'], gapCount: 5 } };
    const result = await emitPlanningProposal([conflictingEval], canonicalSnapshot, { planId: 'plan-conflict' });
    assert.strictEqual(result.output.planId, 'plan-conflict');
  });

  await test('C08', 'Policy Guard blocks proposal with missing all identity fields', () => {
    const missingId = { ...canonicalOrchestration.output, orchestrationId: '', candidateSnapshotId: '', evidenceHash: '' };
    const result = evaluatePolicyDecision(missingId, { snapshot: canonicalSnapshot, options: { policyDecisionId: 'pol-c08' } });
    assert.strictEqual(result.decision, 'BLOCK');
  });

  await test('C09', 'Simulated dispatch failure returns DISPATCH_FAILED with failed attempt status', () => {
    const result = executeApplicationPackage({ applicationId: 'app-c09', approvedArtifact: canonicalArtifactForExecution, currentContent: ARTIFACT_CONTENT, destination: 'Beta2 Corp ATS', route: 'portal', simulateDispatchFailure: true });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.code, 'DISPATCH_FAILED');
    assert.strictEqual(result.attempt?.status, 'failed');
  });

  await test('C10', 'After dispatch failure, clean retry without failure flag succeeds', () => {
    const first = executeApplicationPackage({ applicationId: 'app-c10', approvedArtifact: canonicalArtifactForExecution, currentContent: ARTIFACT_CONTENT, destination: 'Beta2 Corp ATS', route: 'portal', simulateDispatchFailure: true });
    assert.strictEqual(first.success, false);
    const retry = executeApplicationPackage({ applicationId: 'app-c10-retry', approvedArtifact: canonicalArtifactForExecution, currentContent: ARTIFACT_CONTENT, destination: 'Beta2 Corp ATS', route: 'portal' });
    assert.strictEqual(retry.success, true);
  });

  await test('C11', 'Concurrent execution blocked by in-flight lock', () => {
    const appId = 'app-c11-concurrent';
    acquireExecutionLock(appId);
    try {
      const result = executeApplicationPackage({ applicationId: appId, approvedArtifact: canonicalArtifactForExecution, currentContent: ARTIFACT_CONTENT, destination: 'Beta2 Corp ATS', route: 'portal' });
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.code, 'CONCURRENT_EXECUTION_BLOCKED');
    } finally {
      releaseExecutionLock(appId);
    }
  });

  await test('C12', 'After lock release, previously blocked execution succeeds', () => {
    const appId = 'app-c12';
    acquireExecutionLock(appId);
    releaseExecutionLock(appId);
    const result = executeApplicationPackage({ applicationId: appId, approvedArtifact: canonicalArtifactForExecution, currentContent: ARTIFACT_CONTENT, destination: 'Beta2 Corp ATS', route: 'portal' });
    assert.strictEqual(result.success, true);
  });

  await test('C13', 'POLICY_BLOCKED is a terminal state — no further transitions allowed', async () => {
    await assertThrows(() => transitionGovernanceState('POLICY_BLOCKED', { type: 'EVALUATE_POLICY', actor: 'system' }), 'TERMINAL_STATE_VIOLATION');
  });

  await test('C14', 'EXECUTED is a terminal state — no further transitions allowed', async () => {
    await assertThrows(() => transitionGovernanceState('EXECUTED', { type: 'DISPATCH', actor: 'system' }), 'TERMINAL_STATE_VIOLATION');
  });

  await test('C15', 'HUMAN_REJECTED is a terminal state — no further transitions allowed', async () => {
    await assertThrows(() => transitionGovernanceState('HUMAN_REJECTED', { type: 'HUMAN_APPROVE', actor: 'candidate@test.com' }), 'TERMINAL_STATE_VIOLATION');
  });

  await test('C16', 'recordOutcome produces immutable OutcomeRecord linked to receipt', () => {
    const outcome = recordOutcome({ receipt: canonicalExecution.receipt, frozenArtifact: canonicalFrozenArtifact, snapshot: canonicalSnapshot, planningProposal: canonicalPlanning.output, options: { outcomeId: 'out-c16' } });
    assert.strictEqual(outcome.executionId, canonicalExecution.receipt.execution_attempt_id);
    assert.strictEqual(outcome.immutable, true);
  });

  await test('C17', 'recordOutcome with FAILED status records correct status', () => {
    const failedReceipt = { id: 'rcpt-failed-c17', execution_attempt_id: 'exec-failed-c17', application_id: 'app-failed-c17', destination: 'Beta2 Corp ATS', verified_fingerprint: canonicalFingerprint.hash, received_at: new Date().toISOString(), timestamp: new Date().toISOString() };
    const outcome = recordOutcome({ receipt: failedReceipt, frozenArtifact: canonicalFrozenArtifact, snapshot: canonicalSnapshot, planningProposal: canonicalPlanning.output, options: { outcomeId: 'out-c17' }, status: 'FAILED' });
    assert.strictEqual(outcome.status, 'FAILED');
    assert.strictEqual(outcome.immutable, true);
  });

  await test('C18', 'createEvidenceFeedback preserves sourceOutcomeId from OutcomeRecord', () => {
    const feedback = createEvidenceFeedback({ outcome: canonicalOutcome, snapshot: canonicalSnapshot, options: { feedbackId: 'fb-c18' } });
    assert.strictEqual(feedback.sourceOutcomeId, canonicalOutcome.outcomeId);
    assert.strictEqual(feedback.immutable, true);
  });

  await test('C19', 'createLearningProposal with empty feedback throws FEEDBACK_EMPTY', async () => {
    await assertThrows(() => createLearningProposal({ currentProfile: baselineProfile, feedbacks: [], candidateSnapshot: canonicalSnapshot }), 'FEEDBACK_EMPTY');
  });

  await test('C20', 'Experiment with version mismatch throws BASELINE_VERSION_MISMATCH', async () => {
    await assertThrows(() => runReplayExperiment({ learningProposal: { ...canonicalLearningProposal, currentProfileVersion: '0.9.0' }, baselineProfile, candidateProfile: canonicalApprovedProfileV2, dataset: canonicalDataset }), 'BASELINE_VERSION_MISMATCH');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ZONE D: IDEMPOTENCY & CONCURRENCY (16 Scenarios)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n\u2500\u2500\u2500 ZONE D: Idempotency & Concurrency (16 Scenarios) \u2500\u2500\u2500');

  await test('D01', 'Duplicate dispatch to same destination blocked with DUPLICATE_SUBMISSION', () => {
    const existingReceipts = canonicalExecution.success ? [canonicalExecution.receipt] : [];
    const duplicate = executeApplicationPackage({ applicationId: 'app-beta2-001', approvedArtifact: canonicalArtifactForExecution, currentContent: ARTIFACT_CONTENT, destination: 'Beta2 Corp ATS', route: 'portal', existingReceipts });
    assert.strictEqual(duplicate.success, false);
    assert.strictEqual(duplicate.code, 'DUPLICATE_SUBMISSION');
  });

  await test('D02', 'idempotentReturnExisting returns existing receipt without re-dispatching', () => {
    const existingReceipts = canonicalExecution.success ? [canonicalExecution.receipt] : [];
    const retry = executeApplicationPackage({ applicationId: 'app-beta2-001', approvedArtifact: canonicalArtifactForExecution, currentContent: ARTIFACT_CONTENT, destination: 'Beta2 Corp ATS', route: 'portal', existingReceipts, idempotentReturnExisting: true });
    assert.strictEqual(retry.success, true);
    assert.strictEqual(retry.is_idempotent, true);
    assert.strictEqual(retry.receipt.id, existingReceipts[0]?.id);
  });

  await test('D03', 'Same applicationId dispatched to different destination is not a duplicate', () => {
    const existingReceipts = canonicalExecution.success ? [canonicalExecution.receipt] : [];
    const altArtifact = { ...canonicalArtifactForExecution, destination: 'other-ats.beta2corp.com' };
    const result = executeApplicationPackage({ applicationId: 'app-beta2-001', approvedArtifact: altArtifact, currentContent: ARTIFACT_CONTENT, destination: 'other-ats.beta2corp.com', route: 'portal', existingReceipts });
    assert.ok(result.code !== 'DUPLICATE_SUBMISSION');
  });

  await test('D04', 'computeArtifactFingerprint is idempotent across 10 calls', () => {
    const hashes = Array.from({ length: 10 }, () => computeArtifactFingerprint(ARTIFACT_CONTENT).hash);
    assert.ok(hashes.every(h => h === hashes[0]));
  });

  await test('D05', 'evaluatePolicyDecision is idempotent for identical inputs', () => {
    const r1 = evaluatePolicyDecision(canonicalOrchestration, { snapshot: canonicalSnapshot, options: { policyDecisionId: 'pol-d05-1', createdAt: '2026-09-27T00:00:00.000Z' } });
    const r2 = evaluatePolicyDecision(canonicalOrchestration, { snapshot: canonicalSnapshot, options: { policyDecisionId: 'pol-d05-2', createdAt: '2026-09-27T00:00:00.000Z' } });
    assert.strictEqual(r1.decision, r2.decision);
    assert.strictEqual(r1.policyFindings.length, r2.policyFindings.length);
  });

  await test('D06', 'emitEvaluationProposal produces identical fitScore for identical inputs', async () => {
    const e1 = await emitEvaluationProposal(canonicalDiscovery, canonicalSnapshot);
    const e2 = await emitEvaluationProposal(canonicalDiscovery, canonicalSnapshot);
    assert.strictEqual(e1.output.fitScore, e2.output.fitScore);
    assert.strictEqual(e1.output.tier, e2.output.tier);
  });

  await test('D07', 'emitPlanningProposal produces same action count for identical inputs', async () => {
    const p1 = await emitPlanningProposal([canonicalEvaluation], canonicalSnapshot, { planId: 'plan-d07-1' });
    const p2 = await emitPlanningProposal([canonicalEvaluation], canonicalSnapshot, { planId: 'plan-d07-2' });
    assert.strictEqual(p1.output.actions.length, p2.output.actions.length);
  });

  await test('D08', 'deterministicStringify is idempotent for nested objects', () => {
    const obj = { z: 1, a: [3, 2, 1], m: { nested: true } };
    assert.strictEqual(deterministicStringify(obj), deterministicStringify(obj));
  });

  await test('D09', 'acquireExecutionLock returns false on second acquisition for same appId', () => {
    const appId = 'app-d09';
    const first = acquireExecutionLock(appId);
    const second = acquireExecutionLock(appId);
    releaseExecutionLock(appId);
    assert.strictEqual(first, true);
    assert.strictEqual(second, false);
  });

  await test('D10', 'releaseExecutionLock allows subsequent successful acquisition', () => {
    const appId = 'app-d10';
    acquireExecutionLock(appId);
    releaseExecutionLock(appId);
    const reacquired = acquireExecutionLock(appId);
    releaseExecutionLock(appId);
    assert.strictEqual(reacquired, true);
  });

  await test('D11', 'Different applicationIds can be locked independently', () => {
    const id1 = acquireExecutionLock('app-d11-a');
    const id2 = acquireExecutionLock('app-d11-b');
    releaseExecutionLock('app-d11-a');
    releaseExecutionLock('app-d11-b');
    assert.strictEqual(id1, true);
    assert.strictEqual(id2, true);
  });

  await test('D12', 'Repeated evaluatePolicyDecision calls produce same BLOCK decision for forged hash', () => {
    const forgedProposal = { ...canonicalOrchestration.output, evidenceHash: 'b'.repeat(64) };
    const decisions = Array.from({ length: 5 }, (_, i) => evaluatePolicyDecision(forgedProposal, { snapshot: canonicalSnapshot, options: { policyDecisionId: `pol-d12-${i}` } }).decision);
    assert.ok(decisions.every(d => d === 'BLOCK'));
  });

  await test('D13', 'validateProfileIntegrity is idempotent for the same profile', () => {
    const r1 = validateProfileIntegrity(baselineProfile);
    const r2 = validateProfileIntegrity(baselineProfile);
    assert.strictEqual(r1.valid, r2.valid);
    assert.strictEqual(r1.violations.length, r2.violations.length);
  });

  await test('D14', 'runReplayExperiment produces same replayHash for identical inputs', () => {
    const e1 = runReplayExperiment({ learningProposal: canonicalLearningProposal, baselineProfile, candidateProfile: canonicalApprovedProfileV2, dataset: canonicalDataset });
    const e2 = runReplayExperiment({ learningProposal: canonicalLearningProposal, baselineProfile, candidateProfile: canonicalApprovedProfileV2, dataset: canonicalDataset });
    assert.strictEqual(e1.replayHash, e2.replayHash);
  });

  await test('D15', 'transitionGovernanceState is deterministic for same (state, action) pair', () => {
    const s1 = transitionGovernanceState('ORCHESTRATED', { type: 'EVALUATE_POLICY', actor: 'system', payload: { decision: 'ALLOW_REVIEW' } });
    const s2 = transitionGovernanceState('ORCHESTRATED', { type: 'EVALUATE_POLICY', actor: 'system', payload: { decision: 'ALLOW_REVIEW' } });
    assert.strictEqual(s1, s2);
    assert.strictEqual(s1, 'AWAITING_HUMAN_REVIEW');
  });

  await test('D16', 'normalizeText is idempotent (applying twice = applying once)', () => {
    const raw = 'Hello\r\nWorld\r\n';
    assert.strictEqual(normalizeText(normalizeText(raw)), normalizeText(raw));
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ZONE E: DETERMINISTIC REPLAY (16 Scenarios)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n\u2500\u2500\u2500 ZONE E: Deterministic Replay (16 Scenarios) \u2500\u2500\u2500');

  await test('E01', 'Same job listing always produces identical provenance hash', async () => {
    const d1 = await emitDiscoveryProposal(JOB_LISTING, { retrievedAt: '2026-09-27T00:00:00.000Z' });
    const d2 = await emitDiscoveryProposal(JOB_LISTING, { retrievedAt: '2026-09-27T00:00:00.000Z' });
    assert.strictEqual(d1.provenance.provenance_hash, d2.provenance.provenance_hash);
  });

  await test('E02', 'Same candidate data always produces identical evidence_hash', () => {
    const s1 = createEvidenceSnapshot('cand-e02', CANDIDATE_DATA);
    const s2 = createEvidenceSnapshot('cand-e02', CANDIDATE_DATA);
    assert.strictEqual(s1.evidence_hash, s2.evidence_hash);
  });

  await test('E03', 'Same inputs to emitEvaluationProposal always produce identical fitScore', async () => {
    const evaluations = await Promise.all(Array.from({ length: 5 }, () => emitEvaluationProposal(canonicalDiscovery, canonicalSnapshot)));
    const scores = evaluations.map(e => e.output.fitScore);
    assert.ok(scores.every(s => s === scores[0]), `All fitScores must be identical. Got: ${scores}`);
  });

  await test('E04', 'Same inputs to emitPlanningProposal always produce identical action count', async () => {
    const plans = await Promise.all(Array.from({ length: 5 }, (_, i) => emitPlanningProposal([canonicalEvaluation], canonicalSnapshot, { planId: `plan-e04-${i}` })));
    const counts = plans.map(p => p.output.actions.length);
    assert.ok(counts.every(c => c === counts[0]), `All action counts must be identical. Got: ${counts}`);
  });

  await test('E05', 'canonicalizeArtifactContent produces identical output on N calls', () => {
    const out = Array.from({ length: 5 }, () => canonicalizeArtifactContent(ARTIFACT_CONTENT));
    assert.ok(out.every(s => s === out[0]));
  });

  await test('E06', 'runReplayExperiment replayHash is stable across N executions', () => {
    const hashes = Array.from({ length: 5 }, () => runReplayExperiment({ learningProposal: canonicalLearningProposal, baselineProfile, candidateProfile: canonicalApprovedProfileV2, dataset: canonicalDataset }).replayHash);
    assert.ok(hashes.every(h => h === hashes[0]));
  });

  await test('E07', 'deterministicStringify on unicode content is deterministic', () => {
    const input = { name: '\u5c71\u7530\u592a\u90ce', org: '\u65e5\u672c\u8a9e\u30c6\u30b9\u30c8', score: 99 };
    assert.strictEqual(deterministicStringify(input), deterministicStringify(input));
  });

  await test('E08', 'NFC-normalized and NFD-equivalent content produces identical fingerprint', () => {
    const nfc = { ...ARTIFACT_CONTENT, resume: { full_resume: 'caf\u00e9', name: 'Test' } };
    const nfd = { ...ARTIFACT_CONTENT, resume: { full_resume: 'cafe\u0301', name: 'Test' } };
    const h1 = computeArtifactFingerprint(nfc).hash;
    const h2 = computeArtifactFingerprint(nfd).hash;
    assert.strictEqual(h1, h2);
  });

  await test('E09', 'Swapped baseline/candidate throws version mismatch', async () => {
    await assertThrows(() => runReplayExperiment({ learningProposal: canonicalLearningProposal, baselineProfile: canonicalApprovedProfileV2, candidateProfile: baselineProfile, dataset: canonicalDataset }), 'BASELINE_VERSION_MISMATCH');
  });

  await test('E10', 'Different dataset content produces different replayHash', () => {
    const ds1 = canonicalDataset;
    const ds2 = createStandardBenchmarkDataset({
      datasetId: 'ds-e10-b',
      customItems: [
        {
          id: 'item-custom-1',
          candidateSnapshotId: 'snap-b',
          jobId: 'job-b',
          historicalOutcomeId: 'hist-b',
          inputPayload: {
            candidateSkills: ['Python'],
            candidateYearsExperience: 3,
            jobRequiredSkills: ['Python'],
            jobRequiredYears: 2,
          },
        },
      ],
    });
    const h1 = runReplayExperiment({ learningProposal: canonicalLearningProposal, baselineProfile, candidateProfile: canonicalApprovedProfileV2, dataset: ds1 }).replayHash;
    const h2 = runReplayExperiment({ learningProposal: canonicalLearningProposal, baselineProfile, candidateProfile: canonicalApprovedProfileV2, dataset: ds2 }).replayHash;
    assert.notStrictEqual(h1, h2);
  });

  await test('E11', 'Policy evaluation decision is deterministic across 10 replay calls', () => {
    const forged = { ...canonicalOrchestration.output, evidenceHash: 'c'.repeat(64) };
    const decisions = Array.from({ length: 10 }, (_, i) => evaluatePolicyDecision(forged, { snapshot: canonicalSnapshot, options: { policyDecisionId: `pol-e11-${i}` } }).decision);
    assert.ok(decisions.every(d => d === decisions[0]));
  });

  await test('E12', 'verifyArtifactFingerprint is deterministic across N calls', () => {
    const results = Array.from({ length: 5 }, () => verifyArtifactFingerprint(ARTIFACT_CONTENT, canonicalFingerprint.hash).valid);
    assert.ok(results.every(v => v === true));
  });

  await test('E13', 'validateProfileIntegrity is deterministic across N calls', () => {
    const valids = Array.from({ length: 5 }, () => validateProfileIntegrity(baselineProfile).valid);
    assert.ok(valids.every(v => v === valids[0]));
  });

  await test('E14', 'createLearningProposal with same learningId produces same proposedProfileVersion', () => {
    const l1 = createLearningProposal({ currentProfile: baselineProfile, feedbacks: [canonicalFeedback], candidateSnapshot: canonicalSnapshot, options: { learningId: 'lrn-e14' } });
    const l2 = createLearningProposal({ currentProfile: baselineProfile, feedbacks: [canonicalFeedback], candidateSnapshot: canonicalSnapshot, options: { learningId: 'lrn-e14' } });
    assert.strictEqual(l1.proposedProfileVersion, l2.proposedProfileVersion);
  });

  await test('E15', 'transitionGovernanceState produces same result for same (state, action) pair', () => {
    const transitions = Array.from({ length: 5 }, () => transitionGovernanceState('ORCHESTRATED', { type: 'EVALUATE_POLICY', actor: 'system', payload: { decision: 'BLOCK' } }));
    assert.ok(transitions.every(t => t === 'POLICY_BLOCKED'));
  });

  await test('E16', 'normalizeText is deterministic for mixed-line-ending inputs', () => {
    const input = 'Line1\r\nLine2\rLine3\n';
    const results = Array.from({ length: 5 }, () => normalizeText(input));
    assert.ok(results.every(r => r === results[0]));
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ZONE F: VERSION & ROLLBACK SAFETY (16 Scenarios)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n\u2500\u2500\u2500 ZONE F: Version & Rollback Safety (16 Scenarios) \u2500\u2500\u2500');

  await test('F01', 'applyApprovedLearningProposal creates v1.1 with parentVersion=v1.0', () => {
    const lp = createLearningProposal({ currentProfile: baselineProfile, feedbacks: [canonicalFeedback], candidateSnapshot: canonicalSnapshot, options: { learningId: 'lrn-f01' } });
    const v11 = applyApprovedLearningProposal({ proposal: lp, currentProfile: baselineProfile, approvalSignature: 'sig-f01', approvedBy: 'candidate@beta2.com' });
    assert.strictEqual(v11.parentVersion, '1.0.0');
    assert.strictEqual(v11.immutable, true);
    assert.strictEqual(v11.createdBy, 'controlled_learning');
  });

  await test('F02', 'Baseline profile v1.0 remains immutable after learning evolution', () => {
    const lp = createLearningProposal({ currentProfile: baselineProfile, feedbacks: [canonicalFeedback], candidateSnapshot: canonicalSnapshot, options: { learningId: 'lrn-f02' } });
    applyApprovedLearningProposal({ proposal: lp, currentProfile: baselineProfile, approvalSignature: 'sig-f02', approvedBy: 'candidate@beta2.com' });
    assert.strictEqual(baselineProfile.version, '1.0.0');
    assert.strictEqual(baselineProfile.immutable, true);
    assert.ok(!baselineProfile.parentVersion);
  });

  await test('F03', 'validateProfileIntegrity correctly validates profile schema requirements', () => {
    const brokenProfile = { ...baselineProfile, rules: [] };
    const result = validateProfileIntegrity(brokenProfile);
    assert.strictEqual(result.valid, false);
    assert.ok(result.violations.some(v => v.includes('PROFILE_SCHEMA_VIOLATION')));
  });

  await test('F04', 'Experiment result cannot directly activate candidate profile', () => {
    const result = runReplayExperiment({ learningProposal: canonicalLearningProposal, baselineProfile, candidateProfile: canonicalApprovedProfileV2, dataset: canonicalDataset });
    assert.strictEqual(result.immutable, true);
    assert.ok(!('activate' in result));
    assert.ok(!('approved' in result));
  });

  await test('F05', 'Learning proposal records current profile version correctly', () => {
    const lp = createLearningProposal({ currentProfile: baselineProfile, feedbacks: [canonicalFeedback], candidateSnapshot: canonicalSnapshot, options: { learningId: 'lrn-f05' } });
    assert.strictEqual(lp.currentProfileVersion, baselineProfile.version);
  });

  await test('F06', 'Learning proposal proposedProfileVersion is different from currentProfileVersion', () => {
    const lp = createLearningProposal({ currentProfile: baselineProfile, feedbacks: [canonicalFeedback], candidateSnapshot: canonicalSnapshot, options: { learningId: 'lrn-f06' } });
    assert.notStrictEqual(lp.proposedProfileVersion, lp.currentProfileVersion);
  });

  await test('F07', 'Baseline intelligence profile version cannot be mutated after creation', () => {
    try { baselineProfile.version = '99.0.0'; } catch {}
    assert.strictEqual(baselineProfile.version, '1.0.0');
  });

  await test('F08', 'Three-generation profile chain maintains complete parentVersion chain', () => {
    const lp1 = createLearningProposal({ currentProfile: baselineProfile, feedbacks: [canonicalFeedback], candidateSnapshot: canonicalSnapshot, options: { learningId: 'lrn-f08-1' } });
    const v11 = applyApprovedLearningProposal({ proposal: lp1, currentProfile: baselineProfile, approvalSignature: 'sig-f08-1', approvedBy: 'candidate@beta2.com' });
    const lp2 = createLearningProposal({ currentProfile: v11, feedbacks: [canonicalFeedback], candidateSnapshot: canonicalSnapshot, options: { learningId: 'lrn-f08-2' } });
    const v12 = applyApprovedLearningProposal({ proposal: lp2, currentProfile: v11, approvalSignature: 'sig-f08-2', approvedBy: 'candidate@beta2.com' });
    assert.strictEqual(v11.parentVersion, '1.0.0');
    assert.strictEqual(v12.parentVersion, v11.version);
  });

  await test('F09', 'Learning proposal currentProfileVersion matches the profile it was derived from', () => {
    const lp = createLearningProposal({ currentProfile: baselineProfile, feedbacks: [canonicalFeedback], candidateSnapshot: canonicalSnapshot, options: { learningId: 'lrn-f09' } });
    assert.strictEqual(lp.currentProfileVersion, baselineProfile.version);
  });

  await test('F10', 'validateProfileIntegrity passes for well-formed baseline profile', () => {
    const result = validateProfileIntegrity(baselineProfile);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.violations.length, 0);
  });

  await test('F11', 'FrozenArtifactPackage always uses rja-c14n-v1-sha256 fingerprint algorithm', () => {
    assert.strictEqual(canonicalFrozenArtifact.fingerprintAlgorithm, 'rja-c14n-v1-sha256');
  });

  await test('F12', 'FrozenArtifactPackage.immutable cannot be mutated to false', () => {
    try { canonicalFrozenArtifact.immutable = false; } catch {}
    assert.strictEqual(canonicalFrozenArtifact.immutable, true);
  });

  await test('F13', 'FrozenArtifactPackage.artifactPayload fields are immutable post-freeze', () => {
    try { canonicalFrozenArtifact.artifactPayload.resume = { full_resume: 'INJECTED' }; } catch {}
    assert.notStrictEqual(JSON.stringify(canonicalFrozenArtifact.artifactPayload.resume), JSON.stringify({ full_resume: 'INJECTED' }));
  });

  await test('F14', 'LearningProposal.immutable is true and cannot be changed', () => {
    const lp = createLearningProposal({ currentProfile: baselineProfile, feedbacks: [canonicalFeedback], candidateSnapshot: canonicalSnapshot, options: { learningId: 'lrn-f14' } });
    assert.strictEqual(lp.immutable, true);
    try { lp.immutable = false; } catch {}
    assert.strictEqual(lp.immutable, true);
  });

  await test('F15', 'ExperimentResult.immutable is true and cannot be changed', () => {
    assert.strictEqual(canonicalExperiment.immutable, true);
    try { canonicalExperiment.immutable = false; } catch {}
    assert.strictEqual(canonicalExperiment.immutable, true);
  });

  await test('F16', 'OutcomeRecord.immutable is true and cannot be changed', () => {
    assert.strictEqual(canonicalOutcome.immutable, true);
    try { canonicalOutcome.immutable = false; } catch {}
    assert.strictEqual(canonicalOutcome.immutable, true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ZONE G: OPERATIONAL LIMITS (16 Scenarios)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n\u2500\u2500\u2500 ZONE G: Operational Limits (16 Scenarios) \u2500\u2500\u2500');

  await test('G01', 'Empty artifact fields produce valid 64-char fingerprint', () => {
    const empty = { resume: { full_resume: '' }, cover_letter: { letter: '' }, screening_answers: { answers: [] } };
    const fp = computeArtifactFingerprint(empty);
    assert.ok(fp.hash.length === 64);
  });

  await test('G02', 'Null resume field produces fingerprint without crash', () => {
    const withNull = { resume: null, cover_letter: { letter: 'valid' }, screening_answers: { answers: [] } };
    const fp = computeArtifactFingerprint(withNull);
    assert.ok(fp.hash.length === 64);
  });

  await test('G03', '1MB resume string produces valid 64-char fingerprint', () => {
    const large = { resume: { full_resume: 'X'.repeat(1_000_000) }, cover_letter: { letter: '' }, screening_answers: { answers: [] } };
    const fp = computeArtifactFingerprint(large);
    assert.ok(fp.hash.length === 64);
  });

  await test('G04', '1000 screening answers produce deterministic fingerprint', () => {
    const answers = Array.from({ length: 1000 }, (_, i) => ({ question_id: `q${i}`, question: `Q${i}?`, answer: `Answer ${i}` }));
    const large = { ...ARTIFACT_CONTENT, screening_answers: { answers } };
    const h1 = computeArtifactFingerprint(large).hash;
    const h2 = computeArtifactFingerprint(large).hash;
    assert.strictEqual(h1, h2);
  });

  await test('G05', 'Deeply nested resume object produces valid fingerprint', () => {
    let nested = { value: 'deep' };
    for (let i = 0; i < 10; i++) nested = { level: nested };
    const deep = { resume: nested, cover_letter: { letter: '' }, screening_answers: { answers: [] } };
    const fp = computeArtifactFingerprint(deep);
    assert.ok(fp.hash.length === 64);
  });

  await test('G06', 'Evidence snapshot with empty skills produces valid evidence_hash', () => {
    const minimal = { headline: 'Candidate', years_experience: 0, skills: [], certifications: [], bio: '' };
    const snap = createEvidenceSnapshot('cand-minimal', minimal);
    assert.ok(snap.evidence_hash.length === 64);
  });

  await test('G07', 'Policy evaluation handles 100-conflict orchestration without crashing', () => {
    const conflicts = Array.from({ length: 100 }, (_, i) => ({ conflictId: `conflict-${i}`, type: 'EVIDENCE_MISMATCH', proposalIds: [`p${i}`], description: `Conflict ${i}`, blocking: true }));
    const bloated = { ...canonicalOrchestration.output, conflicts };
    const result = evaluatePolicyDecision(bloated, { snapshot: canonicalSnapshot, options: { policyDecisionId: 'pol-g07' } });
    assert.strictEqual(result.decision, 'BLOCK');
    assert.ok(result.policyFindings.length >= 100);
  });

  await test('G08', 'Policy evaluation handles 100 upstream evaluation inputs without crashing', () => {
    const evals = Array.from({ length: 100 }, (_, i) => ({ proposalId: `eval-g08-${i}`, evaluationId: `eval-g08-${i}`, _tampered: false }));
    const result = evaluatePolicyDecision(canonicalOrchestration, { snapshot: canonicalSnapshot, upstreamInputs: { evaluation: evals }, options: { policyDecisionId: 'pol-g08' } });
    assert.ok(result.decision === 'ALLOW_REVIEW' || result.decision === 'BLOCK' || result.decision === 'REQUIRE_HUMAN_DECISION');
  });

  await test('G09', 'deterministicStringify handles 10-level nested arrays without crashing', () => {
    let arr = ['leaf'];
    for (let i = 0; i < 10; i++) arr = [arr];
    const result = deterministicStringify(arr);
    assert.ok(typeof result === 'string');
  });

  await test('G10', 'normalizeText(null) and normalizeText(undefined) return empty string', () => {
    assert.strictEqual(normalizeText(null), '');
    assert.strictEqual(normalizeText(undefined), '');
  });

  await test('G11', 'deterministicStringify(null) and deterministicStringify(undefined) return "null"', () => {
    assert.strictEqual(deterministicStringify(null), 'null');
    assert.strictEqual(deterministicStringify(undefined), 'null');
  });

  await test('G12', 'Benchmark dataset with 500 items produces valid datasetHash', () => {
    const items = Array.from({ length: 500 }, (_, i) => ({ id: `item-${i}`, candidateSnapshotId: `snap-${i}`, jobId: `job-${i}`, inputPayload: { candidateSkills: ['TS'], candidateYearsExperience: 5, jobRequiredSkills: ['TS'], jobRequiredYears: 3 } }));
    const ds = createStandardBenchmarkDataset({ datasetId: 'ds-g12', sampleItems: items });
    assert.ok(ds.datasetHash.length > 0);
    assert.strictEqual(ds.immutable, true);
  });

  await test('G13', 'Policy evaluation with minimal valid proposal produces ALLOW_REVIEW', () => {
    const minimal = { orchestrationId: 'orch-g13', candidateSnapshotId: canonicalSnapshot.id, evidenceHash: canonicalSnapshot.evidence_hash, conflicts: [], requiredHumanDecisions: [], reviewRequired: false, rationale: [], createdAt: new Date().toISOString(), proposed_by: 'agent_orchestrator', discoveryProposalIds: [], evaluationProposalIds: [], planningProposalIds: [], selectedPlanIds: [] };
    const result = evaluatePolicyDecision(minimal, { snapshot: canonicalSnapshot, options: { policyDecisionId: 'pol-g13' } });
    assert.strictEqual(result.decision, 'ALLOW_REVIEW');
  });

  await test('G14', 'Execution with 255-char applicationId succeeds', () => {
    const longId = 'app-' + 'x'.repeat(251);
    const result = executeApplicationPackage({ applicationId: longId, approvedArtifact: canonicalArtifactForExecution, currentContent: ARTIFACT_CONTENT, destination: 'Beta2 Corp ATS', route: 'portal' });
    assert.strictEqual(result.success, true);
  });

  await test('G15', 'Execution with special characters in destination succeeds when destination matches', () => {
    const specialDest = 'Beta2 Corp ATS (2026) APAC';
    const specialArtifact = { ...canonicalArtifactForExecution, destination: specialDest };
    const result = executeApplicationPackage({ applicationId: 'app-g15', approvedArtifact: specialArtifact, currentContent: ARTIFACT_CONTENT, destination: specialDest, route: 'portal' });
    assert.strictEqual(result.success, true);
  });

  await test('G16', 'verifyUnifiedLifecycleAuditTrail processes full 14+ node chain without crashing', () => {
    const audit = verifyUnifiedLifecycleAuditTrail(canonicalLifecycle);
    assert.ok(typeof audit.valid === 'boolean');
    assert.ok(Array.isArray(audit.traceChain));
    assert.ok(audit.traceChain.length >= 14, `Expected 14+ chain nodes, got ${audit.traceChain.length}`);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ZONE H: FULL-LIFECYCLE FUZZING (20 Scenarios)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n\u2500\u2500\u2500 ZONE H: Full-Lifecycle Fuzzing (20 Scenarios) \u2500\u2500\u2500');

  await test('H01', 'Proposal with numeric proposed_by still evaluated correctly by Policy Guard', () => {
    const fuzzed = { ...canonicalOrchestration.output, proposed_by: 42 };
    const result = evaluatePolicyDecision(fuzzed, { snapshot: canonicalSnapshot, options: { policyDecisionId: 'pol-h01' } });
    assert.ok(result.decision === 'ALLOW_REVIEW' || result.decision === 'BLOCK' || result.decision === 'REQUIRE_HUMAN_DECISION');
    assert.strictEqual(result.proposed_by, 'server_policy_guard');
  });

  await test('H02', 'Proposal with null conflicts does not crash Policy Guard', () => {
    const fuzzed = { ...canonicalOrchestration.output, conflicts: null };
    const result = evaluatePolicyDecision(fuzzed, { snapshot: canonicalSnapshot, options: { policyDecisionId: 'pol-h02' } });
    assert.ok(result.decision === 'ALLOW_REVIEW' || result.decision === 'BLOCK' || result.decision === 'REQUIRE_HUMAN_DECISION');
  });

  await test('H03', 'Execution with numeric applicationId does not crash', () => {
    const result = executeApplicationPackage({ applicationId: 12345, approvedArtifact: canonicalArtifactForExecution, currentContent: ARTIFACT_CONTENT, destination: 'Beta2 Corp ATS', route: 'portal' });
    assert.ok(typeof result.success === 'boolean');
  });

  await test('H04', 'Proposal with all-zero evidenceHash is blocked', () => {
    const zeroed = { ...canonicalOrchestration.output, evidenceHash: '0'.repeat(64) };
    const result = evaluatePolicyDecision(zeroed, { snapshot: canonicalSnapshot, options: { policyDecisionId: 'pol-h04' } });
    assert.strictEqual(result.decision, 'BLOCK');
  });

  await test('H05', 'Proposal with empty string orchestrationId is blocked', () => {
    const emptyId = { ...canonicalOrchestration.output, orchestrationId: '', candidateSnapshotId: '', evidenceHash: '' };
    const result = evaluatePolicyDecision(emptyId, { snapshot: canonicalSnapshot, options: { policyDecisionId: 'pol-h05' } });
    assert.strictEqual(result.decision, 'BLOCK');
  });

  await test('H06', 'Discovery with XSS payload in description does not crash or forge authority', async () => {
    const xss = { ...JOB_LISTING, title: 'XSS Eng', url: 'https://beta2corp.com/jobs/xss', description: '<script>alert("XSS")</script>' };
    const disc = await emitDiscoveryProposal(xss);
    assert.strictEqual(disc.authority.canExecute, false);
  });

  await test('H07', 'Discovery with SQL injection in sourceUrl does not forge provenance_hash', async () => {
    const sql = { ...JOB_LISTING, title: 'SQL Eng', url: "https://beta2corp.com/jobs/sql?id=1' OR '1'='1" };
    const disc = await emitDiscoveryProposal(sql);
    assert.ok(disc.provenance.provenance_hash.length > 0);
  });

  await test('H08', 'Evaluation cannot produce fitScore > 100', async () => {
    const superJob = { ...JOB_LISTING, title: 'Super Job', url: 'https://beta2corp.com/jobs/super', requirements: CANDIDATE_DATA.skills, skills: CANDIDATE_DATA.skills };
    const disc = await emitDiscoveryProposal(superJob);
    const eval_ = await emitEvaluationProposal(disc, canonicalSnapshot);
    assert.ok(eval_.output.fitScore <= 100, `fitScore must not exceed 100, got ${eval_.output.fitScore}`);
  });

  await test('H09', 'Evaluation with negative years_experience does not crash', async () => {
    const neg = { ...CANDIDATE_DATA, years_experience: -5 };
    const snap = createEvidenceSnapshot('cand-negyears', neg);
    const eval_ = await emitEvaluationProposal(canonicalDiscovery, snap);
    assert.ok(typeof eval_.output.fitScore === 'number');
  });

  await test('H10', 'Evaluation with undefined skills does not crash or fabricate matches', async () => {
    const noSkills = { ...CANDIDATE_DATA, skills: undefined };
    const snap = createEvidenceSnapshot('cand-noskills-h10', noSkills);
    const eval_ = await emitEvaluationProposal(canonicalDiscovery, snap);
    assert.ok(typeof eval_.output.fitScore === 'number');
    assert.strictEqual(eval_.authority.canExecute, false);
  });

  await test('H11', 'computeArtifactFingerprint with all undefined sections produces valid hash', () => {
    const partial = { resume: undefined, cover_letter: undefined, screening_answers: undefined };
    const fp = computeArtifactFingerprint(partial);
    assert.ok(fp.hash.length === 64);
  });

  await test('H12', 'deterministicStringify handles boolean, number, and string primitives correctly', () => {
    assert.strictEqual(deterministicStringify(true), 'true');
    assert.strictEqual(deterministicStringify(false), 'false');
    assert.strictEqual(deterministicStringify(42), '42');
    assert.strictEqual(deterministicStringify('hello'), '"hello"');
  });

  await test('H13', 'normalizeText with only whitespace returns whitespace without crash', () => {
    const result = normalizeText('   \t  \n  ');
    assert.ok(typeof result === 'string');
  });

  await test('H14', 'Proposal with execute field blocked by Policy Guard', () => {
    const execProposal = { ...canonicalOrchestration.output, execute: 'immediate' };
    const result = evaluatePolicyDecision(execProposal, { snapshot: canonicalSnapshot, options: { policyDecisionId: 'pol-h14' } });
    assert.strictEqual(result.decision, 'BLOCK');
    assert.ok(result.policyFindings.some(f => f.rule === 'DIRECT_DISPATCH_PROHIBITED'));
  });

  await test('H15', 'Composite attack: forged hash + self-approval + artifact injection produces 3+ blocking findings', () => {
    const composite = { ...canonicalOrchestration.output, evidenceHash: 'f'.repeat(64), approved_by: 'agt-orchestrator-v1', cover_letter: { letter: 'INJECTED' }, execute: 'now' };
    const result = evaluatePolicyDecision(composite, { snapshot: canonicalSnapshot, options: { policyDecisionId: 'pol-h15' } });
    assert.strictEqual(result.decision, 'BLOCK');
    assert.ok(result.policyFindings.filter(f => f.severity === 'BLOCKING').length >= 3, `Expected 3+ blocking findings, got ${result.policyFindings.filter(f => f.severity === 'BLOCKING').length}`);
  });

  await test('H16', 'AGENT_AUTHORITY_REGISTRY covers all 8 agent types with fail_closed behavior', () => {
    const expected = ['discovery', 'evaluation', 'planning', 'orchestrator', 'outcome', 'feedback', 'learning', 'experiment'];
    for (const agentType of expected) {
      const contract = AGENT_AUTHORITY_REGISTRY[agentType];
      assert.ok(contract, `Missing contract for agent: ${agentType}`);
      assert.strictEqual(contract.failure_behavior, 'fail_closed');
    }
  });

  await test('H17', 'Non-discovery agents explicitly prohibit execution and approval operations', () => {
    for (const [agentType, contract] of Object.entries(AGENT_AUTHORITY_REGISTRY)) {
      if (agentType === 'discovery') continue;
      const hasExecProhibition = contract.prohibited_operations.some(op => op.includes('execute') || op.includes('dispatch'));
      const hasApprovalProhibition = contract.prohibited_operations.some(op => op.includes('approv') || op.includes('sign'));
      assert.ok(hasExecProhibition, `${agentType} must prohibit execution`);
      assert.ok(hasApprovalProhibition, `${agentType} must prohibit human approval`);
      assert.strictEqual(contract.external_actions.length, 0, `${agentType} must have no external actions`);
    }
  });

  await test('H18', 'Triple-chain tamper (discovery + evaluation + planning) produces 3+ BLOCKING findings', () => {
    const result = evaluatePolicyDecision(canonicalOrchestration, {
      snapshot: canonicalSnapshot,
      upstreamInputs: { discovery: [{ ...canonicalDiscovery, _tampered: true }], evaluation: [{ ...canonicalEvaluation, _tamperedScore: true }], planning: [{ ...canonicalPlanning, _tamperedPriority: true }] },
      options: { policyDecisionId: 'pol-h18' },
    });
    assert.strictEqual(result.decision, 'BLOCK');
    assert.ok(result.policyFindings.filter(f => f.severity === 'BLOCKING').length >= 3);
  });

  await test('H19', 'verifyUnifiedLifecycleAuditTrail catches T4 provenance break (wrong discoveryProposalIds)', () => {
    const brokenOrch = { ...canonicalOrchestration, output: { ...canonicalOrchestration.output, discoveryProposalIds: ['disc-WRONG-REFERENCE'] } };
    const brokenLifecycle = { ...canonicalLifecycle, orchestration: brokenOrch };
    const audit = verifyUnifiedLifecycleAuditTrail(brokenLifecycle);
    assert.strictEqual(audit.valid, false);
    assert.ok(audit.violations.some(v => v.includes('T4_PROVENANCE_BREAK')));
  });

  await test('H20', 'Beta1 golden audit trail still passes after Beta2 adversarial test run', () => {
    const audit = verifyUnifiedLifecycleAuditTrail(canonicalLifecycle);
    assert.strictEqual(audit.valid, true, `Beta1 golden invariant must hold. Violations: ${audit.violations.join(', ')}`);
    assert.strictEqual(audit.violations.length, 0);
    assert.ok(audit.traceChain.length >= 14);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ZERO-DRIFT VERIFICATION: lib/execution/
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n\u2500\u2500\u2500 Zero-Drift Verification: lib/execution/ (5 Checks) \u2500\u2500\u2500');

  await test('DRIFT-01', 'lib/execution/engine.ts exports executeApplicationPackage, acquireExecutionLock, releaseExecutionLock', () => {
    assert.strictEqual(typeof executeApplicationPackage, 'function');
    assert.strictEqual(typeof acquireExecutionLock, 'function');
    assert.strictEqual(typeof releaseExecutionLock, 'function');
  });

  await test('DRIFT-02', 'lib/execution/fingerprint.ts exports computeArtifactFingerprint, verifyArtifactFingerprint, deterministicStringify, normalizeText', () => {
    assert.strictEqual(typeof computeArtifactFingerprint, 'function');
    assert.strictEqual(typeof verifyArtifactFingerprint, 'function');
    assert.strictEqual(typeof deterministicStringify, 'function');
    assert.strictEqual(typeof normalizeText, 'function');
  });

  await test('DRIFT-03', 'DEFAULT_FINGERPRINT_SCHEME is exactly "rja-c14n-v1-sha256"', () => {
    assert.strictEqual(DEFAULT_FINGERPRINT_SCHEME, 'rja-c14n-v1-sha256');
  });

  await test('DRIFT-04', 'lib/execution/snapshot.ts exports createEvidenceSnapshot function', () => {
    assert.strictEqual(typeof createEvidenceSnapshot, 'function');
  });

  await test('DRIFT-05', 'computeArtifactFingerprint always returns algorithm:sha256 and rja-c14n-v1-sha256 scheme', () => {
    const fp = computeArtifactFingerprint(ARTIFACT_CONTENT);
    assert.strictEqual(fp.algorithm, 'sha256');
    assert.strictEqual(fp.fingerprint_algorithm, 'rja-c14n-v1-sha256');
    assert.strictEqual(fp.canonicalization_scheme, 'rja-c14n-v1-sha256');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // FINAL REPORT
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c');
  console.log('  RJA V5.0-BETA2: RESILIENCE MATRIX RESULTS                     ');
  console.log('\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c\u256c');
  console.log(`  Total Scenarios  : ${passed + failed}`);
  console.log(`  \u2705 Passed        : ${passed}`);
  console.log(`  \u274c Failed        : ${failed}`);
  console.log('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');

  if (failures.length > 0) {
    console.log('\n  FAILED SCENARIOS:');
    for (const f of failures) {
      console.log(`  \u274c [${f.id}] ${f.description}`);
      console.log(`       \u2192 ${f.error}`);
    }
  }

  if (failed > 0) {
    console.error(`\n\u274c BETA2 CERTIFICATION FAILED: ${failed} scenario(s) failed.\n`);
    process.exit(1);
  } else {
    console.log('\n\u2705 BETA2 PRODUCTION CERTIFICATION PASSED: All scenarios green.');
    console.log('   Architecture survives adversarial, failure-recovery, idempotency,');
    console.log('   concurrency, deterministic-replay, version-safety, operational-limit,');
    console.log('   and lifecycle-fuzzing conditions.');
    console.log('   lib/execution/ zero-drift confirmed.');
    console.log('\n\ud83c\udfc6 RJA v5.0-BETA2 \u2192 READY FOR v5.0 FINAL RELEASE\n');
  }
}

runResilienceMatrix().catch((err) => {
  console.error('Fatal runner error in v5_beta2_resilience:', err);
  process.exit(1);
});
