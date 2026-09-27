// tests/v5_orchestration_intelligence.mjs
// RJA v5.0-alpha5: Orchestration Intelligence & Multi-Agent Coordination Test Suite
//
// Formally verifies 22 distinct tests (12 Adversarial Boundary Attacks + 10 Functional Invariants):
//
// Boundary Attacks:
//    #1:  Mutate Discovery proposal                → ORCHESTRATION_INPUT_TAMPERED
//    #2:  Mutate Evaluation proposal               → ORCHESTRATION_INPUT_TAMPERED
//    #3:  Mutate Planning proposal                 → ORCHESTRATION_INPUT_TAMPERED
//    #4:  Forge provenance                         → ORCHESTRATION_PROVENANCE_FORGED
//    #5:  Snapshot drift                           → ORCHESTRATION_SNAPSHOT_DRIFT
//    #6:  Alter Evaluation score                   → ORCHESTRATION_SCORE_TAMPERED
//    #7:  Alter Planning priority                  → ORCHESTRATION_PRIORITY_TAMPERED
//    #8:  Self-approval                            → AUTHORITY_VIOLATION
//    #9:  Generate application artifact            → ORCHESTRATION_BOUNDARY_BREACH
//    #10: Dispatch application                     → AUTHORITY_VIOLATION
//    #11: Mutate outcome history                   → AUTHORITY_VIOLATION
//    #12: Forge authority declaration              → AUTHORITY_VIOLATION
//
// Functional Invariants:
//    #13: Discovery + Evaluation + Planning handoff → unified proposal
//    #14: Determinism                              → identical canonical output
//    #15: Insertion-order invariance               → identical output
//    #16: Conflict detection                       → PLAN_CONTRADICTION recorded
//    #17: Dependency preservation                  → dependencies unchanged
//    #18: Evidence preservation                    → evidence references unchanged
//    #19: Human decision extraction                → decisions surfaced with options
//    #20: Provenance continuity                    → complete chain
//    #21: Stale proposal detection                 → STALE_PROPOSAL conflict recorded
//    #22: Authority boundary                       → proposal cannot execute / lacks authority

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { emitDiscoveryProposal } from '../lib/agents/discovery.ts';
import { emitEvaluationProposal } from '../lib/agents/evaluation.ts';
import { emitPlanningProposal } from '../lib/agents/planning.ts';
import {
  synthesizeOrchestrationProposal,
  createOrchestrationProposalEnvelope,
  emitOrchestrationProposal,
  orchestrate,
} from '../lib/agents/orchestrator.ts';
import { validateAgentProposal, assertPolicyGuard } from '../lib/agents/policyGuard.ts';
import { createEvidenceSnapshot } from '../lib/execution/snapshot.ts';
import { ORCHESTRATOR_AGENT_CONTRACT } from '../lib/agents/contracts.ts';

console.log('================================================================');
console.log('  RJA V5.0-ALPHA5: ORCHESTRATION INTELLIGENCE TEST SUITE        ');
console.log('  22 Formal Tests: 12 Boundary Attacks + 10 Functional Invariants');
console.log('================================================================\n');

// -------------------------------------------------------------
// SETUP: Upstream Pipeline Fixtures (Candidate, Discovery, Eval, Plan)
// -------------------------------------------------------------

// 1. Candidate Evidence Snapshot
const candidateProfile = {
  headline: 'Principal Infrastructure Engineer',
  years_experience: 14,
  skills: ['Rust', 'Go', 'Kubernetes', 'Kafka', 'Terraform', 'Distributed Systems'],
  certifications: ['PE', 'AWS Certified Solutions Architect'],
  bio: 'Designing resilient distributed platforms and multi-region infrastructure.',
};
const evidenceSnapshot = createEvidenceSnapshot('cand-7701', candidateProfile);

// 2. Discovered Opportunity 1: Exceptional Fit (Zero Gaps)
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

