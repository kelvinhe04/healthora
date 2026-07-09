import { describe, expect, test } from 'bun:test';
import { isWithinReturnWindow, RETURN_WINDOW_DAYS } from './returns';

describe('isWithinReturnWindow', () => {
  test('true right after the order was placed', () => {
    const now = new Date('2026-01-10');
    expect(isWithinReturnWindow({ createdAt: '2026-01-01' }, now)).toBe(true);
  });

  test(`true exactly at the ${RETURN_WINDOW_DAYS}-day boundary`, () => {
    const now = new Date('2026-01-31');
    expect(isWithinReturnWindow({ createdAt: '2026-01-01' }, now)).toBe(true);
  });

  test('false once the window has passed', () => {
    const now = new Date('2026-03-01');
    expect(isWithinReturnWindow({ createdAt: '2026-01-01' }, now)).toBe(false);
  });
});
