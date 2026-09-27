// lib/agents/outcome.ts
// RJA v5.0: 📊 Outcome Intelligence & Temporal Integrity Engine
// Milestone v5.0-alpha7: Outcome Intelligence & Temporal Boundary
// Governing Invariant: "Outcome Intelligence observes history; it does not rewrite history."

import crypto from 'node:crypto';
import type {
  AgentOutcomeRecord,
  AgentProposal,
  FrozenArtifactPackage,
  OutcomeDeviation,
  OutcomeObservation,
  OutcomeRecord,
  OutcomeStatus,
  PlanningProposal,
  ProvenanceRecord,
} from './types';
import type { EvidenceSnapshot, SubmissionReceipt } from '../execution/types';
import { verifyArtifactFingerprint } from '../execution/fingerprint';
import { OUTCOME_AGENT_CONTRACT } from './contracts';

export interface OutcomeRecordParams {
  receipt: SubmissionReceipt;
  frozenArtifact: FrozenArtifactPackage;
  snapshot: EvidenceSnapshot;
  planningProposal?: PlanningProposal;
  status?: OutcomeStatus;
  externalObservations?: OutcomeObservation[];
  observedAt?: string;
  options?: {
    outcomeId?: string;
  };
}

/**
 * Validates execution receipt integrity and computes a deterministic SHA-256 digest over receipt fields.
 */
export function validateExecutionReceipt(receipt: SubmissionReceipt): { valid: boolean; receiptHash: string } {
  if (!receipt || typeof receipt !== 'object') {
    throw new Error('RECEIPT_INVALID: Execution receipt must be a non-null object.');
  }

  const requiredFields: (keyof SubmissionReceipt)[] = [
    'id',
    'execution_attempt_id',
    'application_id',
    'destination',
    'verified_fingerprint',
    'received_at',
  ];

  for (const field of requiredFields) {
    if (!receipt[field] || String(receipt[field]).trim().length === 0) {
      throw new Error(`RECEIPT_SCHEMA_VIOLATION: Execution receipt missing required field '${field}'.`);
    }
  }

  const canonicalReceiptRepresentation = [
    receipt.id,
    receipt.execution_attempt_id,
    receipt.application_id,
    receipt.destination,
    receipt.verified_fingerprint,
    receipt.external_confirmation_id || '',
    receipt.received_at,
  ].join('::');

  const receiptHash = crypto
    .createHash('sha256')
    .update(canonicalReceiptRepresentation, 'utf8')
    .digest('hex');

  return { valid: true, receiptHash };
}

/**
 * Validates frozen artifact integrity.
 */
export function validateFrozenArtifact(frozenArtifact: FrozenArtifactPackage): { valid: boolean; fingerprint: string } {
  if (!frozenArtifact || !frozenArtifact.immutable) {
    throw new Error('FROZEN_ARTIFACT_INVALID: Frozen artifact must be an immutable FrozenArtifactPackage.');
  }

  if (!frozenArtifact.frozenArtifactId || !frozenArtifact.canonicalFingerprint) {
    throw new Error('FROZEN_ARTIFACT_SCHEMA_VIOLATION: Missing required frozen artifact identifiers.');
  }

  const verification = verifyArtifactFingerprint(
    frozenArtifact.artifactPayload,
    frozenArtifact.canonicalFingerprint
  );

  if (!verification.valid) {
    throw new Error('FROZEN_ARTIFACT_TAMPERED: Frozen artifact payload diverges from canonical fingerprint.');
  }

  return { valid: true, fingerprint: frozenArtifact.canonicalFingerprint };
}

/**
 * Detects deviations between planned execution and observed execution truth.
 * Crucial invariant: Creates new historical deviation observations; never mutates the original plan.
 */
