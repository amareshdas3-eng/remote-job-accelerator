// lib/agents/discovery.ts
// RJA v5.0: 🔎 Autonomous Discovery Agent (Read-Only)
// Milestone v5.0-alpha2: Discovery Intelligence & Universal Provenance Envelope

import crypto from 'node:crypto';
import { canonicalizeUrl, generateDeduplicationKey } from '../jobs/dedup';
import type {
  AgentProposal,
  DiscoveryAgentProposal,
  DiscoveryProposal,
  ProvenanceRecord,
} from './types';
import { DISCOVERY_AGENT_CONTRACT } from './contracts';

export interface RawJobInput {
  title: string;
  company: string;
  url: string;
  source: string;
  description?: string;
  location?: string;
  category?: string;
  skills?: string[];
  requirements?: string[];
  raw_payload?: any;
}

export interface DiscoveryOptions {
  retrievedAt?: string;
  requestEvaluation?: boolean;
  evaluationPriority?: 'low' | 'normal' | 'high';
  evaluationReason?: string;
  inputEvidenceRefs?: string[];
}

export interface DeduplicationResult<T> {
  unique: T[];
  duplicatesRemoved: number;
  duplicateKeys: string[];
}

/**
 * Sources permitted by the Discovery Agent Authority Contract.
 */
export const PERMITTED_DISCOVERY_SOURCES = [
  'job_boards',
  'ats_feeds',
  'career_portals',
  'webhooks',
  'direct_ats',
  'greenhouse',
  'lever',
  'workday',
  'unknown_feed',
] as const;

/**
 * Verifies whether a given source is within the permitted discovery boundary.
 */
export function isPermittedSource(source: string): boolean {
  if (!source || typeof source !== 'string') return false;
  const s = source.trim().toLowerCase();
  return (PERMITTED_DISCOVERY_SOURCES as readonly string[]).includes(s);
}

/**
 * Universal Provenance Envelope constructor.
 * Every autonomous agent output must be wrapped in this envelope.
 * Explicitly states: Who produced it, from what evidence, using which version, under what authority.
 */
