// lib/agents/planning.ts
// RJA v5.0: 📋 Autonomous Planning Agent (Proposal-Only)
// Milestone v5.0-alpha4: Planning Intelligence & Deterministic Plan Sequencing
// Invariant: "Planning proposes what should happen next; it does not authorize what happens next."

import crypto from 'node:crypto';
import type {
  AgentProposal,
  EvaluationProposal,
  PlannedAction,
  PlannedActionType,
  PlanningAgentProposal,
  PlanningDependency,
  PlanningProposal,
  ProvenanceRecord,
} from './types';
import type { EvidenceSnapshot } from '../execution/types';
import { PLANNING_AGENT_CONTRACT } from './contracts';

export interface PlanningOptions {
  maxConcurrentApplications?: number;
  createdAt?: string;
  planId?: string;
  forceReviewRequired?: boolean;
}

/**
 * Extracts unwrapped EvaluationProposal from direct or enveloped inputs.
 */
function unwrapEvaluation(
  item: EvaluationProposal | AgentProposal<EvaluationProposal>
): { evaluation: EvaluationProposal; proposalId: string; discoveryId: string } {
  if ('output' in item && 'proposalId' in item) {
    const env = item as AgentProposal<EvaluationProposal>;
    return {
      evaluation: env.output,
      proposalId: env.proposalId,
      discoveryId: env.output.jobId,
    };
  }
  const evalProp = item as EvaluationProposal;
  return {
    evaluation: evalProp,
    proposalId: evalProp.evaluationId,
    discoveryId: evalProp.jobId,
  };
}

/**
 * Generates a deterministic PlanningProposal from evaluated opportunities and candidate evidence.
 *
 * Guarantees:
 * - Deterministic: Same evaluations + snapshot = exact same actions, ordering, and dependencies
 * - Non-authoritative: No 'execute' action exists; proposes review, missing evidence, hold, or defer
 * - Preserves evidence links: Traceable to candidate snapshot ID and upstream evaluation IDs
 */