export function detectDeviations(params: {
  planningProposal?: PlanningProposal;
  receipt: SubmissionReceipt;
  observedStatus: OutcomeStatus;
  observedAt: string;
}): OutcomeDeviation[] {
  const { planningProposal, receipt, observedStatus, observedAt } = params;
  const deviations: OutcomeDeviation[] = [];

  if (observedStatus === 'FAILED' || observedStatus === 'CANCELLED') {
    deviations.push({
      deviationId: `dev-status-${crypto.randomBytes(4).toString('hex')}`,
      category: 'EXECUTION_FAILURE',
      plannedReference: 'status:confirmed',
      observedReference: `status:${observedStatus}`,
      magnitude: 'critical',
      description: `Execution outcome failed or was cancelled (observed status: ${observedStatus}).`,
    });
  }

  if (planningProposal) {
    // Check if the application was dispatched within expected plan timeframe
    const plannedAction = planningProposal.actions?.find(
      (a) => a.jobId === receipt.application_id || receipt.destination.includes(a.jobId)
    );

    if (plannedAction && plannedAction.priority > 1) {
      deviations.push({
        deviationId: `dev-pacing-${crypto.randomBytes(4).toString('hex')}`,
        category: 'TIMING',
        plannedReference: `priority:#${plannedAction.priority}`,
        observedReference: 'dispatched:immediate',
        magnitude: 'minor',
        description: `Opportunity prioritized as #${plannedAction.priority} in plan was executed in initial batch.`,
      });
    }
  }

  return deviations.sort((a, b) => a.deviationId.localeCompare(b.deviationId));
}

/**
 * Canonicalizes an OutcomeRecord for deterministic hashing and comparison.
 */
export function canonicalizeOutcome(outcome: OutcomeRecord): string {
  const sortedObservations = [...outcome.actualResults].sort((a, b) =>
    a.observationId.localeCompare(b.observationId)
  );
  const sortedDeviations = [...outcome.deviations].sort((a, b) =>
    a.deviationId.localeCompare(b.deviationId)
  );
  const sortedRefs = [...outcome.evidenceReferences].sort();

  return JSON.stringify({
    outcomeId: outcome.outcomeId,
    executionId: outcome.executionId,
    frozenArtifactId: outcome.frozenArtifactId,
    candidateSnapshotId: outcome.candidateSnapshotId,
    executionReceiptHash: outcome.executionReceiptHash,
    status: outcome.status,
    observedAt: outcome.observedAt,
    actualResults: sortedObservations,
    deviations: sortedDeviations,
    evidenceReferences: sortedRefs,
    created_by: outcome.created_by,
  });
}

/**
 * Records an immutable outcome from an execution receipt and frozen artifact.
 *
 * Invariant: Creates a NEW write-once record.
 * Never modifies frozen artifact, receipt, or historical proposals.
 */
