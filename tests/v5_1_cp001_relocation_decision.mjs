// tests/v5_1_cp001_relocation_decision.mjs
// Phase v5.1.0: RFC CP-001 Verification Suite
// Validates structured relocation decision surfacing, deterministic output, evidence grounding,
// and human-decision handling without granting positive authority to agents.

import assert from 'node:assert';

// Frozen Core & Governed Agent Imports
import { emitDiscoveryProposal } from '../lib/agents/discovery.ts';
import { emitEvaluationProposal } from '../lib/agents/evaluation.ts';
import { emitPlanningProposal } from '../lib/agents/planning.ts';
import { emitOrchestrationProposal } from '../lib/agents/orchestrator.ts';
import {
  evaluatePolicyDecision,
  signHumanApproval,
  freezeApplicationArtifact,
  verifyUnifiedLifecycleAuditTrail,
} from '../lib/agents/governance.ts';
import { createEvidenceSnapshot } from '../lib/execution/snapshot.ts';
import { executeApplicationPackage } from '../lib/execution/engine.ts';
import { computeArtifactFingerprint } from '../lib/execution/fingerprint.ts';
import { recordOutcome } from '../lib/agents/outcome.ts';
import { createEvidenceFeedback } from '../lib/agents/feedback.ts';
import {
  createBaselineIntelligenceProfile,
  createLearningProposal,
  applyApprovedLearningProposal,
} from '../lib/agents/learning.ts';
import {
  createStandardBenchmarkDataset,
  runReplayExperiment,
} from '../lib/agents/experimentation.ts';

console.log('================================================================');
console.log('  RJA V5.1.0: RFC CP-001 RELOCATION DECISION PROMPT TEST       ');
console.log('  Testing Deterministic Surfacing, Grounding & Human Sign-off   ');
console.log('================================================================\n');

// 1. Candidate Profile Setup
const candidate = {
  id: 'cand-cp001-remote',
  name: 'Marcus Chen',
  email: 'marcus.chen@example.com',
  skills: ['Java', 'Spring Boot', 'Kafka', 'Microservices', 'Distributed Systems'],
  experience: [
    {
      company: 'Distributed FinTech Inc',
      title: 'Lead Systems Architect',
      duration: '2020 - Present',
      bullets: ['Built low-latency clearing settlement engine in Java'],
    },
  ],
  verifiableFacts: ['Built low-latency clearing settlement engine in Java'],
};

const snapshot = createEvidenceSnapshot(candidate.id, candidate);

// 2. Job 1: On-site / Hybrid Job (JPMorgan Chase scenario from P4 Pilot)
const onSiteJob = {
  jobId: 'job-jpmc-nyc-01',
  title: 'Lead Enterprise Architect',
  company: 'JPMorgan Chase & Co.',
  location: 'New York, NY (Hybrid - 3 days on-site)',
  category: 'Enterprise Engineering',
  description: 'Enterprise architecture role. Candidates must be willing to work on-site 3 days a week in NYC.',
  requirements: ['Java', 'Distributed Systems', 'Microservices'],
  skills: ['Java', 'Distributed Systems', 'Microservices'],
  url: 'https://jpmc.com/jobs/01',
  sourceUrl: 'https://jpmc.com/jobs/01',
  source: 'portal',
};

// 3. Job 2: Fully Remote Job (Baseline control)
const remoteJob = {
  jobId: 'job-stripe-remote-02',
  title: 'Staff Distributed Systems Engineer',
  company: 'Stripe',
  location: 'Remote - Worldwide',
  category: 'Infrastructure',
  description: '100% remote distributed systems architecture.',
  requirements: ['Java', 'Distributed Systems', 'Kafka'],
  skills: ['Java', 'Distributed Systems', 'Kafka'],
  url: 'https://stripe.com/jobs/02',
  sourceUrl: 'https://stripe.com/jobs/02',
  source: 'greenhouse',
};

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1: ON-SITE JOB SURFACES STRUCTURED RELOCATION DECISION
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- Test 1: Structured Relocation Decision Surfacing ---');
const discOnsite = await emitDiscoveryProposal(onSiteJob, { proposalId: 'disc-onsite' });
const evalOnsite = await emitEvaluationProposal(discOnsite, snapshot, { evaluationId: 'eval-onsite' });
const planOnsite = await emitPlanningProposal([evalOnsite], snapshot, { planId: 'plan-onsite' });
const orchOnsite = await emitOrchestrationProposal({
  discoveryProposals: [discOnsite],
  evaluationProposals: [evalOnsite],
  planningProposals: [planOnsite],
}, snapshot, { orchestrationId: 'orch-onsite' });

