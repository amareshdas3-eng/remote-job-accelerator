import type { JobSourceAdapter, NormalizedJob } from '../types.ts';
import { normalizeJobRecord } from '../normalizer.ts';

const TOP_REMOTE_LEVER_COMPANIES = [
  { companyKey: 'netflix', company: 'Netflix' },
  { companyKey: 'spotify', company: 'Spotify' },
  { companyKey: 'yelp', company: 'Yelp' },
];

export class LeverAdapter implements JobSourceAdapter {
  name = 'lever';

  async fetchJobs(options: { limit?: number; companyKey?: string } = {}): Promise<NormalizedJob[]> {
    const companiesToFetch = options.companyKey
      ? [{ companyKey: options.companyKey, company: options.companyKey }]
      : TOP_REMOTE_LEVER_COMPANIES;

    const allJobs: NormalizedJob[] = [];

    for (const c of companiesToFetch) {
      try {
        const url = `https://api.lever.co/v0/postings/${c.companyKey}?mode=json`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'RemoteJobAccelerator/4.3 (+https://remotejobaccelerator.com)',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) continue;

        const postings = await res.json();
        if (!Array.isArray(postings)) continue;

        for (const p of postings) {
          const location = p.categories?.location || '100% Remote';
          const isRemote =
            location.toLowerCase().includes('remote') ||
            p.text.toLowerCase().includes('remote') ||
            p.categories?.workplaceType === 'remote';

          if (!isRemote && !options.companyKey) continue;

          const description = `${p.descriptionPlain || ''}\n\n${p.additionalPlain || ''}`.trim();

          const normalized = normalizeJobRecord({
            native_id: p.id,
            title: p.text,
            company: c.company,
            url: p.hostedUrl,
            application_url: p.applyUrl || p.hostedUrl,
            description,
            location,
            remote_status: isRemote ? '100% Remote' : 'Hybrid',
            source: `Lever (${c.company})`,
            published_at: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
          });

          allJobs.push(normalized);
          if (options.limit && allJobs.length >= options.limit) {
            return allJobs;
          }
        }
      } catch (err: any) {
        console.warn(`[LeverAdapter] Failed to fetch company ${c.companyKey}:`, err?.message);
      }
    }

    return allJobs;
  }

  async fetchJobByUrl(url: string): Promise<NormalizedJob | null> {
    try {
      const u = new URL(url);
      // Expected format: jobs.lever.co/{company}/{id}
      const segments = u.pathname.split('/').filter(Boolean);
      if (segments.length < 2) return null;

      const companyKey = segments[0];
      const postingId = segments[1];

      const apiUrl = `https://api.lever.co/v0/postings/${companyKey}/${postingId}`;
      const res = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'RemoteJobAccelerator/4.3 (+https://remotejobaccelerator.com)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) return null;
      const p = await res.json();

      const description = `${p.descriptionPlain || ''}\n\n${p.additionalPlain || ''}`.trim();

      return normalizeJobRecord({
        native_id: p.id,
        title: p.text,
        company: companyKey.charAt(0).toUpperCase() + companyKey.slice(1),
        url: p.hostedUrl || url,
        application_url: p.applyUrl || p.hostedUrl || url,
        description,
        location: p.categories?.location || '100% Remote',
        remote_status: '100% Remote',
        source: `Lever (${companyKey})`,
        published_at: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
      });
    } catch {
      return null;
    }
  }
}