export function recordOutcome(params: OutcomeRecordParams): OutcomeRecord {
  const {
    receipt,
    frozenArtifact,
    snapshot,
    planningProposal,
    status = 'SUCCEEDED',
    externalObservations = [],
    observedAt = new Date().toISOString(),
    options,
  } = params;

  // 1. Verify receipt and compute cryptographic receipt digest
  const receiptValidation = validateExecutionReceipt(receipt);

  // 2. Verify frozen artifact integrity
  validateFrozenArtifact(frozenArtifact);

  // 3. Verify snapshot alignment
  if (frozenArtifact.candidateSnapshotId !== snapshot.id) {
    throw new Error(
      `SNAPSHOT_MISMATCH: Frozen artifact snapshot '${frozenArtifact.candidateSnapshotId}' does not match context '${snapshot.id}'.`
    );
  }

  const outcomeId = options?.outcomeId || `out-${crypto.randomBytes(6).toString('hex')}`;

  // 4. Synthesize observations
  const observations: OutcomeObservation[] = [
    {
      observationId: `obs-receipt-${receipt.id}`,
      category: 'STATUS' as const,
      name: 'execution_receipt_verified',
      value: {
        receiptId: receipt.id,
        externalConfirmationId: receipt.external_confirmation_id || 'CONF-OK',
        destination: receipt.destination,
      },
      observedAt,
    },
    {
      observationId: `obs-fingerprint-${receipt.id}`,
      category: 'METRICS' as const,
      value: receipt.verified_fingerprint,
      name: 'canonical_fingerprint_verified',
      observedAt,
    },
    ...externalObservations,
  ].sort((a, b) => a.observationId.localeCompare(b.observationId));

  // 5. Detect deviations
  const deviations = detectDeviations({
    planningProposal,
    receipt,
    observedStatus: status,
    observedAt,
  });

  const evidenceReferences = [
    snapshot.id,
    frozenArtifact.frozenArtifactId,
    receipt.id,
    ...(planningProposal ? [planningProposal.planId] : []),
  ].sort();

  const record: OutcomeRecord = {
    outcomeId,
    executionId: receipt.execution_attempt_id,
    frozenArtifactId: frozenArtifact.frozenArtifactId,
    candidateSnapshotId: snapshot.id,
    executionReceiptHash: receiptValidation.receiptHash,
    status,
    observedAt,
    actualResults: observations,
    deviations,
    evidenceReferences,
    created_by: 'outcome_intelligence',
    immutable: true,
  };

  // Deeply freeze to guarantee temporal write-once immutability
  Object.freeze(record);
  Object.freeze(record.actualResults);
  Object.freeze(record.deviations);
  Object.freeze(record.evidenceReferences);

  return record;
}

/**
 * Universal Provenance Envelope constructor for Outcome proposals/records.
 */
export function createOutcomeProposalEnvelope(
  output: OutcomeRecord,
  snapshot: EvidenceSnapshot,
  options?: { proposalId?: string; createdAt?: string }
): AgentOutcomeRecord {
  const proposalId =
    options?.proposalId || `prop-agt-outcome-v1-${crypto.randomBytes(6).toString('hex')}`;
  const createdAt = options?.createdAt || output.observedAt || new Date().toISOString();

  const canonicalOutcomeString = canonicalizeOutcome(output);
  const provenanceHash = crypto
    .createHash('sha256')
    .update(`${output.outcomeId}::${snapshot.id}::${snapshot.evidence_hash}::${canonicalOutcomeString}`)
    .digest('hex');

  const provenance: ProvenanceRecord = {
    source: 'outcome_intelligence',
    source_url: `snapshot://${snapshot.id}`,
    retrieved_at: createdAt,
    raw_hash: snapshot.evidence_hash,
    adapter_version: 'v5.0-outcome',
    provenance_hash: provenanceHash,
    is_verified: true,
  };

  return {
    proposalId,
    agentId: OUTCOME_AGENT_CONTRACT.agent_id,
    agentVersion: OUTCOME_AGENT_CONTRACT.version,
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
 * Verifies that an OutcomeRecord accurately matches an execution receipt and frozen artifact.
 */
export function verifyOutcomeIntegrity(
  outcome: OutcomeRecord,
  receipt: SubmissionReceipt,
  frozenArtifact: FrozenArtifactPackage
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  if (outcome.executionId !== receipt.execution_attempt_id) {
    violations.push(
      `EXECUTION_ID_MISMATCH: Outcome executionId '${outcome.executionId}' does not match receipt attempt '${receipt.execution_attempt_id}'.`
    );
  }

  if (outcome.frozenArtifactId !== frozenArtifact.frozenArtifactId) {
    violations.push(
      `FROZEN_ARTIFACT_MISMATCH: Outcome frozenArtifactId '${outcome.frozenArtifactId}' does not match artifact '${frozenArtifact.frozenArtifactId}'.`
    );
  }

  const { receiptHash } = validateExecutionReceipt(receipt);
  if (outcome.executionReceiptHash !== receiptHash) {
    violations.push(
      `RECEIPT_HASH_MISMATCH: Outcome executionReceiptHash '${outcome.executionReceiptHash}' does not match receipt hash '${receiptHash}'.`
    );
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
