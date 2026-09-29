// lib/jobs/adapters/workable.ts
// RJA v5.3: Workable Direct ATS Source Adapter (Tier 1)
// Connects to Workable Public Widget API.
// Invariant: Uses authentic source-declared published_on ISO timestamp.

import type { JobSourceAdapter, NormalizedJob } from '../types.ts';
import { normalizeJobRecord } from '../normalizer.ts';

const TOP_REMOTE_WORKABLE_ACCOUNTS = [
  { account: 'revolut', company: 'Revolut' },
  { account: 'monzo', company: 'Monzo' },
];

export class WorkableAdapter implements JobSourceAdapter {
  name = 'workable';

  async fetchJobs(options: { limit?: number; account?: string } = {}): Promise<NormalizedJob[]> {
    const accountsToFetch = options.account
      ? [{ account: options.account, company: options.account }]
      : TOP_REMOTE_WORKABLE_ACCOUNTS;

    const allJobs: NormalizedJob[] = [];

    for (const item of accountsToFetch) {
      try {
        const url = `https://apply.workable.com/api/v1/widget/accounts/${item.account}`;
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
          const isRemote = j.telecommuting || (j.city && j.city.toLowerCase().includes('remote')) || (j.title && j.title.toLowerCase().includes('remote'));

          if (!isRemote && !options.account) continue;

          const published_at = j.published_on && !isNaN(Date.parse(j.published_on))
            ? new Date(j.published_on).toISOString()
            : undefined;

          const location = isRemote ? '100% Remote' : (j.city ? `${j.city}, ${j.country || ''}`.trim() : '100% Remote');

          const normalized = normalizeJobRecord({
            native_id: j.shortcode,
            title: j.title,
            company: item.company,
            url: j.url || `https://apply.workable.com/${item.account}/j/${j.shortcode}/`,
            application_url: j.url || `https://apply.workable.com/${item.account}/j/${j.shortcode}/`,
            description: j.description || `${j.title} at ${item.company}`,
            location,
            remote_status: isRemote ? '100% Remote' : 'Hybrid',
            source: `Workable (${item.company})`,
            published_at,
          });

          normalized.source_tier = 'tier1_direct_ats';
          normalized.requisition_id = String(j.shortcode);

          allJobs.push(normalized);
          if (options.limit && allJobs.length >= options.limit) {
            return allJobs;
          }
        }
      } catch (err: any) {
        console.warn(`[WorkableAdapter] Failed to fetch account ${item.account}:`, err?.message);
      }
    }

    return allJobs;
  }
}
