import type { JobSourceAdapter, NormalizedJob } from '../types.ts';
import { normalizeJobRecord } from '../normalizer.ts';

export class RemoteOKAdapter implements JobSourceAdapter {
  name = 'remoteok';

  async fetchJobs(options: { limit?: number } = {}): Promise<NormalizedJob[]> {
    const allJobs: NormalizedJob[] = [];

    try {
      const url = 'https://remoteok.com/api';
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'RemoteJobAccelerator/4.3 (+https://remotejobaccelerator.com; contact@remotejobaccelerator.com)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) return [];

      const data = await res.json();
      if (!Array.isArray(data)) return [];

      // RemoteOK first element is legal notice object
      const postings = data.filter((item) => item && item.id && item.position && item.company);

      for (const item of postings) {
        let salary: string | undefined;
        if (item.salary_min && item.salary_max) {
          salary = `$${item.salary_min.toLocaleString()} – $${item.salary_max.toLocaleString()}`;
        }

        const published_at = item.epoch
          ? new Date(Number(item.epoch) * 1000).toISOString()
          : item.date || new Date().toISOString();

        const normalized = normalizeJobRecord({
          native_id: item.id,
          title: item.position,
          company: item.company,
          url: item.url || `https://remoteok.com/remote-jobs/${item.id}`,
          application_url: item.apply_url || item.url,
          description: item.description || '',
          salary,
          location: item.location || '100% Remote (Global)',
          remote_status: '100% Remote',
          source: 'RemoteOK',
          skills: Array.isArray(item.tags) ? item.tags : [],
          published_at,
        });

        allJobs.push(normalized);
        if (options.limit && allJobs.length >= options.limit) {
          break;
        }
      }
    } catch (err: any) {
      console.warn('[RemoteOKAdapter] Failed to fetch jobs:', err?.message);
    }

    return allJobs;
  }
}
