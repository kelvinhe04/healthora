import type { Context, MiddlewareHandler } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../types/hono';

type RateLimitScope = 'ip' | 'user';

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  scope: RateLimitScope;
  key: string;
  maxRequests: number;
  windowMs: number;
};

const buckets = new Map<string, RateLimitBucket>();
let lastSweepAt = 0;

function positiveEnvNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const DEFAULT_WINDOW_MS = positiveEnvNumber('RATE_LIMIT_WINDOW_MS', 60_000);
const IP_MAX_REQUESTS = positiveEnvNumber('RATE_LIMIT_IP_MAX', 300);
const USER_MAX_REQUESTS = positiveEnvNumber('RATE_LIMIT_USER_MAX', 120);

function sweepExpiredBuckets(now: number) {
  if (now - lastSweepAt < DEFAULT_WINDOW_MS) return;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }

  lastSweepAt = now;
}

function buildBucketKey(scope: RateLimitScope, key: string) {
  return `${scope}:${key || 'unknown'}`;
}

export function getClientIp(c: Context) {
  const forwardedFor = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  return (
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-real-ip') ||
    forwardedFor ||
    'unknown'
  );
}

export function enforceRateLimit(c: Context, options: RateLimitOptions) {
  if (c.req.method === 'OPTIONS') return null;

  const now = Date.now();
  sweepExpiredBuckets(now);

  const bucketKey = buildBucketKey(options.scope, options.key);
  const existingBucket = buckets.get(bucketKey);
  const bucket =
    existingBucket && existingBucket.resetAt > now
      ? existingBucket
      : { count: 0, resetAt: now + options.windowMs };

  bucket.count += 1;
  buckets.set(bucketKey, bucket);

  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  const remaining = Math.max(0, options.maxRequests - bucket.count);

  c.header('RateLimit-Limit', String(options.maxRequests));
  c.header('RateLimit-Remaining', String(remaining));
  c.header('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count <= options.maxRequests) {
    return null;
  }

  c.header('Retry-After', String(retryAfterSeconds));
  return c.json(
    {
      error: 'Too many requests',
      retryAfter: retryAfterSeconds,
      scope: options.scope,
    },
    429
  );
}

export const ipRateLimit = createMiddleware<AppEnv>(async (c, next) => {
  const rateLimitedResponse = enforceRateLimit(c, {
    scope: 'ip',
    key: getClientIp(c),
    maxRequests: IP_MAX_REQUESTS,
    windowMs: DEFAULT_WINDOW_MS,
  });

  if (rateLimitedResponse) return rateLimitedResponse;

  await next();
});

export const userRateLimit: MiddlewareHandler<AppEnv> = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user');
  const rateLimitedResponse = enforceRateLimit(c, {
    scope: 'user',
    key: user.clerkId,
    maxRequests: USER_MAX_REQUESTS,
    windowMs: DEFAULT_WINDOW_MS,
  });

  if (rateLimitedResponse) return rateLimitedResponse;

  await next();
});
