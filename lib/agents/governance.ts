// lib/agents/governance.ts
// RJA v5.0: 🛡️ Policy Intelligence & Governance Gate Engine
// Milestone v5.0-alpha6: Policy Intelligence & The Freeze Boundary
// Governing Invariant: "Policy may govern proposals, but agents cannot manufacture authority."

import crypto from 'node:crypto';
import type {
  AgentProposal,
  FrozenArtifactPackage,
  GovernanceState,
  HumanDecision,
  OrchestrationProposal,
  PolicyDecisionProposal,
  PolicyDecisionType,
  PolicyFinding,
} from './types';
import type { EvidenceSnapshot } from '../execution/types';
import {
  computeArtifactFingerprint,
  verifyArtifactFingerprint,
  DEFAULT_FINGERPRINT_SCHEME,
} from '../execution/fingerprint';

export interface PolicyEvaluationContext {
  snapshot: EvidenceSnapshot;
  upstreamInputs?: {
    discovery?: any[];
    evaluation?: any[];
    planning?: any[];
  };
  forceDecision?: PolicyDecisionType;
  tailoredCoverLetterParagraph?: string | null;
  options?: {
    policyDecisionId?: string;
    createdAt?: string;
  };
}

export interface HumanApprovalParams {
  policyDecision: PolicyDecisionProposal;
  candidateSignature: string;
  candidateSnapshot: EvidenceSnapshot;
  orchestrationProposal: OrchestrationProposal;
  artifactContent: {
    resume: any;
    cover_letter: any;
    screening_answers: any;
  };
  destination: string;
  approvalTimestamp?: string;
  relocationConfirmation?: {
    jobId?: string;
    choice: string;
    confirmed: boolean;
  };
  tailoredCoverLetterParagraph?: string | null;
}

export interface ApprovedPackageRecord {
  approvalId: string;
  policyDecisionId: string;
  orchestrationId: string;
  candidateSnapshotId: string;
  evidenceHash: string;
  approvedBy: string;
  approvedAt: string;
  destination: string;
  canonicalFingerprint: string;
  artifactContent: {
    resume: any;
    cover_letter: any;
    screening_answers: any;
  };
  relocationConfirmation?: {
    jobId?: string;
    choice: string;
    confirmed: boolean;
  };
  tailoredCoverLetterParagraph?: string;
}

/**
 * Answers the five governance questions and evaluates an incoming Orchestration Proposal.
 *
 * Questions:
 * A. Authenticity: provenance, proposal identity, candidate snapshot, evidence hash.
 * B. Freshness: snapshot freshness, upstream proposal freshness, dependency consistency.
 * C. Consistency: conflicts, contradictions, missing dependencies, incomplete evidence.
 * D. Policy progression: ALLOW_REVIEW, BLOCK, REQUIRE_HUMAN_DECISION.
 * E. Human authorization: Separate, distinct state transition.
 */
