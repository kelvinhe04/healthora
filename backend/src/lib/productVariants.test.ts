import { describe, expect, test } from 'bun:test';
import { buildPaidLineItem, resolveVariantPricing } from '../lib/productVariants';

const product = {
  id: 'demo',
  name: 'Demo Product',
  price: 10,
  stock: 5,
  category: 'Vitaminas',
  variants: [
    { id: 'vanilla', label: 'Vainilla', type: 'flavor', price: 12, stock: 3 },
    { id: 'small', label: '30 ct', type: 'size', price: 2, stock: 4 },
  ],
};

describe('resolveVariantPricing', () => {
  test('uses base product when no variant', () => {
    expect(resolveVariantPricing(product, undefined)).toEqual({ price: 10, stock: 5 });
  });

  test('uses single variant price', () => {
    expect(resolveVariantPricing(product, 'vanilla')).toEqual({
      price: 12,
      stock: 3,
      label: 'Vainilla',
    });
  });

  test('combines flavor and size composite id', () => {
    expect(resolveVariantPricing(product, 'vanilla:small')).toEqual({
      price: 14,
      stock: 4,
      label: 'Vainilla · 30 ct',
    });
  });
});

describe('buildPaidLineItem', () => {
  test('names stripe line with variant label', () => {
    const line = buildPaidLineItem(product, { productId: 'demo', qty: 1, variantId: 'vanilla' });
    expect(line.price).toBe(12);
    expect(line.productName).toBe('Demo Product · Vainilla');
    expect(line.variantId).toBe('vanilla');
    expect(line.variantLabel).toBe('Vainilla');
  });
});
