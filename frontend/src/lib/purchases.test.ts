import { describe, expect, test } from 'bun:test';
import { formatPurchasesLastMonth } from './purchases';

describe('formatPurchasesLastMonth', () => {
  test('hides the indicator below the display threshold', () => {
    expect(formatPurchasesLastMonth(0)).toBeNull();
    expect(formatPurchasesLastMonth(9)).toBeNull();
  });

  test('rounds down to the nearest ten under 100', () => {
    expect(formatPurchasesLastMonth(10)).toBe('10+');
    expect(formatPurchasesLastMonth(47)).toBe('40+');
    expect(formatPurchasesLastMonth(99)).toBe('90+');
  });

  test('rounds down to the nearest hundred under 1000', () => {
    expect(formatPurchasesLastMonth(100)).toBe('100+');
    expect(formatPurchasesLastMonth(499)).toBe('400+');
    expect(formatPurchasesLastMonth(999)).toBe('900+');
  });

  test('rounds down to the nearest thousand at 1000 and above', () => {
    expect(formatPurchasesLastMonth(1000)).toBe('1K+');
    expect(formatPurchasesLastMonth(2345)).toBe('2K+');
  });
});
