import { ServiceError } from "../errors";

export interface RateLimiterOptions {
  /** Requests allowed per window and key. */
  limit: number;
  windowMs: number;
  /** Clock, injectable for tests. */
  now?: () => number;
}

export interface RateDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window, in-memory rate limiter. Good enough for a single server instance; with several
 * instances this would move to Redis alongside the SSE hub (see ARCHITECTURE.md section 5).
 */
export class RateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();
  private readonly now: () => number;

  constructor(private readonly options: RateLimiterOptions) {
    this.now = options.now ?? Date.now;
  }

  /** Count one request for `key` and say whether it is allowed. */
  hit(key: string): RateDecision {
    const now = this.now();
    this.prune(now);
    const current = this.windows.get(key);
    const window =
      current && now - current.start < this.options.windowMs ? current : { start: now, count: 0 };
    window.count += 1;
    this.windows.set(key, window);
    const allowed = window.count <= this.options.limit;
    return {
      allowed,
      remaining: Math.max(0, this.options.limit - window.count),
      retryAfterSeconds: allowed
        ? 0
        : Math.ceil((window.start + this.options.windowMs - now) / 1000),
    };
  }

  private prune(now: number): void {
    if (this.windows.size < 10_000) return;
    for (const [key, w] of this.windows)
      if (now - w.start >= this.options.windowMs) this.windows.delete(key);
  }
}

/** Best-effort client address from proxy headers (Vercel sets x-forwarded-for). */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Tournament creation: default 10 per hour per client (RATE_LIMIT_CREATE_PER_HOUR). */
export const createLimiter = new RateLimiter({
  limit: envNumber("RATE_LIMIT_CREATE_PER_HOUR", 10),
  windowMs: 60 * 60 * 1000,
});

/** Other admin writes: default 120 per minute per client (RATE_LIMIT_WRITES_PER_MINUTE). */
export const writeLimiter = new RateLimiter({
  limit: envNumber("RATE_LIMIT_WRITES_PER_MINUTE", 120),
  windowMs: 60 * 1000,
});

/** Throw RATE_LIMITED (429 with Retry-After) when the client is over the limit. */
export function enforceRateLimit(request: Request, limiter: RateLimiter = writeLimiter): void {
  const decision = limiter.hit(clientKey(request));
  if (!decision.allowed) {
    throw new ServiceError("RATE_LIMITED", "Too many requests. Please slow down.", {
      retryAfterSeconds: decision.retryAfterSeconds,
    });
  }
}
