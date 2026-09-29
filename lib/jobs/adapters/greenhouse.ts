// lib/jobs/adapters/greenhouse.ts
// RJA v5.3: Greenhouse Direct ATS Source Adapter (Tier 1)
// Implements Two-Phase Discovery to resolve genuine first_published timestamp.
//
// Invariants:
// Phase 1 (List): Filters candidates; updated_at is rejected as publication evidence.
// Phase 2 (Detail): Fetches individual requisition to extract authentic first_published ISO date.
// If first_published is missing, published_at remains undefined (POSTING_TIME_UNKNOWN).

import type { JobSourceAdapter, NormalizedJob } from '../types.ts';
import { normalizeJobRecord } from '../normalizer.ts';

const TOP_REMOTE_GREENHOUSE_BOARDS = [
  { board: 'automattic', company: 'Automattic' },
  { board: 'gitlab', company: 'GitLab' },
  { board: 'docker', company: 'Docker' },
  { board: 'canonical', company: 'Canonical' },
  { board: 'cloudflare', company: 'Cloudflare' },
];

export class GreenhouseAdapter implements JobSourceAdapter {
  name = 'greenhouse';

  async fetchJobs(options: { limit?: number; board?: string } = {}): Promise<NormalizedJob[]> {
    const boardsToFetch = options.board
      ? [{ board: options.board, company: options.board }]
      : TOP_REMOTE_GREENHOUSE_BOARDS;

    const allJobs: NormalizedJob[] = [];

    for (const b of boardsToFetch) {
      try {
        // Phase 1: List endpoint fetch
        const url = `https://boards-api.greenhouse.io/v1/boards/${b.board}/jobs?content=true`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'RemoteJobAccelerator/5.3 (+https://remotejobaccelerator.com; bot@remotejobaccelerator.com)',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) continue;

        const data = await res.json();
        const jobs = data.jobs || [];

        // Candidates to inspect
        const candidates = [];
        for (const j of jobs) {
          const location = j.location?.name || '100% Remote';
          const isRemote =
            location.toLowerCase().includes('remote') ||
            j.title.toLowerCase().includes('remote');

          if (!isRemote && !options.board) continue;
          candidates.push(j);
        }

        // Phase 2: Selective Detail Fetching for authentic first_published timestamp
        // Limit detail lookups to candidates passing Phase 1
        const detailFetchLimit = Math.min(candidates.length, options.limit || 15);
        for (let i = 0; i < detailFetchLimit; i++) {
          const j = candidates[i];
          let firstPublishedDate: string | undefined = undefined;

          try {
            const detailUrl = `https://boards-api.greenhouse.io/v1/boards/${b.board}/jobs/${j.id}`;
            const detailRes = await fetch(detailUrl, {
              headers: {
                'User-Agent': 'RemoteJobAccelerator/5.3 (+https://remotejobaccelerator.com; bot@remotejobaccelerator.com)',
                Accept: 'application/json',
              },
              signal: AbortSignal.timeout(5000),
            });

            if (detailRes.ok) {
              const detailData = await detailRes.json();
              if (detailData.first_published && !isNaN(Date.parse(detailData.first_published))) {
                firstPublishedDate = new Date(detailData.first_published).toISOString();
              }
            }
          } catch {
            // Non-fatal if detail fetch fails; leave firstPublishedDate as undefined
          }

          const location = j.location?.name || '100% Remote';
          const isRemote =
            location.toLowerCase().includes('remote') ||
            j.title.toLowerCase().includes('remote');

          const normalized = normalizeJobRecord({
            native_id: j.id,
            title: j.title,
            company: b.company,
            url: j.absolute_url,
            application_url: j.absolute_url,
            description: j.content || '',
            location,
            remote_status: isRemote ? '100% Remote' : 'Hybrid',
            source: `Greenhouse (${b.company})`,
            // Strict Truthfulness Boundary: Only authentic first_published is accepted.
            // If missing or unavailable, published_at is strictly undefined (POSTING_TIME_UNKNOWN).
            published_at: firstPublishedDate,
          });

          normalized.source_tier = 'tier1_direct_ats';
          normalized.requisition_id = String(j.id);

          allJobs.push(normalized);
          if (options.limit && allJobs.length >= options.limit) {
            return allJobs;
          }
        }
      } catch (err: any) {
        console.warn(`[GreenhouseAdapter] Failed to fetch board ${b.board}:`, err?.message);
      }
    }

    return allJobs;
  }

  async fetchJobByUrl(url: string): Promise<NormalizedJob | null> {
    try {
      const u = new URL(url);
      const segments = u.pathname.split('/').filter(Boolean);
      const jobsIdx = segments.indexOf('jobs');
      if (jobsIdx === -1 || jobsIdx === 0 || jobsIdx >= segments.length - 1) {
        return null;
      }

      const board = segments[jobsIdx - 1];
      const jobId = segments[jobsIdx + 1];

      const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${jobId}`;
      const res = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'RemoteJobAccelerator/5.3 (+https://remotejobaccelerator.com; bot@remotejobaccelerator.com)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) return null;
      const data = await res.json();

      let firstPublishedDate: string | undefined = undefined;
      if (data.first_published && !isNaN(Date.parse(data.first_published))) {
        firstPublishedDate = new Date(data.first_published).toISOString();
      }

      const normalized = normalizeJobRecord({
        native_id: data.id,
        title: data.title,
        company: board.charAt(0).toUpperCase() + board.slice(1),
        url: data.absolute_url || url,
        application_url: data.absolute_url || url,
        description: data.content || '',
        location: data.location?.name || '100% Remote',
        remote_status: '100% Remote',
        source: `Greenhouse (${board})`,
        published_at: firstPublishedDate,
      });

      normalized.source_tier = 'tier1_direct_ats';
      normalized.requisition_id = String(data.id);
      return normalized;
    } catch {
      return null;
    }
  }
}
