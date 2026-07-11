import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Product } from '../db/models/Product';
import { applyCategoryDiscount, removeCategoryDiscount } from './discounts';

let mongo: MongoMemoryServer;

async function seedNoVariantProduct() {
  await Product.create({
    id: 'no-variant',
    name: 'No Variant Product',
    brand: 'Healthora',
    category: 'Vitaminas',
    need: 'Test',
    price: 20,
    stock: 10,
  });
}

async function seedSimpleVariantProduct() {
  await Product.create({
    id: 'simple-variant',
    name: 'Simple Variant Product',
    brand: 'Healthora',
    category: 'Vitaminas',
    need: 'Test',
    price: 10,
    stock: 0,
    variants: [
      { id: 'small', label: 'Pequeño', type: 'size', price: 10, stock: 5 },
      { id: 'large', label: 'Grande', type: 'size', price: 18, stock: 5 },
    ],
  });
}

async function seedMatrixProduct() {
  await Product.create({
    id: 'matrix-product',
    name: 'Matrix Product',
    brand: 'Healthora',
    category: 'Vitaminas',
    need: 'Test',
    price: 15,
    stock: 0,
    variants: [
      { id: 'chocolate', label: 'Chocolate', type: 'flavor', price: 0, stock: 20 },
      { id: 'vanilla', label: 'Vainilla', type: 'flavor', price: 0, stock: 20 },
      { id: '5lb', label: '5lb', type: 'size', price: 15, stock: 20 },
      // Only offered for chocolate - exercises the `availableFor` restriction.
      { id: '10lb', label: '10lb', type: 'size', price: 28, stock: 10, availableFor: ['chocolate'] },
    ],
  });
}

