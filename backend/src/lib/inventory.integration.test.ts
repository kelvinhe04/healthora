import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Product } from '../db/models/Product';
import { decrementStock } from './inventory';

let mongo: MongoMemoryServer;

async function seedTwoDimensionProduct() {
  await Product.create({
    id: 'combo-product',
    name: 'Combo Product',
    brand: 'Healthora',
    category: 'Vitaminas',
    need: 'Test',
    price: 10,
    stock: 0,
    variants: [
      {
        id: 'chocolate',
        label: 'Chocolate',
        type: 'flavor',
        price: 0,
        stock: 20,
        stockBySize: { '5lb': 3 },
      },
      { id: 'vanilla', label: 'Vainilla', type: 'flavor', price: 0, stock: 20 },
      { id: '5lb', label: '5lb', type: 'size', price: 5, stock: 10 },
    ],
  });
}

describe('decrementStock with stockBySize', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { dbName: 'healthora_inventory_test' });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await Product.deleteMany({});
    await seedTwoDimensionProduct();
  });

  test('decrements the combo-specific stockBySize bucket, not the shared size stock', async () => {
    const ok = await decrementStock('combo-product', 2, 'chocolate:5lb');
    expect(ok).toBe(true);

    const product = await Product.findOne({ id: 'combo-product' }).lean();
    const chocolate = product?.variants.find((v: { id: string }) => v.id === 'chocolate');
    const size = product?.variants.find((v: { id: string }) => v.id === '5lb');
    expect(chocolate?.stockBySize?.['5lb']).toBe(1);
    expect(size?.stock).toBe(10);
  });

  test('does not touch chocolate combo stock when vanilla:5lb sells (no override, shared size bucket)', async () => {
    const ok = await decrementStock('combo-product', 4, 'vanilla:5lb');
    expect(ok).toBe(true);

    const product = await Product.findOne({ id: 'combo-product' }).lean();
    const chocolate = product?.variants.find((v: { id: string }) => v.id === 'chocolate');
    const size = product?.variants.find((v: { id: string }) => v.id === '5lb');
    expect(chocolate?.stockBySize?.['5lb']).toBe(3);
    expect(size?.stock).toBe(6);
  });

  test('rejects decrement when combo stockBySize is insufficient', async () => {
    const ok = await decrementStock('combo-product', 10, 'chocolate:5lb');
    expect(ok).toBe(false);
  });

  test('keeps the top-level stock field in sync with the sum of all active combos after a sale', async () => {
    // seeded: chocolate:5lb has a 3-unit override, vanilla:5lb shares the size's 10-unit bucket.
    // Total starts at 3 + 10 = 13; selling 4 vanilla:5lb only touches the shared bucket (10 -> 6),
    // so the new total is chocolate's untouched 3 + vanilla's 6 = 9.
    await decrementStock('combo-product', 4, 'vanilla:5lb');

    const product = await Product.findOne({ id: 'combo-product' }).lean();
    expect(product?.stock).toBe(9);
  });
});
