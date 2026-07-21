import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { cartRouter } from './cart';
import { Product } from '../db/models/Product';
import { User } from '../db/models/User';

process.env.NODE_ENV = 'test';

let mongo: MongoMemoryServer;

function createTestApp() {
  const app = new Hono();
  app.route('/cart', cartRouter);
  return app;
}

const authHeaders = {
  'content-type': 'application/json',
  'x-test-clerk-id': 'user_test_1',
  'x-test-email': 'buyer@example.com',
  'x-test-name': 'Buyer Test',
};

describe('cart persists the selected variant (HU-035)', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { dbName: 'healthora_cart_test' });
  });

  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
    await User.create({ clerkId: 'user_test_1', email: 'buyer@example.com', name: 'Buyer Test' });
    await Product.create({
      id: 'combo-product',
      name: 'Combo Product',
      brand: 'Healthora',
      category: 'Vitaminas',
      need: 'Test',
      price: 10,
      stock: 13,
      active: true,
      variants: [
        { id: 'chocolate', label: 'Chocolate', type: 'flavor', price: 0, stock: 20, stockBySize: { '5lb': 3 } },
        { id: '5lb', label: '5lb', type: 'size', price: 5, stock: 10 },
        { id: 'simple-variant', label: 'Unica', type: 'color', price: 2, stock: 7 },
      ],
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  test('PUT /cart stores a combo variantId and GET /cart returns it back', async () => {
    const app = createTestApp();
    const putResponse = await app.request('/cart', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ items: [{ productId: 'combo-product', qty: 2, variantId: 'chocolate:5lb' }] }),
    });
    expect(putResponse.status).toBe(200);
    const putBody = (await putResponse.json()) as { variantId?: string; qty: number }[];
    expect(putBody).toHaveLength(1);
    expect(putBody[0].variantId).toBe('chocolate:5lb');
    expect(putBody[0].qty).toBe(2);

    const user = await User.findOne({ clerkId: 'user_test_1' }).lean();
    expect(user?.cart?.[0]?.variantId).toBe('chocolate:5lb');

    const getResponse = await app.request('/cart', { headers: authHeaders });
    const getBody = (await getResponse.json()) as { variantId?: string }[];
    expect(getBody[0].variantId).toBe('chocolate:5lb');
  });

  test('PUT /cart stores a simple (non-combo) variantId', async () => {
    const app = createTestApp();
    const response = await app.request('/cart', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ items: [{ productId: 'combo-product', qty: 1, variantId: 'simple-variant' }] }),
    });
    const body = (await response.json()) as { variantId?: string }[];
    expect(body[0].variantId).toBe('simple-variant');
  });

  test('an invalid variantId is dropped but the product line is kept', async () => {
    const app = createTestApp();
    const response = await app.request('/cart', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ items: [{ productId: 'combo-product', qty: 1, variantId: 'no-such-variant' }] }),
    });
    const body = (await response.json()) as { variantId?: string; qty: number }[];
    expect(body).toHaveLength(1);
    expect(body[0].variantId).toBeUndefined();
    expect(body[0].qty).toBe(1);
  });

  test('an item without variantId round-trips as a plain product line', async () => {
    const app = createTestApp();
    const response = await app.request('/cart', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ items: [{ productId: 'combo-product', qty: 3 }] }),
    });
    const body = (await response.json()) as { variantId?: string; qty: number }[];
    expect(body[0].variantId).toBeUndefined();
    expect(body[0].qty).toBe(3);
  });
});
