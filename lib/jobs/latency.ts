// lib/jobs/latency.ts
// RJA v5.3: Discovery Latency Metric Engine
// Invariant: Calculates discovery speed strictly from authentic source publication evidence.
// Never substitutes discoveredAt or current time.

import type { DiscoveryLatencyMetric } from './types.ts';
import { parseSourcePostingTime } from './freshness.ts';

/**
 * Calculates the exact discovery latency between when an employer posted a job
 * and when RJA's discovery fabric detected and normalized it.
 *
 * @param sourcePostedAt Authentic source-declared posting time
 * @param detectedAtMs Epoch ms of RJA detection (default: Date.now())
 * @param options.discoveredAt Explicit parameter to safeguard against accidental substitution
 * @returns DiscoveryLatencyMetric if source evidence is trustworthy, otherwise null
 */
export function calculateDiscoveryLatency(
  sourcePostedAt: unknown,
  detectedAtMs: number = Date.now(),
  options?: { discoveredAt?: unknown; jobId?: string }
): DiscoveryLatencyMetric | null {
  // Strict Truthfulness Boundary: If source evidence is missing, do NOT estimate or fabricate
  if (sourcePostedAt === null || sourcePostedAt === undefined || sourcePostedAt === '') {
    return null;
  }

  const postedEpoch = parseSourcePostingTime(sourcePostedAt);
  if (postedEpoch === null) {
    return null;
  }

  // Future timestamp protection: an invalid future date cannot have a positive latency
  if (postedEpoch > detectedAtMs) {
    return null;
  }

  const latencyMs = Math.max(0, detectedAtMs - postedEpoch);
  const latencyMinutes = Math.floor(latencyMs / (60 * 1000));
  const sourcePostedAtIso = new Date(postedEpoch).toISOString();
  const rjaDetectedAtIso = new Date(detectedAtMs).toISOString();

  let latencyText = '';
  if (latencyMinutes < 1) {
    latencyText = 'Detected <1m after employer publication';
  } else if (latencyMinutes < 60) {
    latencyText = `Detected ${latencyMinutes}m after employer publication`;
  } else {
    const hours = Math.floor(latencyMinutes / 60);
    const remainingMins = latencyMinutes % 60;
    if (remainingMins === 0) {
      latencyText = `Detected ${hours}h after employer publication`;
    } else {
      latencyText = `Detected ${hours}h ${remainingMins}m after employer publication`;
    }
  }

  return {
    jobId: options?.jobId,
    sourcePostedAtIso,
    rjaDetectedAtIso,
    discoveryLatencyMs: latencyMs,
    discoveryLatencyMinutes: latencyMinutes,
    discoveryLatencyText: latencyText,
    isTrustworthy: true,
  };
}
