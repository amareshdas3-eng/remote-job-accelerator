// lib/agents/feedback.ts
// RJA v5.0: 📚 Evidence Feedback Intelligence Engine
// Milestone v5.0-alpha8: Controlled Feedback Boundary
// Governing Invariant: "Feedback creates evidence; it does not create authority."

import crypto from 'node:crypto';
import type {
  AgentEvidenceFeedbackRecord,
  EvidenceFeedbackRecord,
  FeedbackObservation,
  FeedbackSignal,
  FeedbackSignalType,
  OutcomeRecord,
  ProvenanceRecord,
} from './types';
import type { EvidenceSnapshot } from '../execution/types';
import { FEEDBACK_AGENT_CONTRACT } from './contracts';

export interface CreateFeedbackParams {
  outcome: OutcomeRecord;
  snapshot: EvidenceSnapshot;
  options?: {
    feedbackId?: string;
    createdAt?: string;
  };
}

/**
 * Validates the cryptographic provenance and snapshot alignment of an OutcomeRecord.
 */
export function validateOutcomeProvenance(
  outcome: OutcomeRecord,
  snapshot: EvidenceSnapshot
): { valid: boolean; outcomeId: string } {
  if (!outcome || typeof outcome !== 'object') {
    throw new Error('OUTCOME_INVALID: OutcomeRecord must be a non-null object.');
  }

  if (outcome.immutable !== true) {
    throw new Error('OUTCOME_MUTABLE: OutcomeRecord must be declared immutable: true.');
  }

  const requiredFields: (keyof OutcomeRecord)[] = [
    'outcomeId',
    'executionId',
    'frozenArtifactId',
    'candidateSnapshotId',
    'executionReceiptHash',
    'status',
  ];

  for (const field of requiredFields) {
    if (!outcome[field] || String(outcome[field]).trim().length === 0) {
      throw new Error(`OUTCOME_SCHEMA_VIOLATION: Missing required field '${field}'.`);
    }
  }

  if (outcome.candidateSnapshotId !== snapshot.id) {
    throw new Error(
      `SNAPSHOT_MISMATCH: Outcome snapshot '${outcome.candidateSnapshotId}' does not match context '${snapshot.id}'.`
    );
  }

  return { valid: true, outcomeId: outcome.outcomeId };
}

/**
 * Derives factual observations and signals from an immutable OutcomeRecord.
 * Crucial invariant: Only generates derived feedback signals; never mutates past plans or scores.
 */
export function deriveFeedbackSignals(outcome: OutcomeRecord): {
  observations: FeedbackObservation[];
  signals: FeedbackSignal[];
} {
  const observations: FeedbackObservation[] = [];
  const signals: FeedbackSignal[] = [];

  // 1. Overall Status Observation & Signal
  if (outcome.status === 'SUCCEEDED') {
    observations.push({
      observationId: `obs-success-${outcome.outcomeId.slice(-6)}`,
      type: 'SUCCESS_OBSERVATION',
      sourceOutcomeId: outcome.outcomeId,
      description: `Execution ${outcome.executionId} confirmed delivery successfully.`,
      evidenceReference: outcome.executionReceiptHash,
    });
    signals.push({
      signalId: `sig-success-${outcome.outcomeId.slice(-6)}`,
      type: 'SUCCESS_OBSERVATION',
      confidence: 1.0,
      description: 'Destination endpoint accepts current artifact structure.',
      actionableFor: 'planning',
    });
  } else if (outcome.status === 'FAILED') {
    observations.push({
      observationId: `obs-failure-${outcome.outcomeId.slice(-6)}`,
      type: 'EXECUTION_FAILURE_OBSERVATION',
      sourceOutcomeId: outcome.outcomeId,
      description: `Execution ${outcome.executionId} reported failure status.`,
      evidenceReference: outcome.executionReceiptHash,
    });
    signals.push({
      signalId: `sig-failure-${outcome.outcomeId.slice(-6)}`,
      type: 'EXECUTION_FAILURE_OBSERVATION',
      confidence: 1.0,
      description: 'Destination endpoint or payload encountered execution rejection.',
      actionableFor: 'planning',
    });
  }

  // 2. Observations derived from Deviations
  if (Array.isArray(outcome.deviations)) {
    for (const dev of outcome.deviations) {
      let signalType: FeedbackSignalType = 'RESULT_OBSERVATION';
      let actionableFor: 'discovery' | 'evaluation' | 'planning' = 'planning';

      switch (dev.category) {
        case 'TIMING':
          signalType = 'TIMING_OBSERVATION';
          actionableFor = 'planning';
          break;
        case 'SCOPE':
          signalType = 'SCOPE_OBSERVATION';
          actionableFor = 'evaluation';
          break;
        case 'DEPENDENCY':
          signalType = 'DEPENDENCY_OBSERVATION';
          actionableFor = 'planning';
          break;
        case 'EXECUTION_FAILURE':
          signalType = 'EXECUTION_FAILURE_OBSERVATION';
          actionableFor = 'planning';
          break;
        case 'RESULT':
        default:
          signalType = 'RESULT_OBSERVATION';
          actionableFor = 'discovery';
          break;
      }

      const obsId = `obs-dev-${dev.deviationId.slice(-8)}`;
      observations.push({
        observationId: obsId,
        type: signalType,
        sourceOutcomeId: outcome.outcomeId,
        description: dev.description,
        evidenceReference: dev.observedReference,
      });

      signals.push({
        signalId: `sig-dev-${dev.deviationId.slice(-8)}`,
        type: signalType,
        confidence: 0.9,
        description: `Observed deviation: ${dev.plannedReference} -> ${dev.observedReference}`,
        actionableFor,
      });
    }
  }

  return {
    observations: observations.sort((a, b) => a.observationId.localeCompare(b.observationId)),
    signals: signals.sort((a, b) => a.signalId.localeCompare(b.signalId)),
  };
}

