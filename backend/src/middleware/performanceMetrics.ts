import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { PerformanceMetric } from '../db/models/PerformanceMetric';
import type { AppEnv } from '../types/hono';

const slowRequestThresholdMs = Number(process.env.APM_SLOW_REQUEST_MS || 1000);

function getRequestIp(headers: Headers) {
  return headers.get('cf-connecting-ip') || headers.get('x-real-ip') || headers.get('x-forwarded-for')?.split(',')[0]?.trim();
}

function getUser(c: Context<AppEnv>) {
  try {
    return c.get('user');
  } catch {
    return undefined;
  }
}

function normalizeRoute(method: string, pathname: string) {
  if (pathname.startsWith('/admin/products/') && method !== 'GET') return '/admin/products/:id';
  if (pathname.startsWith('/admin/orders/') && pathname.endsWith('/statuses')) return '/admin/orders/:id/statuses';
  if (pathname.startsWith('/admin/users/') && pathname.endsWith('/role')) return '/admin/users/:id/role';
  if (pathname.startsWith('/admin/users/')) return '/admin/users/:id';
  if (pathname.startsWith('/orders/') && pathname.endsWith('/cancel')) return '/orders/:id/cancel';
  if (pathname.startsWith('/orders/') && pathname.endsWith('/address')) return '/orders/:id/address';
  if (pathname.startsWith('/orders/')) return '/orders/:id';
  if (pathname.startsWith('/products/')) return '/products/:id';
  if (pathname.startsWith('/reviews/') && pathname.endsWith('/helpful')) return '/reviews/:id/helpful';
  return pathname;
}

export const performanceMetrics = createMiddleware<AppEnv>(async (c, next) => {
  const startedAt = performance.now();
  let thrown: unknown;

  try {
    await next();
  } catch (error) {
    thrown = error;
    throw error;
  } finally {
    const latencyMs = Math.round((performance.now() - startedAt) * 100) / 100;
    const url = new URL(c.req.url);
    const statusCode = thrown ? 500 : c.res.status;
    const user = getUser(c);

    PerformanceMetric.create({
      method: c.req.method,
      route: normalizeRoute(c.req.method, url.pathname),
      statusCode,
      latencyMs,
      slow: latencyMs >= slowRequestThresholdMs,
      error: statusCode >= 500,
      userId: user?.clerkId,
      userRole: user?.role,
      userAgent: c.req.header('user-agent'),
      ip: getRequestIp(c.req.raw.headers),
    }).catch((metricError) => {
      console.error('[APM] Failed to write performance metric:', metricError);
    });
  }
});
