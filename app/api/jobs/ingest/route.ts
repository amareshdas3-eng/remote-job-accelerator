import { NextResponse } from 'next/server';
import { requirePro } from '../../../../lib/auth';
import { rate } from '../../../../lib/rate';
import { jsonError, sameOrigin } from '../../../../lib/security';
import { ingestJobsFromSource, ingestJobFromUrl } from '../../../../lib/jobs/ingestion';

const ALLOWED_HOSTS = [
  'linkedin.com',
  'www.linkedin.com',
  'boards.greenhouse.io',
  'job-boards.greenhouse.io',
  'jobs.lever.co',
  'lever.co',
  'remoteok.com',
  'weworkremotely.com',
];

function isAllowedHost(host: string): boolean {
  return ALLOWED_HOSTS.some((x) => host === x || host.endsWith('.' + x));
}

export async function POST(req: Request) {
  try {
    const user = await requirePro();
    if (!sameOrigin(req)) return jsonError('Invalid origin', 403);
    if (!(await rate('ingest:' + user.id, 20))) return jsonError('RATE_LIMIT', 429);

    const b = await req.json().catch(() => ({}));

    // Mode 1: Feed Ingestion (syncing jobs from external board APIs)
    if (b.source && ['all', 'greenhouse', 'lever', 'remoteok'].includes(b.source)) {
      const result = await ingestJobsFromSource(b.source, {
        limitPerSource: b.limit ? Math.min(50, Number(b.limit)) : 20,
      });
      return NextResponse.json({
        ok: true,
        mode: 'feed_sync',
        result,
      });
    }

    // Mode 2: Single URL Ingestion
    const raw = String(b.url || '').trim();
    if (!raw) {
      return jsonError('Please provide a valid job URL or specify an ingestion source.', 400);
    }

    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password) {
      return jsonError('Unsupported or unsafe job URL', 400);
    }

    // Attempt structured extraction first
    const normalized = await ingestJobFromUrl(raw, b.text);
    if (normalized) {
      return NextResponse.json(
        {
          ok: true,
          url: normalized.url,
          text: normalized.description,
          job: normalized,
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Fallback: fetch HTML directly if allowed
    if (!isAllowedHost(u.hostname)) {
      return jsonError('Unsupported or unverified job domain. Paste the job description instead.', 400);
    }

    const r = await fetch(u, {
      redirect: 'error',
      headers: { 'User-Agent': 'RemoteJobAccelerator/4.3 (+job-ingestion)' },
      signal: AbortSignal.timeout(7000),
      cache: 'no-store',
    });

    if (!r.ok) {
      return jsonError(`Job page could not be read (${r.status}). Paste the job description instead.`, 422);
    }

    const html = await r.text();
    if (html.length > 2_000_000) return jsonError('Job page is too large', 413);

    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 30000);

    if (text.length < 300) {
      return jsonError('Not enough readable job content. Paste the description instead.', 422);
    }

    return NextResponse.json(
      { ok: true, url: u.toString(), text },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: any) {
    const status = e.message === 'PRO_REQUIRED' ? 402 : e.message === 'UNAUTHENTICATED' ? 401 : 422;
    return jsonError(
      e.message === 'PRO_REQUIRED'
        ? 'PRO_REQUIRED'
        : 'Unable to ingest job URL. Paste the job description instead.',
      status
    );
  }
}