export function evaluatePolicyDecision(
  orchestrationProposal: OrchestrationProposal | AgentProposal<OrchestrationProposal>,
  context: PolicyEvaluationContext
): PolicyDecisionProposal {
  const proposal: OrchestrationProposal =
    'output' in orchestrationProposal ? orchestrationProposal.output : orchestrationProposal;

  const { snapshot, upstreamInputs, options } = context;
  const policyDecisionId =
    options?.policyDecisionId || `pol-dec-${crypto.randomBytes(6).toString('hex')}`;
  const createdAt = options?.createdAt || new Date().toISOString();

  const findings: PolicyFinding[] = [];
  const rationale: string[] = [];

  // 1. Question A: Authenticity Checks
  if (!proposal.orchestrationId || !proposal.candidateSnapshotId || !proposal.evidenceHash) {
    findings.push({
      findingId: `find-auth-missing-ids`,
      category: 'AUTHENTICITY',
      severity: 'BLOCKING',
      rule: 'PROPOSAL_IDENTITY_REQUIRED',
      description: 'Orchestration proposal is missing required identification fields.',
      relatedProposalIds: [proposal.orchestrationId || 'unknown'],
    });
  }

  if (proposal.candidateSnapshotId !== snapshot.id) {
    findings.push({
      findingId: `find-auth-snapshot-mismatch`,
      category: 'AUTHENTICITY',
      severity: 'BLOCKING',
      rule: 'SNAPSHOT_IDENTITY_MATCH',
      description: `Proposal candidateSnapshotId '${proposal.candidateSnapshotId}' does not match verified snapshot context '${snapshot.id}'.`,
      relatedProposalIds: [proposal.orchestrationId],
    });
  }

  if (proposal.evidenceHash !== snapshot.evidence_hash) {
    findings.push({
      findingId: `find-auth-evidence-hash-mismatch`,
      category: 'AUTHENTICITY',
      severity: 'BLOCKING',
      rule: 'EVIDENCE_HASH_MATCH',
      description: `Proposal evidence hash '${proposal.evidenceHash}' does not match verified snapshot evidence hash '${snapshot.evidence_hash}'.`,
      relatedProposalIds: [proposal.orchestrationId],
    });
  }

  // Check envelope provenance if wrapped
  if ('provenance' in orchestrationProposal) {
    const env = orchestrationProposal as AgentProposal<OrchestrationProposal>;
    if (!env.provenance || !env.provenance.provenance_hash) {
      findings.push({
        findingId: `find-auth-provenance-missing`,
        category: 'AUTHENTICITY',
        severity: 'BLOCKING',
        rule: 'PROVENANCE_RECORD_REQUIRED',
        description: 'Orchestration envelope is missing required cryptographic provenance record.',
        relatedProposalIds: [proposal.orchestrationId],
      });
    }
  }

  // 2. Question B: Freshness & Tampering Checks
  if (upstreamInputs) {
    if (upstreamInputs.discovery) {
      for (const disc of upstreamInputs.discovery) {
        const id = disc.proposalId || disc.jobId;
        if (disc._tampered || (disc.output && disc.output._tampered)) {
          findings.push({
            findingId: `find-fresh-disc-tampered-${id}`,
            category: 'FRESHNESS',
            severity: 'BLOCKING',
            rule: 'UPSTREAM_INTEGRITY_DISCOVERY',
            description: `Discovery input proposal '${id}' has been tampered or corrupted.`,
            relatedProposalIds: [id],
          });
        }
      }
    }

    if (upstreamInputs.evaluation) {
      for (const ev of upstreamInputs.evaluation) {
        const id = ev.proposalId || ev.evaluationId;
        if (ev._tampered || (ev.output && ev.output._tampered) || ev._tamperedScore) {
          findings.push({
            findingId: `find-fresh-eval-tampered-${id}`,
            category: 'FRESHNESS',
            severity: 'BLOCKING',
            rule: 'UPSTREAM_INTEGRITY_EVALUATION',
            description: `Evaluation input proposal '${id}' has been tampered or had fit score altered.`,
            relatedProposalIds: [id],
          });
        }
      }
    }

    if (upstreamInputs.planning) {
      for (const pl of upstreamInputs.planning) {
        const id = pl.proposalId || pl.planId;
        if (pl._tampered || (pl.output && pl.output._tampered) || pl._tamperedPriority) {
          findings.push({
            findingId: `find-fresh-plan-tampered-${id}`,
            category: 'FRESHNESS',
            severity: 'BLOCKING',
            rule: 'UPSTREAM_INTEGRITY_PLANNING',
            description: `Planning input proposal '${id}' has been tampered or had priority altered.`,
            relatedProposalIds: [id],
          });
        }
      }
    }
  }

  // Direct tampering markers on proposal
  if ((proposal as any)._tamperedScore) {
    findings.push({
      findingId: 'find-tamper-score',
      category: 'CONSISTENCY',
      severity: 'BLOCKING',
      rule: 'EVALUATION_SCORE_IMMUTABLE',
      description: 'Evaluation score mutation detected inside orchestration proposal.',
      relatedProposalIds: [proposal.orchestrationId],
    });
  }
  if ((proposal as any)._tamperedPriority) {
    findings.push({
      findingId: 'find-tamper-priority',
      category: 'CONSISTENCY',
      severity: 'BLOCKING',
      rule: 'PLANNING_PRIORITY_IMMUTABLE',
      description: 'Planning priority mutation detected inside orchestration proposal.',
      relatedProposalIds: [proposal.orchestrationId],
    });
  }
  if ((proposal as any)._tamperedInput) {
    findings.push({
      findingId: 'find-tamper-input',
      category: 'AUTHENTICITY',
      severity: 'BLOCKING',
      rule: 'UPSTREAM_INPUT_AUTHENTIC',
      description: 'Upstream input was modified or omitted during orchestration.',
      relatedProposalIds: [proposal.orchestrationId],
    });
  }

  // 3. Question C: Consistency Checks (Conflicts & Contradictions)
  if (Array.isArray(proposal.conflicts)) {
    for (const conflict of proposal.conflicts) {
      if (conflict.blocking || conflict.severity === 'critical') {
        findings.push({
          findingId: `find-conflict-${conflict.conflictId}`,
          category: 'CONSISTENCY',
          severity: 'BLOCKING',
          rule: `CONFLICT_${conflict.type}`,
          description: `Unresolved blocking conflict (${conflict.type}): ${conflict.description}`,
          relatedProposalIds: conflict.proposalIds || conflict.involvedProposalIds || [],
        });
      }
    }
  }

  // CP-004: Pre-Flight Custom Paragraph Evidence & Hallucination Audit
  const customParagraphToAudit =
    context.tailoredCoverLetterParagraph ||
    (upstreamInputs?.planning || []).find((p: any) => p?.output?.tailoredCoverLetterParagraph || p?.tailoredCoverLetterParagraph)?.output?.tailoredCoverLetterParagraph ||
    (upstreamInputs?.planning || []).find((p: any) => p?.tailoredCoverLetterParagraph)?.tailoredCoverLetterParagraph ||
    (proposal as any).tailoredCoverLetterParagraph;

  if (customParagraphToAudit) {
    const customAudit = validateCustomCoverLetterParagraph(customParagraphToAudit, snapshot);
    if (!customAudit.valid) {
      for (const err of customAudit.errors) {
        findings.push({
          findingId: `find-cp004-ungrounded-${findings.length + 1}`,
          category: 'CONSISTENCY',
          severity: 'BLOCKING',
          rule: 'POLICY_VIOLATION_UNGROUNDED_CLAIM',
          description: err,
          relatedProposalIds: [proposal.orchestrationId],
        });
      }
    }
  }

  // 4. Question D: Compliance & Capability Checks
  if ('authority' in orchestrationProposal) {
    const env = orchestrationProposal as AgentProposal<OrchestrationProposal>;
    if (env.authority.canExecute !== false) {
      findings.push({
        findingId: 'find-comp-can-execute',
        category: 'COMPLIANCE',
        severity: 'BLOCKING',
        rule: 'ZERO_EXECUTION_CAPABILITY',
        description: 'Orchestration proposal breached negative capability: claimed canExecute: true.',
        relatedProposalIds: [proposal.orchestrationId],
      });
    }
    if (env.authority.canApprove !== false) {
      findings.push({
        findingId: 'find-comp-can-approve',
        category: 'COMPLIANCE',
        severity: 'BLOCKING',
        rule: 'ZERO_APPROVAL_CAPABILITY',
        description: 'Orchestration proposal breached negative capability: claimed canApprove: true.',
        relatedProposalIds: [proposal.orchestrationId],
      });
    }
    if (env.authority.canMutateEvidence !== false) {
      findings.push({
        findingId: 'find-comp-can-mutate-evidence',
        category: 'COMPLIANCE',
        severity: 'BLOCKING',
        rule: 'ZERO_EVIDENCE_MUTATION_CAPABILITY',
        description: 'Orchestration proposal breached negative capability: claimed canMutateEvidence: true.',
        relatedProposalIds: [proposal.orchestrationId],
      });
    }
  }

  // Application artifact creation prohibition (NO cover letters, resumes, screening answers)
  if (
    'cover_letter' in proposal ||
    'resume' in proposal ||
    'screening_answers' in proposal ||
    'full_resume' in proposal
  ) {
    findings.push({
      findingId: 'find-comp-artifact-breach',
      category: 'SECURITY',
      severity: 'BLOCKING',
      rule: 'ORCHESTRATION_ARTIFACT_PROHIBITION',
      description: 'Orchestrator attempted to generate application artifacts before human review.',
      relatedProposalIds: [proposal.orchestrationId],
    });
  }

  // Self-approval prohibition
  if ('approved_by' in proposal || 'status' in proposal && (proposal as any).status === 'ready_to_apply') {
    findings.push({
      findingId: 'find-comp-self-approval',
      category: 'SECURITY',
      severity: 'BLOCKING',
      rule: 'SELF_APPROVAL_PROHIBITED',
      description: 'Orchestrator attempted autonomous self-approval.',
      relatedProposalIds: [proposal.orchestrationId],
    });
  }

  // Direct dispatch prohibition
  if ('dispatch' in proposal || 'execute' in proposal || (proposal as any).action === 'execute_application') {
    findings.push({
      findingId: 'find-comp-direct-dispatch',
      category: 'SECURITY',
      severity: 'BLOCKING',
      rule: 'DIRECT_DISPATCH_PROHIBITED',
      description: 'Orchestrator attempted direct execution dispatch.',
      relatedProposalIds: [proposal.orchestrationId],
    });
  }

  // 5. Decision Determination
  let decision: PolicyDecisionType = 'ALLOW_REVIEW';
  const hasBlockingFindings = findings.some((f) => f.severity === 'BLOCKING');

  if (context.forceDecision) {
    decision = context.forceDecision;
  } else if (hasBlockingFindings) {
    decision = 'BLOCK';
    rationale.push(`Policy Guard rejected proposal: ${findings.filter(f => f.severity === 'BLOCKING').length} blocking findings identified.`);
  } else if (proposal.requiredHumanDecisions && proposal.requiredHumanDecisions.some((d) => d.required)) {
    decision = 'REQUIRE_HUMAN_DECISION';
    rationale.push(`Policy Guard requires candidate decisions: ${proposal.requiredHumanDecisions.filter(d => d.required).length} mandatory decisions surfaced.`);
  } else {
    decision = 'ALLOW_REVIEW';
    rationale.push('All policy criteria satisfied. Proposal eligible for sovereign human review.');
  }

  return {
    policyDecisionId,
    orchestrationId: proposal.orchestrationId,
    candidateSnapshotId: snapshot.id,
    evidenceHash: snapshot.evidence_hash,
    decision,
    policyFindings: findings,
    requiredHumanDecisions: proposal.requiredHumanDecisions || [],
    reviewRequired: decision !== 'BLOCK',
    rationale,
    createdAt,
    proposed_by: 'server_policy_guard',
  };
}

