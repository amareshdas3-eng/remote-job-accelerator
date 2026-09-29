// lib/jobs/adapters/ashby.ts
// RJA v5.3: Ashby Direct ATS Source Adapter (Tier 1)
// Connects to Ashby Public Job Board API.
// Invariant: Uses authentic source-declared publishedAt ISO timestamp.

import type { JobSourceAdapter, NormalizedJob } from '../types.ts';
import { normalizeJobRecord } from '../normalizer.ts';

const TOP_REMOTE_ASHBY_ORGS = [
  { org: 'ramp', company: 'Ramp' },
  { org: 'linear', company: 'Linear' },
  { org: 'retool', company: 'Retool' },
  { org: 'openai', company: 'OpenAI' },
  { org: 'notion', company: 'Notion' },
];

export class AshbyAdapter implements JobSourceAdapter {
  name = 'ashby';

  async fetchJobs(options: { limit?: number; organization?: string } = {}): Promise<NormalizedJob[]> {
    const orgsToFetch = options.organization
      ? [{ org: options.organization, company: options.organization }]
      : TOP_REMOTE_ASHBY_ORGS;

    const allJobs: NormalizedJob[] = [];

    for (const item of orgsToFetch) {
      try {
        const url = `https://api.ashbyhq.com/posting-api/job-board/${item.org}`;
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

        for (const j of jobs) {
          const location = j.location || (j.isRemote ? '100% Remote' : 'Unspecified');
          const isRemote = j.isRemote || location.toLowerCase().includes('remote') || j.title.toLowerCase().includes('remote');

          if (!isRemote && !options.organization) continue;

          // Ashby exposes declared publishedAt ISO timestamp
          const published_at = j.publishedAt && !isNaN(Date.parse(j.publishedAt))
            ? new Date(j.publishedAt).toISOString()
            : undefined;

          let salary: string | undefined;
          if (j.compensation?.summary) {
            salary = String(j.compensation.summary);
          }

          const normalized = normalizeJobRecord({
            native_id: j.id,
            title: j.title,
            company: item.company,
            url: j.jobUrl || `https://jobs.ashbyhq.com/${item.org}/${j.id}`,
            application_url: j.applyUrl || j.jobUrl,
            description: j.descriptionHtml || j.descriptionPlain || '',
            location: isRemote ? '100% Remote' : location,
            remote_status: isRemote ? '100% Remote' : 'Hybrid',
            source: `Ashby (${item.company})`,
            salary,
            published_at,
          });

          normalized.source_tier = 'tier1_direct_ats';
          normalized.requisition_id = String(j.id);

          allJobs.push(normalized);
          if (options.limit && allJobs.length >= options.limit) {
            return allJobs;
          }
        }
      } catch (err: any) {
        console.warn(`[AshbyAdapter] Failed to fetch organization ${item.org}:`, err?.message);
      }
    }

    return allJobs;
  }
}