/**
 * Canonicalizes an EvidenceFeedbackRecord for deterministic hashing and comparisons.
 */
export function canonicalizeFeedback(feedback: EvidenceFeedbackRecord): string {
  const sortedObs = [...feedback.observations].sort((a, b) =>
    a.observationId.localeCompare(b.observationId)
  );
  const sortedSignals = [...feedback.derivedSignals].sort((a, b) =>
    a.signalId.localeCompare(b.signalId)
  );
  const sortedRefs = [...feedback.evidenceReferences].sort();

  return JSON.stringify({
    feedbackId: feedback.feedbackId,
    sourceOutcomeId: feedback.sourceOutcomeId,
    sourceExecutionId: feedback.sourceExecutionId,
    candidateSnapshotId: feedback.candidateSnapshotId,
    evidenceReferences: sortedRefs,
    observations: sortedObs,
    derivedSignals: sortedSignals,
    createdAt: feedback.createdAt,
    created_by: feedback.created_by,
  });
}

/**
 * Records an immutable EvidenceFeedbackRecord from an executed OutcomeRecord.
 *
 * Invariant: Creates a NEW write-once record.
 * Never modifies outcome, frozen artifact, receipts, or historical proposals.
 */
export function createEvidenceFeedback(params: CreateFeedbackParams): EvidenceFeedbackRecord {
  const { outcome, snapshot, options } = params;

  // 1. Verify outcome provenance and snapshot match
  validateOutcomeProvenance(outcome, snapshot);

  const feedbackId = options?.feedbackId || `fb-${crypto.randomBytes(6).toString('hex')}`;
  const createdAt = options?.createdAt || new Date().toISOString();

  // 2. Derive factual observations and signals
  const { observations, signals } = deriveFeedbackSignals(outcome);

  const evidenceReferences = [
    snapshot.id,
    outcome.outcomeId,
    outcome.frozenArtifactId,
    outcome.executionReceiptHash,
  ].sort();

  const record: EvidenceFeedbackRecord = {
    feedbackId,
    sourceOutcomeId: outcome.outcomeId,
    sourceExecutionId: outcome.executionId,
    candidateSnapshotId: snapshot.id,
    evidenceReferences,
    observations,
    derivedSignals: signals,
    createdAt,
    created_by: 'evidence_feedback',
    immutable: true,
  };

  // Deeply freeze to guarantee write-once immutability
  Object.freeze(record);
  Object.freeze(record.observations);
  Object.freeze(record.derivedSignals);
  Object.freeze(record.evidenceReferences);

  return record;
}

export const recordFeedback = createEvidenceFeedback;

/**
 * Universal Provenance Envelope constructor for Feedback proposals/records.
 */
export function createFeedbackProposalEnvelope(
  output: EvidenceFeedbackRecord,
  snapshot: EvidenceSnapshot,
  options?: { proposalId?: string; createdAt?: string }
): AgentEvidenceFeedbackRecord {
  const proposalId =
    options?.proposalId || `prop-agt-feedback-v1-${crypto.randomBytes(6).toString('hex')}`;
  const createdAt = options?.createdAt || output.createdAt || new Date().toISOString();

  const canonicalFeedbackString = canonicalizeFeedback(output);
  const provenanceHash = crypto
    .createHash('sha256')
    .update(`${output.feedbackId}::${snapshot.id}::${snapshot.evidence_hash}::${canonicalFeedbackString}`)
    .digest('hex');

  const provenance: ProvenanceRecord = {
    source: 'evidence_feedback',
    source_url: `outcome://${output.sourceOutcomeId}`,
    retrieved_at: createdAt,
    raw_hash: snapshot.evidence_hash,
    adapter_version: 'v5.0-feedback',
    provenance_hash: provenanceHash,
    is_verified: true,
  };

  return {
    proposalId,
    agentId: FEEDBACK_AGENT_CONTRACT.agent_id,
    agentVersion: FEEDBACK_AGENT_CONTRACT.version,
    createdAt,
    inputEvidenceRefs: output.evidenceReferences,
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
 * Verifies that an EvidenceFeedbackRecord accurately aligns with its source OutcomeRecord.
 */
export function verifyFeedbackIntegrity(
  feedback: EvidenceFeedbackRecord,
  outcome: OutcomeRecord
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  if (feedback.sourceOutcomeId !== outcome.outcomeId) {
    violations.push(
      `OUTCOME_SOURCE_MISMATCH: Feedback sourceOutcomeId '${feedback.sourceOutcomeId}' does not match outcome '${outcome.outcomeId}'.`
    );
  }

  if (feedback.sourceExecutionId !== outcome.executionId) {
    violations.push(
      `EXECUTION_SOURCE_MISMATCH: Feedback sourceExecutionId '${feedback.sourceExecutionId}' does not match outcome execution '${outcome.executionId}'.`
    );
  }

  if (feedback.candidateSnapshotId !== outcome.candidateSnapshotId) {
    violations.push(
      `SNAPSHOT_SOURCE_MISMATCH: Feedback snapshot '${feedback.candidateSnapshotId}' does not match outcome snapshot '${outcome.candidateSnapshotId}'.`
    );
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