export function createAgentProposalEnvelope<T>(
  output: T,
  agentId: string = DISCOVERY_AGENT_CONTRACT.agent_id,
  agentVersion: string = DISCOVERY_AGENT_CONTRACT.version,
  provenance: ProvenanceRecord,
  options?: {
    proposalId?: string;
    inputEvidenceRefs?: string[];
    createdAt?: string;
  }
): AgentProposal<T> {
  const proposalId =
    options?.proposalId || `prop-${agentId}-${crypto.randomBytes(6).toString('hex')}`;

  return {
    proposalId,
    agentId,
    agentVersion,
    createdAt: options?.createdAt || new Date().toISOString(),
    inputEvidenceRefs: options?.inputEvidenceRefs || [],
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
 * Computes a tamper-evident cryptographic provenance record for a job posting.
 */
export function computeProvenance(
  source: string,
  canonicalUrl: string,
  rawPayload: any,
  retrievedAt: string
): ProvenanceRecord {
  const rawString =
    typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload || {});
  const rawHash = crypto.createHash('sha256').update(rawString, 'utf8').digest('hex');

  // Provenance signature over source, canonical URL, retrieval timestamp, and raw payload digest
  const provenanceDigest = crypto
    .createHash('sha256')
    .update(`${source.trim().toLowerCase()}::${canonicalUrl}::${retrievedAt}::${rawHash}`, 'utf8')
    .digest('hex');

  return {
    source: source.trim().toLowerCase(),
    source_url: canonicalUrl,
    retrieved_at: retrievedAt,
    raw_hash: rawHash,
    adapter_version: 'v5.0-discovery',
    provenance_hash: provenanceDigest,
    is_verified: true,
  };
}

/**
 * Verifies whether a given provenance record matches the expected raw content and URL.
 */
export function verifyProvenanceRecord(
  provenance: ProvenanceRecord,
  rawPayload: any
): boolean {
  if (!provenance || !provenance.provenance_hash || !provenance.source_url) {
    return false;
  }
  const recomputed = computeProvenance(
    provenance.source,
    provenance.source_url,
    rawPayload,
    provenance.retrieved_at
  );
  return recomputed.provenance_hash === provenance.provenance_hash;
}

/**
 * Normalizes raw requirement bullet points into structured strings.
 */
export function extractCleanRequirements(rawReqs?: string[], description?: string): string[] {
  if (Array.isArray(rawReqs) && rawReqs.length > 0) {
    return rawReqs.map((r) => String(r).trim()).filter((r) => r.length > 0);
  }

  if (!description) return [];

  // Fallback line extractor for description bullet points
  return description
    .split('\n')
    .map((line) => line.trim().replace(/^[-*•]\s*/, ''))
    .filter((line) => line.length > 15 && line.length < 250)
    .slice(0, 10);
}

/**
 * Normalizes raw skills list into clean, deduplicated strings.
 */
export function extractCleanSkills(skills?: string[]): string[] {
  if (!Array.isArray(skills)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of skills) {
    const cleaned = String(s).trim();
    const lower = cleaned.toLowerCase();
    if (cleaned.length > 0 && !seen.has(lower)) {
      seen.add(lower);
      result.push(cleaned);
    }
  }
  return result;
}

/**
 * The 🔎 Discovery Agent processes raw job listings from external sources into
 * structured, immutable DiscoveryProposals with cryptographic provenance.
 *
 * GUARANTEES:
 * - Read-only: Does not access candidate evidence or profile
 * - Zero execution authority: Cannot approve, execute, or dispatch
 */
export async function runDiscoveryAgent(
  input: RawJobInput,
  options?: DiscoveryOptions
): Promise<DiscoveryProposal> {
  const retrievedAt = options?.retrievedAt || new Date().toISOString();

  // 1. Source and URL sanitization
  const source = (input.source || 'unknown_feed').trim();
  const canonicalUrl = canonicalizeUrl(input.url);

  if (!input.title || !input.company) {
    throw new Error('Discovery Agent rejected job: missing required title or company');
  }

  // 2. Compute cryptographic deduplication key (canonical SHA-256)
  const jobId = generateDeduplicationKey(input.title, input.company, canonicalUrl);

  // 3. Compute immutable provenance record
  const provenance = computeProvenance(
    source,
    canonicalUrl,
    input.raw_payload || input,
    retrievedAt
  );

  // 4. Extract structured requirements and taxonomy
  const requirements = extractCleanRequirements(input.requirements, input.description);
  const skills = extractCleanSkills(input.skills);

  // 5. Emit read-only DiscoveryProposal
  return {
    jobId,
    source,
    sourceUrl: canonicalUrl,
    retrievedAt,
    title: input.title.trim(),
    company: input.company.trim(),
    location: (input.location || 'Remote').trim(),
    category: (input.category || 'software_engineering').trim(),
    description: (input.description || '').trim(),
    requirements,
    skills,
    provenance,
    proposed_by: 'discovery_agent',
    confidence_score: 0.95,
    evaluation_requested: options?.requestEvaluation ?? true,
    evaluation_priority: options?.evaluationPriority || 'normal',
    evaluation_reason: options?.evaluationReason || 'Discovered new opportunity matching criteria',
  };
}

/**
 * Emits a DiscoveryProposal wrapped in the Universal Provenance Envelope.
 * Guarantees zero execution, zero approval, zero evidence mutation authority.
 */
export async function emitDiscoveryProposal(
  input: RawJobInput,
  options?: DiscoveryOptions
): Promise<DiscoveryAgentProposal> {
  const proposal = await runDiscoveryAgent(input, options);

  return createAgentProposalEnvelope(
    proposal,
    DISCOVERY_AGENT_CONTRACT.agent_id,
    DISCOVERY_AGENT_CONTRACT.version,
    proposal.provenance,
    {
      inputEvidenceRefs: options?.inputEvidenceRefs || [],
      createdAt: proposal.retrievedAt,
    }
  );
}

/**
 * Deduplicates job proposals or envelopes deterministically based on their canonical deduplication key.
 * Retains the first observed listing and filters out duplicates.
 */
export function deduplicateProposals<
  T extends DiscoveryProposal | AgentProposal<DiscoveryProposal>
>(items: T[]): DeduplicationResult<T> {
  const seenKeys = new Set<string>();
  const unique: T[] = [];
  const duplicateKeys: string[] = [];

  for (const item of items) {
    const proposal: DiscoveryProposal = 'output' in item ? (item as AgentProposal<DiscoveryProposal>).output : (item as DiscoveryProposal);
    const key = proposal.jobId;

    if (seenKeys.has(key)) {
      duplicateKeys.push(key);
    } else {
      seenKeys.add(key);
      unique.push(item);
    }
  }

  return {
    unique,
    duplicatesRemoved: duplicateKeys.length,
    duplicateKeys,
  };
}

/**
 * Searches permitted sources for job listings, normalizes them, deduplicates,
 * and emits an array of verified Discovery Agent Proposals wrapped in Provenance Envelopes.
 */
export async function searchPermittedSources(
  inputs: RawJobInput[],
  options?: {
    strictPermittedSources?: boolean;
    inputEvidenceRefs?: string[];
  }
): Promise<{
  proposals: DiscoveryAgentProposal[];
  deduplicatedCount: number;
  rejectedCount: number;
  rejections: { title: string; company: string; reason: string }[];
}> {
  const proposals: DiscoveryAgentProposal[] = [];
  const rejections: { title: string; company: string; reason: string }[] = [];

  for (const raw of inputs) {
    // 1. Source verification check
    if (options?.strictPermittedSources !== false && !isPermittedSource(raw.source)) {
      rejections.push({
        title: raw.title || 'Unknown',
        company: raw.company || 'Unknown',
        reason: `Unpermitted discovery source: '${raw.source}'. Permitted sources: ${PERMITTED_DISCOVERY_SOURCES.join(', ')}`,
      });
      continue;
    }

    try {
      const envelope = await emitDiscoveryProposal(raw, {
        inputEvidenceRefs: options?.inputEvidenceRefs,
      });
      proposals.push(envelope);
    } catch (err: any) {
      rejections.push({
        title: raw.title || 'Unknown',
        company: raw.company || 'Unknown',
        reason: err.message,
      });
    }
  }

  // 2. Deterministic deduplication
  const dedupResult = deduplicateProposals(proposals);

  return {
    proposals: dedupResult.unique,
    deduplicatedCount: dedupResult.duplicatesRemoved,
    rejectedCount: rejections.length,
    rejections,
  };
}