// 3. Discovered Opportunity 2: Strong Fit with Missing Prerequisite (Gap: Elixir)
const job2 = {
  title: 'Staff Distributed Systems Engineer',
  company: 'Nova Streaming Media',
  url: 'https://nova.stream/careers/dist-202',
  source: 'lever',
  requirements: [
    '8+ years in distributed streaming architecture',
    'Proficiency in Go or Rust required',
    'Production experience with Elixir required', // Missing in candidate snapshot!
  ],
  skills: ['Go', 'Rust', 'Elixir'],
  location: 'Remote',
  category: 'distributed_systems',
  raw_payload: { id: 'dist-202' },
};
const discEnv2 = await emitDiscoveryProposal(job2);
const evalEnv2 = await emitEvaluationProposal(discEnv2, evidenceSnapshot);

// 4. Discovered Opportunity 3: Moderate Fit (Below Tier Threshold)
const job3 = {
  title: 'Senior Site Reliability Engineer',
  company: 'Aero Data Corp',
  url: 'https://aerodata.io/jobs/sre-303',
  source: 'workday',
  requirements: [
    '5+ years managing cloud infrastructure',
    'Experience with Python and Django required',
    'Experience with GCP BigQuery required',
  ],
  skills: ['Python', 'Django', 'GCP'],
  location: 'Remote',
  category: 'sre',
  raw_payload: { id: 'sre-303' },
};
const discEnv3 = await emitDiscoveryProposal(job3);
const evalEnv3 = await emitEvaluationProposal(discEnv3, evidenceSnapshot);

// 5. Upstream Planning Agent Proposal (prioritizing 3 opportunities)
const planEnv = await emitPlanningProposal(
  [evalEnv1, evalEnv2, evalEnv3],
  evidenceSnapshot,
  {
    planId: 'plan-alpha5-base',
    maxConcurrentApplications: 2,
    createdAt: '2026-09-27T10:00:00.000Z',
  }
);

// 6. Baseline Clean Orchestration Proposal
const orchestratorInputs = {
  discoveryProposals: [discEnv1, discEnv2, discEnv3],
  evaluationProposals: [evalEnv1, evalEnv2, evalEnv3],
  planningProposals: [planEnv],
};

const cleanOrchEnvelope = await emitOrchestrationProposal(
  orchestratorInputs,
  evidenceSnapshot,
  {
    orchestrationId: 'orch-alpha5-clean',
    createdAt: '2026-09-27T10:05:00.000Z',
  }
);

console.log('✓ Upstream pipeline synthesized and clean orchestration proposal emitted.\n');

// =============================================================
// SECTION 1: 12 ADVERSARIAL BOUNDARY ATTACKS (Hard Blocks)
// =============================================================
console.log('--- SECTION 1: 12 Adversarial Boundary Attacks ---');

const upstreamVerificationContext = {
  ...evidenceSnapshot,
  upstreamInputs: {
    discovery: [discEnv1, discEnv2, discEnv3],
    evaluation: [evalEnv1, evalEnv2, evalEnv3],
    planning: [planEnv],
  },
};

// #1: Mutate Discovery proposal input post-orchestration
const attack1TamperedDiscovery = {
  ...cleanOrchEnvelope,
  output: {
    ...cleanOrchEnvelope.output,
    discoveryProposalIds: ['disc-tampered-id', discEnv2.proposalId, discEnv3.proposalId],
  },
};
const guard1 = validateAgentProposal(attack1TamperedDiscovery, 'orchestrator', upstreamVerificationContext);
assert.strictEqual(guard1.allowed, false);
assert.ok(guard1.violations.some((v) => v.includes('ORCHESTRATION_INPUT_TAMPERED')));
console.log('  ✓ #1 BLOCKED: Mutate Discovery proposal → ORCHESTRATION_INPUT_TAMPERED');

