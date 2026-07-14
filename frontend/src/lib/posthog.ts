import posthog from 'posthog-js';

/** Minimal PostHog client init for the product-analytics event capture (HU-054) - just enough to
 * send `add_to_cart`/`checkout_started`/`checkout_completed` (see analyticsEvents.ts). No error
 * tracking here anymore (that was HU-067, removed - see ErrorBoundary.tsx for the plain fallback
 * UI that's left in its place). */

const token = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN as string | undefined;
const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com';

export const isPostHogConfigured = Boolean(token);

if (typeof window !== 'undefined' && isPostHogConfigured) {
  posthog.init(token!, { api_host: host, defaults: '2026-05-30' });
}
