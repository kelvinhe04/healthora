import { randomUUID } from 'crypto';
import { createMiddleware } from 'hono/factory';
import { logger } from '../lib/logger';
import type { AppEnv } from '../types/hono';

const CORRELATION_HEADERS = ['x-correlation-id', 'x-request-id'];

function getCorrelationId(headers: Headers) {
  for (const header of CORRELATION_HEADERS) {
    const value = headers.get(header)?.trim();
    if (value) return value;
  }

  return randomUUID();
}

function getRequestIp(headers: Headers) {
  return headers.get('cf-connecting-ip') || headers.get('x-real-ip') || headers.get('x-forwarded-for')?.split(',')[0]?.trim();
}

export const requestLogger = createMiddleware<AppEnv>(async (c, next) => {
  const startedAt = performance.now();
  const correlationId = getCorrelationId(c.req.raw.headers);
  const path = new URL(c.req.url).pathname;

  c.set('requestId', correlationId);
  c.header('x-correlation-id', correlationId);

  const req = {
    method: c.req.method,
    path,
    route: c.req.routePath || path,
    correlationId,
    ip: getRequestIp(c.req.raw.headers),
    userAgent: c.req.header('user-agent'),
  };

  try {
    await next();

    const status = c.res.status;
    const latencyMs = Math.round((performance.now() - startedAt) * 100) / 100;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

    logger[level](
      {
        req,
        res: { statusCode: status },
        latencyMs,
      },
      'request completed'
    );
  } catch (error) {
    const latencyMs = Math.round((performance.now() - startedAt) * 100) / 100;

    logger.error(
      {
        req,
        err: error,
        latencyMs,
      },
      'request failed'
    );

    throw error;
  }
});
