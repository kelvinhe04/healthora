import { describe, expect, test } from 'bun:test';
import { notificationPresentation, relativeTime } from './notificationPresentation';

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
});

describe('relativeTime', () => {
  const now = new Date('2026-07-08T12:00:00.000Z').getTime();

  test('recent times read as "ahora"', () => {
    expect(relativeTime('2026-07-08T11:59:30.000Z', now)).toBe('ahora');
  });

  test('minutes, hours and days', () => {
    expect(relativeTime('2026-07-08T11:55:00.000Z', now)).toBe('hace 5 min');
    expect(relativeTime('2026-07-08T10:00:00.000Z', now)).toBe('hace 2 h');
    expect(relativeTime('2026-07-05T12:00:00.000Z', now)).toBe('hace 3 d');
  });

  test('invalid dates return empty string', () => {
    expect(relativeTime('not-a-date', now)).toBe('');
  });
});
