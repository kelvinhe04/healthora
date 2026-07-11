import { describe, expect, test } from 'bun:test';
import { computeItbms, isTaxExemptCategory, ITBMS_RATE } from './tax';

describe('isTaxExemptCategory', () => {
  test('Medicamentos esta exenta', () => {
    expect(isTaxExemptCategory('Medicamentos')).toBe(true);
  });

  test('otras categorias no estan exentas', () => {
    expect(isTaxExemptCategory('Vitaminas')).toBe(false);
  });

  test('valores vacios no estan exentos', () => {
    expect(isTaxExemptCategory(undefined)).toBe(false);
    expect(isTaxExemptCategory('')).toBe(false);
  });
});

describe('computeItbms', () => {
  test('7% sobre el subtotal cuando nada esta exento', () => {
    const items = [{ price: 10, qty: 2, taxExempt: false }];
    expect(computeItbms(items, 0, 20)).toBeCloseTo(20 * ITBMS_RATE, 5);
  });

  test('ignora items exentos (ej. medicamentos)', () => {
    const items = [
      { price: 10, qty: 1, taxExempt: false },
      { price: 15, qty: 1, taxExempt: true },
    ];
    expect(computeItbms(items, 0, 25)).toBeCloseTo(10 * ITBMS_RATE, 5);
  });

  test('cero cuando todo el carrito esta exento', () => {
    const items = [{ price: 15, qty: 3, taxExempt: true }];
    expect(computeItbms(items, 0, 45)).toBe(0);
  });

  test('aplica el descuento proporcionalmente solo a la porcion gravada', () => {
    const items = [
      { price: 50, qty: 1, taxExempt: false },
      { price: 50, qty: 1, taxExempt: true },
    ];
    // Descuento de $20 sobre un subtotal de $100 -> 20% de descuento.
    // Porcion gravada ($50) tras ese mismo % -> $40 * 7% = $2.80.
    expect(computeItbms(items, 20, 100)).toBeCloseTo(2.8, 5);
  });

  test('subtotal 0 no divide por cero', () => {
    expect(computeItbms([], 0, 0)).toBe(0);
  });
});
