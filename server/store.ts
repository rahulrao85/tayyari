/**
 * Small in-memory stores with hard size caps, so a flood of distinct keys can
 * never grow memory without bound. One instance per server process; behind
 * several Cloud Run instances each keeps its own copy (documented trade-off).
 */

/** A time-limited cache that evicts the oldest entry when full. */
export class TtlCache<V> {
  private readonly entries = new Map<string, { value: V; expires: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V): void {
    this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }
    this.entries.set(key, { value, expires: this.now() + this.ttlMs });
  }

  get size(): number {
    return this.entries.size;
  }
}

/** Result of a rate-limit check. */
export interface RateDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/** Fixed-window rate limiter keyed by client. */
export class RateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxClients = 10_000,
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string): RateDecision {
    const time = this.now();
    let window = this.windows.get(key);
    if (!window || time - window.start >= this.windowMs) {
      if (!window && this.windows.size >= this.maxClients) {
        const oldest = this.windows.keys().next();
        if (!oldest.done) this.windows.delete(oldest.value);
      }
      window = { start: time, count: 0 };
      this.windows.set(key, window);
    }
    window.count += 1;
    const retryAfterSeconds = Math.ceil((window.start + this.windowMs - time) / 1000);
    return {
      allowed: window.count <= this.limit,
      remaining: Math.max(0, this.limit - window.count),
      retryAfterSeconds,
    };
  }
}