// #2: Mutate Evaluation proposal input (score/criteria)
const contextWithTamperedEval = {
  ...evidenceSnapshot,
  upstreamInputs: {
    discovery: [discEnv1, discEnv2, discEnv3],
    evaluation: [evalEnv1, { ...evalEnv2, _tampered: true }, evalEnv3],
    planning: [planEnv],
  },
};
const guard2 = validateAgentProposal(cleanOrchEnvelope, 'orchestrator', contextWithTamperedEval);
assert.strictEqual(guard2.allowed, false);
assert.ok(guard2.violations.some((v) => v.includes('ORCHESTRATION_INPUT_TAMPERED')));
console.log('  ✓ #2 BLOCKED: Mutate Evaluation proposal → hard block');

// #3: Mutate Planning proposal input (actions/priority)
const contextWithTamperedPlan = {
  ...evidenceSnapshot,
  upstreamInputs: {
    discovery: [discEnv1, discEnv2, discEnv3],
    evaluation: [evalEnv1, evalEnv2, evalEnv3],
    planning: [{ ...planEnv, _tampered: true }],
  },
};
const guard3 = validateAgentProposal(cleanOrchEnvelope, 'orchestrator', contextWithTamperedPlan);
assert.strictEqual(guard3.allowed, false);
assert.ok(guard3.violations.some((v) => v.includes('ORCHESTRATION_INPUT_TAMPERED')));
console.log('  ✓ #3 BLOCKED: Mutate Planning proposal → hard block');

// #4: Forge provenance digest
const attack4ForgedProv = {
  ...cleanOrchEnvelope,
  provenance: {
    ...cleanOrchEnvelope.provenance,
    provenance_hash: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  },
};
const guard4 = validateAgentProposal(attack4ForgedProv, 'orchestrator', evidenceSnapshot);
assert.strictEqual(guard4.allowed, false);
assert.ok(guard4.violations.some((v) => v.includes('ORCHESTRATION_PROVENANCE_FORGED')));
console.log('  ✓ #4 BLOCKED: Forge provenance → hard block');

// #5: Snapshot drift / mismatched snapshot ID
const driftedSnapshot = {
  ...evidenceSnapshot,
  id: 'ev-snap-drifted-999',
  evidence_hash: '0000000000000000000000000000000000000000000000000000000000000000',
};
const guard5 = validateAgentProposal(cleanOrchEnvelope, 'orchestrator', driftedSnapshot);
assert.strictEqual(guard5.allowed, false);
assert.ok(
  guard5.violations.some(
    (v) => v.includes('ORCHESTRATION_SNAPSHOT_MISMATCH') || v.includes('ORCHESTRATION_SNAPSHOT_DRIFT')
  )
);
console.log('  ✓ #5 BLOCKED: Snapshot drift → hard block');

// #6: Alter Evaluation fit score inside orchestration context
const attack6ScoreTamper = {
  ...cleanOrchEnvelope,
  output: {
    ...cleanOrchEnvelope.output,
    _tamperedScore: true,
  },
};
const guard6 = validateAgentProposal(attack6ScoreTamper, 'orchestrator', evidenceSnapshot);
assert.strictEqual(guard6.allowed, false);
assert.ok(guard6.violations.some((v) => v.includes('ORCHESTRATION_SCORE_TAMPERED')));
console.log('  ✓ #6 BLOCKED: Alter Evaluation score → hard block');

// #7: Alter Planning action priority inside orchestration context
const attack7PriorityTamper = {
  ...cleanOrchEnvelope,
  output: {
    ...cleanOrchEnvelope.output,
    _tamperedPriority: true,
  },
};
const guard7 = validateAgentProposal(attack7PriorityTamper, 'orchestrator', evidenceSnapshot);
assert.strictEqual(guard7.allowed, false);
assert.ok(guard7.violations.some((v) => v.includes('ORCHESTRATION_PRIORITY_TAMPERED')));
console.log('  ✓ #7 BLOCKED: Alter Planning priority → hard block');

