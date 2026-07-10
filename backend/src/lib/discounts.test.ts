import { describe, expect, test } from 'bun:test';
import { isDiscountActive, isVigenciaRangeValid, withEffectiveDiscount } from './discounts';

describe('isDiscountActive', () => {
  test('false when no priceBefore is set', () => {
    expect(isDiscountActive({ price: 10 })).toBe(false);
  });

  test('true when priceBefore is set and no vigencia window', () => {
    expect(isDiscountActive({ price: 8, priceBefore: 10 })).toBe(true);
  });

  test('false before the start date', () => {
    const now = new Date('2026-01-01');
    expect(isDiscountActive({ price: 8, priceBefore: 10, discountStartsAt: '2026-02-01' }, now)).toBe(false);
  });

  test('false after the end date', () => {
    const now = new Date('2026-03-01');
    expect(isDiscountActive({ price: 8, priceBefore: 10, discountEndsAt: '2026-02-01' }, now)).toBe(false);
  });

  test('true within the vigencia window', () => {
    const now = new Date('2026-01-15');
    expect(isDiscountActive({ price: 8, priceBefore: 10, discountStartsAt: '2026-01-01', discountEndsAt: '2026-02-01' }, now)).toBe(true);
  });

  test('stays active for the whole end-date day in Panama, not just its first UTC instant', () => {
    const product = { price: 8, priceBefore: 10, discountEndsAt: '2026-07-10' };
    // 2026-07-10T16:40:00Z is 11:40am in Panama on July 10 - still the configured last day.
    expect(isDiscountActive(product, new Date('2026-07-10T16:40:00Z'))).toBe(true);
    // 2026-07-11T04:59:59.999Z is 23:59:59.999 in Panama on July 10 - the very last instant.
    expect(isDiscountActive(product, new Date('2026-07-11T04:59:59.999Z'))).toBe(true);
    // 2026-07-11T05:00:00Z is midnight in Panama on July 11 - now truly expired.
    expect(isDiscountActive(product, new Date('2026-07-11T05:00:00Z'))).toBe(false);
  });

  test('does not activate until the start-date day actually begins in Panama', () => {
    const product = { price: 8, priceBefore: 10, discountStartsAt: '2026-07-11' };
    // 2026-07-10T23:00:00Z is 6pm in Panama on July 10 - the day before, not yet active.
    expect(isDiscountActive(product, new Date('2026-07-10T23:00:00Z'))).toBe(false);
    // 2026-07-11T05:00:00Z is midnight in Panama on July 11 - now active.
    expect(isDiscountActive(product, new Date('2026-07-11T05:00:00Z'))).toBe(true);
  });
});

describe('withEffectiveDiscount', () => {
  test('leaves an active discount untouched', () => {
    const product = { price: 8, priceBefore: 10, name: 'x' };
    expect(withEffectiveDiscount(product)).toEqual(product);
  });

  test('clears priceBefore once expired, but leaves price - the real charge - untouched', () => {
    const now = new Date('2026-03-01');
    const product = { price: 8, priceBefore: 10, discountEndsAt: '2026-02-01', name: 'x' };
    expect(withEffectiveDiscount(product, now)).toEqual({ price: 8, priceBefore: undefined, discountEndsAt: '2026-02-01', name: 'x' });
  });

  test('is a no-op when there is no priceBefore', () => {
    const product = { price: 10, name: 'x' };
    expect(withEffectiveDiscount(product)).toEqual(product);
  });

  test('clears an expired variant discount independently of the product, without touching either price', () => {
    const now = new Date('2026-03-01');
    const product = {
      price: 20,
      name: 'x',
      variants: [
        { id: 'a', price: 8, priceBefore: 10, discountEndsAt: '2026-02-01' },
        { id: 'b', price: 15, priceBefore: 18 },
      ],
    };
    expect(withEffectiveDiscount(product, now)).toEqual({
      price: 20,
      name: 'x',
      variants: [
        { id: 'a', price: 8, priceBefore: undefined, discountEndsAt: '2026-02-01' },
        { id: 'b', price: 15, priceBefore: 18 },
      ],
    });
  });

  test('leaves variants untouched when none have an expired discount', () => {
    const product = {
      price: 20,
      name: 'x',
      variants: [{ id: 'a', price: 8, priceBefore: 10 }],
    };
    expect(withEffectiveDiscount(product)).toEqual(product);
  });
});

describe('isVigenciaRangeValid', () => {
  test('true when neither bound is set', () => {
    expect(isVigenciaRangeValid()).toBe(true);
  });

  test('true when only one bound is set', () => {
    expect(isVigenciaRangeValid('2026-01-01', null)).toBe(true);
    expect(isVigenciaRangeValid(null, '2026-01-01')).toBe(true);
  });

  test('true when end is on or after start', () => {
    expect(isVigenciaRangeValid('2026-01-01', '2026-01-01')).toBe(true);
    expect(isVigenciaRangeValid('2026-01-01', '2026-02-01')).toBe(true);
  });

  test('false when end is before start - a window that could never be active', () => {
    expect(isVigenciaRangeValid('2026-07-17', '2026-07-06')).toBe(false);
  });
});
