import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import { ingestJobFromUrl } from '../../../../lib/jobs/ingestion';

const ImportSchema = z.object({
  url: z.string().url(),
  custom_text: z.string().optional(),
});

const ALLOWED_ATS = [
  'boards.greenhouse.io',
  'job-boards.greenhouse.io',
  'jobs.lever.co',
  'lever.co',
  'remoteok.com',
  'jobs.ashbyhq.com',
  'weworkremotely.com',
];

function isApprovedHost(hostname: string): boolean {
  return ALLOWED_ATS.some((h) => hostname === h || hostname.endsWith('.' + h));
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parseResult = ImportSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid URL provided' }, { status: 400 });
    }

    const { url, custom_text } = parseResult.data;
    const u = new URL(url);

    if (!isApprovedHost(u.hostname) && !custom_text) {
      return NextResponse.json(
        { error: 'Only approved public Greenhouse/Lever/RemoteOK sources or descriptions with URLs are enabled.' },
        { status: 400 }
      );
    }

    // Extract and normalize job data
    const normalized = await ingestJobFromUrl(url, custom_text);
    if (!normalized) {
      return NextResponse.json(
        { error: 'Unable to extract structured job details from the provided URL. Please paste the job description.' },
        { status: 422 }
      );
    }

    // Check if user is authenticated to establish active canonical job automatically
    let user = null;
    try {
      user = await requireUser();
    } catch {
      // Unauthenticated callers still receive normalized job extraction
    }

    let canonicalJobRecord = null;
    let applicationRecord = null;

    if (user) {
      const admin = supabaseAdmin();

      // Check if job already exists for user
      const { data: existing } = await admin
        .from('jobs')
        .select('*')
        .eq('user_id', user.id)
        .eq('title', normalized.title)
        .eq('company', normalized.company)
        .maybeSingle();

      if (existing) {
        canonicalJobRecord = existing;
      } else {
        const { data: newJob, error: insertError } = await admin
          .from('jobs')
          .insert({
            user_id: user.id,
            title: normalized.title,
            company: normalized.company,
            url: normalized.url,
            application_url: normalized.application_url || normalized.url,
            description: normalized.description,
            salary: normalized.salary || null,
            location: normalized.location,
            remote_status: normalized.remote_status,
            source: normalized.source,
            employment_type: normalized.employment_type || 'Full-time Remote',
            metadata: {
              external_id: normalized.external_id,
              category: normalized.category,
              skills: normalized.skills,
            },
          })
          .select()
          .single();

        if (!insertError && newJob) {
          canonicalJobRecord = newJob;
        }
      }

      if (canonicalJobRecord) {
        // Ensure application record is created
        const { data: existingApp } = await admin
          .from('applications')
          .select('*')
          .eq('user_id', user.id)
          .eq('job_id', canonicalJobRecord.id)
          .maybeSingle();

        if (existingApp) {
          applicationRecord = existingApp;
        } else {
          const { data: newApp } = await admin
            .from('applications')
            .insert({
              user_id: user.id,
              job_id: canonicalJobRecord.id,
              company: canonicalJobRecord.company,
              role: canonicalJobRecord.title,
              job_url: canonicalJobRecord.url,
              status: 'selected',
              notes: `[${new Date().toLocaleDateString('en-US')}] Imported via RJA Job Adapter.`,
            })
            .select()
            .single();

          if (newApp) applicationRecord = newApp;
        }
      }
    }

    return NextResponse.json({
      status: 'accepted',
      url: normalized.url,
      message: 'Job successfully extracted and normalized.',
      job: normalized,
      canonical_job: canonicalJobRecord,
      application: applicationRecord,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Job import failed' },
      { status: 500 }
    );
  }
}