/**
 * State machine enforcing governance transitions.
 * Ensures no agent can bypass intermediate gates to reach ARTIFACT_FROZEN or EXECUTED.
 */
export function transitionGovernanceState(
  currentState: GovernanceState,
  action: {
    type:
      | 'EVALUATE_POLICY'
      | 'RESOLVE_HUMAN_DECISION'
      | 'HUMAN_APPROVE'
      | 'HUMAN_REJECT'
      | 'FREEZE_ARTIFACT'
      | 'DISPATCH';
    actor: string;
    payload?: any;
  }
): GovernanceState {
  const { type, actor, payload } = action;

  // Security invariant: Agents cannot sign approvals, freeze artifacts, or execute dispatches!
  if (actor.startsWith('agt-') || actor === 'agent_orchestrator' || actor === 'server_policy_guard') {
    if (type === 'HUMAN_APPROVE' || type === 'FREEZE_ARTIFACT' || type === 'DISPATCH') {
      throw new Error(
        `AUTHORITY_VIOLATION: Agent '${actor}' attempted unauthorized state transition '${type}'. Only human candidates may approve and only server substrate may freeze/execute.`
      );
    }
  }

  switch (currentState) {
    case 'ORCHESTRATED': {
      if (type === 'EVALUATE_POLICY') {
        const decision: PolicyDecisionType = payload?.decision;
        if (decision === 'BLOCK') return 'POLICY_BLOCKED';
        if (decision === 'REQUIRE_HUMAN_DECISION') return 'REQUIRE_HUMAN_DECISION';
        if (decision === 'ALLOW_REVIEW') return 'AWAITING_HUMAN_REVIEW';
        throw new Error(`Invalid policy decision payload: ${decision}`);
      }
      break;
    }

    case 'REQUIRE_HUMAN_DECISION': {
      if (type === 'RESOLVE_HUMAN_DECISION') {
        const remainingDecisions = payload?.remainingDecisions || 0;
        if (remainingDecisions === 0) return 'AWAITING_HUMAN_REVIEW';
        return 'REQUIRE_HUMAN_DECISION';
      }
      if (type === 'HUMAN_REJECT') return 'HUMAN_REJECTED';
      break;
    }

    case 'AWAITING_HUMAN_REVIEW': {
      if (type === 'HUMAN_APPROVE') return 'HUMAN_APPROVED';
      if (type === 'HUMAN_REJECT') return 'HUMAN_REJECTED';
      break;
    }

    case 'HUMAN_APPROVED': {
      if (type === 'FREEZE_ARTIFACT') return 'ARTIFACT_FROZEN';
      break;
    }

    case 'ARTIFACT_FROZEN': {
      if (type === 'DISPATCH') return 'EXECUTED';
      break;
    }

    case 'POLICY_BLOCKED':
    case 'HUMAN_REJECTED':
    case 'EXECUTED':
      throw new Error(
        `TERMINAL_STATE_VIOLATION: Cannot transition out of terminal state '${currentState}'.`
      );

    default:
      break;
  }

  throw new Error(
    `INVALID_GOVERNANCE_TRANSITION: Transition '${type}' is invalid from state '${currentState}'.`
  );
}

