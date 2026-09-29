// lib/jobs/freshness.ts
// RJA: Deterministic Job Freshness Engine
// Enforces source-backed posting evidence and strict freshness classification.

export type FreshnessWindow = '24h' | '48h';

export type JobFreshnessClassification =
  | 'LIVE_FRESH'
  | 'POSTING_TIME_UNKNOWN'
  | 'STALE'
  | 'POSTING_TIME_INVALID';

export const FRESHNESS_WINDOW_MS: Record<FreshnessWindow, number> = {
  '24h': 24 * 60 * 60 * 1000, // 86,400,000 ms
  '48h': 48 * 60 * 60 * 1000, // 172,800,000 ms
};

export const DEFAULT_FRESHNESS_WINDOW: FreshnessWindow = '48h';

export interface JobFreshnessEvaluation {
  status: JobFreshnessClassification;
  ageMs?: number;
  ageHours?: number;
  ageText?: string;
  isFresh: boolean;
  postedAtIso?: string;
}

/**
 * Validates and parses source-backed posting timestamp.
 * Returns unix epoch milliseconds or null if missing/unreliable.
 *
 * GUARANTEES:
 * - Does NOT infer discoveredAt = postedAt
 * - Does NOT fabricate or estimate an exact posting timestamp
 * - Returns null for unparseable or missing evidence
 */
export function parseSourcePostingTime(input: unknown): number | null {
  if (input === null || input === undefined) {
    return null;
  }

  if (typeof input === 'number') {
    if (isNaN(input) || !isFinite(input) || input <= 0) return null;
    return input;
  }

  if (input instanceof Date) {
    const time = input.getTime();
    return isNaN(time) ? null : time;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const parsed = Date.parse(trimmed);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}

/**
 * Formats posting age in human-readable terms.
 * Examples: 'Posted 6h ago', 'Posted 31h ago', 'Posted 46h ago'
 * For under 1 hour: 'Posted <1h ago'
 */
export function formatPostingAge(ageMs: number): string {
  if (ageMs < 0) return '';
  const hours = Math.floor(ageMs / (60 * 60 * 1000));
  if (hours < 1) {
    return 'Posted <1h ago';
  }
  return `Posted ${hours}h ago`;
}

/**
 * Deterministically classifies job freshness based on source-backed postedAt evidence.
 *
 * MODEL:
 * LIVE_FRESH:
 *   postedAt <= now AND now - postedAt <= selected freshness window (inclusive boundary)
 * POSTING_TIME_UNKNOWN:
 *   postedAt unavailable / unreliable / unparseable
 * STALE:
 *   now - postedAt > selected freshness window
 * POSTING_TIME_INVALID:
 *   postedAt > now (future timestamp)
 *
 * INVARIANT: discoveredAt MUST NEVER substitute for postedAt.
 */
export function classifyJobFreshness(
  postedAtInput: unknown,
  window: FreshnessWindow = DEFAULT_FRESHNESS_WINDOW,
  nowMs: number = Date.now(),
  options?: { discoveredAt?: unknown }
): JobFreshnessEvaluation {
  // Explicit defense: verify discoveredAt is not treated as postedAt
  if (postedAtInput === undefined || postedAtInput === null || postedAtInput === '') {
    return {
      status: 'POSTING_TIME_UNKNOWN',
      isFresh: false,
    };
  }

  const postedTime = parseSourcePostingTime(postedAtInput);
  if (postedTime === null) {
    return {
      status: 'POSTING_TIME_UNKNOWN',
      isFresh: false,
    };
  }

  // Future timestamp protection
  if (postedTime > nowMs) {
    return {
      status: 'POSTING_TIME_INVALID',
      isFresh: false,
      postedAtIso: new Date(postedTime).toISOString(),
    };
  }

  const ageMs = nowMs - postedTime;
  const windowMs = FRESHNESS_WINDOW_MS[window] || FRESHNESS_WINDOW_MS[DEFAULT_FRESHNESS_WINDOW];
  const ageHours = Math.floor(ageMs / (60 * 60 * 1000));
  const postedAtIso = new Date(postedTime).toISOString();

  // Boundary condition: inclusive (now - postedAt <= window)
  if (ageMs <= windowMs) {
    return {
      status: 'LIVE_FRESH',
      ageMs,
      ageHours,
      ageText: formatPostingAge(ageMs),
      isFresh: true,
      postedAtIso,
    };
  }

  return {
    status: 'STALE',
    ageMs,
    ageHours,
    ageText: formatPostingAge(ageMs),
    isFresh: false,
    postedAtIso,
  };
}