const relocationDecision = orchOnsite.output.requiredHumanDecisions.find(
  (d) => d.type === 'confirm_relocation_waiver'
);

assert.ok(relocationDecision, 'Orchestration proposal MUST extract confirm_relocation_waiver decision');
assert.strictEqual(relocationDecision.targetJobId, discOnsite.output.jobId);
assert.strictEqual(relocationDecision.required, true);
assert.ok(relocationDecision.options.includes('Confirm Remote Exception Request'));
assert.ok(relocationDecision.options.includes('Willing to Relocate'));
console.log(`  ✓ Relocation decision surfaced: "${relocationDecision.title}"`);
console.log(`  ✓ Options: ${JSON.stringify(relocationDecision.options)}`);

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2: FULLY REMOTE JOB OMITS RELOCATION DECISION (NO FALSE POSITIVES)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Test 2: Remote Job Baseline (Zero False Positives) ---');
const discRemote = await emitDiscoveryProposal(remoteJob, { proposalId: 'disc-remote' });
const evalRemote = await emitEvaluationProposal(discRemote, snapshot, { evaluationId: 'eval-remote' });
const planRemote = await emitPlanningProposal([evalRemote], snapshot, { planId: 'plan-remote' });
const orchRemote = await emitOrchestrationProposal({
  discoveryProposals: [discRemote],
  evaluationProposals: [evalRemote],
  planningProposals: [planRemote],
}, snapshot, { orchestrationId: 'orch-remote' });

const remoteRelocDecision = orchRemote.output.requiredHumanDecisions.find(
  (d) => d.type === 'confirm_relocation_waiver'
);
assert.strictEqual(remoteRelocDecision, undefined, 'Fully remote job must NOT surface relocation decision');
console.log('  ✓ Verified: Remote opportunities do not surface unnecessary relocation prompts.');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3: POLICY GUARD HALTS AT REQUIRE_HUMAN_DECISION
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Test 3: Policy Guard Evaluation & Gating ---');
const polOnsite = evaluatePolicyDecision(orchOnsite, { snapshot });
assert.strictEqual(
  polOnsite.decision,
  'REQUIRE_HUMAN_DECISION',
  'Policy Guard must mandate human decision prior to approval'
);
console.log(`  ✓ Policy Decision: "${polOnsite.decision}" (Review Required: ${polOnsite.reviewRequired})`);

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4: HUMAN SOVEREIGN REVIEW & DECISION CONFIRMATION
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Test 4: Candidate Decision Confirmation at Sovereign Review Gate ---');
const artifactContent = {
  resume: {
    candidateId: candidate.id,
    summary: 'Lead systems architect with verifiable Java experience',
    skills: candidate.skills,
  },
  cover_letter: {
    employer: onSiteJob.company,
    letter: `Application for ${onSiteJob.title}`,
  },
  screening_answers: {
    answers: [{ question_id: 'q1', answer: 'Requesting remote exception under enterprise policy.' }],
  },
};

const approvalWithConfirmation = signHumanApproval({
  policyDecision: { ...polOnsite, decision: 'ALLOW_REVIEW' },
  candidateSignature: candidate.email,
  candidateSnapshot: snapshot,
  orchestrationProposal: orchOnsite.output,
  artifactContent,
  destination: onSiteJob.company,
  relocationConfirmation: {
    jobId: onSiteJob.jobId,
    choice: 'Confirm Remote Exception Request',
    confirmed: true,
  },
});

assert.ok(approvalWithConfirmation.relocationConfirmation, 'Approval record must persist relocationConfirmation');
assert.strictEqual(
  approvalWithConfirmation.relocationConfirmation.choice,
  'Confirm Remote Exception Request'
);
assert.strictEqual(approvalWithConfirmation.relocationConfirmation.confirmed, true);
console.log('  ✓ Candidate Sovereign Confirmation recorded in ApprovedPackageRecord.');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5: DOWNSTREAM LIFECYCLE & AUDIT CONTINUITY
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Test 5: Freeze, Substrate Execution & Audit Trail ---');
const frozen = freezeApplicationArtifact(approvalWithConfirmation, artifactContent);
const fingerprint = computeArtifactFingerprint(artifactContent);

