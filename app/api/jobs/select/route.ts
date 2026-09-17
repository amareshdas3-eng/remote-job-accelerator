import { NextResponse } from 'next/server';
import { requirePro } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import { jsonError, sameOrigin } from '../../../../lib/security';

export async function POST(req: Request) {
  try {
    const user = await requirePro();
    if (!sameOrigin(req)) return jsonError('Invalid origin', 403);

    const b = await req.json();
    const title = String(b.title || '').trim().slice(0, 200);
    const company = String(b.company || '').trim().slice(0, 200);
    const description = String(b.description || '').trim().slice(0, 30000);
    const url = b.url ? String(b.url).trim().slice(0, 1000) : null;

    if (!title || !company) {
      return jsonError('Job title and company are required.', 400);
    }

    const admin = supabaseAdmin();

    // Check if an identical job record already exists for this user
    let existingJob: any = null;
    if (b.job_id) {
      const { data } = await admin.from('jobs').select('*').eq('id', b.job_id).eq('user_id', user.id).maybeSingle();
      existingJob = data;
    } else {
      const { data } = await admin
        .from('jobs')
        .select('*')
        .eq('user_id', user.id)
        .eq('title', title)
        .eq('company', company)
        .maybeSingle();
      existingJob = data;
    }

    let jobRecord = existingJob;
    if (!jobRecord) {
      // Create canonical job record
      const { data: newJob, error: insertError } = await admin
        .from('jobs')
        .insert({
          user_id: user.id,
          title,
          company,
          url,
          description: description || 'Target job opportunity selected from discovery.',
        })
        .select()
        .single();

      if (insertError) throw insertError;
      jobRecord = newJob;
    } else if (description && (!jobRecord.description || jobRecord.description.length < 50)) {
      // Update description if previous was empty
      const { data: updated } = await admin
        .from('jobs')
        .update({ description, url: url || jobRecord.url, updated_at: new Date().toISOString() })
        .eq('id', jobRecord.id)
        .select()
        .single();
      if (updated) jobRecord = updated;
    }

    // Ensure application record exists in pipeline with status 'selected'
    const { data: existingApp } = await admin
      .from('applications')
      .select('*')
      .eq('user_id', user.id)
      .eq('job_id', jobRecord.id)
      .maybeSingle();

    let appRecord = existingApp;
    if (!appRecord) {
      const { data: newApp, error: appError } = await admin
        .from('applications')
        .insert({
          user_id: user.id,
          job_id: jobRecord.id,
          company: jobRecord.company,
          role: jobRecord.title,
          job_url: jobRecord.url,
          status: 'selected',
          notes: `[${new Date().toLocaleDateString('en-US')}] Selected job from Remote Job Discovery. Ready for Match Analysis.`,
        })
        .select()
        .single();
      if (!appError && newApp) appRecord = newApp;
    }

    return NextResponse.json({
      job_id: jobRecord.id,
      job: jobRecord,
      application: appRecord,
      message: `Selected ${jobRecord.title} at ${jobRecord.company}. Canonical job record established.`,
    });
  } catch (e: any) {
    console.error('Job select error:', e);
    const status = e.message === 'PRO_REQUIRED' ? 402 : e.message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonError(e.message || 'JOB_SELECT_FAILED', status);
  }
}
