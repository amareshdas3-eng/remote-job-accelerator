import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import { jsonError, sameOrigin } from '../../../../lib/security';
import { computeArtifactFingerprint } from '../../../../lib/execution/fingerprint';
import { executeApplicationPackage } from '../../../../lib/execution/engine';
import { createOutcomeEvent } from '../../../../lib/execution/stateMachine';
import type { ApprovedArtifact } from '../../../../lib/execution/types';

export async function POST(req: Request) {
  try {
    const u = await requireUser();
    if (!sameOrigin(req)) return jsonError('INVALID_ORIGIN', 403);

    const b = await req.json();
    const applicationId = String(b.application_id || '').trim();
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

    // Gate 1: Check human review approval
    const routeDetails = appRow.route_details || {};
    const isApproved = appRow.status === 'ready_to_apply' || Boolean(routeDetails.human_approved_at);
    if (!isApproved) {
      return jsonError('Execution halted: application must be approved by candidate at Human Review Gate before execution.', 422);
    }

    // Load linked job content
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

    const currentContent = {
      resume: jobRow?.tailored_resume || null,
      cover_letter: jobRow?.cover_letter || null,
      screening_answers: jobRow?.metadata?.screening_answers ? { answers: jobRow.metadata.screening_answers } : null,
    };

    // Retrieve or establish approved artifact fingerprint
    const approvedFingerprintHash = routeDetails.approved_fingerprint || computeArtifactFingerprint(currentContent).hash;
    const approvedArtifact: ApprovedArtifact = {
      id: `app-art-${applicationId.slice(0, 16)}`,
      application_id: applicationId,
      fingerprint: {
        hash: approvedFingerprintHash,
        algorithm: 'sha256',
        components: {
          resume_length: (currentContent.resume?.full_resume || '').length,
          cover_letter_length: (currentContent.cover_letter?.letter || '').length,
          answers_count: Array.isArray(currentContent.screening_answers?.answers) ? currentContent.screening_answers.answers.length : 0,
        },
        computed_at: routeDetails.human_approved_at || new Date().toISOString(),
      },
      approved_by: routeDetails.reviewer_signature || u.email || 'Candidate',
      approved_at: routeDetails.human_approved_at || new Date().toISOString(),
      content: currentContent,
    };

    const destination = b.destination || appRow.job_url || `${appRow.company} Application Portal`;
    const existingReceipts = Array.isArray(routeDetails.submission_receipts) ? routeDetails.submission_receipts : [];

    // Execute application package through execution engine
    const execution = executeApplicationPackage({
      applicationId,
      approvedArtifact,
      currentContent,
      destination,
      route: appRow.route || 'website',
      existingReceipts,
    });

    if (!execution.success) {
      if (execution.code === 'MUTATION_BLOCKED') {
        try {
          const { trackServerEvent } = await import('../../../../lib/analytics');
          await trackServerEvent('execution_blocked', {
            applicationId,
            reason: execution.error,
          }, u.id);
        } catch {}
        return jsonError(execution.error, 422);
      } else if (execution.code === 'DUPLICATE_SUBMISSION') {
        return jsonError(execution.error, 409);
      }
      return jsonError(execution.error, 500);
    }

    // Success: update application record, store receipt, and append outcome event
    const now = new Date().toISOString();
    const updatedReceipts = [...existingReceipts, execution.receipt];

    const outcomeEvent = createOutcomeEvent({
      applicationId,
      userId: u.id,
      type: 'applied',
      metadata: {
        confirmation_id: execution.receipt.external_confirmation_id,
        destination: execution.receipt.destination,
      },
    });

    const existingEvents = Array.isArray(routeDetails.outcome_events) ? routeDetails.outcome_events : [];
    const updatedEvents = [...existingEvents, outcomeEvent];

    await admin
      .from('applications')
      .update({
        status: 'applied',
        applied_at: now,
        route_details: {
          ...routeDetails,
          submission_receipts: updatedReceipts,
          outcome_events: updatedEvents,
          latest_receipt_id: execution.receipt.id,
        },
        updated_at: now,
      })
      .eq('id', applicationId)
      .eq('user_id', u.id);

    // Track telemetry
    try {
      const { trackServerEvent } = await import('../../../../lib/analytics');
      await trackServerEvent('execution_dispatched', {
        applicationId,
        destination,
        route: appRow.route,
      }, u.id);

      await trackServerEvent('execution_confirmed', {
        applicationId,
        receiptId: execution.receipt.id,
        confirmationId: execution.receipt.external_confirmation_id,
      }, u.id);

      await trackServerEvent('application_submitted', {
        applicationId,
        company: appRow.company,
        role: appRow.role,
      }, u.id);
    } catch {}

    return NextResponse.json({
      success: true,
      receipt: execution.receipt,
      attempt: execution.attempt,
      status: 'applied',
      outcome_event: outcomeEvent,
    });
  } catch (e: any) {
    const status = e.message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonError(e.message || 'APPLICATION_EXECUTION_FAILED', status);
  }
}