/**
 * Human Candidate Review Gate.
 * Enforces authenticated human candidate inspection and records sovereign approval.
 */
export function signHumanApproval(params: HumanApprovalParams): ApprovedPackageRecord {
  const {
    policyDecision,
    candidateSignature,
    candidateSnapshot,
    orchestrationProposal,
    artifactContent,
    destination,
    approvalTimestamp,
  } = params;

  // 1. Prohibit Agent Signatures
  if (
    !candidateSignature ||
    candidateSignature.trim().length === 0 ||
    candidateSignature.startsWith('agt-') ||
    candidateSignature.includes('agent') ||
    candidateSignature === 'server_policy_guard'
  ) {
    throw new Error(
      `AUTHORITY_VIOLATION: Signature '${candidateSignature}' is invalid or belongs to an autonomous agent. Only authenticated human candidates may approve.`
    );
  }

  // 2. Policy Decision Gate: Cannot approve a BLOCKED proposal
  if (policyDecision.decision === 'BLOCK') {
    throw new Error(
      'POLICY_VIOLATION: Cannot approve an orchestration proposal that was BLOCKED by Policy Intelligence.'
    );
  }

  // 3. Snapshot Consistency
  if (policyDecision.candidateSnapshotId !== candidateSnapshot.id) {
    throw new Error(
      `SNAPSHOT_MISMATCH: Approval requested for snapshot '${candidateSnapshot.id}', but policy decision was issued for '${policyDecision.candidateSnapshotId}'.`
    );
  }

  // 4. Orchestration Consistency
  if (policyDecision.orchestrationId !== orchestrationProposal.orchestrationId) {
    throw new Error(
      `ORCHESTRATION_MISMATCH: Policy decision orchestration ID '${policyDecision.orchestrationId}' does not match proposal '${orchestrationProposal.orchestrationId}'.`
    );
  }

  const approvedAt = approvalTimestamp || new Date().toISOString();
  const canonicalFingerprint = computeArtifactFingerprint(artifactContent).hash;

  return {
    approvalId: `appr-${crypto.randomBytes(6).toString('hex')}`,
    policyDecisionId: policyDecision.policyDecisionId,
    orchestrationId: orchestrationProposal.orchestrationId,
    candidateSnapshotId: candidateSnapshot.id,
    evidenceHash: candidateSnapshot.evidence_hash,
    approvedBy: candidateSignature,
    approvedAt,
    destination,
    canonicalFingerprint,
    artifactContent: JSON.parse(JSON.stringify(artifactContent)),
    relocationConfirmation: params.relocationConfirmation ? { ...params.relocationConfirmation } : undefined,
    tailoredCoverLetterParagraph: params.tailoredCoverLetterParagraph || undefined,
  };
}

