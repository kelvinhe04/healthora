import { describe, expect, test } from 'bun:test';
import { buildPaidLineItem, resolveVariantImage, resolveVariantPricing } from '../lib/productVariants';

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
      stockVariantId: 'vanilla',
    });
  });

  test('combines flavor and size composite id', () => {
    expect(resolveVariantPricing(product, 'vanilla:small')).toEqual({
      price: 14,
      stock: 4,
      label: 'Vainilla · 30 ct',
      stockVariantId: 'small',
    });
  });

  test('charges the combo\'s priceBySize override instead of the additive sum when present', () => {
    const productWithOverride = {
      ...product,
      variants: [
        { id: 'vanilla', label: 'Vainilla', type: 'flavor', price: 12, stock: 3, priceBySize: { small: 13.5 } },
        { id: 'small', label: '30 ct', type: 'size', price: 2, stock: 4 },
      ],
    };
    expect(resolveVariantPricing(productWithOverride, 'vanilla:small')).toEqual({
      price: 13.5,
      stock: 4,
      label: 'Vainilla · 30 ct',
      stockVariantId: 'small',
    });
  });

  test('prefers stockBySize override for composite id when present', () => {
    const productWithOverride = {
      ...product,
      variants: [
        { id: 'vanilla', label: 'Vainilla', type: 'flavor', price: 12, stock: 3, stockBySize: { small: 1 } },
        { id: 'small', label: '30 ct', type: 'size', price: 2, stock: 4 },
      ],
    };
    expect(resolveVariantPricing(productWithOverride, 'vanilla:small')).toEqual({
      price: 14,
      stock: 1,
      label: 'Vainilla · 30 ct',
      stockVariantId: 'vanilla',
      stockField: 'stockBySize.small',
    });
  });

  test('always charges the variant\'s own price, regardless of priceBefore/vigencia - those only control the "was $X" badge, never what\'s billed', () => {
    const productWithDiscount = {
      ...product,
      variants: [
        { id: 'vanilla', label: 'Vainilla', type: 'flavor', price: 9, priceBefore: 12, stock: 3 },
        { id: 'small', label: '30 ct', type: 'size', price: 2, stock: 4 },
      ],
    };
    expect(resolveVariantPricing(productWithDiscount, 'vanilla')).toEqual({
      price: 9,
      stock: 3,
      label: 'Vainilla',
      stockVariantId: 'vanilla',
    });

    const productWithExpiredDiscount = {
      ...product,
      variants: [
        { id: 'vanilla', label: 'Vainilla', type: 'flavor', price: 9, priceBefore: 12, discountEndsAt: '2020-01-01', stock: 3 },
        { id: 'small', label: '30 ct', type: 'size', price: 2, stock: 4 },
      ],
    };
    expect(resolveVariantPricing(productWithExpiredDiscount, 'vanilla')).toEqual({
      price: 9,
      stock: 3,
      label: 'Vainilla',
      stockVariantId: 'vanilla',
    });
  });

  test('falls back to shared size stock when stockBySize has no entry for that size', () => {
    const productWithOverride = {
      ...product,
      variants: [
        { id: 'vanilla', label: 'Vainilla', type: 'flavor', price: 12, stock: 3, stockBySize: { other: 9 } },
        { id: 'small', label: '30 ct', type: 'size', price: 2, stock: 4 },
      ],
    };
    expect(resolveVariantPricing(productWithOverride, 'vanilla:small')).toEqual({
      price: 14,
      stock: 4,
      label: 'Vainilla · 30 ct',
      stockVariantId: 'small',
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

  test('uses the variant photo, not the product default, when the variant has its own image', () => {
    const productWithVariantImage = {
      ...product,
      imageUrl: '/products/demo-default.jpg',
      variants: [
        { id: 'vanilla', label: 'Vainilla', type: 'flavor', price: 12, stock: 3, imageUrl: '/products/vanilla.jpg' },
        { id: 'small', label: '30 ct', type: 'size', price: 2, stock: 4 },
      ],
    };
    const line = buildPaidLineItem(productWithVariantImage, { productId: 'demo', qty: 1, variantId: 'vanilla' });
    expect(line.imageUrl).toBe('/products/vanilla.jpg');
  });

  test('uses the combo-specific imagesBySize photo for two-dimension variants', () => {
    const productWithCombo = {
      ...product,
      imageUrl: '/products/demo-default.jpg',
      variants: [
        {
          id: 'vanilla', label: 'Vainilla', type: 'flavor', price: 12, stock: 3,
          imageUrl: '/products/vanilla-flat.jpg',
          imagesBySize: { small: ['/products/vanilla-small.jpg'] },
        },
        { id: 'small', label: '30 ct', type: 'size', price: 2, stock: 4 },
      ],
    };
    const line = buildPaidLineItem(productWithCombo, { productId: 'demo', qty: 1, variantId: 'vanilla:small' });
    expect(line.imageUrl).toBe('/products/vanilla-small.jpg');
  });
});

describe('resolveVariantImage', () => {
  test('falls back to product image when variant has no photo of its own', () => {
    const withProductImage = { ...product, imageUrl: '/products/demo-default.jpg' };
    expect(resolveVariantImage(withProductImage, 'vanilla')).toBe('/products/demo-default.jpg');
  });
});