describe('applyCategoryDiscount / removeCategoryDiscount', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { dbName: 'healthora_discounts_test' });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await Product.deleteMany({});
  });

  test('discounts the product price when it has no variants', async () => {
    await seedNoVariantProduct();
    const result = await applyCategoryDiscount({ category: 'Vitaminas', discountType: 'percent', value: 10 });
    expect(result).toEqual({ updated: 1, total: 1 });

    const product = await Product.findOne({ id: 'no-variant' }).lean();
    expect(product?.price).toBe(18);
    expect(product?.priceBefore).toBe(20);
  });

  test('discounts each simple variant using its own price as the base', async () => {
    await seedSimpleVariantProduct();
    const result = await applyCategoryDiscount({ category: 'Vitaminas', discountType: 'fixed', value: 2 });
    expect(result).toEqual({ updated: 1, total: 1 });

    const product = await Product.findOne({ id: 'simple-variant' }).lean();
    const small = product?.variants?.find((v) => v.id === 'small');
    const large = product?.variants?.find((v) => v.id === 'large');
    expect(small?.price).toBe(8);
    expect(small?.priceBefore).toBe(10);
    expect(large?.price).toBe(16);
    expect(large?.priceBefore).toBe(18);
    // Top-level price/priceBefore are unused for variant products - left untouched, not faked.
    expect(product?.priceBefore).toBeUndefined();
  });

  test('re-applying a discount does not compound on top of a previous one', async () => {
    await seedSimpleVariantProduct();
    await applyCategoryDiscount({ category: 'Vitaminas', discountType: 'percent', value: 10 });
    await applyCategoryDiscount({ category: 'Vitaminas', discountType: 'percent', value: 10 });

    const product = await Product.findOne({ id: 'simple-variant' }).lean();
    const small = product?.variants?.find((v) => v.id === 'small');
    // Base stays the original $10 (from priceBefore, not the already-discounted $9) each time.
    expect(small?.priceBefore).toBe(10);
    expect(small?.price).toBe(9);
  });

  test('discounts every sabor×tamaño combo using each combo\'s own price as the base, respecting availableFor', async () => {
    await seedMatrixProduct();
    const discountStartsAt = new Date('2026-07-01');
    const discountEndsAt = new Date('2026-07-31');
    const result = await applyCategoryDiscount({
      category: 'Vitaminas',
      discountType: 'percent',
      value: 10,
      discountStartsAt,
      discountEndsAt,
    });
    expect(result).toEqual({ updated: 1, total: 1 });

    const product = await Product.findOne({ id: 'matrix-product' }).lean();
    const chocolate = product?.variants?.find((v) => v.id === 'chocolate');
    const vanilla = product?.variants?.find((v) => v.id === 'vanilla');

    // chocolate:5lb = 0 + 15 = 15 -> 13.5; chocolate:10lb = 0 + 28 = 28 -> 25.2 (only available for chocolate).
    expect(chocolate?.priceBySize).toEqual({ '5lb': 13.5, '10lb': 25.2 });
    expect(chocolate?.priceBeforeBySize).toEqual({ '5lb': 15, '10lb': 28 });
    expect(chocolate?.discountStartsAt?.toISOString()).toBe(discountStartsAt.toISOString());
    expect(chocolate?.discountEndsAt?.toISOString()).toBe(discountEndsAt.toISOString());

    // vanilla only has 5lb available (10lb is restricted to chocolate).
    expect(vanilla?.priceBySize).toEqual({ '5lb': 13.5 });
    expect(vanilla?.priceBeforeBySize).toEqual({ '5lb': 15 });

    // The additive price parts themselves are untouched - only the combo override changed.
    expect(chocolate?.price).toBe(0);
    const size5lb = product?.variants?.find((v) => v.id === '5lb');
    expect(size5lb?.price).toBe(15);
  });

  test('re-applying a discount to matrix combos does not compound on top of a previous one', async () => {
    await seedMatrixProduct();
    await applyCategoryDiscount({ category: 'Vitaminas', discountType: 'percent', value: 10 });
    await applyCategoryDiscount({ category: 'Vitaminas', discountType: 'percent', value: 10 });

    const product = await Product.findOne({ id: 'matrix-product' }).lean();
    const chocolate = product?.variants?.find((v) => v.id === 'chocolate');
    // Base stays the original $15 (from priceBeforeBySize, not the already-discounted $13.5).
    expect(chocolate?.priceBeforeBySize).toEqual({ '5lb': 15, '10lb': 28 });
    expect(chocolate?.priceBySize).toEqual({ '5lb': 13.5, '10lb': 25.2 });
  });

  test('removeCategoryDiscount reverts product-level, variant-level and combo-level discounts', async () => {
    await seedNoVariantProduct();
    await seedSimpleVariantProduct();
    await seedMatrixProduct();
    await applyCategoryDiscount({ category: 'Vitaminas', discountType: 'percent', value: 10 });

    const result = await removeCategoryDiscount('Vitaminas');
    expect(result).toEqual({ updated: 3 });

    const noVariant = await Product.findOne({ id: 'no-variant' }).lean();
    expect(noVariant?.price).toBe(20);
    expect(noVariant?.priceBefore).toBeUndefined();

    const simpleVariant = await Product.findOne({ id: 'simple-variant' }).lean();
    const small = simpleVariant?.variants?.find((v) => v.id === 'small');
    expect(small?.price).toBe(10);
    expect(small?.priceBefore).toBeUndefined();

    const matrixProduct = await Product.findOne({ id: 'matrix-product' }).lean();
    const chocolate = matrixProduct?.variants?.find((v) => v.id === 'chocolate');
    expect(chocolate?.priceBySize).toEqual({ '5lb': 15, '10lb': 28 });
    expect(chocolate?.priceBeforeBySize).toBeUndefined();
    expect(chocolate?.discountStartsAt).toBeUndefined();
    expect(chocolate?.discountEndsAt).toBeUndefined();
  });

  test('removeCategoryDiscount also clears a discount that was hardcoded directly in seed data', async () => {
    await Product.create({
      id: 'hardcoded-discount',
      name: 'Hardcoded Discount Product',
      brand: 'Healthora',
      category: 'Vitaminas',
      need: 'Test',
      price: 11.68,
      stock: 0,
      variants: [{ id: '84ct', label: '84 Count', type: 'count', price: 11.68, priceBefore: 19.99, stock: 38 }],
    });

    const result = await removeCategoryDiscount('Vitaminas');
    expect(result).toEqual({ updated: 1 });

    const product = await Product.findOne({ id: 'hardcoded-discount' }).lean();
    const variant = product?.variants?.[0];
    expect(variant?.price).toBe(19.99);
    expect(variant?.priceBefore).toBeUndefined();
  });
});