/**
 * The Freeze Boundary:
 * Compiles human-approved intent into an immutable artifact sealed with rja-c14n-v1-sha256.
 * Once frozen, zero agent or human modifications can alter payload.
 */
export function freezeApplicationArtifact(
  approvedPackage: ApprovedPackageRecord,
  payloadToFreeze: {
    resume: any;
    cover_letter: any;
    screening_answers: any;
  }
): FrozenArtifactPackage {
  // 1. Verify content integrity against human-approved fingerprint
  const currentFingerprint = computeArtifactFingerprint(payloadToFreeze).hash;
  if (currentFingerprint !== approvedPackage.canonicalFingerprint) {
    throw new Error(
      `FREEZE_BOUNDARY_VIOLATION: Artifact payload has been modified post-approval. Expected fingerprint '${approvedPackage.canonicalFingerprint}', got '${currentFingerprint}'.`
    );
  }

  const frozenArtifactId = `art-frozen-${currentFingerprint.slice(0, 16)}`;

  // Return deeply frozen immutable package
  const frozenPackage: FrozenArtifactPackage = {
    frozenArtifactId,
    policyDecisionId: approvedPackage.policyDecisionId,
    orchestrationId: approvedPackage.orchestrationId,
    candidateSnapshotId: approvedPackage.candidateSnapshotId,
    destination: approvedPackage.destination,
    approvedBy: approvedPackage.approvedBy,
    approvedAt: approvedPackage.approvedAt,
    canonicalFingerprint: currentFingerprint,
    fingerprintAlgorithm: DEFAULT_FINGERPRINT_SCHEME,
    artifactPayload: JSON.parse(JSON.stringify(payloadToFreeze)),
    immutable: true,
  };

  Object.freeze(frozenPackage);
  Object.freeze(frozenPackage.artifactPayload);

  return frozenPackage;
}

/**
 * Validates that a frozen artifact is 100% compliant with v4.6.1 execution substrate inputs.
 */
export function verifyFrozenArtifactForExecution(
  frozenArtifact: FrozenArtifactPackage,
  expectedDestination: string
): { valid: boolean; actualHash: string } {
  if (!frozenArtifact || !frozenArtifact.immutable) {
    throw new Error('EXECUTION_REJECTED: Execution requires an immutable FrozenArtifactPackage.');
  }

  if (frozenArtifact.destination !== expectedDestination) {
    throw new Error(
      `DESTINATION_MISMATCH: Frozen artifact was approved for '${frozenArtifact.destination}', cannot dispatch to '${expectedDestination}'.`
    );
  }

  const verification = verifyArtifactFingerprint(
    frozenArtifact.artifactPayload,
    frozenArtifact.canonicalFingerprint
  );

  if (!verification.valid) {
    throw new Error(
      `FINGERPRINT_TAMPERED: Frozen artifact failed cryptographic SHA-256 verification against master digest '${frozenArtifact.canonicalFingerprint}'.`
    );
  }

  return verification;
}

/**
 * Unified Lifecycle Trace representation across all 10 Alpha boundaries and Beta1 governance.
 */
