import posthog from 'posthog-js';

const token = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN as string | undefined;
const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com';

export const posthogOptions = {
  api_host: host,
  defaults: '2026-05-30',
  capture_exceptions: true,
} as const;

export const isPostHogConfigured = Boolean(token);
export const posthogToken = token || '';

type UserContext = {
  id?: string;
  email?: string;
};

let currentUser: UserContext = {};

export function setErrorTrackingUser(user: UserContext) {
  currentUser = user;
  if (!isPostHogConfigured || !user.id) return;

  posthog.identify(user.id, {
    email: user.email,
  });
}

export function clearErrorTrackingUser() {
  currentUser = {};
  if (isPostHogConfigured) posthog.reset();
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: 'Error',
    message: typeof error === 'string' ? error : 'Unknown frontend error',
    stack: undefined,
  };
}

export function captureFrontendException(error: unknown, metadata?: Record<string, unknown>) {
  const normalized = serializeError(error);

  if (isPostHogConfigured) {
    posthog.captureException(error, {
      source: 'frontend',
      route: window.location.pathname,
      ...metadata,
    });
  }

  void fetch('/api/error-reports/client', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...normalized,
      route: window.location.pathname,
      userId: currentUser.id,
      userEmail: currentUser.email,
      posthogDistinctId: posthog.get_distinct_id?.(),
      posthogSessionId: posthog.get_session_id?.(),
      metadata,
    }),
  }).catch(() => undefined);
}

export function installGlobalErrorTracking() {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    captureFrontendException(event.error || event.message, {
      handler: 'window.error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    captureFrontendException(event.reason, {
      handler: 'window.unhandledrejection',
    });
  });
}
