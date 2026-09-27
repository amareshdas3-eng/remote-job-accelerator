// lib/agents/policyGuard.ts
// RJA v5.0: Policy Guard Boundary Enforcement Engine

import crypto from 'node:crypto';
import type {
  AgentProposal,
  AgentType,
  DiscoveryProposal,
  EvaluationProposal,
  EvidenceFeedbackRecord,
  ExperimentResult,
  LearningProposal,
  OrchestrationProposal,
  OutcomeRecord,
  PlanningProposal,
  PolicyGuardResult,
} from './types';
import { AGENT_AUTHORITY_REGISTRY } from './contracts';
import { verifyProvenanceRecord } from './discovery';
import { verifyEvidenceCitation } from './evaluation';
import { canonicalizeOutcome, validateExecutionReceipt } from './outcome';
import { canonicalizeFeedback } from './feedback';
import { canonicalizeLearning } from './learning';
import { canonicalizeExperiment, computeExperimentHash } from './experimentation';

/**
 * Validates whether an agent's proposed output adheres strictly to its declared authority contract.
 *
 * Enforces:
 * - Negative capabilities (banned actions)
 * - Required provenance integrity
 * - Prohibition of autonomous self-approval
 * - Prohibition of direct execution dispatch
 * - Prohibition of candidate evidence mutation
 */
