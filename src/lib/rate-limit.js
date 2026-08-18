import { NextResponse } from "next/server";

/**
 * Lightweight, in-memory sliding-window rate limiter for sensitive endpoints.
 *
 * Serverless caveat: state is per-process, so limits apply per instance. This
 * is sufficient to stop accidental spam and casual abuse; a shared store
 * (Redis/DB) can replace the backing store later without changing call sites.
 */

const buckets = new Map();
let accessCount = 0;

function prune() {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

/**
 * rateLimit(key, { limit, windowMs })
 * Returns { allowed, remaining, retryAfterMs }
 */
export function rateLimit(key, { limit = 10, windowMs = 15 * 60 * 1000 }) {
  const now = Date.now();

  // Periodic cleanup to prevent unbounded memory growth
  accessCount += 1;
  if (accessCount % 100 === 0) prune();

  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, bucket.resetAt - now),
    };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, retryAfterMs: 0 };
}

/** Extract the best-effort client IP from a Next.js request. */
export function getClientIp(req) {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
  } catch (_) {}
  return "unknown";
}

/**
 * Enforce a rate limit inside a route handler.
 * Returns a 429 NextResponse when limited, otherwise null.
 */
export function enforceRateLimit(req, key, options) {
  const result = rateLimit(key, options);
  if (result.allowed) return null;

  const retrySeconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
  return NextResponse.json(
    {
      success: false,
      error: `Too many requests. Please wait ${retrySeconds}s and try again.`,
      retryAfterSeconds: retrySeconds,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retrySeconds) },
    },
  );
}
