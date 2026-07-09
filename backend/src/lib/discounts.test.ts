import { describe, expect, test } from 'bun:test';
import { getEffectivePrice, isDiscountActive, withEffectiveDiscount } from './discounts';

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
});

describe('getEffectivePrice', () => {
  test('returns discounted price while active', () => {
    expect(getEffectivePrice({ price: 8, priceBefore: 10 })).toBe(8);
  });

  test('returns priceBefore once expired', () => {
    const now = new Date('2026-03-01');
    expect(getEffectivePrice({ price: 8, priceBefore: 10, discountEndsAt: '2026-02-01' }, now)).toBe(10);
  });

  test('returns price when no discount configured', () => {
    expect(getEffectivePrice({ price: 10 })).toBe(10);
  });
});

describe('withEffectiveDiscount', () => {
  test('leaves an active discount untouched', () => {
    const product = { price: 8, priceBefore: 10, name: 'x' };
    expect(withEffectiveDiscount(product)).toEqual(product);
  });

  test('reverts price and clears priceBefore once expired', () => {
    const now = new Date('2026-03-01');
    const product = { price: 8, priceBefore: 10, discountEndsAt: '2026-02-01', name: 'x' };
    expect(withEffectiveDiscount(product, now)).toEqual({ price: 10, priceBefore: undefined, discountEndsAt: '2026-02-01', name: 'x' });
  });

  test('is a no-op when there is no priceBefore', () => {
    const product = { price: 10, name: 'x' };
    expect(withEffectiveDiscount(product)).toEqual(product);
  });
});
