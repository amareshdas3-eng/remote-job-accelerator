// lib/attribution.ts
// Traffic Attribution & Growth Channel Acquisition Tracking for RJA v4.3

export type AcquisitionChannel =
  | 'linkedin'
  | 'reddit'
  | 'community'
  | 'gumroad'
  | 'referral'
  | 'search'
  | 'direct'
  | 'network';

export interface AttributionData {
  channel: AcquisitionChannel;
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  ref?: string;
  referrer?: string;
  landingPath?: string;
  capturedAt: string;
}

const STORAGE_KEY = 'rja_attribution_v1';

/**
 * Classifies raw referrer and UTM source into a standard acquisition channel.
 */
export function classifyChannel(
  source?: string,
  referrer?: string,
  ref?: string
): AcquisitionChannel {
  const s = (source || '').toLowerCase();
  const r = (referrer || '').toLowerCase();
  const rf = (ref || '').toLowerCase();

  if (s.includes('linkedin') || r.includes('linkedin.com') || s.includes('lnkd.in')) {
    return 'linkedin';
  }

  if (s.includes('reddit') || r.includes('reddit.com') || r.includes('redd.it')) {
    return 'reddit';
  }

  if (
    s.includes('ycombinator') ||
    s.includes('hackernews') ||
    r.includes('news.ycombinator.com') ||
    s.includes('producthunt') ||
    r.includes('producthunt.com') ||
    s.includes('discord') ||
    s.includes('slack')
  ) {
    return 'community';
  }

  if (s.includes('gumroad') || r.includes('gumroad.com')) {
    return 'gumroad';
  }

  if (s.includes('network') || rf.includes('network') || s.includes('direct_intro')) {
    return 'network';
  }

  if (s.includes('google') || r.includes('google.') || s.includes('bing') || s.includes('duckduckgo')) {
    return 'search';
  }

  if (s.includes('ref') || rf || (r && !r.includes(typeof window !== 'undefined' ? window.location.hostname : ''))) {
    return 'referral';
  }

  return 'direct';
}

/**
 * Captures current page URL parameters and document referrer, saving to sessionStorage.
 */
export function captureAttribution(): AttributionData {
  if (typeof window === 'undefined') {
    return {
      channel: 'direct',
      capturedAt: new Date().toISOString(),
    };
  }

  try {
    const url = new URL(window.location.href);
    const source = url.searchParams.get('utm_source') || undefined;
    const medium = url.searchParams.get('utm_medium') || undefined;
    const campaign = url.searchParams.get('utm_campaign') || undefined;
    const content = url.searchParams.get('utm_content') || undefined;
    const ref = url.searchParams.get('ref') || undefined;
    const referrer = document.referrer || undefined;

    const channel = classifyChannel(source, referrer, ref);

    const data: AttributionData = {
      channel,
      source,
      medium,
      campaign,
      content,
      ref,
      referrer,
      landingPath: window.location.pathname,
      capturedAt: new Date().toISOString(),
    };

    // Store in sessionStorage for session lifetime, or localStorage for 30-day window
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
  } catch {
    return {
      channel: 'direct',
      capturedAt: new Date().toISOString(),
    };
  }
}

/**
 * Retrieves the stored attribution data for the current user.
 */
export function getStoredAttribution(): AttributionData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Appends attribution parameters to an outgoing link (e.g. signup or checkout).
 */
export function appendAttributionParams(targetUrl: string): string {
  const attribution = getStoredAttribution();
  if (!attribution) return targetUrl;

  try {
    const url = new URL(targetUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    if (attribution.source) url.searchParams.set('utm_source', attribution.source);
    if (attribution.medium) url.searchParams.set('utm_medium', attribution.medium);
    if (attribution.campaign) url.searchParams.set('utm_campaign', attribution.campaign);
    if (attribution.channel) url.searchParams.set('channel', attribution.channel);
    return url.toString();
  } catch {
    return targetUrl;
  }
}
