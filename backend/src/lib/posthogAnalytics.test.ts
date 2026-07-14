import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { getProductAnalytics, isPostHogQueryConfigured } from './posthogAnalytics';

const ENV_KEYS = ['POSTHOG_PERSONAL_API_KEY', 'POSTHOG_PROJECT_ID', 'POSTHOG_HOST'] as const;
let savedEnv: Record<string, string | undefined>;

describe('posthogAnalytics', () => {
  beforeEach(() => {
    savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  test('isPostHogQueryConfigured is false without POSTHOG_PERSONAL_API_KEY/POSTHOG_PROJECT_ID', () => {
    expect(isPostHogQueryConfigured()).toBe(false);
  });

  test('isPostHogQueryConfigured is true once both are set', () => {
    process.env.POSTHOG_PERSONAL_API_KEY = 'phx_test';
    process.env.POSTHOG_PROJECT_ID = '123';
    expect(isPostHogQueryConfigured()).toBe(true);
  });

  test('getProductAnalytics degrades to a zeroed, unconfigured shape without credentials', async () => {
    const result = await getProductAnalytics(30);
    expect(result).toEqual({
      configured: false,
      periodDays: 30,
      funnel: { checkoutStarted: 0, checkoutCompleted: 0, conversionRate: 0 },
      cartAbandonment: { addedToCart: 0, completedCheckout: 0, abandonmentRate: 0 },
      recentEvents: [],
    });
  });
});
