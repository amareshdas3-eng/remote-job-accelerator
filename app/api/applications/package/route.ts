import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import { jsonError, sameOrigin } from '../../../../lib/security';
import { formatStructuredProfileText } from '../../../../lib/profile';
import { buildApplicationPackage } from '../../../../lib/applications/workspace';

export async function GET(req: Request) {
  try {
    const u = await requireUser();
    const url = new URL(req.url);
    const jobId = url.searchParams.get('job_id');
    const applicationId = url.searchParams.get('application_id');

    if (!jobId && !applicationId) {
      return jsonError('job_id or application_id required', 400);
    }

    const admin = supabaseAdmin();
    let jobRow: any = null;
    let appRow: any = null;

    if (jobId) {
      const { data } = await admin
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', u.id)
        .maybeSingle();
      jobRow = data;

      const { data: aData } = await admin
        .from('applications')
        .select('*')
        .eq('job_id', jobId)
        .eq('user_id', u.id)
        .maybeSingle();
      appRow = aData;
    } else if (applicationId) {
      const { data: aData } = await admin
        .from('applications')
        .select('*')
        .eq('id', applicationId)
        .eq('user_id', u.id)
        .maybeSingle();
      appRow = aData;

      if (appRow?.job_id) {
        const { data: jData } = await admin
          .from('jobs')
          .select('*')
          .eq('id', appRow.job_id)
          .eq('user_id', u.id)
          .maybeSingle();
        jobRow = jData;
      }
    }

    if (!jobRow && !appRow) {
      return jsonError('Application or job record not found', 404);
    }

    // Fetch user profile for gap analysis
    const { data: profileRow } = await admin
      .from('profiles')
      .select('resume_text, structured_profile')
      .eq('id', u.id)
      .maybeSingle();

    const title = jobRow?.title || appRow?.role || 'Target Role';
    const company = jobRow?.company || appRow?.company || 'Target Company';
    const description = jobRow?.description || appRow?.notes || '';
    const jobUrl = jobRow?.url || appRow?.job_url || '';

    const pkg = buildApplicationPackage({
      id: appRow?.id || (jobRow ? `pkg-${jobRow.id.slice(0, 16)}` : undefined),
      jobId: jobRow?.id || appRow?.job_id || 'unlinked-job',
      applicationId: appRow?.id,
      userId: u.id,
      company,
      role: title,
      jobUrl,
      jobDescription: description,
      profile: profileRow?.structured_profile || null,
      rawEvidence: profileRow?.resume_text || '',
      tailoredResume: jobRow?.tailored_resume || null,
      coverLetter: jobRow?.cover_letter || null,
      screeningAnswers: jobRow?.metadata?.screening_answers ? { answers: jobRow.metadata.screening_answers } : null,
      currentStatus: appRow?.status || 'draft',
      humanReviewed: appRow?.status === 'ready_to_apply' || appRow?.status === 'applied',
    });

    return NextResponse.json({ package: pkg });
  } catch (e: any) {
    const status = e.message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonError(e.message || 'APPLICATION_PACKAGE_FETCH_FAILED', status);
  }
}

export async function POST(req: Request) {
  try {
    const u = await requireUser();
    if (!sameOrigin(req)) return jsonError('INVALID_ORIGIN', 403);

    const b = await req.json();
    const jobId = String(b.job_id || '').trim();

    if (!jobId) {
      return jsonError('job_id is required', 400);
    }

    const admin = supabaseAdmin();
    const { data: jobRow } = await admin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', u.id)
      .maybeSingle();

    if (!jobRow) {
      return jsonError('Job record not found', 404);
    }

    const { data: profileRow } = await admin
      .from('profiles')
      .select('resume_text, structured_profile')
      .eq('id', u.id)
      .maybeSingle();

    // Check existing application row
    const { data: existingApp } = await admin
      .from('applications')
      .select('*')
      .eq('job_id', jobId)
      .eq('user_id', u.id)
      .maybeSingle();

    let applicationId = existingApp?.id;

    if (!existingApp) {
      const { data: newApp, error: appErr } = await admin
        .from('applications')
        .insert({
          user_id: u.id,
          job_id: jobId,
          company: jobRow.company,
          role: jobRow.title,
          job_url: jobRow.url,
          status: 'draft',
          route: 'website',
          notes: 'Application draft created via Application Intelligence Workspace',
        })
        .select()
        .single();

      if (appErr) throw appErr;
      applicationId = newApp?.id;
    }

    const pkg = buildApplicationPackage({
      id: applicationId || `pkg-${jobId.slice(0, 16)}`,
      jobId,
      applicationId,
      userId: u.id,
      company: jobRow.company,
      role: jobRow.title,
      jobUrl: jobRow.url,
      jobDescription: jobRow.description || '',
      profile: profileRow?.structured_profile || null,
      rawEvidence: profileRow?.resume_text || '',
      tailoredResume: jobRow.tailored_resume || b.tailored_resume || null,
      coverLetter: jobRow.cover_letter || b.cover_letter || null,
      screeningAnswers: jobRow.metadata?.screening_answers ? { answers: jobRow.metadata.screening_answers } : b.screening_answers || null,
      currentStatus: existingApp?.status || 'draft',
    });

    // Update application with requirement/gap metadata
    if (applicationId) {
      await admin
        .from('applications')
        .update({
          route_details: {
            readiness_score: pkg.gap_analysis.readiness_score,
            verified_count: pkg.gap_analysis.verified_count,
            gap_count: pkg.gap_analysis.gap_count,
            truth_score: pkg.truthfulness.truth_score,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', applicationId)
        .eq('user_id', u.id);
    }

    // Telemetry tracking
    try {
      const { trackServerEvent } = await import('../../../../lib/analytics');
      await trackServerEvent('application_draft_created', {
        jobId,
        company: jobRow.company,
        role: jobRow.title,
        readinessScore: pkg.gap_analysis.readiness_score,
        requirementsCount: pkg.requirements.length,
      }, u.id);

      await trackServerEvent('application_review_started', {
        jobId,
        applicationId,
        truthScore: pkg.truthfulness.truth_score,
      }, u.id);
    } catch {
      // Non-fatal telemetry
    }

    return NextResponse.json({ package: pkg });
  } catch (e: any) {
    const status = e.message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonError(e.message || 'APPLICATION_PACKAGE_CREATE_FAILED', status);
  }
}