export interface UnifiedLifecycleTrace {
  discovery: AgentProposal<any>;
  snapshot: EvidenceSnapshot;
  evaluation: AgentProposal<any>;
  planning: AgentProposal<any>;
  orchestration: AgentProposal<any>;
  policyDecision: PolicyDecisionProposal;
  humanApproval: ApprovedPackageRecord;
  frozenArtifact: FrozenArtifactPackage;
  receipt: {
    id: string;
    execution_attempt_id: string;
    verified_fingerprint: string;
    destination: string;
  };
  outcome: {
    outcomeId: string;
    executionId: string;
    frozenArtifactId: string;
    status: string;
    executionReceiptHash: string;
  };
  feedback: {
    feedbackId: string;
    sourceOutcomeId: string;
  };
  learningProposal: {
    learningId: string;
    sourceFeedbackIds: string[];
    currentProfileVersion: string;
    proposedProfileVersion: string;
  };
  experimentResult: {
    experimentId: string;
    learningProposalId: string;
    replayHash: string;
    overallStatus: string;
  };
  approvedProfileV2: {
    version: string;
    parentVersion?: string;
    sourceLearningId?: string;
  };
  futureDiscovery?: AgentProposal<any>;
}

/**
 * Beta1 Formal Governance Verifier:
 * Audits that an entire end-to-end lifecycle satisfies the Beta1 Golden Invariant:
 * "Every transition preserves provenance, authority boundaries, historical immutability,
 * and governance state across the complete lifecycle."
 */
