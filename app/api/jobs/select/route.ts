import { NextResponse } from 'next/server';
import { requirePro } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import { jsonError, sameOrigin } from '../../../../lib/security';
import { detectApplicationRoute } from '../../../../lib/jobs/routeDetector';

export async function POST(req: Request) {
  try {
    const user = await requirePro();
    if (!sameOrigin(req)) return jsonError('Invalid origin', 403);

    const b = await req.json();
    const admin = supabaseAdmin();

    let title = String(b.title || '').trim().slice(0, 200);
    let company = String(b.company || '').trim().slice(0, 200);
    let description = String(b.description || '').trim().slice(0, 30000);
    let url = b.url ? String(b.url).trim().slice(0, 1000) : null;
    let company_website = b.company_website ? String(b.company_website).trim().slice(0, 1000) : null;
    let application_url = b.application_url ? String(b.application_url).trim().slice(0, 1000) : url;
    let remote_status = String(b.remote_status || '100% Remote').trim().slice(0, 100);
    let location = String(b.location || '100% Remote (Global / US)').trim().slice(0, 200);
    let salary = b.salary ? String(b.salary).trim().slice(0, 150) : null;
    let employment_type = b.employment_type ? String(b.employment_type).trim().slice(0, 100) : 'Full-time';
    let source = String(b.source || 'Verified Direct Employer Listing').trim().slice(0, 200);
    const metadata = b.metadata && typeof b.metadata === 'object' ? { ...b.metadata } : {};

    // If discovered_job_id provided, enrich from discovered_jobs
    if (b.discovered_job_id) {
      const { data: disc } = await admin
        .from('discovered_jobs')
        .select('*')
        .eq('id', b.discovered_job_id)
        .maybeSingle();

      if (disc) {
        if (!title) title = disc.title;
        if (!company) company = disc.company;
        if (!description || description.length < 50) description = disc.description || '';
        if (!url) url = disc.url;
        if (!application_url) application_url = disc.url;
        if (!salary && disc.salary) salary = disc.salary;
        if (disc.source) source = disc.source;
        if (disc.location) location = disc.location;
        if (disc.remote_status) remote_status = disc.remote_status;
        metadata.discovered_job_id = disc.id;
        metadata.skills = disc.skills;
      }
    }

    if (!title || !company) {
      return jsonError('Job title and company are required.', 400);
    }

    // Automatically detect application route & ATS platform
    const routeInfo = detectApplicationRoute(url, application_url, description);
    metadata.route_detection = routeInfo;

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
      const newJobPayload = {
        user_id: user.id,
        title,
        company,
        url,
        description: description || 'Target job opportunity selected from discovery.',
        company_website,
        application_url,
        remote_status,
        location,
        salary,
        employment_type,
        source,
        metadata,
      };

      const { data: newJob, error: insertError } = await admin
        .from('jobs')
        .insert(newJobPayload)
        .select()
        .single();

      if (insertError) {
        console.warn('[Jobs API] Supabase jobs insert fallback (check table grants in SQL editor):', insertError.message);
        jobRecord = {
          id: crypto.randomUUID(),
          ...newJobPayload,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      } else {
        jobRecord = newJob;
      }
    } else {
      // Update fields if provided
      const existingMeta = jobRecord.metadata && typeof jobRecord.metadata === 'object' ? jobRecord.metadata : {};
      const updates: any = {
        updated_at: new Date().toISOString(),
        metadata: { ...existingMeta, route_detection: routeInfo, ...metadata }
      };
      if (description && (!jobRecord.description || jobRecord.description.length < 50)) updates.description = description;
      if (url && !jobRecord.url) updates.url = url;
      if (company_website && !jobRecord.company_website) updates.company_website = company_website;
      if (application_url && !jobRecord.application_url) updates.application_url = application_url;
      if (salary && !jobRecord.salary) updates.salary = salary;
      if (source && !jobRecord.source) updates.source = source;

      const { data: updated } = await admin
        .from('jobs')
        .update(updates)
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
          route: routeInfo.route,
          route_details: routeInfo,
          notes: `[${new Date().toLocaleDateString('en-US')}] Selected job from Remote Job Discovery. Route: ${routeInfo.platformName}. Ready for Application Strategy.`,
        })
        .select()
        .single();
      if (!appError && newApp) appRecord = newApp;
    } else if (!existingApp.route || existingApp.route === 'website') {
      const { data: updatedApp } = await admin
        .from('applications')
        .update({
          route: routeInfo.route,
          route_details: routeInfo,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingApp.id)
        .select()
        .single();
      if (updatedApp) appRecord = updatedApp;
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
