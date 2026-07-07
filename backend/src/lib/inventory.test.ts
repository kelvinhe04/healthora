import { describe, expect, test } from 'bun:test';
import { resolveStockTarget, validateCartStock } from './inventory';

const product = {
  id: 'demo',
  name: 'Demo',
  price: 10,
  stock: 5,
  variants: [
    { id: 'vanilla', label: 'Vainilla', type: 'flavor', price: 12, stock: 3 },
    { id: 'small', label: '30 ct', type: 'size', price: 2, stock: 4 },
  ],
};

describe('resolveStockTarget', () => {
  test('uses product stock without variant', () => {
    expect(resolveStockTarget(product, undefined)).toEqual({ stock: 5, stockVariantId: undefined });
  });

  test('uses variant stock for single variant', () => {
    expect(resolveStockTarget(product, 'vanilla')).toEqual({ stock: 3, stockVariantId: 'vanilla' });
  });

  test('uses size stock for composite variant', () => {
    expect(resolveStockTarget(product, 'vanilla:small')).toEqual({
      stock: 4,
      stockVariantId: 'small',
    });
  });
});

describe('validateCartStock', () => {
  test('aggregates qty for same variant', () => {
    expect(() =>
      validateCartStock([product], [
        { productId: 'demo', qty: 2, variantId: 'vanilla' },
        { productId: 'demo', qty: 2, variantId: 'vanilla' },
      ]),
    ).toThrow('Stock insuficiente');
  });
});
