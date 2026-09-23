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
        const url = `https://boards-api.greenhouse.io/v1/boards/${b.board}/jobs?content=true`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'RemoteJobAccelerator/4.3 (+https://remotejobaccelerator.com)',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) continue;

        const data = await res.json();
        const jobs = data.jobs || [];

        for (const j of jobs) {
          const location = j.location?.name || '100% Remote';
          const isRemote =
            location.toLowerCase().includes('remote') ||
            j.title.toLowerCase().includes('remote');

          // Prioritize remote jobs
          if (!isRemote && !options.board) continue;

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
            published_at: j.updated_at,
          });

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
      // Expected formats:
      // boards.greenhouse.io/{board}/jobs/{id}
      // job-boards.greenhouse.io/{board}/jobs/{id}
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
          'User-Agent': 'RemoteJobAccelerator/4.3 (+https://remotejobaccelerator.com)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) return null;
      const data = await res.json();

      return normalizeJobRecord({
        native_id: data.id,
        title: data.title,
        company: board.charAt(0).toUpperCase() + board.slice(1),
        url: data.absolute_url || url,
        application_url: data.absolute_url || url,
        description: data.content || '',
        location: data.location?.name || '100% Remote',
        remote_status: '100% Remote',
        source: `Greenhouse (${board})`,
        published_at: data.updated_at,
      });
    } catch {
      return null;
    }
  }
}
