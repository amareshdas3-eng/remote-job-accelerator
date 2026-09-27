// tests/v5_evaluation_intelligence.mjs
// RJA v5.0-alpha3: Evaluation Intelligence & Bounded Evidence Boundary Test Suite
//
// Formally verifies:
// 1. Evaluation Correctness & Schema:
//    - Consumption of candidate evidence snapshot & canonical discovery proposal
//    - Classification of requirements as required vs preferred
//    - Evidence-backed requirement matching with strict EvidenceCitation citations
//    - Gap detection where evidence is missing
//    - Deterministic 4D fit scoring & tier classification
//    - Emission inside Universal Provenance Envelope: AgentProposal<EvaluationProposal>
// 2. "Generation is Never Evidence" Invariant:
//    - Unbacked match rejection (cannot mark satisfied without citations)
//    - Hallucinated/forged citation rejection (citing facts not in snapshot)
//    - Deterministic score governance (cannot tamper with score independently)
//    - Evidence snapshot hash drift detection
// 3. Negative Capability & Privilege Escalation Resistance:
//    - Envelope authority tampering (canExecute, canApprove, canMutateEvidence)
//    - Application artifact creation prohibition (cover letter, resume, answers)
//    - Candidate profile mutation prohibition
//    - Direct dispatch and self-approval prevention
// 4. Discovery → Evaluation Pipeline Integration:
//    - Seamless handoff of Discovery Agent Proposal into Evaluation Agent

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { emitDiscoveryProposal } from '../lib/agents/discovery.ts';
import {
  classifyRequirement,
  findEvidenceInSnapshot,
  verifyEvidenceCitation,
  evaluateCandidateAgainstJob,
  emitEvaluationProposal,
} from '../lib/agents/evaluation.ts';
import { validateAgentProposal, assertPolicyGuard } from '../lib/agents/policyGuard.ts';
import { createEvidenceSnapshot } from '../lib/execution/snapshot.ts';
import { EVALUATION_AGENT_CONTRACT } from '../lib/agents/contracts.ts';

console.log('================================================================');
console.log('  RJA V5.0-ALPHA3: EVALUATION INTELLIGENCE TEST SUITE           ');
console.log('  Formal Invariants, Citations & "Generation is Never Evidence" ');
console.log('================================================================\n');

// -------------------------------------------------------------
// PART 1: Evaluation Correctness & Universal Provenance Envelope
// -------------------------------------------------------------
console.log('Part 1: Testing Evaluation Correctness & Provenance Envelope...');

// Setup Candidate Evidence Snapshot
const candidateProfile = {
  headline: 'Principal Distributed Systems Engineer',
  years_experience: 12,
  skills: ['Rust', 'Go', 'Kubernetes', 'Kafka', 'PostgreSQL', 'Distributed Consensus'],
  certifications: ['AWS Certified Solutions Architect - Professional', 'PE'],
  bio: 'Architecting high-scale distributed systems and real-time streaming engines.',
};
const evidenceSnapshot = createEvidenceSnapshot('cand-8801', candidateProfile);

// Discovered Job Proposal (Greenhouse listing)
const rawDiscoveryInput = {
  title: 'Principal Distributed Systems Engineer',
  company: 'Aether Streaming Networks',
  url: 'https://careers.aether.io/jobs/dist-88?utm_source=boards',
  source: 'greenhouse',
  description: `Seeking a Principal Distributed Systems Engineer.
• Must have 10+ years designing distributed streaming systems.
• Expert proficiency in Rust or Go required.
• Deep experience with Kafka and distributed consensus protocols.
• Experience with Elixir preferred.
• Master's degree in Computer Science preferred.`,
  requirements: [
    '10+ years designing distributed streaming systems',
    'Expert proficiency in Rust or Go required',
    'Deep experience with Kafka and distributed consensus protocols',
    'Experience with Elixir preferred',
    "Master's degree in Computer Science preferred",
  ],
  skills: ['Rust', 'Go', 'Kafka', 'Distributed Consensus', 'Elixir'],
  location: 'Remote (Global)',
  category: 'distributed_systems',
  raw_payload: { id: 'dist-88' },
};

const discoveryEnvelope = await emitDiscoveryProposal(rawDiscoveryInput);

