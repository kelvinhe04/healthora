import { createMiddleware } from 'hono/factory';
import { captureException } from '../lib/errorTracking';
import type { AppEnv } from '../types/hono';

export const errorTracking = createMiddleware<AppEnv>(async (c, next) => {
  try {
    await next();
  } catch (error) {
    captureException({
      source: 'backend',
      error,
      c,
      severity: 'fatal',
      statusCode: 500,
    });

    throw error;
  }
});
