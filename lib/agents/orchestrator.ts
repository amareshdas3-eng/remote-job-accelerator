// lib/agents/orchestrator.ts
// RJA v5.0: 🤖 Autonomous Agent Orchestrator (Coordination-Only)
// Milestone v5.0-alpha5: Orchestration Intelligence & Multi-Agent Coordination
// Governing Invariant: "Orchestration coordinates intelligence; it does not manufacture authority."

import crypto from 'node:crypto';
import type {
  AgentOrchestrationProposal,
  AgentProposal,
  DiscoveryProposal,
  EvaluationProposal,
  HumanDecision,
  HumanDecisionType,
  OrchestrationConflict,
  OrchestrationConflictType,
  OrchestrationProposal,
  PlanningProposal,
  ProvenanceRecord,
} from './types';
import type { EvidenceSnapshot } from '../execution/types';
import { ORCHESTRATOR_AGENT_CONTRACT } from './contracts';

export interface OrchestratorOptions {
  orchestrationId?: string;
  createdAt?: string;
  forceReviewRequired?: boolean;
}

export interface OrchestrationInputs {
  discoveryProposals: (DiscoveryProposal | AgentProposal<DiscoveryProposal>)[];
  evaluationProposals: (EvaluationProposal | AgentProposal<EvaluationProposal>)[];
  planningProposals: (PlanningProposal | AgentProposal<PlanningProposal>)[];
}

interface UnwrappedDiscovery {
  proposal: DiscoveryProposal;
  proposalId: string;
}

interface UnwrappedEvaluation {
  proposal: EvaluationProposal;
  proposalId: string;
}

interface UnwrappedPlanning {
  proposal: PlanningProposal;
  proposalId: string;
}

function unwrapDiscovery(
  item: DiscoveryProposal | AgentProposal<DiscoveryProposal>
): UnwrappedDiscovery {
  if ('output' in item && 'proposalId' in item) {
    const env = item as AgentProposal<DiscoveryProposal>;
    return { proposal: env.output, proposalId: env.proposalId };
  }
  const disc = item as DiscoveryProposal;
  return { proposal: disc, proposalId: disc.jobId || 'disc-unknown' };
}

function unwrapEvaluation(
  item: EvaluationProposal | AgentProposal<EvaluationProposal>
): UnwrappedEvaluation {
  if ('output' in item && 'proposalId' in item) {
    const env = item as AgentProposal<EvaluationProposal>;
    return { proposal: env.output, proposalId: env.proposalId };
  }
  const evalProp = item as EvaluationProposal;
  return { proposal: evalProp, proposalId: evalProp.evaluationId || 'eval-unknown' };
}

function unwrapPlanning(
  item: PlanningProposal | AgentProposal<PlanningProposal>
): UnwrappedPlanning {
  if ('output' in item && 'proposalId' in item) {
    const env = item as AgentProposal<PlanningProposal>;
    return { proposal: env.output, proposalId: env.proposalId };
  }
  const plan = item as PlanningProposal;
  return { proposal: plan, proposalId: plan.planId || 'plan-unknown' };
}

/**
 * Synthesizes Discovery, Evaluation, and Planning proposals into a single, unified OrchestrationProposal.
 *
 * Guarantees:
 * - Deterministic: Given identical inputs and snapshot, returns exact same output.
 * - Insertion-order invariant: Input proposal array ordering does not affect output.
 * - Conflict detection: Detects contradictions between evaluated gaps and planned readiness.
 * - Non-authoritative: Does not approve, dispatch, mutate evidence, or generate application materials.
 */