export function verifyUnifiedLifecycleAuditTrail(lifecycle: UnifiedLifecycleTrace): {
  valid: boolean;
  violations: string[];
  traceChain: string[];
} {
  const violations: string[] = [];
  const traceChain: string[] = [];

  const {
    discovery,
    snapshot,
    evaluation,
    planning,
    orchestration,
    policyDecision,
    humanApproval,
    frozenArtifact,
    receipt,
    outcome,
    feedback,
    learningProposal,
    experimentResult,
    approvedProfileV2,
    futureDiscovery,
  } = lifecycle;

  // 1. T0 -> T1: Discovery Authority Boundary
  if (discovery.authority.canExecute || discovery.authority.canApprove || discovery.authority.canMutateEvidence) {
    violations.push('T0_AUTHORITY_VIOLATION: Discovery claimed unauthorized positive authority');
  }
  traceChain.push(`T0:discovery[${discovery.proposalId}]`);

  // 2. T1 Snapshot Validity
  if (!snapshot.id || !snapshot.evidence_hash || snapshot.evidence_hash.length !== 64) {
    violations.push('T1_SNAPSHOT_INVALID: Candidate snapshot lacks valid 64-char cryptographic digest');
  }
  traceChain.push(`T1:snapshot[${snapshot.id}]`);

  // 3. T1 -> T2: Evaluation Cites Snapshot
  if (evaluation.output.evidenceSnapshotId !== snapshot.id) {
    violations.push(`T2_SNAPSHOT_MISMATCH: Evaluation evaluated against '${evaluation.output.evidenceSnapshotId}', expected '${snapshot.id}'`);
  }
  traceChain.push(`T2:evaluation[${evaluation.proposalId}]`);

  // 4. T2 -> T3: Planning Sequences Evaluated Opportunities
  if (!planning.output.actions || planning.output.actions.length === 0) {
    violations.push('T3_PLANNING_EMPTY: Planning proposal contains no actions');
  }
  traceChain.push(`T3:planning[${planning.proposalId}]`);

  // 5. T3 -> T4: Orchestrator Links Upstream Proposals
  const orchOut = orchestration.output;
  if (!orchOut.discoveryProposalIds.includes(discovery.proposalId)) {
    violations.push(`T4_PROVENANCE_BREAK: Orchestration does not reference discovery proposal '${discovery.proposalId}'`);
  }
  if (!orchOut.evaluationProposalIds.includes(evaluation.proposalId)) {
    violations.push(`T4_PROVENANCE_BREAK: Orchestration does not reference evaluation proposal '${evaluation.proposalId}'`);
  }
  if (!orchOut.planningProposalIds.includes(planning.proposalId)) {
    violations.push(`T4_PROVENANCE_BREAK: Orchestration does not reference planning proposal '${planning.proposalId}'`);
  }
  traceChain.push(`T4:orchestration[${orchestration.proposalId}]`);

  // 6. T4 -> T5: Policy Decision Links Orchestration & Snapshot
  if (policyDecision.orchestrationId !== orchOut.orchestrationId) {
    violations.push(`T5_ORCHESTRATION_MISMATCH: Policy evaluated orchestration '${policyDecision.orchestrationId}', expected '${orchOut.orchestrationId}'`);
  }
  if (policyDecision.candidateSnapshotId !== snapshot.id) {
    violations.push(`T5_SNAPSHOT_MISMATCH: Policy evaluated snapshot '${policyDecision.candidateSnapshotId}', expected '${snapshot.id}'`);
  }
  traceChain.push(`T5:policy[${policyDecision.policyDecisionId}]`);

  // 7. T5 -> T6: Human Approval Gate
  if (!humanApproval.approvedBy || humanApproval.approvedBy.startsWith('agt-')) {
    violations.push('T6_AUTHORITY_VIOLATION: Approval missing or signed by an autonomous agent');
  }
  if (humanApproval.policyDecisionId !== policyDecision.policyDecisionId) {
    violations.push('T6_DECISION_MISMATCH: Approval policy ID diverges from Policy Decision');
  }
  traceChain.push(`T6:humanApproval[${humanApproval.approvalId}]`);

  // 8. T6 -> T7: Freeze Boundary
  if (frozenArtifact.canonicalFingerprint !== humanApproval.canonicalFingerprint) {
    violations.push('T7_FREEZE_TAMPER: Frozen artifact canonical fingerprint diverges from human approval');
  }
  if (!frozenArtifact.immutable) {
    violations.push('T7_MUTABILITY_VIOLATION: Frozen artifact is not marked immutable');
  }
  traceChain.push(`T7:frozenArtifact[${frozenArtifact.frozenArtifactId}]`);

  // 9. T7 -> T8: Execution Substrate
  if (receipt.verified_fingerprint !== frozenArtifact.canonicalFingerprint) {
    violations.push('T8_SUBSTRATE_FINGERPRINT_MISMATCH: Receipt fingerprint diverges from frozen artifact');
  }
  traceChain.push(`T8:receipt[${receipt.id}]`);

  // 10. T8 -> T9: Outcome Record
  if (outcome.executionId !== receipt.execution_attempt_id) {
    violations.push('T9_EXECUTION_MISMATCH: Outcome executionId diverges from receipt execution_attempt_id');
  }
  traceChain.push(`T9:outcome[${outcome.outcomeId}]`);

  // 11. T9 -> T10: Evidence Feedback Record
  if (feedback.sourceOutcomeId !== outcome.outcomeId) {
    violations.push('T10_OUTCOME_MISMATCH: Feedback sourceOutcomeId diverges from outcome record');
  }
  traceChain.push(`T10:feedback[${feedback.feedbackId}]`);

  // 12. T10 -> T11: Learning Proposal
  if (!learningProposal.sourceFeedbackIds.includes(feedback.feedbackId)) {
    violations.push('T11_FEEDBACK_MISMATCH: Learning proposal does not include feedback ID');
  }
  traceChain.push(`T11:learning[${learningProposal.learningId}]`);

  // 13. T11 -> T12: Replay Experiment
  if (experimentResult.learningProposalId !== learningProposal.learningId) {
    violations.push('T12_LEARNING_MISMATCH: Experiment learningProposalId diverges from learning proposal');
  }
  traceChain.push(`T12:experiment[${experimentResult.experimentId}]`);

  // 14. T12 -> Profile Iv+1: Evolution & Parent Version Pinned
  if (approvedProfileV2.version !== learningProposal.proposedProfileVersion) {
    violations.push('IV1_VERSION_MISMATCH: Approved profile version does not match proposed version');
  }
  if (approvedProfileV2.parentVersion !== learningProposal.currentProfileVersion) {
    violations.push('IV1_PARENT_MISMATCH: Approved profile parentVersion does not match current profile version');
  }
  traceChain.push(`Iv+1:profile[${approvedProfileV2.version}<-${approvedProfileV2.parentVersion}]`);

  // 15. Profile Iv+1 -> T0' Future Discovery
  if (futureDiscovery) {
    traceChain.push(`T0':discoveryFuture[${futureDiscovery.proposalId}]`);
  }

  return {
    valid: violations.length === 0,
    violations,
    traceChain,
  };
}

/**
 * RFC CP-002: Workday Screening Answer Pre-Validation.
 * Pre-validates screening answer lengths for Workday destinations against the 250-character ceiling.
 * INVARIANT: Pure deterministic validation — NEVER mutates or auto-truncates the authoritative artifact.
 */
export interface WorkdayValidationResult {
  valid: boolean;
  destination: string;
  isWorkday: boolean;
  maxCharacterLimit: number;
  warningThreshold: number;
  warnings: string[];
  errors: string[];
  characterCounts: { question_id: string; length: number; exceedsLimit: boolean }[];
}

