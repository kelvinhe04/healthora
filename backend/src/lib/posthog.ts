import { PostHog } from 'posthog-node';

const token = process.env.POSTHOG_PROJECT_API_KEY || process.env.POSTHOG_API_KEY;
const host = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';

export const posthog = token
  ? new PostHog(token, {
      host,
      enableExceptionAutocapture: true,
    })
  : null;

export function shutdownPostHog() {
  return posthog?.shutdown();
}
