import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { IngestionResult, NormalizedJob } from './types.ts';
import { GreenhouseAdapter } from './adapters/greenhouse.ts';
import { LeverAdapter } from './adapters/lever.ts';
import { RemoteOKAdapter } from './adapters/remoteok.ts';
import { extractJsonLdJob } from './adapters/jsonld.ts';
import { normalizeJobRecord, stripHtml } from './normalizer.ts';

let _adminClient: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return _adminClient;
}

const greenhouse = new GreenhouseAdapter();
const lever = new LeverAdapter();
const remoteok = new RemoteOKAdapter();

export async function persistDiscoveredJobs(jobs: NormalizedJob[]): Promise<{
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}> {
  if (!jobs || jobs.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0, errors: [] };
  }

  const admin = getAdmin();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Batch in chunks of 50 to avoid payload limits
  const CHUNK_SIZE = 50;
  for (let i = 0; i < jobs.length; i += CHUNK_SIZE) {
    const chunk = jobs.slice(i, i + CHUNK_SIZE).map((j) => ({
      external_id: j.external_id,
      title: j.title,
      company: j.company,
      url: j.url,
      description: j.description,
      salary: j.salary || null,
      location: j.location,
      remote_status: j.remote_status,
      source: j.source,
      category: j.category,
      skills: j.skills,
      published_at: j.published_at,
    }));

    try {
      const { data, error } = await admin
        .from('discovered_jobs')
        .upsert(chunk, { onConflict: 'external_id', ignoreDuplicates: false })
        .select('id, external_id');

      if (error) {
        errors.push(error.message);
        console.error('[Ingestion] Database upsert error:', error.message);
      } else if (data) {
        inserted += data.length;
      }
    } catch (err: any) {
      errors.push(err.message || 'Unknown database error');
    }
  }

  return { inserted, updated, skipped, errors };
}

export async function ingestJobsFromSource(
  source: 'all' | 'greenhouse' | 'lever' | 'remoteok' = 'all',
  options: { limitPerSource?: number } = {}
): Promise<IngestionResult> {
  const limit = options.limitPerSource || 25;
  const fetchedJobs: NormalizedJob[] = [];
  const errors: string[] = [];

  if (source === 'all' || source === 'greenhouse') {
    try {
      const ghJobs = await greenhouse.fetchJobs({ limit });
      fetchedJobs.push(...ghJobs);
    } catch (err: any) {
      errors.push(`Greenhouse: ${err?.message}`);
    }
  }

  if (source === 'all' || source === 'lever') {
    try {
      const levJobs = await lever.fetchJobs({ limit });
      fetchedJobs.push(...levJobs);
    } catch (err: any) {
      errors.push(`Lever: ${err?.message}`);
    }
  }

  if (source === 'all' || source === 'remoteok') {
    try {
      const rokJobs = await remoteok.fetchJobs({ limit });
      fetchedJobs.push(...rokJobs);
    } catch (err: any) {
      errors.push(`RemoteOK: ${err?.message}`);
    }
  }

  // Deduplicate before database insertion
  const seenKeys = new Set<string>();
  const uniqueJobs: NormalizedJob[] = [];

  for (const j of fetchedJobs) {
    if (!seenKeys.has(j.external_id)) {
      seenKeys.add(j.external_id);
      uniqueJobs.push(j);
    }
  }

  const { inserted, updated, skipped, errors: dbErrors } = await persistDiscoveredJobs(uniqueJobs);
  errors.push(...dbErrors);

  return {
    source,
    total_fetched: fetchedJobs.length,
    inserted,
    updated,
    skipped,
    errors,
  };
}

export async function ingestJobFromUrl(
  rawUrl: string,
  customText?: string
): Promise<NormalizedJob | null> {
  const trimmedUrl = rawUrl.trim();

  // Try ATS adapters if URL matches
  if (/boards\.greenhouse\.io|job-boards\.greenhouse\.io/.test(trimmedUrl)) {
    const ghJob = await greenhouse.fetchJobByUrl(trimmedUrl);
    if (ghJob) {
      await persistDiscoveredJobs([ghJob]);
      return ghJob;
    }
  }

  if (/jobs\.lever\.co/.test(trimmedUrl)) {
    const leverJob = await lever.fetchJobByUrl(trimmedUrl);
    if (leverJob) {
      await persistDiscoveredJobs([leverJob]);
      return leverJob;
    }
  }

  // Fetch HTML and try JSON-LD extraction
  try {
    const res = await fetch(trimmedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 RemoteJobAccelerator/4.3',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });

    if (res.ok) {
      const html = await res.text();
      const extracted = extractJsonLdJob(html, trimmedUrl);
      if (extracted) {
        if (customText && customText.trim().length > 100) {
          extracted.description = stripHtml(customText).slice(0, 30000);
        }
        await persistDiscoveredJobs([extracted]);
        return extracted;
      }
    }
  } catch (err: any) {
    console.warn('[IngestFromUrl] Web extraction fallback:', err?.message);
  }

  // Fallback: If customText was provided, create normalized job directly
  if (customText && customText.trim().length >= 50) {
    const u = new URL(trimmedUrl);
    const domain = u.hostname.replace(/^www\./, '');
    const cleanText = stripHtml(customText);
    const rawLines = customText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const title = rawLines[0]?.slice(0, 100) || 'Target Remote Role';
    const candidateCompany = rawLines.length > 1 && rawLines[1].length < 60 ? rawLines[1] : null;

    const normalized = normalizeJobRecord({
      title,
      company: candidateCompany || domain.split('.')[0]?.toUpperCase() || 'Direct Employer',
      url: trimmedUrl,
      description: cleanText,
      source: `Manual Ingest (${domain})`,
    });

    await persistDiscoveredJobs([normalized]);
    return normalized;
  }

  return null;
}