export async function synthesizeOrchestrationProposal(
  inputs: OrchestrationInputs,
  snapshot: EvidenceSnapshot,
  options?: OrchestratorOptions
): Promise<OrchestrationProposal> {
  if (!snapshot || !snapshot.id || !snapshot.evidence_hash) {
    throw new Error('Agent Orchestrator rejected: missing valid candidate evidence snapshot');
  }

  const { discoveryProposals, evaluationProposals, planningProposals } = inputs;

  if (
    !Array.isArray(discoveryProposals) ||
    !Array.isArray(evaluationProposals) ||
    !Array.isArray(planningProposals)
  ) {
    throw new Error('Agent Orchestrator rejected: inputs must contain arrays of discovery, evaluation, and planning proposals');
  }

  const createdAt = options?.createdAt || new Date().toISOString();
  const orchestrationId =
    options?.orchestrationId || `orch-${crypto.randomBytes(6).toString('hex')}`;

  // 1. Unwrap and sort all input proposals by ID for strict insertion-order invariance
  const unwrappedDiscoveries: UnwrappedDiscovery[] = discoveryProposals
    .map(unwrapDiscovery)
    .sort((a, b) => a.proposalId.localeCompare(b.proposalId));

  const unwrappedEvaluations: UnwrappedEvaluation[] = evaluationProposals
    .map(unwrapEvaluation)
    .sort((a, b) => a.proposalId.localeCompare(b.proposalId));

  const unwrappedPlans: UnwrappedPlanning[] = planningProposals
    .map(unwrapPlanning)
    .sort((a, b) => a.proposalId.localeCompare(b.proposalId));

  const conflicts: OrchestrationConflict[] = [];
  const requiredHumanDecisions: HumanDecision[] = [];
  const rationale: string[] = [];

  // Map evaluations by evaluationId and by jobId for lookup
  const evalById = new Map<string, UnwrappedEvaluation>();
  const evalByJobId = new Map<string, UnwrappedEvaluation>();
  for (const item of unwrappedEvaluations) {
    evalById.set(item.proposal.evaluationId, item);
    evalById.set(item.proposalId, item);
    evalByJobId.set(item.proposal.jobId, item);
  }

  // 2. Snapshot Verification & Divergence Detection
  for (const { proposal: evalProp, proposalId } of unwrappedEvaluations) {
    if (
      evalProp.evidenceSnapshotId !== snapshot.id ||
      evalProp.evidenceHash !== snapshot.evidence_hash
    ) {
      conflicts.push({
        conflictId: `conf-divergent-snap-${evalProp.evaluationId}`,
        type: 'SNAPSHOT_DRIFT',
        severity: 'critical',
        blocking: true,
        description: `Evaluation '${evalProp.evaluationId}' was evaluated against snapshot '${evalProp.evidenceSnapshotId}' (${evalProp.evidenceHash}), divergent from current candidate snapshot '${snapshot.id}' (${snapshot.evidence_hash}).`,
        proposalIds: [proposalId],
        involvedProposalIds: [proposalId],
      });
    }
  }

  for (const { proposal: planProp, proposalId } of unwrappedPlans) {
    if (
      planProp.candidateSnapshotId !== snapshot.id ||
      planProp.evidenceHash !== snapshot.evidence_hash
    ) {
      conflicts.push({
        conflictId: `conf-divergent-snap-${planProp.planId}`,
        type: 'SNAPSHOT_DRIFT',
        severity: 'critical',
        blocking: true,
        description: `Plan '${planProp.planId}' was sequenced against snapshot '${planProp.candidateSnapshotId}' (${planProp.evidenceHash}), divergent from current candidate snapshot '${snapshot.id}' (${snapshot.evidence_hash}).`,
        proposalIds: [proposalId],
        involvedProposalIds: [proposalId],
      });
    }
  }

  // 3. Cross-Agent Contradiction Detection: Gap vs Ready Conflicts
  for (const { proposal: planProp, proposalId: planEnvelopeId } of unwrappedPlans) {
    for (const action of planProp.actions) {
      const matchingEval =
        evalById.get(action.evaluationProposalId) || evalByJobId.get(action.jobId);

      if (!matchingEval) {
        conflicts.push({
          conflictId: `conf-missing-eval-${action.actionId}`,
          type: 'STALE_PROPOSAL',
          severity: 'critical',
          blocking: true,
          description: `Planning action '${action.actionId}' references evaluation '${action.evaluationProposalId}' which is missing from orchestrator context.`,
          proposalIds: [planEnvelopeId],
          involvedProposalIds: [planEnvelopeId],
        });
        continue;
      }

      // Check if plan recommends prepare_for_review despite critical gaps in evaluation
      if (action.action === 'prepare_for_review') {
        const hasUnmetRequirements = matchingEval.proposal.evaluatedRequirements?.some(
          (req) => req.status === 'gap'
        );
        const hasGaps =
          matchingEval.proposal.gapCount > 0 ||
          (Array.isArray(matchingEval.proposal.missingSkills) &&
            matchingEval.proposal.missingSkills.length > 0);

        if (hasUnmetRequirements || hasGaps) {
          conflicts.push({
            conflictId: `conf-gap-ready-${action.actionId}`,
            type: 'PLAN_CONTRADICTION',
            severity: 'critical',
            blocking: true,
            description: `Contradiction detected: Planning action '${action.actionId}' marked '${action.jobTitle}' at '${action.company}' as 'prepare_for_review', but Evaluation '${matchingEval.proposal.evaluationId}' identified unresolved qualification gaps.`,
            proposalIds: [planEnvelopeId, matchingEval.proposalId],
            involvedProposalIds: [planEnvelopeId, matchingEval.proposalId],
          });
        }
      }
    }
  }

  // 4. Human Decision Extraction
  // Extract decisions for each planned action
  for (const { proposal: planProp, proposalId: planEnvelopeId } of unwrappedPlans) {
    for (const action of planProp.actions) {
      if (action.action === 'prepare_for_review') {
        requiredHumanDecisions.push({
          decisionId: `dec-auth-draft-${action.actionId}`,
          type: 'authorize_draft',
          title: `Authorize Application Draft: ${action.company} — ${action.jobTitle}`,
          description: `Prioritized as #${action.priority}. Candidate review required before generating tailored application materials.`,
          relatedProposalIds: [planEnvelopeId, action.evaluationProposalId],
          reason: `Action '${action.actionId}' prioritized as #${action.priority}. Requires candidate confirmation before draft generation.`,
          options: ['Approve Draft Creation', 'Reject Opportunity', 'Defer Preparation'],
          targetJobId: action.jobId,
          required: true,
        });
      } else if (action.action === 'request_missing_evidence') {
        requiredHumanDecisions.push({
          decisionId: `dec-evidence-${action.actionId}`,
          type: 'provide_missing_evidence',
          title: `Provide Missing Evidence for ${action.company}`,
          description: `Action '${action.actionId}' requires candidate credentials or evidence clarification before application can proceed. Rationale: ${action.rationale}`,
          relatedProposalIds: [planEnvelopeId, action.evaluationProposalId],
          reason: action.rationale,
          options: ['Upload Verified Evidence', 'Acknowledge Gap & Proceed', 'Drop Opportunity'],
          targetJobId: action.jobId,
          required: true,
        });
      } else if (action.action === 'defer' || action.action === 'hold') {
        requiredHumanDecisions.push({
          decisionId: `dec-override-${action.actionId}`,
          type: 'override_deferral',
          title: `Review Deferred Role: ${action.company}`,
          description: `Application preparation deferred/held due to concurrency pacing or threshold. Rationale: ${action.rationale}`,
          relatedProposalIds: [planEnvelopeId],
          reason: action.rationale,
          options: ['Accept Deferral', 'Override & Expedite'],
          targetJobId: action.jobId,
          required: false,
        });
      }
    }

    // Extract decisions for plan dependencies
    for (const dep of planProp.dependencies) {
      if (!dep.resolved && dep.type === 'missing_evidence') {
        const existingDecision = requiredHumanDecisions.find(
          (d) => d.decisionId === `dec-dep-${dep.dependencyId}`
        );
        if (!existingDecision) {
          requiredHumanDecisions.push({
            decisionId: `dec-dep-${dep.dependencyId}`,
            type: 'provide_missing_evidence',
            title: `Resolve Dependency: ${dep.description}`,
            description: `Plan dependency '${dep.dependencyId}' is unresolved: ${dep.description}`,
            relatedProposalIds: [planEnvelopeId],
            reason: `Unresolved dependency: ${dep.description}`,
            options: ['Provide Evidence', 'Waive Requirement', 'Drop Role'],
            targetJobId: dep.actionId,
            required: true,
          });
        }
      }
    }
  }

  // Extract decisions for any critical conflicts
  for (const conflict of conflicts) {
    if (conflict.blocking || conflict.severity === 'critical') {
      requiredHumanDecisions.push({
        decisionId: `dec-resolve-${conflict.conflictId}`,
        type: 'resolve_conflict',
        title: `Resolve Orchestration Contradiction (${conflict.type})`,
        description: conflict.description,
        relatedProposalIds: conflict.proposalIds || conflict.involvedProposalIds || [],
        reason: `Conflict detected: ${conflict.description}`,
        options: ['Drop Disputed Opportunity', 'Override Contradiction', 'Re-evaluate with Fresh Evidence'],
        targetJobId: conflict.proposalIds[0] || 'unknown',
        required: true,
      });
    }
  }

  // 5. Deduplicate and sort decisions and conflicts deterministically
  const uniqueConflicts = Array.from(
    new Map(conflicts.map((c) => [c.conflictId, c])).values()
  ).sort((a, b) => a.conflictId.localeCompare(b.conflictId));

  const uniqueDecisions = Array.from(
    new Map(requiredHumanDecisions.map((d) => [d.decisionId, d])).values()
  ).sort((a, b) => a.decisionId.localeCompare(b.decisionId));

  // Synthesize rationale
  rationale.push(
    `Orchestrated ${unwrappedDiscoveries.length} discovered opportunities, ${unwrappedEvaluations.length} evaluations, and ${unwrappedPlans.length} plans.`
  );
  if (uniqueConflicts.length > 0) {
    rationale.push(`Detected ${uniqueConflicts.length} cross-agent conflicts requiring resolution.`);
  }
  if (uniqueDecisions.length > 0) {
    rationale.push(`Extracted ${uniqueDecisions.length} human decisions (${uniqueDecisions.filter(d => d.required).length} mandatory).`);
  }
  rationale.push('Orchestration coordinates intelligence; human candidate retains sovereign approval authority.');

  const discoveryProposalIds = unwrappedDiscoveries.map((d) => d.proposalId).sort();
  const evaluationProposalIds = unwrappedEvaluations.map((e) => e.proposalId).sort();
  const planningProposalIds = unwrappedPlans.map((p) => p.proposalId).sort();
  const selectedPlanIds = unwrappedPlans.map((p) => p.proposal.planId).sort();

  return {
    orchestrationId,
    candidateSnapshotId: snapshot.id,
    evidenceHash: snapshot.evidence_hash,
    discoveryProposalIds,
    evaluationProposalIds,
    planningProposalIds,
    selectedPlanIds,
    conflicts: uniqueConflicts,
    requiredHumanDecisions: uniqueDecisions,
    reviewRequired: true, // Orchestration proposals ALWAYS require human review before drafting
    rationale,
    createdAt,
    proposed_by: 'agent_orchestrator',
  };
}

