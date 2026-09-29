import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { IngestionResult, NormalizedJob, JobSourceTier } from './types.ts';
import { GreenhouseAdapter } from './adapters/greenhouse.ts';
import { LeverAdapter } from './adapters/lever.ts';
import { AshbyAdapter } from './adapters/ashby.ts';
import { WorkableAdapter } from './adapters/workable.ts';
import { RemoteOKAdapter } from './adapters/remoteok.ts';
import { extractJsonLdJob } from './adapters/jsonld.ts';
import { normalizeJobRecord, stripHtml } from './normalizer.ts';
import { globalSourceRegistry } from './registry.ts';
import { discoveryDispatcher } from './dispatcher.ts';
import { clusterDiscoveredJobs } from './clustering.ts';
import { calculateDiscoveryLatency } from './latency.ts';

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
const ashby = new AshbyAdapter();
const workable = new WorkableAdapter();
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

/**
 * RJA v5.3: Global Job Discovery Fabric Ingestion Engine
 * Executes bounded-concurrency parallel queries across registered Tier 1 and Tier 2 sources.
 * Applies Requisition Clustering, Discovery Latency calculation, and updates source telemetry.
 */
export async function executeGlobalDiscoveryFabric(options: {
  limitPerSource?: number;
  tier?: JobSourceTier;
  targetRegion?: string;
} = {}): Promise<{
  total_sources_queried: number;
  raw_jobs_found: number;
  clustered_jobs_count: number;
  fresh_jobs_count: number;
  jobs: NormalizedJob[];
  errors: string[];
}> {
  const sources = globalSourceRegistry.listRegisteredSources({
    tier: options.tier,
    health: 'healthy',
  });

  const rawJobs: NormalizedJob[] = [];
  const errors: string[] = [];

  const { results, errors: poolErrors } = await discoveryDispatcher.runPool(
    sources,
    async (src) => {
      const t0 = Date.now();
      try {
        let fetched: NormalizedJob[] = [];
        if (src.provider === 'greenhouse') {
          // Extracts authentic first_published via two-phase discovery
          const boardName = src.endpoint_url.split('/boards/')[1]?.split('/')[0] || src.company_name.toLowerCase();
          fetched = await greenhouse.fetchJobs({ limit: options.limitPerSource || 15, board: boardName });
        } else if (src.provider === 'lever') {
          const compKey = src.endpoint_url.split('/postings/')[1]?.split('?')[0] || src.company_name.toLowerCase();
          fetched = await lever.fetchJobs({ limit: options.limitPerSource || 15, companyKey: compKey });
        } else if (src.provider === 'ashby') {
          const org = src.endpoint_url.split('/job-board/')[1]?.split('/')[0] || src.company_name.toLowerCase();
          fetched = await ashby.fetchJobs({ limit: options.limitPerSource || 15, organization: org });
        } else if (src.provider === 'workable') {
          const acc = src.endpoint_url.split('/accounts/')[1]?.split('/')[0] || src.company_name.toLowerCase();
          fetched = await workable.fetchJobs({ limit: options.limitPerSource || 15, account: acc });
        } else if (src.provider === 'remoteok') {
          fetched = await remoteok.fetchJobs({ limit: options.limitPerSource || 25 });
        }

        const elapsed = Date.now() - t0;
        const freshCount = fetched.filter((j) => {
          if (!j.published_at) return false;
          const age = Date.now() - new Date(j.published_at).getTime();
          return age > 0 && age <= 48 * 3600 * 1000;
        }).length;

        globalSourceRegistry.updateSourceHealth(src.id, 'healthy', {
          latencyMs: elapsed,
          jobsFound: fetched.length,
          freshJobs: freshCount,
        });

        return fetched;
      } catch (err: any) {
        globalSourceRegistry.updateSourceHealth(src.id, 'degraded', { failure: true });
        throw err;
      }
    }
  );

  rawJobs.push(...results);
  for (const pe of poolErrors) {
    errors.push(`${pe.item.company_name} (${pe.item.provider}): ${pe.error}`);
  }

  // 1. Cluster jobs to unify multi-source requisition sightings
  const clustered = clusterDiscoveredJobs(rawJobs);

  // 2. Attach authentic Discovery Latency metrics (never estimating or fabricating)
  const now = Date.now();
  const enriched = clustered.map((j) => {
    const detectedAtMs = j.detected_at ? new Date(j.detected_at).getTime() : now;
    const latency = calculateDiscoveryLatency(j.published_at || j.posted_at, detectedAtMs, {
      jobId: j.external_id,
    });
    if (latency) {
      j.discovery_latency_ms = latency.discoveryLatencyMs;
      j.discovery_latency_text = latency.discoveryLatencyText;
    }
    return j;
  });

  // 3. Persist to database
  await persistDiscoveredJobs(enriched).catch(() => {});

  const freshJobs = enriched.filter((j) => {
    if (!j.published_at) return false;
    const age = now - new Date(j.published_at).getTime();
    return age > 0 && age <= 48 * 3600 * 1000;
  });

  return {
    total_sources_queried: sources.length,
    raw_jobs_found: rawJobs.length,
    clustered_jobs_count: enriched.length,
    fresh_jobs_count: freshJobs.length,
    jobs: enriched,
    errors,
  };
}

export async function ingestJobsFromSource(
  source: 'all' | 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'remoteok' = 'all',
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

  if (source === 'all' || source === 'ashby') {
    try {
      const ashJobs = await ashby.fetchJobs({ limit });
      fetchedJobs.push(...ashJobs);
    } catch (err: any) {
      errors.push(`Ashby: ${err?.message}`);
    }
  }

  if (source === 'all' || source === 'workable') {
    try {
      const wrkJobs = await workable.fetchJobs({ limit });
      fetchedJobs.push(...wrkJobs);
    } catch (err: any) {
      errors.push(`Workable: ${err?.message}`);
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

  // Canonical Deduplication & Clustering
  const clusteredJobs = clusterDiscoveredJobs(fetchedJobs);

  const { inserted, updated, skipped, errors: dbErrors } = await persistDiscoveredJobs(clusteredJobs);
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
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 RemoteJobAccelerator/5.3',
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
