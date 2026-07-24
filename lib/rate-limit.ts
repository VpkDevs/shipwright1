import { getRedis } from "@/lib/redis";
import { Ratelimit } from "@upstash/ratelimit";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export const RATE_LIMITS = {
  analyze: { maxRequests: 10, windowSeconds: 60 },
  generate: { maxRequests: 5, windowSeconds: 60 },
  agent: { maxRequests: 3, windowSeconds: 60 },
  repos: { maxRequests: 30, windowSeconds: 60 },
  auth: { maxRequests: 5, windowSeconds: 60 },
  demo: { maxRequests: 20, windowSeconds: 60 },
  default: { maxRequests: 20, windowSeconds: 60 },
} as const;

export type RateLimitType = keyof typeof RATE_LIMITS;

const limiterCache = new Map<string, Ratelimit>();

function getUpstashLimiter(type: RateLimitType): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  const existing = limiterCache.get(type);
  if (existing) return existing;

  const config = RATE_LIMITS[type] ?? RATE_LIMITS.default;
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.maxRequests, `${config.windowSeconds} s`),
    analytics: false,
    prefix: `@shipwright/ratelimit/${type}`,
  });
  limiterCache.set(type, limiter);
  return limiter;
}

export function checkRateLimit(
  key: string,
  type: RateLimitType = "default"
): { allowed: boolean; remaining: number; reset: number } {
  const config = RATE_LIMITS[type] ?? RATE_LIMITS.default;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    const resetTime = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetTime });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      reset: resetTime,
    };
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      reset: entry.resetTime,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    reset: entry.resetTime,
  };
}

/**
 * Prefer Upstash sliding-window limits when Redis is configured; otherwise in-memory fallback.
 */
export async function checkRateLimitAsync(
  key: string,
  type: RateLimitType = "default"
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  const limiter = getUpstashLimiter(type);
  if (limiter) {
    const result = await limiter.limit(key);
    return {
      allowed: result.success,
      remaining: result.remaining,
      reset: result.reset,
    };
  }
  return checkRateLimit(key, type);
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

export function rateLimitResponse(remaining: number, reset: number) {
  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));

  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded",
      message: `Too many requests. Please try again in ${retryAfter} seconds.`,
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Remaining": String(remaining),
        "X-RateLimit-Reset": String(Math.ceil(reset / 1000)),
        "Retry-After": String(retryAfter),
      },
    }
  );
}

export async function withRateLimit(
  headers: Headers,
  type: RateLimitType,
  handler: () => Promise<Response>
): Promise<Response> {
  const key = createRateLimitKey(headers, type);
  const result = await checkRateLimitAsync(key, type);

  if (!result.allowed) {
    const response = rateLimitResponse(result.remaining, result.reset);
    return response;
  }

  const response = await handler();

  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(result.reset / 1000)));

  return response;
}

export function createRateLimitKey(headers: Headers, type: RateLimitType): string {
  const ip = getClientIp(headers);
  return `${type}:${ip}`;
}

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 60 * 1000);
}
