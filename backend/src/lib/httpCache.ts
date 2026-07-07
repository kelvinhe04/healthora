import type { Context } from 'hono';
import { createHash } from 'node:crypto';

type CachePolicy = 'catalogList' | 'catalogDetail' | 'reviewList' | 'staticDocument';

const cacheControlByPolicy: Record<CachePolicy, string> = {
  catalogList: 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
  catalogDetail: 'public, max-age=120, s-maxage=600, stale-while-revalidate=900',
  reviewList: 'public, max-age=30, s-maxage=120, stale-while-revalidate=300',
  staticDocument: 'public, max-age=300, s-maxage=1800, stale-while-revalidate=3600',
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(',')}}`;
}

export function createETag(payload: unknown): string {
  const hash = createHash('sha256').update(stableStringify(payload)).digest('base64url').slice(0, 27);
  return `W/"${hash}"`;
}

function requestHasMatchingETag(ifNoneMatch: string | undefined, etag: string): boolean {
  if (!ifNoneMatch) return false;
  return ifNoneMatch
    .split(',')
    .map((candidate) => candidate.trim())
    .some((candidate) => candidate === '*' || candidate === etag);
}

export function cacheableJson(c: Context, payload: unknown, policy: CachePolicy, status = 200): Response {
  const etag = createETag(payload);

  c.header('Cache-Control', cacheControlByPolicy[policy]);
  c.header('ETag', etag);
  c.header('Vary', 'Accept-Encoding');

  if (requestHasMatchingETag(c.req.header('If-None-Match'), etag)) {
    return c.body(null, 304);
  }

  return c.json(payload, status as 200);
}
