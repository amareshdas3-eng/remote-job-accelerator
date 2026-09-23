// lib/analytics.ts
// Unified Product Analytics & Event Funnel Telemetry for RJA v4.3

import { logger } from './logger';

export type FunnelEvent =
  | 'landing_view'
  | 'signup_started'
  | 'signup_completed'
  | 'profile_completed'
  | 'resume_uploaded'
  | 'job_search'
  | 'job_viewed'
  | 'why_match_opened'
  | 'job_shortlisted'
  | 'job_selected'
  | 'resume_tailored'
  | 'cover_letter_generated'
  | 'application_started'
  | 'application_submitted'
  | 'interview_recorded'
  | 'offer_recorded'
  | 'pro_clicked'
  | 'checkout_started'
  | 'purchase_completed';

export interface EventProperties {
  userId?: string;
  jobId?: string;
  company?: string;
  role?: string;
  source?: string;
  fitScore?: number;
  route?: string;
  durationMs?: number;
  plan?: string;
  amount?: number;
  [key: string]: any;
}

/**
 * Client-side event tracker.
 * Dispatches to /api/telemetry and optionally PostHog in the browser.
 */
export async function trackEvent(
  event: FunnelEvent,
  properties: EventProperties = {}
): Promise<void> {
  const timestamp = new Date().toISOString();

  // 1. Log structured telemetry event
  logger.info(`event_${event}`, {
    event,
    timestamp,
    ...properties,
  });

  // 2. Transmit to server telemetry ingestion endpoint in browser
  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          properties,
          timestamp,
          url: window.location.href,
        }),
      });
    } catch {
      // Non-blocking fire-and-forget
    }

    // 3. PostHog client integration if configured
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
    if (posthogKey && (window as any).posthog) {
      try {
        (window as any).posthog.capture(event, properties);
      } catch {
        // Ignored
      }
    }
  }
}

/**
 * Server-side event tracker.
 * Emits structured logs and optionally sends to PostHog server API.
 */
export async function trackServerEvent(
  event: FunnelEvent,
  properties: EventProperties = {},
  userId?: string
): Promise<void> {
  logger.info(`server_event_${event}`, {
    event,
    userId,
    timestamp: new Date().toISOString(),
    ...properties,
  });

  const posthogKey = process.env.POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (posthogKey && userId) {
    try {
      await fetch(`${posthogHost}/capture/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: posthogKey,
          event,
          distinct_id: userId,
          properties: {
            ...properties,
            $lib: 'rja_server_telemetry',
          },
          timestamp: new Date().toISOString(),
        }),
      });
    } catch {
      // Server telemetry should never block request pipeline
    }
  }
}
