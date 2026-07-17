import { describe, expect, test } from 'bun:test';
import type { TFunction } from 'i18next';
import { notificationPresentation, relativeTime } from './notificationPresentation';

// Minimal stand-in for i18next's `t` - avoids booting the real i18n instance (LanguageDetector
// touches navigator/localStorage, which don't behave the same under bun:test) just to resolve
// four keys whose Spanish values are fixed here for the test.
const t = ((key: string, options?: Record<string, unknown>) => {
  const templates: Record<string, string> = {
    'notifications.relativeTime.now': 'ahora',
    'notifications.relativeTime.minutesAgo': 'hace {{count}} min',
    'notifications.relativeTime.hoursAgo': 'hace {{count}} h',
    'notifications.relativeTime.daysAgo': 'hace {{count}} d',
  };
  let result = templates[key] ?? key;
  for (const [k, v] of Object.entries(options ?? {})) {
    result = result.replace(`{{${k}}}`, String(v));
  }
  return result;
}) as TFunction;

describe('notificationPresentation', () => {
  test('maps each type to a stable icon + accent', () => {
    expect(notificationPresentation('order_paid')).toEqual({ icon: 'check', accent: 'var(--green)' });
    expect(notificationPresentation('order_shipped').icon).toBe('truck');
    expect(notificationPresentation('low_stock').accent).toBe('var(--coral)');
    expect(notificationPresentation('new_review').icon).toBe('star');
    expect(notificationPresentation('return_requested')).toEqual({ icon: 'arrow-left', accent: 'var(--coral)' });
    expect(notificationPresentation('return_status')).toEqual({ icon: 'arrow-left', accent: 'var(--ink)' });
    expect(notificationPresentation('new_order')).toEqual({ icon: 'bag', accent: 'var(--green)' });
    expect(notificationPresentation('broadcast').icon).toBe('bell');
  });

  test('order_status distinguishes delivered/picked_up from other fulfillment updates', () => {
    expect(notificationPresentation('order_status').icon).toBe('receipt');
    expect(notificationPresentation('order_status', { fulfillmentStatus: 'processing' }).icon).toBe('receipt');
    expect(notificationPresentation('order_status', { fulfillmentStatus: 'delivered' })).toEqual({ icon: 'package', accent: 'var(--green)' });
    expect(notificationPresentation('order_status', { fulfillmentStatus: 'picked_up' })).toEqual({ icon: 'package', accent: 'var(--green)' });
  });
});

describe('relativeTime', () => {
  const now = new Date('2026-07-08T12:00:00.000Z').getTime();

  test('recent times read as "ahora"', () => {
    expect(relativeTime(t, '2026-07-08T11:59:30.000Z', now)).toBe('ahora');
  });

  test('minutes, hours and days', () => {
    expect(relativeTime(t, '2026-07-08T11:55:00.000Z', now)).toBe('hace 5 min');
    expect(relativeTime(t, '2026-07-08T10:00:00.000Z', now)).toBe('hace 2 h');
    expect(relativeTime(t, '2026-07-05T12:00:00.000Z', now)).toBe('hace 3 d');
  });

  test('invalid dates return empty string', () => {
    expect(relativeTime(t, 'not-a-date', now)).toBe('');
  });
});