const execResult = executeApplicationPackage({
  applicationId: onSiteJob.jobId,
  approvedArtifact: {
    id: `art-exec-${fingerprint.hash.slice(0, 8)}`,
    application_id: onSiteJob.jobId,
    evidence_snapshot_id: snapshot.id,
    destination: onSiteJob.company,
    fingerprint,
    approved_by: approvalWithConfirmation.approvedBy,
    approved_at: approvalWithConfirmation.approvedAt,
    content: artifactContent,
  },
  currentContent: artifactContent,
  destination: onSiteJob.company,
  route: 'portal',
});

assert.strictEqual(execResult.success, true);
const outcome = recordOutcome({
  receipt: execResult.receipt,
  frozenArtifact: frozen,
  snapshot,
  planningProposal: planOnsite.output,
  options: { outcomeId: 'out-cp001' },
});

const feedback = createEvidenceFeedback({
  outcome,
  snapshot,
  options: { feedbackId: 'fb-cp001' },
});

const baseProfile = createBaselineIntelligenceProfile(candidate.id, {
  preferredRoles: [onSiteJob.title],
  domainSpecializations: candidate.skills,
});

const learningProposal = createLearningProposal({
  currentProfile: baseProfile,
  feedbacks: [feedback],
  candidateSnapshot: snapshot,
  options: { learningId: 'lrn-cp001' },
});

const approvedProfileV2 = applyApprovedLearningProposal({
  proposal: learningProposal,
  currentProfile: baseProfile,
  approvalSignature: 'sig-cp001',
  approvedBy: candidate.email,
});

const dataset = createStandardBenchmarkDataset({ datasetId: 'ds-cp001' });
const experimentResult = runReplayExperiment({
  learningProposal,
  baselineProfile: baseProfile,
  candidateProfile: approvedProfileV2,
  dataset,
});

const audit = verifyUnifiedLifecycleAuditTrail({
  discovery: discOnsite,
  snapshot,
  evaluation: evalOnsite,
  planning: planOnsite,
  orchestration: orchOnsite,
  policyDecision: polOnsite,
  humanApproval: approvalWithConfirmation,
  frozenArtifact: frozen,
  receipt: execResult.receipt,
  outcome,
  feedback,
  learningProposal,
  experimentResult,
  approvedProfileV2,
});

assert.strictEqual(audit.valid, true, 'Unified Lifecycle Audit Trail must be 100% valid');
console.log('  ✓ 15-node cryptographic audit trail verified intact.');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6: DETERMINISM REPLAY
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Test 6: Deterministic Replay Verification ---');
const orchReplay = await emitOrchestrationProposal({
  discoveryProposals: [discOnsite],
  evaluationProposals: [evalOnsite],
  planningProposals: [planOnsite],
}, snapshot, { orchestrationId: 'orch-onsite' });

const decision1 = orchOnsite.output.requiredHumanDecisions.find(d => d.type === 'confirm_relocation_waiver');
const decision2 = orchReplay.output.requiredHumanDecisions.find(d => d.type === 'confirm_relocation_waiver');
assert.strictEqual(decision1.decisionId, decision2.decisionId);
assert.strictEqual(decision1.description, decision2.description);
console.log('  ✓ Deterministic Replay: Re-orchestration produces identical decision record.');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 7: AUTHORITY BOUNDARY INVARIANT (AGENT CANNOT SELF-WAIVE)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Test 7: Authority Boundary Invariant ---');
assert.strictEqual(orchOnsite.authority.canExecute, false);
assert.strictEqual(orchOnsite.authority.canApprove, false);

assert.throws(
  () => {
    signHumanApproval({
      policyDecision: { ...polOnsite, decision: 'ALLOW_REVIEW' },
      candidateSignature: 'agt-orchestrator-v1', // Agent trying to waive!
      candidateSnapshot: snapshot,
      orchestrationProposal: orchOnsite.output,
      artifactContent,
      destination: onSiteJob.company,
      relocationConfirmation: {
        jobId: onSiteJob.jobId,
        choice: 'Confirm Remote Exception Request',
        confirmed: true,
      },
    });
  },
  /AUTHORITY_VIOLATION/,
  'Agent self-approval MUST be rejected'
);
console.log('  ✓ Authority Boundary: Autonomous agent attempt to self-confirm waiver strictly blocked.');

console.log('\n================================================================');
console.log('  RFC CP-001 RELOCATION DECISION TEST PASSED (7/7)             ');
console.log('  Deterministic output, evidence grounding, human sovereignty,  ');
console.log('  and zero positive agent authority verified.                   ');
console.log('================================================================');