export function validateAgentProposal(
  proposal: any,
  agentType: AgentType,
  rawContext?: any
): PolicyGuardResult {
  const contract = AGENT_AUTHORITY_REGISTRY[agentType];
  const violations: string[] = [];
  const evaluatedAt = new Date().toISOString();

  if (!contract) {
    return {
      allowed: false,
      violations: [`Unrecognized or unregistered agent type: ${agentType}`],
      agent_id: 'unknown',
      evaluated_at: evaluatedAt,
    };
  }

  if (!proposal || typeof proposal !== 'object') {
    return {
      allowed: false,
      violations: ['Agent proposal must be a valid non-null object'],
      agent_id: contract.agent_id,
      evaluated_at: evaluatedAt,
    };
  }

  // --- 0. Universal Provenance Envelope Inspection ---
  const isEnveloped = 'output' in proposal && 'authority' in proposal;
  let envelope = isEnveloped ? (proposal as AgentProposal) : null;
  const innerPayload = isEnveloped ? proposal.output : proposal;

  if (isEnveloped && envelope) {
    // 0.1 Authority Declaration Boundary Verification
    if (!envelope.authority || typeof envelope.authority !== 'object') {
      violations.push('ENVELOPE_AUTHORITY_MISSING: Agent proposal envelope lacks required authority declaration');
    } else {
      if (envelope.authority.canExecute !== false) {
        violations.push(
          `AUTHORITY_VIOLATION: Agent '${contract.agent_id}' claimed canExecute: true. Autonomous execution is strictly forbidden.`
        );
      }
      if (envelope.authority.canApprove !== false) {
        violations.push(
          `AUTHORITY_VIOLATION: Agent '${contract.agent_id}' claimed canApprove: true. Autonomous application approval is strictly forbidden.`
        );
      }
      if (envelope.authority.canMutateEvidence !== false) {
        violations.push(
          `AUTHORITY_VIOLATION: Agent '${contract.agent_id}' claimed canMutateEvidence: true. Candidate evidence modification is strictly forbidden.`
        );
      }
    }

    // 0.2 Envelope Header & Provenance Validation
    if (!envelope.proposalId || typeof envelope.proposalId !== 'string') {
      violations.push('ENVELOPE_ID_INVALID: Proposal envelope missing required proposalId string');
    }
    if (!envelope.agentId || envelope.agentId !== contract.agent_id) {
      violations.push(
        `ENVELOPE_AGENT_MISMATCH: Envelope agentId '${envelope.agentId}' does not match contract '${contract.agent_id}'`
      );
    }
    if (!envelope.createdAt) {
      violations.push('ENVELOPE_TIMESTAMP_MISSING: Proposal envelope missing createdAt timestamp');
    }
    if (!Array.isArray(envelope.inputEvidenceRefs)) {
      violations.push('ENVELOPE_EVIDENCE_REFS_INVALID: inputEvidenceRefs must be an array of evidence identifiers');
    }
    if (!envelope.provenance || !envelope.provenance.provenance_hash) {
      violations.push('ENVELOPE_PROVENANCE_MISSING: Envelope lacks required cryptographic provenance record');
    } else if (agentType === 'discovery' && rawContext && !verifyProvenanceRecord(envelope.provenance, rawContext)) {
      violations.push('DISCOVERY_PROVENANCE_FORGED: Envelope provenance record digest mismatch with source context');
    } else if (agentType === 'evaluation' && rawContext && rawContext.evidence_hash) {
      const evalProp = innerPayload as EvaluationProposal;
      if (evalProp.evaluationId && evalProp.jobId) {
        const expectedEvalDigest = crypto
          .createHash('sha256')
          .update(
            `${evalProp.evaluationId}::${evalProp.jobId}::${rawContext.id}::${rawContext.evidence_hash}::${evalProp.fitScore}`
          )
          .digest('hex');
        if (envelope.provenance.provenance_hash !== expectedEvalDigest) {
          violations.push('EVALUATION_PROVENANCE_FORGED: Evaluation provenance hash mismatch with output digest');
        }
      }
    } else if (agentType === 'planning' && rawContext && rawContext.evidence_hash) {
      const plan = innerPayload as PlanningProposal;
      if (plan.planId && Array.isArray(plan.actions)) {
        const planSummary = plan.actions
          .map((a: any) => `${a.actionId}:${a.priority}:${a.action}:${a.evaluationProposalId}`)
          .join('|');
        const expectedPlanDigest = crypto
          .createHash('sha256')
          .update(`${plan.planId}::${rawContext.id}::${rawContext.evidence_hash}::${planSummary}`)
          .digest('hex');
        if (envelope.provenance.provenance_hash !== expectedPlanDigest) {
          violations.push('PLANNING_PROVENANCE_FORGED: Planning provenance hash mismatch with plan digest');
        }
      }
    } else if (agentType === 'orchestrator' && rawContext && rawContext.evidence_hash) {
      const orch = innerPayload as OrchestrationProposal;
      if (orch.orchestrationId && Array.isArray(orch.discoveryProposalIds)) {
        const summary = [
          orch.orchestrationId,
          rawContext.id,
          rawContext.evidence_hash,
          orch.discoveryProposalIds.join(','),
          orch.evaluationProposalIds.join(','),
          orch.planningProposalIds.join(','),
          orch.selectedPlanIds.join(','),
          orch.conflicts.map((c: any) => `${c.conflictId}:${c.type}:${c.severity}`).join('|'),
          orch.requiredHumanDecisions.map((d: any) => `${d.decisionId}:${d.type}:${d.targetJobId}`).join('|'),
        ].join('::');
        const expectedOrchDigest = crypto
          .createHash('sha256')
          .update(summary)
          .digest('hex');
        if (envelope.provenance.provenance_hash !== expectedOrchDigest) {
          violations.push(
            'ORCHESTRATION_PROVENANCE_FORGED: Orchestrator provenance hash mismatch with output digest'
          );
        }
      }
    } else if (agentType === 'outcome' && rawContext && rawContext.evidence_hash) {
      const outcome = innerPayload as OutcomeRecord;
      if (outcome && outcome.outcomeId) {
        const canonicalOutcomeString = canonicalizeOutcome(outcome);
        const expectedOutcomeDigest = crypto
          .createHash('sha256')
          .update(
            `${outcome.outcomeId}::${rawContext.id}::${rawContext.evidence_hash}::${canonicalOutcomeString}`
          )
          .digest('hex');
        if (envelope.provenance.provenance_hash !== expectedOutcomeDigest) {
          violations.push('OUTCOME_PROVENANCE_FORGED: Outcome provenance hash mismatch with output digest');
        }
      }
    } else if (agentType === 'feedback' && rawContext && rawContext.evidence_hash) {
      const fb = innerPayload as EvidenceFeedbackRecord;
      if (fb && fb.feedbackId) {
        const canonicalFeedbackString = canonicalizeFeedback(fb);
        const expectedFeedbackDigest = crypto
          .createHash('sha256')
          .update(
            `${fb.feedbackId}::${rawContext.id}::${rawContext.evidence_hash}::${canonicalFeedbackString}`
          )
          .digest('hex');
        if (envelope.provenance.provenance_hash !== expectedFeedbackDigest) {
          violations.push('FEEDBACK_PROVENANCE_FORGED: Feedback provenance hash mismatch with output digest');
        }
      }
    } else if (agentType === 'learning' && rawContext && rawContext.evidence_hash) {
      const learn = innerPayload as LearningProposal;
      if (learn && learn.learningId) {
        const canonicalLearningString = canonicalizeLearning(learn);
        const expectedLearningDigest = crypto
          .createHash('sha256')
          .update(
            `${learn.learningId}::${rawContext.id}::${rawContext.evidence_hash}::${canonicalLearningString}`
          )
          .digest('hex');
        if (envelope.provenance.provenance_hash !== expectedLearningDigest) {
          violations.push('LEARNING_PROVENANCE_FORGED: Learning provenance hash mismatch with output digest');
        }
      }
    } else if (agentType === 'experiment') {
      const exp = innerPayload as ExperimentResult;
      const expectedExpDigest = computeExperimentHash({
        proposalId: envelope.proposalId,
        experimentResult: exp,
        learningProposalId: exp.learningProposalId,
        agentId: contract.agent_id,
        agentVersion: contract.version,
      });
      if (envelope.provenance.provenance_hash !== expectedExpDigest) {
        violations.push('EXPERIMENT_PROVENANCE_FORGED: Experiment provenance hash mismatch with output digest');
      }
    }
  }

  // Combined inspection targets (both top envelope and inner output)
  const targets = isEnveloped ? [proposal, innerPayload] : [proposal];

  // 1. Core Prohibition: Autonomous Self-Approval Attempt
  for (const t of targets) {
    if (t && typeof t === 'object') {
      if ('approved_by' in t || 'human_approved_at' in t || t.status === 'ready_to_apply') {
        violations.push(
          `AUTHORITY_VIOLATION: Agent '${contract.agent_id}' attempted to self-approve application. Only authenticated human candidates may approve.`
        );
        break;
      }
    }
  }

  // 2. Core Prohibition: Direct Execution Dispatch Attempt
  for (const t of targets) {
    if (t && typeof t === 'object') {
      if ('dispatch' in t || 'execute' in t || t.action === 'execute_application') {
        violations.push(
          `AUTHORITY_VIOLATION: Agent '${contract.agent_id}' attempted direct execution dispatch. Execution is restricted exclusively to the v4.6.1 substrate.`
        );
        break;
      }
    }
  }

  // 3. Core Prohibition: Candidate Evidence Tampering
  for (const t of targets) {
    if (t && typeof t === 'object') {
      if ('profile_mutation' in t || 'injected_credentials' in t || 'candidate_profile' in t) {
        violations.push(
          `AUTHORITY_VIOLATION: Agent '${contract.agent_id}' attempted to mutate candidate profile or inject unverified evidence.`
        );
        break;
      }
    }
  }

  // 4. Core Prohibition: Outcome History Rewriting
  for (const t of targets) {
    if (t && typeof t === 'object') {
      if ('outcome_event' in t || 'recorded_offer' in t || 'synthetic_interview' in t) {
        violations.push(
          `AUTHORITY_VIOLATION: Agent '${contract.agent_id}' attempted to write or mutate outcome history directly.`
        );
        break;
      }
    }
  }

  // 5. Agent-Specific Contract Checks: Discovery Agent
  if (agentType === 'discovery') {
    const disc = innerPayload as DiscoveryProposal;

    // Check mandatory fields
    if (!disc.jobId || !disc.sourceUrl || !disc.title || !disc.company) {
      violations.push('DISCOVERY_SCHEMA_VIOLATION: Missing required job fields (jobId, sourceUrl, title, company)');
    }

    // Check protocol safety
    if (disc.sourceUrl && !disc.sourceUrl.startsWith('https://') && !disc.sourceUrl.startsWith('http://')) {
      violations.push(`DISCOVERY_URL_INVALID: Insecure or invalid protocol on source URL: ${disc.sourceUrl}`);
    }

    // Check source boundary
    if (disc.source && (disc.source.includes('unauthorized') || disc.source.includes('dark_web') || disc.source.includes('compromised'))) {
      violations.push(`DISCOVERY_SOURCE_UNPERMITTED: Discovery source '${disc.source}' violates permitted sources contract`);
    }

    // Check provenance presence and validity
    const provenanceRecord = disc.provenance || (envelope ? envelope.provenance : undefined);
    if (!provenanceRecord || !provenanceRecord.provenance_hash) {
      violations.push('DISCOVERY_PROVENANCE_MISSING: Proposal lacks required cryptographic provenance record');
    } else if (rawContext && !verifyProvenanceRecord(provenanceRecord, rawContext)) {
      violations.push('DISCOVERY_PROVENANCE_FORGED: Provenance record digest mismatch with source context');
    }

    // Check that Discovery did not draft application materials
    if ('cover_letter' in disc || 'resume_bullet' in disc || 'screening_answers' in disc) {
      violations.push('DISCOVERY_BOUNDARY_BREACH: Discovery Agent is forbidden from drafting application text');
    }
  }

  // 6. Agent-Specific Contract Checks: Evaluation Agent
  if (agentType === 'evaluation') {
    const evalProp = innerPayload as EvaluationProposal;

    // Check mandatory fields
    if (!evalProp.evaluationId || !evalProp.jobId || !evalProp.candidateId) {
      violations.push('EVALUATION_SCHEMA_VIOLATION: Missing required evaluation identifiers');
    }
    if (!evalProp.evidenceSnapshotId || !evalProp.evidenceHash) {
      violations.push('EVALUATION_SNAPSHOT_MISSING: Evaluation must reference a verified evidence snapshot');
    }

    // Check application artifact prohibition
    if (
      'cover_letter' in evalProp ||
      'resume' in evalProp ||
      'screening_answers' in evalProp ||
      'full_resume' in evalProp
    ) {
      violations.push(
        'EVALUATION_BOUNDARY_BREACH: Evaluation Agent is forbidden from creating application artifacts'
      );
    }

    // Check governed fit score calculation
    if (evalProp.dimensions) {
      const expectedScore = Math.min(
        100,
        Math.max(
          0,
          (evalProp.dimensions.role_alignment || 0) +
            (evalProp.dimensions.technical_skills || 0) +
            (evalProp.dimensions.leadership || 0) +
            (evalProp.dimensions.seniority_remote || 0)
        )
      );
      if (evalProp.fitScore !== expectedScore) {
        violations.push(
          `EVALUATION_SCORE_DISCREPANCY: Declared fit score (${evalProp.fitScore}) does not match governed dimension sum (${expectedScore})`
        );
      }
    }

    // Check Evidence -> Truth invariant: "Generation is never evidence"
    if (Array.isArray(evalProp.evaluatedRequirements)) {
      for (const req of evalProp.evaluatedRequirements) {
        if (req.status === 'satisfied') {
          if (!Array.isArray(req.citations) || req.citations.length === 0) {
            violations.push(
              `EVALUATION_UNBACKED_MATCH: Requirement '${req.id}' marked satisfied without verified evidence citation`
            );
          }
        }
      }
    }

    // If raw candidate evidence snapshot context was provided, verify citations
    if (rawContext && rawContext.profile_data) {
      if (evalProp.evidenceSnapshotId !== rawContext.id) {
        violations.push(
          `EVALUATION_SNAPSHOT_MISMATCH: Evaluation snapshotId '${evalProp.evidenceSnapshotId}' does not match context '${rawContext.id}'`
        );
      }
      if (evalProp.evidenceHash !== rawContext.evidence_hash) {
        violations.push(
          'EVALUATION_SNAPSHOT_DRIFT: Snapshot evidence hash mismatch with verification context'
        );
      }

      // Verify each citation against raw evidence
      if (Array.isArray(evalProp.evaluatedRequirements)) {
        for (const req of evalProp.evaluatedRequirements) {
          if (Array.isArray(req.citations)) {
            for (const citation of req.citations) {
              if (!verifyEvidenceCitation(citation, rawContext)) {
                violations.push(
                  `EVALUATION_CITATION_FORGED: Citation for '${citation.fact}' in '${citation.source_field}' not verified in snapshot`
                );
              }
            }
          }
        }
      }
    }
  }

  // 7. Agent-Specific Contract Checks: Planning Agent
  if (agentType === 'planning') {
    const plan = innerPayload as PlanningProposal;

    // Check mandatory fields
    if (!plan.planId || !plan.candidateSnapshotId || !plan.evidenceHash) {
      violations.push('PLANNING_SCHEMA_VIOLATION: Missing required plan identifiers');
    }
    if (!plan.inputs || !Array.isArray(plan.actions)) {
      violations.push('PLANNING_SCHEMA_VIOLATION: Missing plan inputs or actions array');
    }

    // Check application artifact prohibition (NO cover letters, resumes, screening answers)
    if (
      'cover_letter' in plan ||
      'resume' in plan ||
      'screening_answers' in plan ||
      'full_resume' in plan
    ) {
      violations.push(
        'PLANNING_BOUNDARY_BREACH: Planning Agent is forbidden from creating application artifacts'
      );
    }

    // Check action types: only prepare_for_review, request_missing_evidence, hold, defer are permitted
    const permittedActionTypes = ['prepare_for_review', 'request_missing_evidence', 'hold', 'defer'];
    if (Array.isArray(plan.actions)) {
      for (const act of plan.actions) {
        if (!permittedActionTypes.includes(act.action)) {
          violations.push(
            `AUTHORITY_VIOLATION: Planning action '${act.actionId}' contains unauthorized action type '${act.action}'`
          );
        }
        if ((act as any).execute || (act as any).dispatch || (act as any).approve) {
          violations.push(
            `AUTHORITY_VIOLATION: Planning action '${act.actionId}' attempted unauthorized execution or approval capability`
          );
        }
      }
    }

    // If candidate evidence snapshot context was provided
    if (rawContext && rawContext.profile_data) {
      if (plan.candidateSnapshotId !== rawContext.id) {
        violations.push(
          `PLANNING_SNAPSHOT_MISMATCH: Plan candidateSnapshotId '${plan.candidateSnapshotId}' does not match context '${rawContext.id}'`
        );
      }
      if (plan.evidenceHash !== rawContext.evidence_hash) {
        violations.push(
          'PLANNING_SNAPSHOT_DRIFT: Plan snapshot evidence hash mismatch with verification context'
        );
      }
    }
  }

  // 8. Agent-Specific Contract Checks: Orchestrator Agent
  if (agentType === 'orchestrator') {
    const orch = innerPayload as OrchestrationProposal;

    // Check if this is a formal v5.0 Orchestration Proposal
    const isFormalOrchestrationProposal =
      Boolean(
        orch.orchestrationId ||
          orch.proposed_by === 'agent_orchestrator' ||
          (isEnveloped && envelope?.agentId === 'agt-orchestrator-v1')
      );

    if (isFormalOrchestrationProposal) {
      // Check mandatory fields
      if (!orch.orchestrationId || !orch.candidateSnapshotId || !orch.evidenceHash) {
        violations.push('ORCHESTRATION_SCHEMA_VIOLATION: Missing required orchestration identifiers');
      }
      if (
        !Array.isArray(orch.discoveryProposalIds) ||
        !Array.isArray(orch.evaluationProposalIds) ||
        !Array.isArray(orch.planningProposalIds) ||
        !Array.isArray(orch.selectedPlanIds)
      ) {
        violations.push('ORCHESTRATION_SCHEMA_VIOLATION: Missing required proposal ID arrays');
      }
      if (!Array.isArray(orch.conflicts) || !Array.isArray(orch.requiredHumanDecisions)) {
        violations.push('ORCHESTRATION_SCHEMA_VIOLATION: Missing conflicts or human decisions array');
      }
      if (orch.proposed_by !== 'agent_orchestrator') {
        violations.push('ORCHESTRATION_SCHEMA_VIOLATION: proposed_by must be "agent_orchestrator"');
      }

      // Check application artifact prohibition (NO cover letters, resumes, screening answers)
      if (
        'cover_letter' in orch ||
        'resume' in orch ||
        'screening_answers' in orch ||
        'full_resume' in orch
      ) {
        violations.push(
          'ORCHESTRATION_BOUNDARY_BREACH: Orchestrator is forbidden from creating application artifacts'
        );
      }

    // Context / Snapshot verification
    if (rawContext && rawContext.profile_data) {
      if (orch.candidateSnapshotId !== rawContext.id) {
        violations.push(
          `ORCHESTRATION_SNAPSHOT_MISMATCH: Orchestration candidateSnapshotId '${orch.candidateSnapshotId}' does not match context '${rawContext.id}'`
        );
      }
      if (orch.evidenceHash !== rawContext.evidence_hash) {
        violations.push(
          'ORCHESTRATION_SNAPSHOT_DRIFT: Snapshot evidence hash mismatch with verification context'
        );
      }
    }

    // Cross-check input tampering and integrity
    if (rawContext && rawContext.upstreamInputs) {
      const { discovery, evaluation, planning } = rawContext.upstreamInputs;

      if (Array.isArray(discovery)) {
        for (const disc of discovery) {
          const discId = disc.proposalId || disc.jobId;
          if (!orch.discoveryProposalIds.includes(discId)) {
            violations.push(
              `ORCHESTRATION_INPUT_TAMPERED: Discovery proposal '${discId}' was omitted or modified in orchestration`
            );
          }
          if (disc._tampered) {
            violations.push(
              `ORCHESTRATION_INPUT_TAMPERED: Discovery proposal input '${discId}' detected as tampered`
            );
          }
        }
      }

      if (Array.isArray(evaluation)) {
        for (const ev of evaluation) {
          const evId = ev.proposalId || ev.evaluationId;
          if (!orch.evaluationProposalIds.includes(evId)) {
            violations.push(
              `ORCHESTRATION_INPUT_TAMPERED: Evaluation proposal '${evId}' was omitted or modified in orchestration`
            );
          }
          if (ev._tampered || (ev.output && ev.output._tampered)) {
            violations.push(
              `ORCHESTRATION_INPUT_TAMPERED: Evaluation proposal input '${evId}' detected as tampered`
            );
          }
          if (ev._tamperedScore || (ev.output && ev.output._tamperedScore)) {
            violations.push(
              `ORCHESTRATION_SCORE_TAMPERED: Evaluation proposal '${evId}' fit score tampered in orchestration context`
            );
          }
        }
      }

      if (Array.isArray(planning)) {
        for (const pl of planning) {
          const plId = pl.proposalId || pl.planId;
          if (!orch.planningProposalIds.includes(plId)) {
            violations.push(
              `ORCHESTRATION_INPUT_TAMPERED: Planning proposal '${plId}' was omitted or modified in orchestration`
            );
          }
          if (pl._tampered || (pl.output && pl.output._tampered)) {
            violations.push(
              `ORCHESTRATION_INPUT_TAMPERED: Planning proposal input '${plId}' detected as tampered`
            );
          }
          if (pl._tamperedPriority || (pl.output && pl.output._tamperedPriority)) {
            violations.push(
              `ORCHESTRATION_PRIORITY_TAMPERED: Planning proposal '${plId}' action priority tampered in orchestration context`
            );
          }
        }
      }
    }

    // Direct tampering flags on proposal payload
    if ((orch as any)._tamperedScore) {
      violations.push(
        'ORCHESTRATION_SCORE_TAMPERED: Evaluation score mutation detected inside orchestration'
      );
    }
    if ((orch as any)._tamperedPriority) {
      violations.push(
        'ORCHESTRATION_PRIORITY_TAMPERED: Planning action priority mutation detected inside orchestration'
      );
    }
    if ((orch as any)._tamperedInput) {
      violations.push(
        'ORCHESTRATION_INPUT_TAMPERED: Input proposal tampered or forged inside orchestration'
      );
    }
  }
}

  // 9. Agent-Specific Contract Checks: Outcome Agent
  if (agentType === 'outcome') {
    const outcome = innerPayload as OutcomeRecord;

    // Check mandatory fields
    if (
      !outcome.outcomeId ||
      !outcome.executionId ||
      !outcome.frozenArtifactId ||
      !outcome.candidateSnapshotId ||
      !outcome.executionReceiptHash ||
      !outcome.status
    ) {
      violations.push('OUTCOME_SCHEMA_VIOLATION: Missing required outcome identifiers or status');
    }
    if (!Array.isArray(outcome.actualResults) || !Array.isArray(outcome.deviations)) {
      violations.push('OUTCOME_SCHEMA_VIOLATION: Missing actualResults or deviations array');
    }
    if (!Array.isArray(outcome.evidenceReferences)) {
      violations.push('OUTCOME_SCHEMA_VIOLATION: Missing evidenceReferences array');
    }
    if (outcome.created_by !== 'outcome_intelligence') {
      violations.push('OUTCOME_SCHEMA_VIOLATION: created_by must be "outcome_intelligence"');
    }
    if (outcome.immutable !== true) {
      violations.push('OUTCOME_SCHEMA_VIOLATION: OutcomeRecord must be declared immutable: true');
    }

    // Temporal integrity: Check for retroactive mutation attempts on T0-T7
    for (const t of targets) {
      if (t && typeof t === 'object') {
        if ('modify_frozen_artifact' in t || 'mutated_artifact' in t || 'frozenArtifactMutation' in t) {
          violations.push('AUTHORITY_VIOLATION: Outcome agent attempted frozen artifact mutation');
        }
        if ('policy_override' in t || 'policy_change' in t || 'modified_policy' in t) {
          violations.push('AUTHORITY_VIOLATION: Outcome agent attempted policy change');
        }
        if ('approve' in t || 'approved_by' in t || 'grant_approval' in t) {
          violations.push('AUTHORITY_VIOLATION: Outcome agent attempted approval');
        }
        if ('execute' in t || 'dispatch' in t || 'execute_application' in t) {
          violations.push('AUTHORITY_VIOLATION: Outcome agent attempted execution');
        }
        if ('retroactive_evaluation' in t || 'mutate_evaluation' in t || 'modified_evaluation' in t) {
          violations.push('AUTHORITY_VIOLATION: Outcome agent attempted retroactive evaluation mutation');
        }
        if ('retroactive_plan' in t || 'mutate_plan' in t || 'modified_plan' in t) {
          violations.push('AUTHORITY_VIOLATION: Outcome agent attempted retroactive planning mutation');
        }
        if ('cover_letter' in t || 'resume' in t || 'screening_answers' in t) {
          violations.push('OUTCOME_BOUNDARY_BREACH: Outcome agent is forbidden from creating application artifacts');
        }
      }
    }

    // Context / Snapshot verification
    if (rawContext && rawContext.profile_data) {
      if (outcome.candidateSnapshotId !== rawContext.id) {
        violations.push(
          `OUTCOME_SNAPSHOT_MISMATCH: Outcome candidateSnapshotId '${outcome.candidateSnapshotId}' does not match context '${rawContext.id}'`
        );
      }
    }

    // Context / Receipt verification
    if (rawContext && rawContext.receipt) {
      const { receiptHash } = validateExecutionReceipt(rawContext.receipt);
      if (outcome.executionReceiptHash !== receiptHash) {
        violations.push(
          `RECEIPT_HASH_MISMATCH: Outcome executionReceiptHash does not match context receipt`
        );
      }
      if (outcome.executionId !== rawContext.receipt.execution_attempt_id) {
        violations.push(
          `EXECUTION_ID_MISMATCH: Outcome executionId does not match context receipt`
        );
      }
    }

    // Context / Frozen artifact verification
    if (rawContext && rawContext.frozenArtifact) {
      if (outcome.frozenArtifactId !== rawContext.frozenArtifact.frozenArtifactId) {
        violations.push(
          `FROZEN_ARTIFACT_MISMATCH: Outcome frozenArtifactId does not match context frozen artifact`
        );
      }
    }
  }

  // 10. Agent-Specific Contract Checks: Evidence Feedback Agent
  if (agentType === 'feedback') {
    const fb = innerPayload as EvidenceFeedbackRecord;

    // Check mandatory fields
    if (
      !fb.feedbackId ||
      !fb.sourceOutcomeId ||
      !fb.sourceExecutionId ||
      !fb.candidateSnapshotId ||
      !fb.createdAt
    ) {
      violations.push('FEEDBACK_SCHEMA_VIOLATION: Missing required feedback identifiers');
    }
    if (!Array.isArray(fb.observations) || !Array.isArray(fb.derivedSignals)) {
      violations.push('FEEDBACK_SCHEMA_VIOLATION: Missing observations or derivedSignals array');
    }
    if (!Array.isArray(fb.evidenceReferences)) {
      violations.push('FEEDBACK_SCHEMA_VIOLATION: Missing evidenceReferences array');
    }
    if (fb.created_by !== 'evidence_feedback') {
      violations.push('FEEDBACK_SCHEMA_VIOLATION: created_by must be "evidence_feedback"');
    }
    if (fb.immutable !== true) {
      violations.push('FEEDBACK_SCHEMA_VIOLATION: EvidenceFeedbackRecord must be declared immutable: true');
    }

    // Temporal integrity: Check for retroactive mutation attempts on T0-T8
    for (const t of targets) {
      if (t && typeof t === 'object') {
        if ('modify_evaluation' in t || 'mutated_evaluation' in t || 'evaluation_override' in t) {
          violations.push('AUTHORITY_VIOLATION: Feedback agent attempted evaluation mutation');
        }
        if (
          'modify_plan' in t ||
          'mutated_plan' in t ||
          'plan_override' in t ||
          'automatic_replanning' in t ||
          'replan' in t
        ) {
          violations.push('AUTHORITY_VIOLATION: Feedback agent attempted planning mutation or automatic replanning');
        }
        if ('modify_orchestration' in t || 'mutated_orchestration' in t) {
          violations.push('AUTHORITY_VIOLATION: Feedback agent attempted orchestration mutation');
        }
        if ('modify_policy' in t || 'policy_override' in t || 'policy_change' in t) {
          violations.push('AUTHORITY_VIOLATION: Feedback agent attempted policy override');
        }
        if ('approve' in t || 'approved_by' in t || 'grant_approval' in t) {
          violations.push('AUTHORITY_VIOLATION: Feedback agent attempted approval');
        }
        if ('execute' in t || 'dispatch' in t || 'execute_application' in t) {
          violations.push('AUTHORITY_VIOLATION: Feedback agent attempted execution');
        }
        if ('modify_frozen_artifact' in t || 'mutated_artifact' in t || 'freeze' in t) {
          violations.push('AUTHORITY_VIOLATION: Feedback agent attempted artifact freeze or mutation');
        }
        if ('modify_receipt' in t || 'mutated_receipt' in t) {
          violations.push('AUTHORITY_VIOLATION: Feedback agent attempted execution receipt mutation');
        }
        if ('modify_outcome' in t || 'mutated_outcome' in t) {
          violations.push('AUTHORITY_VIOLATION: Feedback agent attempted outcome mutation');
        }
        if ('candidate_profile' in t || 'profile_mutation' in t) {
          violations.push('AUTHORITY_VIOLATION: Feedback agent attempted candidate profile mutation');
        }
      }
    }

    // Context / Snapshot verification
    if (rawContext && rawContext.profile_data) {
      if (fb.candidateSnapshotId !== rawContext.id) {
        violations.push(
          `FEEDBACK_SNAPSHOT_MISMATCH: Feedback candidateSnapshotId '${fb.candidateSnapshotId}' does not match context '${rawContext.id}'`
        );
      }
    }

    // Context / Outcome verification
    if (rawContext && rawContext.outcome) {
      if (fb.sourceOutcomeId !== rawContext.outcome.outcomeId) {
        violations.push(
          `OUTCOME_SOURCE_MISMATCH: Feedback sourceOutcomeId does not match context outcome`
        );
      }
      if (fb.sourceExecutionId !== rawContext.outcome.executionId) {
        violations.push(
          `EXECUTION_SOURCE_MISMATCH: Feedback sourceExecutionId does not match context outcome execution`
        );
      }
    }
  }

  // 11. Agent-Specific Contract Checks: Controlled Learning Agent
  if (agentType === 'learning') {
    const learn = innerPayload as LearningProposal;

    // Check mandatory fields
    if (
      !learn.learningId ||
      !learn.currentProfileVersion ||
      !learn.proposedProfileVersion ||
      !Array.isArray(learn.adaptations) ||
      !Array.isArray(learn.detectedPatterns) ||
      !Array.isArray(learn.regressionChecks) ||
      !Array.isArray(learn.evidenceReferences)
    ) {
      violations.push('LEARNING_SCHEMA_VIOLATION: Missing required learning identifiers or arrays');
    }
    if (learn.created_by !== 'controlled_learning') {
      violations.push('LEARNING_SCHEMA_VIOLATION: created_by must be "controlled_learning"');
    }
    if (learn.immutable !== true) {
      violations.push('LEARNING_SCHEMA_VIOLATION: LearningProposal must be declared immutable: true');
    }

    // Temporal integrity: Check for retroactive mutation attempts on T0-T10
    for (const t of targets) {
      if (t && typeof t === 'object') {
        if ('modify_evaluation' in t || 'mutated_evaluation' in t || 'evaluation_override' in t) {
          violations.push('AUTHORITY_VIOLATION: Learning agent attempted evaluation mutation');
        }
        if ('modify_plan' in t || 'mutated_plan' in t || 'plan_override' in t) {
          violations.push('AUTHORITY_VIOLATION: Learning agent attempted planning mutation');
        }
        if ('modify_orchestration' in t || 'mutated_orchestration' in t) {
          violations.push('AUTHORITY_VIOLATION: Learning agent attempted orchestration mutation');
        }
        if ('modify_policy' in t || 'policy_override' in t || 'policy_change' in t || 'bypass_policy' in t) {
          violations.push('AUTHORITY_VIOLATION: Learning agent attempted policy override');
        }
        if ('approve' in t || 'approved_by' in t || 'grant_approval' in t || 'self_approve' in t) {
          violations.push('AUTHORITY_VIOLATION: Learning agent attempted approval');
        }
        if ('execute' in t || 'dispatch' in t || 'execute_application' in t) {
          violations.push('AUTHORITY_VIOLATION: Learning agent attempted execution');
        }
        if ('modify_frozen_artifact' in t || 'mutated_artifact' in t || 'freeze' in t) {
          violations.push('AUTHORITY_VIOLATION: Learning agent attempted artifact freeze or mutation');
        }
        if ('modify_receipt' in t || 'mutated_receipt' in t) {
          violations.push('AUTHORITY_VIOLATION: Learning agent attempted execution receipt mutation');
        }
        if ('modify_outcome' in t || 'mutated_outcome' in t) {
          violations.push('AUTHORITY_VIOLATION: Learning agent attempted outcome mutation');
        }
        if ('modify_feedback' in t || 'mutated_feedback' in t) {
          violations.push('AUTHORITY_VIOLATION: Learning agent attempted feedback mutation');
        }
        if ('candidate_profile' in t || 'profile_mutation' in t) {
          violations.push('AUTHORITY_VIOLATION: Learning agent attempted candidate profile mutation');
        }
        // Self-modification & Direct Mutation vectors
        if ('direct_evaluator_mutation' in t || 'modify_evaluator_weights' in t || 'mutate_evaluator' in t) {
          violations.push('AUTHORITY_VIOLATION: Learning agent attempted direct evaluator-weight mutation');
        }
        if ('direct_planner_mutation' in t || 'modify_planner_rules' in t || 'mutate_planner' in t) {
          violations.push('AUTHORITY_VIOLATION: Learning agent attempted direct planner-rule mutation');
        }
        if ('direct_discovery_mutation' in t || 'modify_discovery_rules' in t || 'mutate_discovery' in t) {
          violations.push('AUTHORITY_VIOLATION: Learning agent attempted direct discovery-rule mutation');
        }
        if ('direct_orchestration_mutation' in t || 'mutate_orchestration' in t) {
          violations.push('AUTHORITY_VIOLATION: Learning agent attempted direct orchestration mutation');
        }
        if ('activate_profile' in t || 'automatic_profile_activation' in t || 'force_activation' in t) {
          violations.push('AUTHORITY_VIOLATION: Learning agent attempted automatic profile activation');
        }
      }
    }

    // Invariant check on adaptations: must contain required diff properties
    if (Array.isArray(learn.adaptations)) {
      for (const chg of learn.adaptations) {
        if (
          !chg.changeId ||
          !chg.target ||
          !chg.parameter ||
          chg.previousValue === undefined ||
          chg.proposedValue === undefined
        ) {
          violations.push('MALFORMED_ADAPTATION: Adaptation change missing required parameter or before/after diff');
        }
      }
    }

    // Profile version alignment with context
    if (rawContext && rawContext.currentProfile) {
      if (learn.currentProfileVersion !== rawContext.currentProfile.version) {
        violations.push(
          `PROFILE_VERSION_MISMATCH: Proposal currentProfileVersion '${learn.currentProfileVersion}' does not match active profile '${rawContext.currentProfile.version}'`
        );
      }
    }
  }

  // --- 12. Controlled Experimentation Agent Negative Authority (Milestone v5.0-alpha10) ---
  if (agentType === 'experiment') {
    const exp = innerPayload as ExperimentResult;

    if (!exp || typeof exp !== 'object') {
      violations.push('EXPERIMENT_INVALID: Experiment result must be a valid non-null object');
    } else {
      if (exp.created_by !== 'controlled_experimentation') {
        violations.push('EXPERIMENT_SCHEMA_VIOLATION: ExperimentResult must declare created_by: "controlled_experimentation"');
      }
      if (exp.immutable !== true) {
        violations.push('EXPERIMENT_MUTABLE: ExperimentResult must be declared immutable: true');
      }

      for (const t of targets) {
        if (t && typeof t === 'object') {
          // Historical mutations
          if ('modify_evaluation' in t || 'mutated_evaluation' in t) {
            violations.push('AUTHORITY_VIOLATION: Experiment agent attempted evaluation mutation');
          }
          if ('modify_plan' in t || 'mutated_plan' in t || 'plan_override' in t) {
            violations.push('AUTHORITY_VIOLATION: Experiment agent attempted planning mutation');
          }
          if ('modify_orchestration' in t || 'mutated_orchestration' in t) {
            violations.push('AUTHORITY_VIOLATION: Experiment agent attempted orchestration mutation');
          }
          if ('modify_policy' in t || 'policy_override' in t || 'bypass_policy' in t) {
            violations.push('AUTHORITY_VIOLATION: Experiment agent attempted policy override');
          }
          if ('approve' in t || 'approved_by' in t || 'grant_approval' in t || 'self_approve' in t) {
            violations.push('AUTHORITY_VIOLATION: Experiment agent attempted approval');
          }
          if ('execute' in t || 'dispatch' in t || 'execute_application' in t) {
            violations.push('AUTHORITY_VIOLATION: Experiment agent attempted execution');
          }
          if ('modify_frozen_artifact' in t || 'mutated_artifact' in t || 'freeze' in t) {
            violations.push('AUTHORITY_VIOLATION: Experiment agent attempted artifact freeze or mutation');
          }
          if ('modify_receipt' in t || 'mutated_receipt' in t) {
            violations.push('AUTHORITY_VIOLATION: Experiment agent attempted execution receipt mutation');
          }
          if ('modify_outcome' in t || 'mutated_outcome' in t) {
            violations.push('AUTHORITY_VIOLATION: Experiment agent attempted outcome mutation');
          }
          if ('modify_feedback' in t || 'mutated_feedback' in t) {
            violations.push('AUTHORITY_VIOLATION: Experiment agent attempted feedback mutation');
          }
          if ('modify_learning' in t || 'mutated_learning' in t) {
            violations.push('AUTHORITY_VIOLATION: Experiment agent attempted learning proposal mutation');
          }
          if ('mutate_dataset' in t || 'modify_dataset' in t) {
            violations.push('AUTHORITY_VIOLATION: Experiment agent attempted benchmark dataset mutation');
          }
          // Self-modification & Direct Activation
          if ('direct_evaluator_mutation' in t || 'modify_evaluator_weights' in t || 'mutate_evaluator' in t) {
            violations.push('AUTHORITY_VIOLATION: Experiment agent attempted direct evaluator-weight mutation');
          }
          if ('direct_planner_mutation' in t || 'modify_planner_rules' in t || 'mutate_planner' in t) {
            violations.push('AUTHORITY_VIOLATION: Experiment agent attempted direct planner-rule mutation');
          }
          if ('direct_discovery_mutation' in t || 'modify_discovery_rules' in t || 'mutate_discovery' in t) {
            violations.push('AUTHORITY_VIOLATION: Experiment agent attempted direct discovery-rule mutation');
          }
          if ('direct_orchestration_mutation' in t || 'mutate_orchestration' in t) {
            violations.push('AUTHORITY_VIOLATION: Experiment agent attempted direct orchestration mutation');
          }
          if ('activate_profile' in t || 'automatic_profile_activation' in t || 'force_activation' in t) {
            violations.push('AUTHORITY_VIOLATION: Experiment agent attempted automatic profile activation');
          }
        }
      }

      // Invariant checks on recommendations vs regressions
      if (exp.regressionsDetected > 0 && exp.recommendation === 'APPROVE_FOR_REVIEW') {
        violations.push(
          'INVALID_RECOMMENDATION: Experiment with regressions cannot be recommended for approval'
        );
      }
      if (exp.overallStatus === 'FAIL' && exp.recommendation === 'APPROVE_FOR_REVIEW') {
        violations.push('INVALID_RECOMMENDATION: Failed experiment cannot be recommended for approval');
      }

      // Context validation if provided
      if (rawContext && rawContext.learningProposal) {
        if (exp.learningProposalId !== rawContext.learningProposal.learningId) {
          violations.push(
            `LEARNING_PROPOSAL_MISMATCH: Experiment references learningProposalId '${exp.learningProposalId}' but context has '${rawContext.learningProposal.learningId}'`
          );
        }
      }
      if (rawContext && rawContext.dataset) {
        if (exp.datasetHash !== rawContext.dataset.datasetHash) {
          violations.push(
            `DATASET_HASH_MISMATCH: Experiment datasetHash '${exp.datasetHash}' does not match benchmark '${rawContext.dataset.datasetHash}'`
          );
        }
      }
    }
  }

  return {
    allowed: violations.length === 0,
    violations,
    agent_id: contract.agent_id,
    evaluated_at: evaluatedAt,
    sanitized_output: violations.length === 0 ? proposal : undefined,
  };
}

/**
 * Asserts that a proposal passes the Policy Guard, throwing an error if rejected.
 */
export function assertPolicyGuard(result: PolicyGuardResult): void {
  if (!result.allowed) {
    const message = `[PolicyGuard Hard Block] Agent '${result.agent_id}' breached authority boundary:\n` +
      result.violations.map((v) => `  - ${v}`).join('\n');
    const err = new Error(message);
    (err as any).violations = result.violations;
    (err as any).agent_id = result.agent_id;
    throw err;
  }
}
