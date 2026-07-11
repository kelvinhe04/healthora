import { describe, expect, it } from 'bun:test';
import { computeItbms, ITBMS_RATE } from './tax';

describe('computeItbms', () => {
  it('7% sobre el subtotal cuando nada esta exento', () => {
    const items = [{ price: 10, qty: 2, taxExempt: false }];
    expect(computeItbms(items, 0, 20)).toBeCloseTo(20 * ITBMS_RATE, 5);
  });

  it('ignora items exentos (ej. medicamentos)', () => {
    const items = [
      { price: 10, qty: 1, taxExempt: false },
      { price: 15, qty: 1, taxExempt: true },
    ];
    expect(computeItbms(items, 0, 25)).toBeCloseTo(10 * ITBMS_RATE, 5);
  });

  it('cero cuando todo el carrito esta exento', () => {
    const items = [{ price: 15, qty: 3, taxExempt: true }];
    expect(computeItbms(items, 0, 45)).toBe(0);
  });

  it('aplica el descuento proporcionalmente solo a la porcion gravada', () => {
    const items = [
      { price: 50, qty: 1, taxExempt: false },
      { price: 50, qty: 1, taxExempt: true },
    ];
    expect(computeItbms(items, 20, 100)).toBeCloseTo(2.8, 5);
  });
});
