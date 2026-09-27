import crypto from 'node:crypto';
import type { OutcomeEvent, OutcomeEventType, CareerRoiMetrics } from './types';

/**
 * Validates legal state transitions in the application outcome lifecycle:
 * - Applications cannot progress to downstream stages (response, interview, offer) without having an initial 'applied' event.
 * - Applications in terminal states ('rejected' or 'withdrawn') cannot transition to active downstream stages.
 */
export function validateOutcomeTransition(
  history: OutcomeEvent[],
  nextType: OutcomeEventType
): { valid: boolean; reason?: string } {
  if (!Array.isArray(history) || history.length === 0) {
    if (nextType !== 'applied') {
      return {
        valid: false,
        reason: `Illegal initial transition: application must be 'applied' before entering stage '${nextType}'.`,
      };
    }
    return { valid: true };
  }

  const hasApplied = history.some((e) => e.type === 'applied');
  if (!hasApplied && nextType !== 'applied') {
    return {
      valid: false,
      reason: `Out-of-sequence transition: cannot transition to '${nextType}' because application has not been dispatched ('applied').`,
    };
  }

  // Check if current state is terminal ('rejected' or 'withdrawn')
  const lastEvent = history[history.length - 1];
  const isTerminal = lastEvent.type === 'rejected' || lastEvent.type === 'withdrawn';
  if (isTerminal) {
    return {
      valid: false,
      reason: `Illegal transition: application is in terminal state '${lastEvent.type}' and cannot transition to '${nextType}'.`,
    };
  }

  return { valid: true };
}

export function createOutcomeEvent(params: {
  applicationId: string;
  userId: string;
  type: OutcomeEventType;
  stage?: string;
  metadata?: Record<string, any>;
  existingEvents?: OutcomeEvent[];
  strictTransitionCheck?: boolean;
}): OutcomeEvent {
  if (params.strictTransitionCheck && params.existingEvents) {
    const check = validateOutcomeTransition(params.existingEvents, params.type);
    if (!check.valid) {
      throw new Error(`TRANSITION_INVALID: ${check.reason}`);
    }
  }

  const stageMap: Record<OutcomeEventType, string> = {
    applied: 'Application Dispatched',
    acknowledged: 'Receipt Acknowledged by Employer',
    viewed: 'Application Viewed by Recruiter',
    recruiter_response: 'Recruiter Outreach Received',
    screening: 'Recruiter Screening Call',
    interview: 'Hiring Manager Interview',
    technical_round: 'Technical Architecture Evaluation',
    final_round: 'Executive Final Round',
    offer: 'Formal Offer Extended',
    rejected: 'Candidate Not Selected',
    withdrawn: 'Candidate Withdrew Application',
  };

  return {
    id: `evt-${crypto.randomBytes(8).toString('hex')}`,
    application_id: params.applicationId,
    user_id: params.userId,
    type: params.type,
    stage: params.stage || stageMap[params.type] || params.type,
    timestamp: new Date().toISOString(),
    metadata: params.metadata || {},
  };
}

export function computeCareerRoiMetrics(events: OutcomeEvent[]): CareerRoiMetrics {
  const applicationsSet = new Set<string>();
  const responsesSet = new Set<string>();
  const interviewsSet = new Set<string>();
  const offersSet = new Set<string>();

  const appAppliedTimes: Record<string, number> = {};
  const appResponseTimes: Record<string, number> = {};
  const appOfferTimes: Record<string, number> = {};

  for (const e of events) {
    const t = new Date(e.timestamp).getTime();

    if (e.type === 'applied') {
      applicationsSet.add(e.application_id);
      if (!appAppliedTimes[e.application_id] || t < appAppliedTimes[e.application_id]) {
        appAppliedTimes[e.application_id] = t;
      }
    } else if (e.type === 'recruiter_response' || e.type === 'screening') {
      responsesSet.add(e.application_id);
      if (!appResponseTimes[e.application_id] || t < appResponseTimes[e.application_id]) {
        appResponseTimes[e.application_id] = t;
      }
    } else if (e.type === 'interview' || e.type === 'technical_round' || e.type === 'final_round') {
      responsesSet.add(e.application_id);
      interviewsSet.add(e.application_id);
    } else if (e.type === 'offer') {
      offersSet.add(e.application_id);
      if (!appOfferTimes[e.application_id] || t < appOfferTimes[e.application_id]) {
        appOfferTimes[e.application_id] = t;
      }
    }
  }

  const totalApplications = applicationsSet.size;
  const responsesCount = responsesSet.size;
  const interviewsCount = interviewsSet.size;
  const offersCount = offersSet.size;

  const appToResponseRate = totalApplications > 0
    ? Math.round((responsesCount / totalApplications) * 100)
    : 0;

  const interviewToOfferRate = interviewsCount > 0
    ? Math.round((offersCount / interviewsCount) * 100)
    : 0;

  const appToOfferRate = totalApplications > 0
    ? Math.round((offersCount / totalApplications) * 100)
    : 0;

  // Compute average timelines
  const responseDurations: number[] = [];
  for (const appId of Object.keys(appResponseTimes)) {
    if (appAppliedTimes[appId]) {
      const days = (appResponseTimes[appId] - appAppliedTimes[appId]) / (1000 * 60 * 60 * 24);
      if (days >= 0) responseDurations.push(days);
    }
  }

  const offerDurations: number[] = [];
  for (const appId of Object.keys(appOfferTimes)) {
    if (appAppliedTimes[appId]) {
      const days = (appOfferTimes[appId] - appAppliedTimes[appId]) / (1000 * 60 * 60 * 24);
      if (days >= 0) offerDurations.push(days);
    }
  }

  const avgTimeToResponse = responseDurations.length > 0
    ? parseFloat((responseDurations.reduce((a, b) => a + b, 0) / responseDurations.length).toFixed(1))
    : undefined;

  const avgTimeToOffer = offerDurations.length > 0
    ? parseFloat((offerDurations.reduce((a, b) => a + b, 0) / offerDurations.length).toFixed(1))
    : undefined;

  return {
    total_applications: totalApplications,
    responses_count: responsesCount,
    interviews_count: interviewsCount,
    offers_count: offersCount,
    application_to_response_rate: appToResponseRate,
    interview_to_offer_rate: interviewToOfferRate,
    application_to_offer_rate: appToOfferRate,
    avg_time_to_response_days: avgTimeToResponse,
    avg_time_to_offer_days: avgTimeToOffer,
  };
}
