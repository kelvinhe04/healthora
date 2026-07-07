import type { Context } from 'hono';
import { ErrorReport } from '../db/models/ErrorReport';
import { posthog } from './posthog';
import type { AuthUser } from '../types/hono';

type ErrorSource = 'backend' | 'frontend';

type ErrorContext = {
  source: ErrorSource;
  error: unknown;
  c?: Context;
  user?: Partial<AuthUser> | null;
  route?: string;
  method?: string;
  statusCode?: number;
  severity?: 'error' | 'fatal';
  posthogDistinctId?: string;
  posthogSessionId?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: 'Error',
    message: typeof error === 'string' ? error : 'Unknown error',
    stack: undefined,
  };
}

function getRequestIp(c?: Context) {
  return (
    c?.req.header('cf-connecting-ip') ||
    c?.req.header('x-real-ip') ||
    c?.req.header('x-forwarded-for')?.split(',')[0]?.trim()
  );
}

function getUser(c?: Context, fallback?: Partial<AuthUser> | null) {
  if (fallback) return fallback;
  try {
    return c?.get('user');
  } catch {
    return undefined;
  }
}

export function captureException(context: ErrorContext) {
  const normalized = normalizeError(context.error);
  const user = getUser(context.c, context.user);
  const route = context.route || (context.c ? new URL(context.c.req.url).pathname : undefined);
  const method = context.method || context.c?.req.method;
  const userAgent = context.userAgent || context.c?.req.header('user-agent');
  const distinctId = context.posthogDistinctId || user?.clerkId || 'anonymous';

  posthog?.captureException(context.error, distinctId, {
    source: context.source,
    route,
    method,
    status_code: context.statusCode,
    user_email: user?.email,
    posthog_session_id: context.posthogSessionId,
    ...context.metadata,
  });

  ErrorReport.create({
    source: context.source,
    name: normalized.name,
    message: normalized.message,
    stack: normalized.stack,
    severity: context.severity || 'error',
    route,
    method,
    statusCode: context.statusCode,
    userId: user?.clerkId,
    userEmail: user?.email,
    posthogDistinctId: context.posthogDistinctId,
    posthogSessionId: context.posthogSessionId,
    userAgent,
    ip: getRequestIp(context.c),
    metadata: context.metadata,
  }).catch((reportError) => {
    console.error('[ERROR_TRACKING] Failed to save error report:', reportError);
  });
}