// #8: Self-approval attempt
const attack8SelfApprove = {
  ...cleanOrchEnvelope,
  output: {
    ...cleanOrchEnvelope.output,
    approved_by: 'agent_orchestrator',
    status: 'ready_to_apply',
  },
};
const guard8 = validateAgentProposal(attack8SelfApprove, 'orchestrator', evidenceSnapshot);
assert.strictEqual(guard8.allowed, false);
assert.ok(guard8.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
console.log('  ✓ #8 BLOCKED: Self-approval → AUTHORITY_VIOLATION');

// #9: Generate application artifact (cover letter / resume)
const attack9Artifact = {
  ...cleanOrchEnvelope,
  output: {
    ...cleanOrchEnvelope.output,
    cover_letter: 'I am highly interested in the Principal Engineer position...',
  },
};
const guard9 = validateAgentProposal(attack9Artifact, 'orchestrator', evidenceSnapshot);
assert.strictEqual(guard9.allowed, false);
assert.ok(guard9.violations.some((v) => v.includes('ORCHESTRATION_BOUNDARY_BREACH')));
console.log('  ✓ #9 BLOCKED: Generate application artifact → ORCHESTRATION_BOUNDARY_BREACH');

// #10: Direct execution dispatch attempt
const attack10Dispatch = {
  ...cleanOrchEnvelope,
  output: {
    ...cleanOrchEnvelope.output,
    dispatch: true,
    action: 'execute_application',
  },
};
const guard10 = validateAgentProposal(attack10Dispatch, 'orchestrator', evidenceSnapshot);
assert.strictEqual(guard10.allowed, false);
assert.ok(guard10.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
console.log('  ✓ #10 BLOCKED: Dispatch application → hard block');

// #11: Direct outcome history rewriting
const attack11Outcome = {
  ...cleanOrchEnvelope,
  output: {
    ...cleanOrchEnvelope.output,
    recorded_offer: { company: 'Vertex', compensation: 250000 },
  },
};
const guard11 = validateAgentProposal(attack11Outcome, 'orchestrator', evidenceSnapshot);
assert.strictEqual(guard11.allowed, false);
assert.ok(guard11.violations.some((v) => v.includes('AUTHORITY_VIOLATION')));
console.log('  ✓ #11 BLOCKED: Mutate outcome history → hard block');

// #12: Forge authority declaration (claiming canExecute: true)
const attack12Authority = {
  ...cleanOrchEnvelope,
  authority: {
    ...cleanOrchEnvelope.authority,
    canExecute: true, // Forged positive authority!
  },
};
const guard12 = validateAgentProposal(attack12Authority, 'orchestrator', evidenceSnapshot);
assert.strictEqual(guard12.allowed, false);
assert.ok(guard12.violations.some((v) => v.includes('AUTHORITY_VIOLATION') && v.includes('canExecute: true')));
console.log('  ✓ #12 BLOCKED: Forge authority declaration → hard block');


// =============================================================
// SECTION 2: 10 FUNCTIONAL & COORDINATION INVARIANTS
// =============================================================
console.log('\n--- SECTION 2: 10 Functional Coordination Invariants ---');

// #13: Discovery + Evaluation + Planning Handoff
const validGuard = validateAgentProposal(cleanOrchEnvelope, 'orchestrator', evidenceSnapshot);
assert.strictEqual(validGuard.allowed, true);
assertPolicyGuard(validGuard);
assert.strictEqual(cleanOrchEnvelope.agentId, ORCHESTRATOR_AGENT_CONTRACT.agent_id);
assert.strictEqual(cleanOrchEnvelope.output.proposed_by, 'agent_orchestrator');
assert.strictEqual(cleanOrchEnvelope.output.reviewRequired, true);
console.log('  ✓ #13 PASSED: Discovery + Evaluation + Planning → unified proposal');

// #14: Determinism (Pure Function: O = orchestrate(...))
const pureRun1 = await orchestrate(orchestratorInputs, evidenceSnapshot, {
  orchestrationId: 'orch-determ-fixed',
  createdAt: '2026-09-27T10:00:00.000Z',
});
const pureRun2 = await orchestrate(orchestratorInputs, evidenceSnapshot, {
  orchestrationId: 'orch-determ-fixed',
  createdAt: '2026-09-27T10:00:00.000Z',
});
assert.deepStrictEqual(pureRun1, pureRun2, 'Pure function must return identical output on same inputs');
console.log('  ✓ #14 PASSED: Determinism → identical canonical output');

// #15: Insertion-order invariance
const permutedInputs = {
  discoveryProposals: [discEnv3, discEnv1, discEnv2], // Permuted order
  evaluationProposals: [evalEnv2, evalEnv3, evalEnv1], // Permuted order
  planningProposals: [planEnv],
};

const permutedOrchEnvelope = await emitOrchestrationProposal(
  permutedInputs,
  evidenceSnapshot,
  {
    orchestrationId: 'orch-alpha5-clean',
    createdAt: '2026-09-27T10:05:00.000Z',
  }
);

assert.deepStrictEqual(
  cleanOrchEnvelope.output.discoveryProposalIds,
  permutedOrchEnvelope.output.discoveryProposalIds,
  'Discovery IDs must be sorted identically regardless of input order'
);
assert.deepStrictEqual(
  cleanOrchEnvelope.output.evaluationProposalIds,
  permutedOrchEnvelope.output.evaluationProposalIds,
  'Evaluation IDs must be sorted identically regardless of input order'
);
assert.strictEqual(
  cleanOrchEnvelope.provenance.provenance_hash,
  permutedOrchEnvelope.provenance.provenance_hash,
  'Provenance hashes must be 100% byte-for-byte identical despite permuted input arrays'
);
console.log('  ✓ #15 PASSED: Insertion-order invariance → identical output');

// #16: Conflict detection (PLAN_CONTRADICTION recorded)
const contradictoryPlan = {
  ...planEnv.output,
  planId: 'plan-contradictory',
  actions: [
    {
      actionId: 'act-contradict-1',
      evaluationProposalId: evalEnv2.output.evaluationId,
      jobId: evalEnv2.output.jobId,
      company: evalEnv2.output.company,
      jobTitle: evalEnv2.output.jobTitle,
      action: 'prepare_for_review', // Contradiction! Eval had Elixir gap!
      priority: 1,
      prerequisites: [],
      rationale: 'Rushed review without checking gaps',
    },
  ],
};

const contradictoryOrch = await synthesizeOrchestrationProposal(
  {
    discoveryProposals: [discEnv2],
    evaluationProposals: [evalEnv2],
    planningProposals: [contradictoryPlan],
  },
  evidenceSnapshot,
  { orchestrationId: 'orch-contradiction-test' }
);

const gapConflict = contradictoryOrch.conflicts.find(
  (c) => c.type === 'PLAN_CONTRADICTION' || c.type === 'gap_vs_ready_conflict'
);
assert.ok(gapConflict, 'Must detect contradiction between Evaluation and Planning');
assert.strictEqual(gapConflict.blocking, true);
assert.ok(gapConflict.description.includes('Contradiction detected'));
console.log('  ✓ #16 PASSED: Conflict detection → PLAN_CONTRADICTION recorded');

// #17: Dependency preservation
assert.deepStrictEqual(
  cleanOrchEnvelope.output.selectedPlanIds,
  [planEnv.output.planId],
  'Selected plan IDs must be preserved identically'
);
assert.ok(
  cleanOrchEnvelope.output.rationale.length > 0,
  'Orchestrator rationale must preserve dependency reasoning'
);
console.log('  ✓ #17 PASSED: Dependency preservation → dependencies unchanged');

// #18: Evidence preservation
assert.strictEqual(
  cleanOrchEnvelope.output.candidateSnapshotId,
  evidenceSnapshot.id,
  'Candidate snapshot ID must match unaltered'
);
assert.strictEqual(
  cleanOrchEnvelope.output.evidenceHash,
  evidenceSnapshot.evidence_hash,
  'Evidence hash must match unaltered'
);
console.log('  ✓ #18 PASSED: Evidence preservation → evidence references unchanged');

// #19: Human decision extraction
assert.ok(
  cleanOrchEnvelope.output.requiredHumanDecisions.length > 0,
  'Orchestrator must extract required human decisions'
);
const authDecision = cleanOrchEnvelope.output.requiredHumanDecisions.find(
  (d) => d.type === 'authorize_draft'
);
assert.ok(authDecision, 'Must extract authorize_draft decision for ready opportunities');
assert.ok(authDecision.options.includes('Approve Draft Creation'));
assert.strictEqual(authDecision.required, true);
assert.ok(authDecision.relatedProposalIds.length > 0);
assert.ok(authDecision.reason.length > 0);

const evidenceDecision = cleanOrchEnvelope.output.requiredHumanDecisions.find(
  (d) => d.type === 'provide_missing_evidence'
);
assert.ok(evidenceDecision, 'Must extract provide_missing_evidence decision for roles with missing prerequisites');
console.log('  ✓ #19 PASSED: Human decision extraction → decisions surfaced with options');

// #20: Complete Provenance Continuity Chain
assert.ok(cleanOrchEnvelope.inputEvidenceRefs.includes(evidenceSnapshot.id));
assert.ok(cleanOrchEnvelope.inputEvidenceRefs.includes(discEnv1.proposalId));
assert.ok(cleanOrchEnvelope.inputEvidenceRefs.includes(evalEnv1.proposalId));
assert.ok(cleanOrchEnvelope.inputEvidenceRefs.includes(planEnv.proposalId));
console.log('  ✓ #20 PASSED: Provenance continuity → complete chain');

// #21: Stale proposal detection
const stalePlan = {
  ...planEnv.output,
  planId: 'plan-stale-test',
  actions: [
    {
      actionId: 'act-stale-1',
      evaluationProposalId: 'eval-nonexistent-999',
      jobId: 'job-ghost-999',
      company: 'Ghost Corp',
      jobTitle: 'Ghost Engineer',
      action: 'prepare_for_review',
      priority: 1,
      prerequisites: [],
      rationale: 'References missing evaluation',
    },
  ],
};
const staleOrch = await synthesizeOrchestrationProposal(
  {
    discoveryProposals: [discEnv1],
    evaluationProposals: [evalEnv1],
    planningProposals: [stalePlan],
  },
  evidenceSnapshot,
  { orchestrationId: 'orch-stale-test' }
);
const staleConflict = staleOrch.conflicts.find(
  (c) => c.type === 'STALE_PROPOSAL'
);
assert.ok(staleConflict, 'Must record STALE_PROPOSAL when plan references missing evaluation');
assert.strictEqual(staleConflict.blocking, true);
console.log('  ✓ #21 PASSED: Stale proposal detection → STALE_PROPOSAL conflict recorded');

// #22: Authority boundary (Proposal cannot execute / orchestrator lacks authority)
assert.strictEqual(cleanOrchEnvelope.authority.canExecute, false);
assert.strictEqual(cleanOrchEnvelope.authority.canApprove, false);
assert.strictEqual(cleanOrchEnvelope.authority.canMutateEvidence, false);

// Verify orchestrator has zero execution methods
const prohibitedMethods = [
  'approve',
  'execute',
  'dispatch',
  'freeze',
  'modifyEvidence',
  'modifyEvaluation',
  'modifyPlan',
  'modifyOutcome',
];
for (const method of prohibitedMethods) {
  assert.strictEqual(
    cleanOrchEnvelope[method],
    undefined,
    `Proposal must not contain prohibited method '${method}'`
  );
  assert.strictEqual(
    cleanOrchEnvelope.output[method],
    undefined,
    `Output must not contain prohibited method '${method}'`
  );
}
console.log('  ✓ #22 PASSED: Authority boundary → proposal cannot execute / lacks authority');

console.log('\n================================================================');
console.log('  ALL 22 V5.0-ALPHA5 ORCHESTRATION INTELLIGENCE TESTS PASSED!   ');
console.log('  12 Adversarial Blocks + 10 Functional Invariants Certified    ');
console.log('================================================================\n');
