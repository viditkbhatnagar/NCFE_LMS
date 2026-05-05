// In-memory sliding-window rate limiter. Keyed by `${userId or ip}:${routeKey}`.
// Single-instance only (Render serves one container) — DO NOT rely on this
// for horizontal scaling. Each entry is cleared after its window elapses.

import { NextResponse } from 'next/server';

interface Bucket {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 60_000;
const buckets = new Map<string, Bucket>();

// Cleanup tick every minute. Wrapped in a guard so we don't double-register
// during Next.js HMR.
const RL_GLOBAL_KEY = '__ncfeLmsRateLimitCleanup';
type GlobalWithRl = typeof globalThis & { [k: string]: unknown };
const g = globalThis as GlobalWithRl;
if (!g[RL_GLOBAL_KEY]) {
  g[RL_GLOBAL_KEY] = setInterval(() => {
    const cutoff = Date.now() - WINDOW_MS;
    for (const [key, bucket] of buckets) {
      if (bucket.windowStart < cutoff) buckets.delete(key);
    }
  }, WINDOW_MS).unref?.() ?? true;
}

export interface RateLimitOptions {
  // Maximum requests allowed within the 60-second window.
  limit: number;
  // Optional override for the per-route key. Defaults to the request URL path.
  routeKey?: string;
}

export interface RateLimitResult {
  ok: true;
}
export interface RateLimitDeny {
  ok: false;
  response: NextResponse;
}

export function checkRateLimit(
  identity: string,
  options: RateLimitOptions,
  requestUrl: string,
): RateLimitResult | RateLimitDeny {
  const routeKey = options.routeKey ?? new URL(requestUrl).pathname;
  const key = `${identity}:${routeKey}`;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return { ok: true };
  }

  if (bucket.count >= options.limit) {
    const retryAfter = Math.ceil((bucket.windowStart + WINDOW_MS - now) / 1000);
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'Too many requests. Please slow down and try again shortly.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.max(1, retryAfter)),
          },
        },
      ),
    };
  }

  bucket.count += 1;
  return { ok: true };
}

// Resolve a stable identity for rate-limiting. Prefers session userId; falls
// back to a best-effort IP read from the X-Forwarded-For header (Render sets it).
export function rateLimitIdentity(
  request: Request,
  userId?: string | null,
): string {
  if (userId) return `u:${userId}`;
  const xff = request.headers.get('x-forwarded-for') ?? '';
  const first = xff.split(',')[0]?.trim() ?? '';
  return first ? `ip:${first}` : 'ip:unknown';
}
