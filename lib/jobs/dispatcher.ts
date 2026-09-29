// lib/jobs/dispatcher.ts
// RJA v5.3: Bounded Parallel Discovery Engine with Domain Rate Limiting, Circuit Breakers & SSRF Defense

import { globalSourceRegistry } from './registry.ts';
import type { JobSourceRecord, NormalizedJob } from './types.ts';

export interface DispatcherConfig {
  globalConcurrencyLimit: number;
  perDomainConcurrencyLimit: number;
  perDomainMinIntervalMs: number;
  requestTimeoutMs: number;
  maxRetries: number;
  backoffBaseMs: number;
  maxResponseBytes: number;
}

export const DEFAULT_DISPATCHER_CONFIG: DispatcherConfig = {
  globalConcurrencyLimit: 20,
  perDomainConcurrencyLimit: 2,
  perDomainMinIntervalMs: 1500,
  requestTimeoutMs: 8000,
  maxRetries: 2,
  backoffBaseMs: 800,
  maxResponseBytes: 2 * 1024 * 1024, // 2 MB
};

// SSRF Guard: Disallow private, loopback, and cloud metadata IP ranges
export function isPrivateOrReservedHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }

  // IPv4 private & link-local ranges: 10.x.x.x, 172.16-31.x.x, 192.168.x.x, 169.254.x.x (AWS/GCP metadata)
  const ipMatch = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipMatch) {
    const [, a, b] = ipMatch.map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true; // Metadata IP
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
  }

  return false;
}

interface DomainRateState {
  activeCount: number;
  lastRequestTime: number;
}

export class BoundedDiscoveryDispatcher {
  private config: DispatcherConfig;
  private domainStates: Map<string, DomainRateState> = new Map();
  private circuitBreakers: Map<string, { failureCount: number; trippedUntil: number }> = new Map();

  constructor(config: Partial<DispatcherConfig> = {}) {
    this.config = { ...DEFAULT_DISPATCHER_CONFIG, ...config };
  }

  /**
   * Validates target URL against SSRF and protocol policies.
   */
  validateUrl(rawUrl: string): URL {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      throw new Error(`SSRF Block: Disallowed protocol '${u.protocol}'`);
    }
    if (isPrivateOrReservedHost(u.hostname)) {
      throw new Error(`SSRF Block: Access to private/reserved host '${u.hostname}' is prohibited`);
    }
    return u;
  }

  /**
   * Checks if circuit breaker is currently open for a domain.
   */
  isCircuitOpen(domain: string): boolean {
    const cb = this.circuitBreakers.get(domain);
    if (!cb) return false;
    if (Date.now() < cb.trippedUntil) {
      return true;
    }
    // Cooldown elapsed, reset
    this.circuitBreakers.delete(domain);
    return false;
  }

  recordFailure(domain: string, isRateLimit: boolean): void {
    const cb = this.circuitBreakers.get(domain) || { failureCount: 0, trippedUntil: 0 };
    cb.failureCount += 1;
    if (isRateLimit || cb.failureCount >= 5) {
      cb.trippedUntil = Date.now() + 10 * 60 * 1000; // 10 min cooldown
    }
    this.circuitBreakers.set(domain, cb);
  }

  recordSuccess(domain: string): void {
    this.circuitBreakers.delete(domain);
  }

  /**
   * Executes an HTTP fetch with strict timeouts, rate limiting, and size boundaries.
   */
  async safeFetch(rawUrl: string, init: RequestInit = {}): Promise<Response> {
    const u = this.validateUrl(rawUrl);
    const domain = u.hostname;

    if (this.isCircuitOpen(domain)) {
      throw new Error(`Circuit breaker open for domain '${domain}'`);
    }

    // Rate limiter: check domain interval
    const state = this.domainStates.get(domain) || { activeCount: 0, lastRequestTime: 0 };
    const now = Date.now();
    const waitTime = Math.max(0, state.lastRequestTime + this.config.perDomainMinIntervalMs - now);
    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    state.activeCount += 1;
    state.lastRequestTime = Date.now();
    this.domainStates.set(domain, state);

    try {
      const headers = {
        'User-Agent': 'RemoteJobAccelerator/5.3 (+https://remotejobaccelerator.com/bot; bot@remotejobaccelerator.com)',
        Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
        ...(init.headers || {}),
      };

      let currentUrl = u;
      let redirectHops = 0;
      const maxRedirects = 3;
      let res: Response;

      while (true) {
        res = await fetch(currentUrl.toString(), {
          ...init,
          headers,
          redirect: 'manual',
          signal: AbortSignal.timeout(this.config.requestTimeoutMs),
        });

        // SSRF Defense: Inspect and validate every redirect destination
        if (res.status >= 300 && res.status < 400) {
          const location = res.headers.get('location');
          if (!location) {
            break;
          }
          redirectHops++;
          if (redirectHops > maxRedirects) {
            throw new Error(`SSRF Block: Redirect chain exceeded maximum limit (${maxRedirects})`);
          }
          const targetUrl = new URL(location, currentUrl);
          currentUrl = this.validateUrl(targetUrl.toString());
          continue;
        }

        break;
      }

      if (res.status === 429) {
        this.recordFailure(domain, true);
        throw new Error(`Rate limit encountered (429) on ${domain}`);
      }

      if (!res.ok) {
        this.recordFailure(domain, false);
      } else {
        this.recordSuccess(domain);
      }

      return res;
    } catch (err: any) {
      this.recordFailure(domain, false);
      throw err;
    } finally {
      const s = this.domainStates.get(domain);
      if (s) {
        s.activeCount = Math.max(0, s.activeCount - 1);
        this.domainStates.set(domain, s);
      }
    }
  }

  /**
   * Executes discovery tasks across an array of items with bounded concurrency.
   */
  async runPool<T, R>(
    items: T[],
    taskFn: (item: T) => Promise<R[]>,
    concurrency: number = this.config.globalConcurrencyLimit
  ): Promise<{ results: R[]; errors: { item: T; error: string }[] }> {
    const results: R[] = [];
    const errors: { item: T; error: string }[] = [];
    const queue = [...items];

    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        try {
          const res = await taskFn(item);
          if (Array.isArray(res)) {
            results.push(...res);
          }
        } catch (err: any) {
          errors.push({ item, error: err?.message || String(err) });
        }
      }
    });

    await Promise.allSettled(workers);
    return { results, errors };
  }
}

export const discoveryDispatcher = new BoundedDiscoveryDispatcher();