export async function generatePlanningProposal(
  evaluationInputs: (EvaluationProposal | AgentProposal<EvaluationProposal>)[],
  snapshot: EvidenceSnapshot,
  options?: PlanningOptions
): Promise<PlanningProposal> {
  if (!snapshot || !snapshot.id || !snapshot.evidence_hash) {
    throw new Error('Planning Agent rejected: missing valid candidate evidence snapshot');
  }

  if (!Array.isArray(evaluationInputs) || evaluationInputs.length === 0) {
    throw new Error('Planning Agent rejected: at least one evaluated opportunity is required');
  }

  const createdAt = options?.createdAt || new Date().toISOString();
  const planId = options?.planId || `plan-${crypto.randomBytes(6).toString('hex')}`;
  const maxConcurrent = options?.maxConcurrentApplications || 5;

  const unwrapped = evaluationInputs.map(unwrapEvaluation);

  // Validate all evaluations point to the same candidate snapshot
  for (const { evaluation } of unwrapped) {
    if (evaluation.evidenceSnapshotId !== snapshot.id) {
      throw new Error(
        `Planning Agent snapshot mismatch: evaluation was performed against snapshot '${evaluation.evidenceSnapshotId}' but plan requested '${snapshot.id}'`
      );
    }
  }

  // Deterministically sort incoming evaluations by fit score descending, tiebreaker evaluationId
  const sortedEvaluations = [...unwrapped].sort((a, b) => {
    if (b.evaluation.fitScore !== a.evaluation.fitScore) {
      return b.evaluation.fitScore - a.evaluation.fitScore;
    }
    return a.proposalId.localeCompare(b.proposalId);
  });

  const actions: PlannedAction[] = [];
  const dependencies: PlanningDependency[] = [];
  const rationale: string[] = [];

  let activePreparationCount = 0;

  for (let i = 0; i < sortedEvaluations.length; i++) {
    const { evaluation, proposalId } = sortedEvaluations[i];
    const actionId = `act-${planId.slice(5)}-${i + 1}`;

    let actionType: PlannedActionType;
    let actionRationale: string;
    const prerequisites: string[] = [];

    // Rule 1: High Fit & Zero Gaps -> Prepare for candidate review
    if (
      (evaluation.tier === 'exceptional' || evaluation.tier === 'strong') &&
      evaluation.gapCount === 0
    ) {
      if (activePreparationCount < maxConcurrent) {
        actionType = 'prepare_for_review';
        actionRationale = `High alignment (${evaluation.fitScore}/100, ${evaluation.tier} tier) with zero qualification gaps. Prioritized for immediate draft preparation.`;
        activePreparationCount++;
      } else {
        actionType = 'hold';
        actionRationale = `High alignment but pacing concurrency limit reached (${maxConcurrent} active). Held for next batch.`;
        dependencies.push({
          dependencyId: `dep-${actionId}-pacing`,
          actionId,
          type: 'timeline_conflict',
          description: `Concurrency ceiling reached (${maxConcurrent} active applications)`,
          resolved: false,
        });
      }
    }
    // Rule 2: High Fit but with Qualification Gaps -> Request Missing Evidence
    else if (
      (evaluation.tier === 'exceptional' || evaluation.tier === 'strong') &&
      evaluation.gapCount > 0
    ) {
      actionType = 'request_missing_evidence';
      actionRationale = `Strong role alignment (${evaluation.fitScore}/100), but candidate profile has ${evaluation.gapCount} missing prerequisite(s): ${evaluation.missingSkills.join(', ') || 'unverified requirements'}.`;

      for (const skill of evaluation.missingSkills) {
        prerequisites.push(`verify_skill:${skill}`);
        dependencies.push({
          dependencyId: `dep-${actionId}-${skill.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          actionId,
          type: 'missing_evidence',
          description: `Missing verified evidence for required skill '${skill}'`,
          resolved: false,
        });
      }

      for (const req of evaluation.evaluatedRequirements) {
        if (req.status === 'gap' && req.classification === 'required') {
          prerequisites.push(`verify_requirement:${req.id}`);
          dependencies.push({
            dependencyId: `dep-${actionId}-${req.id}`,
            actionId,
            type: 'prerequisite_credential',
            description: `Unsatisfied required criterion: ${req.raw_requirement.slice(0, 60)}...`,
            resolved: false,
          });
        }
      }
    }
    // Rule 3: Moderate Fit -> Hold until higher-tier opportunities clear
    else if (evaluation.tier === 'moderate') {
      actionType = 'hold';
      actionRationale = `Moderate alignment (${evaluation.fitScore}/100). Held to prioritize top-tier opportunities.`;
      dependencies.push({
        dependencyId: `dep-${actionId}-tier`,
        actionId,
        type: 'tier_threshold',
        description: 'Opportunity held below primary target tier threshold (score < 70)',
        resolved: false,
      });
    }
    // Rule 4: Exploratory / Low Fit -> Defer
    else {
      actionType = 'defer';
      actionRationale = `Low alignment score (${evaluation.fitScore}/100, exploratory tier). Deferred to avoid diluting candidate velocity.`;
    }

    actions.push({
      actionId,
      evaluationProposalId: proposalId,
      jobId: evaluation.jobId,
      company: evaluation.company,
      jobTitle: evaluation.jobTitle,
      action: actionType,
      priority: i + 1,
      prerequisites,
      rationale: actionRationale,
    });
  }

  const reviewRequired =
    options?.forceReviewRequired ??
    (dependencies.some((d) => !d.resolved) ||
      actions.some((a) => a.action === 'request_missing_evidence' || a.action === 'hold'));

  rationale.push(
    `Synthesized deterministic plan across ${actions.length} opportunity(ies). ` +
      `Actions: ${actions.filter((a) => a.action === 'prepare_for_review').length} ready for draft, ` +
      `${actions.filter((a) => a.action === 'request_missing_evidence').length} awaiting evidence, ` +
      `${actions.filter((a) => a.action === 'hold').length} held, ` +
      `${actions.filter((a) => a.action === 'defer').length} deferred.`
  );

  return {
    planId,
    candidateSnapshotId: snapshot.id,
    evidenceHash: snapshot.evidence_hash,
    inputs: {
      evaluationProposalIds: unwrapped.map((u) => u.proposalId),
      discoveryProposalIds: unwrapped.map((u) => u.discoveryId),
    },
    actions,
    dependencies,
    reviewRequired,
    rationale,
    createdAt,
    proposed_by: 'planning_agent',
  };
}

/**
 * Universal Provenance Envelope constructor for Planning proposals.
 */
export function createPlanningProposalEnvelope(
  output: PlanningProposal,
  snapshot: EvidenceSnapshot,
  options?: { proposalId?: string; createdAt?: string }
): PlanningAgentProposal {
  const proposalId =
    options?.proposalId || `prop-agt-planning-v1-${crypto.randomBytes(6).toString('hex')}`;
  const createdAt = options?.createdAt || output.createdAt || new Date().toISOString();

  // Tamper-evident digest over plan actions, dependencies, and candidate snapshot evidence
  const planSummary = output.actions
    .map((a) => `${a.actionId}:${a.priority}:${a.action}:${a.evaluationProposalId}`)
    .join('|');

  const provenanceHash = crypto
    .createHash('sha256')
    .update(`${output.planId}::${snapshot.id}::${snapshot.evidence_hash}::${planSummary}`)
    .digest('hex');

  const provenance: ProvenanceRecord = {
    source: 'planning_agent',
    source_url: `snapshot://${snapshot.id}`,
    retrieved_at: createdAt,
    raw_hash: snapshot.evidence_hash,
    adapter_version: 'v5.0-planning',
    provenance_hash: provenanceHash,
    is_verified: true,
  };

  return {
    proposalId,
    agentId: PLANNING_AGENT_CONTRACT.agent_id,
    agentVersion: PLANNING_AGENT_CONTRACT.version,
    createdAt,
    inputEvidenceRefs: [snapshot.id],
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
 * Emits a Planning Proposal wrapped in the Universal Provenance Envelope.
 */
export async function emitPlanningProposal(
  evaluations: (EvaluationProposal | AgentProposal<EvaluationProposal>)[],
  snapshot: EvidenceSnapshot,
  options?: PlanningOptions
): Promise<PlanningAgentProposal> {
  const proposal = await generatePlanningProposal(evaluations, snapshot, options);
  return createPlanningProposalEnvelope(proposal, snapshot, {
    createdAt: proposal.createdAt,
  });
}