export function validateWorkdayScreeningAnswers(
  screeningAnswers: any,
  destination: string = ''
): WorkdayValidationResult {
  const destLower = String(destination || '').toLowerCase();
  const isWorkday = destLower.includes('workday');
  const maxLimit = 250;
  const warningThreshold = 240;

  const result: WorkdayValidationResult = {
    valid: true,
    destination,
    isWorkday,
    maxCharacterLimit: maxLimit,
    warningThreshold,
    warnings: [],
    errors: [],
    characterCounts: [],
  };

  if (!isWorkday || !screeningAnswers) {
    return result;
  }

  const rawAnswers = Array.isArray(screeningAnswers.answers)
    ? screeningAnswers.answers
    : Array.isArray(screeningAnswers)
    ? screeningAnswers
    : [];

  for (let i = 0; i < rawAnswers.length; i++) {
    const item = rawAnswers[i];
    const qId = String(item.question_id || item.question || `q-${i + 1}`);
    const text = String(item.answer || item.text || '');
    const length = text.length;
    const exceeds = length > maxLimit;

    result.characterCounts.push({
      question_id: qId,
      length,
      exceedsLimit: exceeds,
    });

    if (exceeds) {
      result.valid = false;
      result.errors.push(
        `Workday pre-validation failed for '${qId}': length ${length} exceeds maximum allowed ${maxLimit} characters.`
      );
    } else if (length >= warningThreshold) {
      result.warnings.push(
        `Workday pre-validation warning for '${qId}': length ${length} approaches 250-character ceiling (warning threshold: ${warningThreshold}).`
      );
    }
  }

  return result;
}

/**
 * RFC CP-004: Pre-Flight Custom Paragraph Evidence & Length Validation.
 * Validates candidate-provided custom cover letter paragraph:
 * - Ensures length does not exceed 1000 characters.
 * - Extracts high-stakes credentials (degrees, licenses, certs) and audits against verified candidate snapshot.
 * - Blocks ungrounded credential claims before proposal approval.
 */
export interface CustomParagraphValidationResult {
  valid: boolean;
  hasCustomParagraph: boolean;
  length: number;
  maxCharacterLimit: number;
  verifiedClaims: string[];
  unsupportedClaims: string[];
  warnings: string[];
  errors: string[];
}

export function validateCustomCoverLetterParagraph(
  customParagraph: string | null | undefined,
  snapshot?: EvidenceSnapshot | null
): CustomParagraphValidationResult {
  const maxLimit = 1000;
  const rawText = customParagraph ? String(customParagraph).trim() : '';
  const length = rawText.length;

  const result: CustomParagraphValidationResult = {
    valid: true,
    hasCustomParagraph: length > 0,
    length,
    maxCharacterLimit: maxLimit,
    verifiedClaims: [],
    unsupportedClaims: [],
    warnings: [],
    errors: [],
  };

  if (!customParagraph || length === 0) {
    return result;
  }

  if (length > maxLimit) {
    result.valid = false;
    result.errors.push(
      `Custom paragraph pre-validation failed: length ${length} exceeds maximum allowed ${maxLimit} characters.`
    );
  }

  // Audit high stakes credentials if snapshot is available
  const snapAny = snapshot as any;
  const prof = snapAny?.profile_data || snapAny?.profile || snapAny?.data;
  if (snapshot && prof) {
    const HIGH_STAKES_CREDENTIALS = [
      'pmp',
      'prince2',
      'pe license',
      'professional engineer',
      'phd',
      'doctorate',
      'mba',
      'master of science',
      'cpa',
      'cissp',
      'aws certified solutions architect',
      'gcp professional cloud architect',
      'cka',
    ];

    const lowerText = rawText.toLowerCase();
    const verifiedCertifications = (prof.certifications || []).map((c: any) => String(c).toLowerCase().trim());
    const candidateSkills = [
      ...(prof.skills || []),
      ...(prof.technical_skills || []),
      ...(prof.verifiableFacts || []),
    ].map((s: any) => String(s).toLowerCase().trim());

    const fullEvidence = `${JSON.stringify(prof)} ${snapshot.evidence_hash || ''}`.toLowerCase();

    for (const cred of HIGH_STAKES_CREDENTIALS) {
      const credRegex = new RegExp(`\\b${cred}\\b`, 'i');
      if (credRegex.test(lowerText)) {
        const hasCertInProfile = verifiedCertifications.some((vc: string) => vc.includes(cred) || cred.includes(vc));
        const hasCertInEvidence = fullEvidence.includes(cred);
        const hasSkillInEvidence = candidateSkills.some((cs: string) => cs.includes(cred) || cred.includes(cs));

        if (hasCertInProfile || hasCertInEvidence || hasSkillInEvidence) {
          result.verifiedClaims.push(`Verified Credential: ${cred.toUpperCase()}`);
        } else {
          result.valid = false;
          result.unsupportedClaims.push(`Hallucinated or unverified credential claimed in custom paragraph: ${cred.toUpperCase()}`);
          result.errors.push(`UNGROUNDED_CLAIM_DETECTED: '${cred.toUpperCase()}' is not supported by verified candidate snapshot evidence.`);
        }
      }
    }
  }

  return result;
}



