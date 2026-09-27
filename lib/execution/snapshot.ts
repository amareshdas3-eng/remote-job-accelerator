import crypto from 'node:crypto';
import type { StructuredProfileData } from '../profile';
import type { EvidenceSnapshot } from './types';

export function createEvidenceSnapshot(
  candidateId: string,
  profile: StructuredProfileData,
  rawEvidence: string = ''
): EvidenceSnapshot {
  const canonicalRepresentation = JSON.stringify({
    profile,
    evidenceText: rawEvidence.trim(),
  });

  const evidenceHash = crypto
    .createHash('sha256')
    .update(canonicalRepresentation)
    .digest('hex');

  const now = new Date().toISOString();
  const snapshotId = `ev-snap-${evidenceHash.slice(0, 16)}`;

  return {
    id: snapshotId,
    candidate_id: candidateId,
    profile_data: JSON.parse(JSON.stringify(profile)), // deep clone
    evidence_hash: evidenceHash,
    captured_at: now,
  };
}