// 1.1 Test requirement classification
assert.strictEqual(classifyRequirement('10+ years designing distributed streaming systems'), 'required');
assert.strictEqual(classifyRequirement('Expert proficiency in Rust or Go required'), 'required');
assert.strictEqual(classifyRequirement('Experience with Elixir preferred'), 'preferred');
assert.strictEqual(classifyRequirement("Master's degree in Computer Science preferred"), 'preferred');
assert.strictEqual(classifyRequirement('Knowledge of Erlang is a plus'), 'preferred');
assert.strictEqual(classifyRequirement('AWS certification desired'), 'preferred');

// 1.2 Emit Evaluation Proposal wrapped in Universal Provenance Envelope
const evaluationEnvelope = await emitEvaluationProposal(discoveryEnvelope, evidenceSnapshot, {
  reviewRequested: false,
});

// Assert Envelope Structure
assert.ok(evaluationEnvelope.proposalId.startsWith('prop-agt-evaluation-v1-'));
assert.strictEqual(evaluationEnvelope.agentId, 'agt-evaluation-v1');
assert.strictEqual(evaluationEnvelope.agentVersion, '1.0.0');
assert.ok(evaluationEnvelope.createdAt);
assert.deepStrictEqual(evaluationEnvelope.inputEvidenceRefs, [evidenceSnapshot.id]);

// Assert Negative Authority Declaration
assert.strictEqual(evaluationEnvelope.authority.canExecute, false);
assert.strictEqual(evaluationEnvelope.authority.canApprove, false);
assert.strictEqual(evaluationEnvelope.authority.canMutateEvidence, false);

// Assert Inner Evaluation Proposal
const evalOutput = evaluationEnvelope.output;
assert.strictEqual(evalOutput.jobTitle, 'Principal Distributed Systems Engineer');
assert.strictEqual(evalOutput.company, 'Aether Streaming Networks');
assert.strictEqual(evalOutput.candidateId, 'cand-8801');
assert.strictEqual(evalOutput.evidenceSnapshotId, evidenceSnapshot.id);
assert.strictEqual(evalOutput.evidenceHash, evidenceSnapshot.evidence_hash);
assert.strictEqual(evalOutput.proposed_by, 'evaluation_agent');

// Assert Evaluated Requirements breakdown
assert.strictEqual(evalOutput.evaluatedRequirements.length, 5);
assert.strictEqual(evalOutput.preferredCount, 2);
assert.strictEqual(evalOutput.satisfiedCount, 3); // 3 satisfied (10+ yrs, Rust/Go, Kafka)
assert.strictEqual(evalOutput.gapCount, 2); // 2 gaps (Elixir, Master's degree)

// Assert satisfied requirements have strict citations
const reqYears = evalOutput.evaluatedRequirements[0];
assert.strictEqual(reqYears.status, 'satisfied');
assert.ok(reqYears.citations.length > 0);
assert.ok(reqYears.citations.some((c) => c.source_field === 'years_experience'));

const reqRustGo = evalOutput.evaluatedRequirements[1];
assert.strictEqual(reqRustGo.status, 'satisfied');
assert.ok(reqRustGo.citations.some((c) => c.fact === 'Rust' || c.fact === 'Go'));

// Assert gaps have zero citations and explicit gap descriptions
const reqElixir = evalOutput.evaluatedRequirements[3];
assert.strictEqual(reqElixir.status, 'gap');
assert.strictEqual(reqElixir.classification, 'preferred');
assert.strictEqual(reqElixir.citations.length, 0);
assert.ok(reqElixir.gap_description.includes('No verified evidence'));

// Assert deterministic fit score and tier
assert.ok(evalOutput.fitScore >= 70 && evalOutput.fitScore <= 100);
assert.ok(['exceptional', 'strong'].includes(evalOutput.tier));
assert.strictEqual(
  evalOutput.fitScore,
  evalOutput.dimensions.role_alignment +
    evalOutput.dimensions.technical_skills +
    evalOutput.dimensions.leadership +
    evalOutput.dimensions.seniority_remote
);

// Assert Policy Guard passes clean evaluation proposal
const guardCheckClean = validateAgentProposal(evaluationEnvelope, 'evaluation', evidenceSnapshot);
assert.strictEqual(guardCheckClean.allowed, true, 'Clean Evaluation Proposal must pass Policy Guard');
assert.strictEqual(guardCheckClean.violations.length, 0);

console.log('  ✓ Test 1.1: Requirement classification correctly distinguishes required vs preferred.');
console.log('  ✓ Test 1.2: Evaluation Agent wrapped in Universal Provenance Envelope with inputEvidenceRefs.');
console.log('  ✓ Test 1.3: Requirement matching extracts verified evidence citations to candidate snapshot.');
console.log('  ✓ Test 1.4: Gaps identified without hallucinating missing credentials.');
console.log('  ✓ Test 1.5: Clean Evaluation Proposal passes Policy Guard without violations.\n');

