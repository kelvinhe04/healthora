import { describe, expect, test } from 'bun:test';
import { resolveShipping } from './shipping';

describe('resolveShipping', () => {
  test('pickup is always free regardless of subtotal', () => {
    expect(resolveShipping('pickup', 10).cost).toBe(0);
    expect(resolveShipping('pickup', 0).cost).toBe(0);
  });

  test('free delivery over the threshold', () => {
    expect(resolveShipping('delivery', 50).cost).toBe(0);
  });

  test('charges the flat delivery rate below the threshold', () => {
    expect(resolveShipping('delivery', 10).cost).toBe(6.9);
  });

  test('free delivery on an empty cart', () => {
    expect(resolveShipping('delivery', 0).cost).toBe(0);
  });
});
