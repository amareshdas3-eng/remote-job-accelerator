import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase';
import { jsonError, sameOrigin } from '../../../../lib/security';
import { createOutcomeEvent, computeCareerRoiMetrics } from '../../../../lib/execution/stateMachine';
import type { OutcomeEvent, OutcomeEventType } from '../../../../lib/execution/types';

export async function GET(req: Request) {
  try {
    const u = await requireUser();
    const admin = supabaseAdmin();

    const { data: apps, error } = await admin
      .from('applications')
      .select('*')
      .eq('user_id', u.id);

    if (error) throw error;

    // Aggregate outcome events from all applications
    const allEvents: OutcomeEvent[] = [];
    for (const app of apps || []) {
      if (app.applied_at) {
        allEvents.push({
          id: `initial-applied-${app.id}`,
          application_id: app.id,
          user_id: u.id,
          type: 'applied',
          stage: 'Application Dispatched',
          timestamp: app.applied_at,
        });
      }

      const recordedEvents = Array.isArray(app.route_details?.outcome_events)
        ? app.route_details.outcome_events
        : [];
      allEvents.push(...recordedEvents);

      // Map application status to implicit outcome events if not explicitly logged
      if (app.status === 'interview' && !recordedEvents.some((e: any) => e.type === 'interview')) {
        allEvents.push({
          id: `status-interview-${app.id}`,
          application_id: app.id,
          user_id: u.id,
          type: 'interview',
          stage: 'Hiring Manager Interview',
          timestamp: app.updated_at || new Date().toISOString(),
        });
      } else if (app.status === 'offer' && !recordedEvents.some((e: any) => e.type === 'offer')) {
        allEvents.push({
          id: `status-offer-${app.id}`,
          application_id: app.id,
          user_id: u.id,
          type: 'offer',
          stage: 'Formal Offer Extended',
          timestamp: app.updated_at || new Date().toISOString(),
        });
      }
    }

    const metrics = computeCareerRoiMetrics(allEvents);

    return NextResponse.json({
      metrics,
      total_events: allEvents.length,
      events: allEvents.slice(0, 100),
    });
  } catch (e: any) {
    const status = e.message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonError(e.message || 'OUTCOMES_FETCH_FAILED', status);
  }
}

export async function POST(req: Request) {
  try {
    const u = await requireUser();
    if (!sameOrigin(req)) return jsonError('INVALID_ORIGIN', 403);

    const b = await req.json();
    const applicationId = String(b.application_id || '').trim();
    const eventType = String(b.type || '').trim() as OutcomeEventType;

    if (!applicationId || !eventType) {
      return jsonError('application_id and type are required', 400);
    }

    const validTypes: OutcomeEventType[] = [
      'applied',
      'acknowledged',
      'viewed',
      'recruiter_response',
      'screening',
      'interview',
      'technical_round',
      'final_round',
      'offer',
      'rejected',
      'withdrawn',
    ];

    if (!validTypes.includes(eventType)) {
      return jsonError(`Invalid outcome event type: ${eventType}`, 400);
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

    const newEvent = createOutcomeEvent({
      applicationId,
      userId: u.id,
      type: eventType,
      stage: b.stage,
      metadata: b.metadata || {},
    });

    const routeDetails = appRow.route_details || {};
    const existingEvents = Array.isArray(routeDetails.outcome_events) ? routeDetails.outcome_events : [];
    const updatedEvents = [...existingEvents, newEvent];

    // Determine lifecycle status update if applicable
    let newStatus = appRow.status;
    if (eventType === 'offer') newStatus = 'offer';
    else if (eventType === 'interview' || eventType === 'technical_round' || eventType === 'final_round') newStatus = 'interview';
    else if (eventType === 'screening') newStatus = 'screening';
    else if (eventType === 'rejected') newStatus = 'rejected';
    else if (eventType === 'withdrawn') newStatus = 'withdrawn';

    const { data: updatedApp, error: updateErr } = await admin
      .from('applications')
      .update({
        status: newStatus,
        route_details: {
          ...routeDetails,
          outcome_events: updatedEvents,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId)
      .eq('user_id', u.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Track telemetry
    try {
      const { trackServerEvent } = await import('../../../../lib/analytics');
      if (eventType === 'recruiter_response') {
        await trackServerEvent('recruiter_response_recorded', { applicationId, company: appRow.company }, u.id);
      } else if (eventType === 'interview' || eventType === 'screening') {
        await trackServerEvent('interview_scheduled', { applicationId, round: eventType }, u.id);
      } else if (eventType === 'offer') {
        await trackServerEvent('offer_received', { applicationId, company: appRow.company }, u.id);
      }
    } catch {}

    return NextResponse.json({
      success: true,
      event: newEvent,
      application: updatedApp,
    });
  } catch (e: any) {
    const status = e.message === 'UNAUTHENTICATED' ? 401 : 500;
    return jsonError(e.message || 'OUTCOME_EVENT_FAILED', status);
  }
}
