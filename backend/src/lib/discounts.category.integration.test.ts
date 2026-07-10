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
      { id: '5lb', label: '5lb', type: 'size', price: 15, stock: 20 },
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
    expect(result).toEqual({ updated: 1, total: 1, skippedMatrix: 0 });

    const product = await Product.findOne({ id: 'no-variant' }).lean();
    expect(product?.price).toBe(18);
    expect(product?.priceBefore).toBe(20);
  });

  test('discounts each simple variant using its own price as the base', async () => {
    await seedSimpleVariantProduct();
    const result = await applyCategoryDiscount({ category: 'Vitaminas', discountType: 'fixed', value: 2 });
    expect(result).toEqual({ updated: 1, total: 1, skippedMatrix: 0 });

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

  test('skips sabor×tamaño matrix products and reports them separately', async () => {
    await seedMatrixProduct();
    const result = await applyCategoryDiscount({ category: 'Vitaminas', discountType: 'percent', value: 10 });
    expect(result).toEqual({ updated: 0, total: 1, skippedMatrix: 1 });

    const product = await Product.findOne({ id: 'matrix-product' }).lean();
    expect(product?.priceBefore).toBeUndefined();
    for (const variant of product?.variants ?? []) {
      expect(variant.priceBefore).toBeUndefined();
    }
  });

  test('removeCategoryDiscount reverts both product-level and variant-level discounts', async () => {
    await seedNoVariantProduct();
    await seedSimpleVariantProduct();
    await applyCategoryDiscount({ category: 'Vitaminas', discountType: 'percent', value: 10 });

    const result = await removeCategoryDiscount('Vitaminas');
    expect(result).toEqual({ updated: 2 });

    const noVariant = await Product.findOne({ id: 'no-variant' }).lean();
    expect(noVariant?.price).toBe(20);
    expect(noVariant?.priceBefore).toBeUndefined();

    const simpleVariant = await Product.findOne({ id: 'simple-variant' }).lean();
    const small = simpleVariant?.variants?.find((v) => v.id === 'small');
    expect(small?.price).toBe(10);
    expect(small?.priceBefore).toBeUndefined();
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