/**
 * Universal Provenance Envelope constructor for Orchestration proposals.
 */
export function createOrchestrationProposalEnvelope(
  output: OrchestrationProposal,
  snapshot: EvidenceSnapshot,
  options?: { proposalId?: string; createdAt?: string }
): AgentOrchestrationProposal {
  const proposalId =
    options?.proposalId || `prop-agt-orchestrator-v1-${crypto.randomBytes(6).toString('hex')}`;
  const createdAt = options?.createdAt || output.createdAt || new Date().toISOString();

  // Tamper-evident digest over orchestration contents and upstream references
  const summary = [
    output.orchestrationId,
    snapshot.id,
    snapshot.evidence_hash,
    output.discoveryProposalIds.join(','),
    output.evaluationProposalIds.join(','),
    output.planningProposalIds.join(','),
    output.selectedPlanIds.join(','),
    output.conflicts.map((c) => `${c.conflictId}:${c.type}:${c.severity}`).join('|'),
    output.requiredHumanDecisions.map((d) => `${d.decisionId}:${d.type}:${d.targetJobId}`).join('|'),
  ].join('::');

  const provenanceHash = crypto
    .createHash('sha256')
    .update(summary)
    .digest('hex');

  const provenance: ProvenanceRecord = {
    source: 'agent_orchestrator',
    source_url: `snapshot://${snapshot.id}`,
    retrieved_at: createdAt,
    raw_hash: snapshot.evidence_hash,
    adapter_version: 'v5.0-orchestration',
    provenance_hash: provenanceHash,
    is_verified: true,
  };

  const inputEvidenceRefs = [
    snapshot.id,
    ...output.discoveryProposalIds,
    ...output.evaluationProposalIds,
    ...output.planningProposalIds,
  ];

  return {
    proposalId,
    agentId: ORCHESTRATOR_AGENT_CONTRACT.agent_id,
    agentVersion: ORCHESTRATOR_AGENT_CONTRACT.version,
    createdAt,
    inputEvidenceRefs,
    output,
    authority: {
      canExecute: false,
      canApprove: false,
      canMutateEvidence: false,
    },
    provenance,
  };
}

/**
 * Emits an Orchestration Proposal wrapped in the Universal Provenance Envelope.
 */
export async function emitOrchestrationProposal(
  inputs: OrchestrationInputs,
  snapshot: EvidenceSnapshot,
  options?: OrchestratorOptions
): Promise<AgentOrchestrationProposal> {
  const proposal = await synthesizeOrchestrationProposal(inputs, snapshot, options);
  return createOrchestrationProposalEnvelope(proposal, snapshot, {
    createdAt: proposal.createdAt,
  });
}

/**
 * Pure function alias: orchestrate(Discovery[], Evaluation[], Planning[], EvidenceSnapshot)
 */
export const orchestrate = synthesizeOrchestrationProposal;