// -------------------------------------------------------------
// PART 2: "Generation is Never Evidence" Invariant
// -------------------------------------------------------------
console.log('Part 2: Testing "Generation is Never Evidence" Boundary Enforcement...');

// 2.1 Attack: Attempt to upgrade a gap to satisfied without citations (unbacked match)
const attackUnbackedMatch = {
  ...evaluationEnvelope,
  output: {
    ...evaluationEnvelope.output,
    evaluatedRequirements: evalOutput.evaluatedRequirements.map((r) => {
      if (r.id === 'req-4') {
        // req-4 is Elixir (gap)
        return {
          ...r,
          status: 'satisfied', // Hallucinated upgrade
          citations: [], // No citations!
        };
      }
      return r;
    }),
  },
};
const guardUnbacked = validateAgentProposal(attackUnbackedMatch, 'evaluation', evidenceSnapshot);
assert.strictEqual(guardUnbacked.allowed, false);
assert.ok(guardUnbacked.violations.some((v) => v.includes('EVALUATION_UNBACKED_MATCH')));
console.log('  ✓ Invariant 2.1 DEFENDED: Upgrading requirement to satisfied without citations strictly blocked.');

// 2.2 Attack: Hallucinated / forged citation (citing fact not present in candidate snapshot)
const attackForgedCitation = {
  ...evaluationEnvelope,
  output: {
    ...evaluationEnvelope.output,
    evaluatedRequirements: evalOutput.evaluatedRequirements.map((r) => {
      if (r.id === 'req-4') {
        return {
          ...r,
          status: 'satisfied',
          citations: [
            {
              fact: '10 years Elixir & OTP core contributor', // Fabricated!
              source_field: 'skills',
              evidence_snapshot_id: evidenceSnapshot.id,
              evidence_hash: evidenceSnapshot.evidence_hash,
            },
          ],
        };
      }
      return r;
    }),
  },
};
const guardForgedCitation = validateAgentProposal(attackForgedCitation, 'evaluation', evidenceSnapshot);
assert.strictEqual(guardForgedCitation.allowed, false);
assert.ok(guardForgedCitation.violations.some((v) => v.includes('EVALUATION_CITATION_FORGED')));
console.log('  ✓ Invariant 2.2 DEFENDED: Fabricated citations referencing absent facts strictly caught.');

// 2.3 Attack: Governed score manipulation (score does not match dimension sum)
const attackScoreDiscrepancy = {
  ...evaluationEnvelope,
  output: {
    ...evaluationEnvelope.output,
    fitScore: 99, // Artificially inflated beyond dimension sum
  },
};
const guardScore = validateAgentProposal(attackScoreDiscrepancy, 'evaluation', evidenceSnapshot);
assert.strictEqual(guardScore.allowed, false);
assert.ok(guardScore.violations.some((v) => v.includes('EVALUATION_SCORE_DISCREPANCY')));
console.log('  ✓ Invariant 2.3 DEFENDED: Artificial score inflation without dimension basis strictly caught.');

// 2.4 Attack: Evidence snapshot drift (evaluation claims different evidence hash than verification snapshot)
const driftedSnapshot = {
  ...evidenceSnapshot,
  evidence_hash: 'drifted_evidence_hash_99999999999999999999999999999999',
};
const guardDrift = validateAgentProposal(evaluationEnvelope, 'evaluation', driftedSnapshot);
assert.strictEqual(guardDrift.allowed, false);
assert.ok(guardDrift.violations.some((v) => v.includes('EVALUATION_SNAPSHOT_DRIFT')));
console.log('  ✓ Invariant 2.4 DEFENDED: Evidence snapshot hash drift detected and halted.\n');

// -------------------------------------------------------------
// PART 3: Privilege Escalation & Negative Capabilities
// -------------------------------------------------------------
console.log('Part 3: Testing Privilege Escalation & Negative Capability Defenses...');

// 3.1 Attack: Evaluation Agent attempts to create application cover letter
const attackCoverLetter = {
  ...evaluationEnvelope,
  output: {
    ...evaluationEnvelope.output,
    cover_letter: 'Drafted cover letter for candidate.',
  },
};
const guardCoverLetter = validateAgentProposal(attackCoverLetter, 'evaluation');
assert.strictEqual(guardCoverLetter.allowed, false);
assert.ok(guardCoverLetter.violations.some((v) => v.includes('EVALUATION_BOUNDARY_BREACH')));
console.log('  ✓ Attack 3.1 BLOCKED: Application artifact generation by Evaluation Agent strictly blocked.');

