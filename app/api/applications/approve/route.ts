import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import { jsonError, sameOrigin } from '../../../../lib/security';
import { buildApplicationPackage, approveApplicationPackage } from '../../../../lib/applications/workspace';

export async function POST(req: Request) {
  try {
    const u = await requireUser();
    if (!sameOrigin(req)) return jsonError('INVALID_ORIGIN', 403);

    const b = await req.json();
    const applicationId = String(b.application_id || '').trim();
    const reviewerSignature = String(b.reviewer_signature || b.candidate_name || u.email || 'Candidate Verified').trim();

    if (!applicationId) {
      return jsonError('application_id is required', 400);
    }

    const admin = supabaseAdmin();
    const { data: appRow } = await admin
      .from('applications')
      .select('*')
      .eq('id', applicationId)
      .eq('user_id', u.id)
      .maybeSingle();

    if (!appRow) {
      return jsonError('Application not found', 404);
    }

    // Fetch linked job if available
    let jobRow: any = null;
    if (appRow.job_id) {
      const { data: jData } = await admin
        .from('jobs')
        .select('*')
        .eq('id', appRow.job_id)
        .eq('user_id', u.id)
        .maybeSingle();
      jobRow = jData;
    }

    const { data: profileRow } = await admin
      .from('profiles')
      .select('resume_text, structured_profile')
      .eq('id', u.id)
      .maybeSingle();

    // Assemble current package state
    const currentPkg = buildApplicationPackage({
      id: appRow.id,
      jobId: appRow.job_id || 'manual-job',
      applicationId: appRow.id,
      userId: u.id,
      company: appRow.company,
      role: appRow.role,
      jobUrl: appRow.job_url,
      jobDescription: jobRow?.description || appRow.notes || '',
      profile: profileRow?.structured_profile || null,
      rawEvidence: profileRow?.resume_text || '',
      tailoredResume: jobRow?.tailored_resume || null,
      coverLetter: jobRow?.cover_letter || null,
      screeningAnswers: jobRow?.metadata?.screening_answers ? { answers: jobRow.metadata.screening_answers } : null,
      currentStatus: appRow.status,
      humanReviewed: false,
    });

    // Run Human Review Gate
    const reviewResult = approveApplicationPackage(currentPkg, reviewerSignature);

    if (!reviewResult.success) {
      return jsonError(reviewResult.error || 'HUMAN_REVIEW_FAILED', 422);
    }

    // Update application in database to ready_to_apply
    const { data: updatedApp, error: updateErr } = await admin
      .from('applications')
      .update({
        status: 'ready_to_apply',
        notes: reviewResult.package.notes,
        route_details: {
          ...(appRow.route_details || {}),
          human_approved_at: reviewResult.package.human_approved_at,
          reviewer_signature: reviewerSignature,
          truth_score: reviewResult.package.truthfulness.truth_score,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId)
      .eq('user_id', u.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Track product telemetry
    try {
      const { trackServerEvent } = await import('../../../../lib/analytics');
      await trackServerEvent('application_approved', {
        applicationId,
        jobId: appRow.job_id,
        company: appRow.company,
        role: appRow.role,
        truthScore: reviewResult.package.truthfulness.truth_score,
      }, u.id);

      await trackServerEvent('application_ready', {
        applicationId,
        jobId: appRow.job_id,
        company: appRow.company,
      }, u.id);
    } catch {
      // Non-fatal telemetry
    }

    return NextResponse.json({
      success: true,
      application: updatedApp,
      package: reviewResult.package,
    });
  } catch (e: any) {
    const status = e.message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonError(e.message || 'APPLICATION_APPROVAL_FAILED', status);
  }
}
