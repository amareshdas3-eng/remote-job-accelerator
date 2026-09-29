// lib/jobs/clustering.ts
// RJA v5.3: Canonical Deduplication & Requisition Clustering
// Merges multi-board/multi-source observations of the same requisition into a single canonical record.
// Invariants:
// 1. Preserves earliest authentic source-declared posted_at.
// 2. Prioritizes Tier 1 direct employer ATS application URLs over aggregators.
// 3. Attaches verifiable provenance badges.

import crypto from 'node:crypto';
import type { NormalizedJob, CanonicalJobCluster, JobObservation, JobSourceTier } from './types.ts';
import { slugify, canonicalizeUrl } from './dedup.ts';
import { parseSourcePostingTime } from './freshness.ts';

const TIER_PRIORITY: Record<JobSourceTier, number> = {
  tier1_direct_ats: 1,
  tier1_company_jsonld: 2,
  tier2_job_board: 3,
  tier3_aggregator: 4,
};

/**
 * Computes a deterministic cluster key for an opportunity.
 * Prefers requisition ID if provided by the ATS, otherwise falls back to normalized company + normalized title.
 */
export function computeClusterKey(job: NormalizedJob): string {
  const comp = slugify(job.company || '');
  if (job.requisition_id && job.requisition_id.trim().length > 0) {
    return `${comp}:req:${slugify(job.requisition_id)}`;
  }
  const normTitle = slugify(job.title || '').slice(0, 48);
  return `${comp}:${normTitle}`;
}

/**
 * Resolves the canonical publication timestamp for a cluster according to an explicit evidence-precedence rule:
 * 1. Filter observations to those with authentic, parseable declared_posted_at.
 * 2. Group by trust tier:
 *    - Tier 1 (Direct ATS / Company JSON-LD): Highest trust employer evidence.
 *    - Tier 2 (Approved Job Boards): Secondary trust.
 *    - Tier 3 (Aggregators): Tertiary trust.
 * 3. Take the earliest authentic timestamp among the HIGHEST available tier.
 *    (e.g., if a Tier 1 ATS exists, its declared date takes absolute precedence over any aggregator date).
 * 4. If no observation has authentic timestamp evidence, return undefined (POSTING_TIME_UNKNOWN).
 */
export function resolveCanonicalPostingTime(observations: JobObservation[]): string | undefined {
  const validObs = observations
    .map((o) => ({
      ...o,
      epoch: parseSourcePostingTime(o.declared_posted_at),
      priority: TIER_PRIORITY[o.source_tier] || 99,
    }))
    .filter((o) => o.epoch !== null);

  if (validObs.length === 0) {
    return undefined;
  }

  // Find the highest trust tier present among valid observations (lowest priority number)
  const bestPriority = Math.min(...validObs.map((o) => o.priority));
  const bestTierObs = validObs.filter((o) => o.priority === bestPriority);

  // Among the highest trust tier, take the earliest authentic timestamp
  const earliestEpoch = Math.min(...bestTierObs.map((o) => o.epoch as number));
  return new Date(earliestEpoch).toISOString();
}

/**
 * Clusters a list of normalized jobs into canonical job records.
 * Multiple sightings of the same job on different boards or APIs are consolidated.
 */
export function clusterDiscoveredJobs(jobs: NormalizedJob[]): NormalizedJob[] {
  if (!jobs || jobs.length === 0) return [];

  const clusters = new Map<string, {
    primaryJob: NormalizedJob;
    observations: JobObservation[];
    bestTier: JobSourceTier;
  }>();

  for (const job of jobs) {
    const key = computeClusterKey(job);
    const jobTier: JobSourceTier = job.source_tier || (
      job.source.toLowerCase().includes('greenhouse') ||
      job.source.toLowerCase().includes('lever') ||
      job.source.toLowerCase().includes('ashby') ||
      job.source.toLowerCase().includes('workable')
        ? 'tier1_direct_ats'
        : job.source.toLowerCase().includes('web')
        ? 'tier1_company_jsonld'
        : 'tier2_job_board'
    );

    const observation: JobObservation = {
      source_id: job.source_id || slugify(job.source),
      source_name: job.source,
      source_tier: jobTier,
      observed_url: job.url,
      declared_posted_at: job.posted_at || job.published_at,
      detected_at: job.detected_at || new Date().toISOString(),
    };

    const existing = clusters.get(key);
    if (!existing) {
      clusters.set(key, {
        primaryJob: {
          ...job,
          source_tier: jobTier,
        },
        observations: [observation],
        bestTier: jobTier,
      });
    } else {
      existing.observations.push(observation);

      // Prioritize higher tier source (Tier 1 ATS > Tier 2 board) for application URL and primary identity
      const existingTierPriority = TIER_PRIORITY[existing.bestTier] || 99;
      const currentTierPriority = TIER_PRIORITY[jobTier] || 99;

      if (currentTierPriority < existingTierPriority) {
        existing.bestTier = jobTier;
        existing.primaryJob.url = job.url;
        existing.primaryJob.application_url = job.application_url || job.url;
        existing.primaryJob.source = job.source;
        existing.primaryJob.source_tier = jobTier;
      }

      // Merge description and skills if incoming has richer content
      if ((job.description?.length || 0) > (existing.primaryJob.description?.length || 0)) {
        existing.primaryJob.description = job.description;
      }
      if (Array.isArray(job.skills) && job.skills.length > (existing.primaryJob.skills?.length || 0)) {
        existing.primaryJob.skills = job.skills;
      }
    }
  }

  // Final pass: resolve canonical publication timestamp via evidence-precedence rule and annotate badges
  const results: NormalizedJob[] = [];
  for (const [key, clusterData] of clusters.entries()) {
    const badges = Array.from(
      new Set(clusterData.observations.map((o) => o.source_name))
    );

    const canonicalPostingTime = resolveCanonicalPostingTime(clusterData.observations);

    const canonicalId = crypto
      .createHash('sha256')
      .update(key)
      .digest('hex')
      .slice(0, 20);

    results.push({
      ...clusterData.primaryJob,
      external_id: clusterData.primaryJob.external_id || `canon:${canonicalId}`,
      posted_at: canonicalPostingTime,
      published_at: canonicalPostingTime,
      observation_badges: badges,
      observations: clusterData.observations,
      is_clustered: clusterData.observations.length > 1,
    });
  }

  return results;
}