// 3.2 Attack: Evaluation Agent attempts to mutate candidate profile
const attackProfileMutation = {
  ...evaluationEnvelope,
  output: {
    ...evaluationEnvelope.output,
    profile_mutation: {
      add_skill: 'Elixir',
    },
  },
};
const guardProfileMut = validateAgentProposal(attackProfileMutation, 'evaluation');
assert.strictEqual(guardProfileMut.allowed, false);
assert.ok(guardProfileMut.violations.some((v) => v.includes('mutate candidate profile')));
console.log('  ✓ Attack 3.2 BLOCKED: Candidate profile mutation strictly blocked.');

// 3.3 Attack: Evaluation Agent envelope claims canExecute: true
const attackExec = {
  ...evaluationEnvelope,
  authority: {
    ...evaluationEnvelope.authority,
    canExecute: true,
  },
};
const guardExec = validateAgentProposal(attackExec, 'evaluation');
assert.strictEqual(guardExec.allowed, false);
assert.ok(guardExec.violations.some((v) => v.includes('claimed canExecute: true')));
console.log('  ✓ Attack 3.3 BLOCKED: canExecute privilege escalation blocked.');

// 3.4 Attack: Evaluation Agent envelope claims canApprove: true
const attackApprove = {
  ...evaluationEnvelope,
  authority: {
    ...evaluationEnvelope.authority,
    canApprove: true,
  },
};
const guardApprove = validateAgentProposal(attackApprove, 'evaluation');
assert.strictEqual(guardApprove.allowed, false);
assert.ok(guardApprove.violations.some((v) => v.includes('claimed canApprove: true')));
console.log('  ✓ Attack 3.4 BLOCKED: canApprove privilege escalation blocked.');

// 3.5 Attack: Evaluation Agent envelope claims canMutateEvidence: true
const attackMutate = {
  ...evaluationEnvelope,
  authority: {
    ...evaluationEnvelope.authority,
    canMutateEvidence: true,
  },
};
const guardMutate = validateAgentProposal(attackMutate, 'evaluation');
assert.strictEqual(guardMutate.allowed, false);
assert.ok(guardMutate.violations.some((v) => v.includes('claimed canMutateEvidence: true')));
console.log('  ✓ Attack 3.5 BLOCKED: canMutateEvidence privilege escalation blocked.\n');

// -------------------------------------------------------------
// PART 4: End-to-End Discovery → Evaluation Pipeline
// -------------------------------------------------------------
console.log('Part 4: Verifying Discovery → Evaluation Handoff Pipeline...');

// 4.1 Discovery Agent output validated by Policy Guard
const discProposalPass = validateAgentProposal(discoveryEnvelope, 'discovery', rawDiscoveryInput.raw_payload);
assertPolicyGuard(discProposalPass);

// 4.2 Discovery Proposal consumed by Evaluation Agent with Evidence Snapshot
const evalPipelineOutput = await emitEvaluationProposal(discoveryEnvelope, evidenceSnapshot);
const evalProposalPass = validateAgentProposal(evalPipelineOutput, 'evaluation', evidenceSnapshot);
assertPolicyGuard(evalProposalPass);

// 4.3 Verify Provenance Continuity
assert.strictEqual(evalPipelineOutput.output.jobId, discoveryEnvelope.output.jobId);
assert.strictEqual(evalPipelineOutput.inputEvidenceRefs[0], evidenceSnapshot.id);
assert.strictEqual(evalPipelineOutput.output.evidenceHash, evidenceSnapshot.evidence_hash);
assert.ok(evalPipelineOutput.provenance.provenance_hash);

console.log('  ✓ Test 4.1: Discovery Agent proposal validated and passed to Evaluation Agent.');
console.log('  ✓ Test 4.2: Evaluation Agent evaluated job against evidence snapshot and passed Policy Guard.');
console.log('  ✓ Test 4.3: Full provenance chain preserved: Discovery Proposal → Evidence Snapshot → Evaluation Proposal.\n');

console.log('================================================================');
console.log('  ALL V5.0-ALPHA3 EVALUATION INTELLIGENCE TESTS PASSED (100%)   ');
console.log('  Evaluation Agent & "Generation is Never Evidence" CERTIFIED   ');
console.log('================================================================');
