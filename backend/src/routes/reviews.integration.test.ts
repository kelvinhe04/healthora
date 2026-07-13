import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Product } from '../db/models/Product';
import { Review } from '../db/models/Review';
import { ReviewBan } from '../db/models/ReviewBan';
import { reviewsRouter } from './reviews';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: 'healthora_reviews_test' });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const userHeaders = { 'x-test-clerk-id': 'user-1', 'x-test-role': 'customer', 'x-test-name': 'Cliente Uno' };

async function userRequest(path: string, init: RequestInit = {}) {
  const req = new Request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...userHeaders, ...(init.headers as Record<string, string>) },
  });
  const res = await reviewsRouter.fetch(req);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : undefined };
}

describe('reviewsRouter POST / — ban de autor por producto', () => {
  beforeEach(async () => {
    await Product.deleteMany({});
    await Review.deleteMany({});
    await ReviewBan.deleteMany({});
    await Product.create({ id: 'product-a', name: 'Producto A', brand: 'Healthora', category: 'Vitaminas', need: 'Test', price: 10, stock: 5, active: true });
    await Product.create({ id: 'product-b', name: 'Producto B', brand: 'Healthora', category: 'Vitaminas', need: 'Test', price: 8, stock: 5, active: true });
  });

  test('un usuario baneado para un producto no puede dejar una nueva reseña ahi', async () => {
    await ReviewBan.create({ productId: 'product-a', userId: 'user-1', userName: 'Cliente Uno', bannedBy: 'admin-1' });

    const { status, json } = await userRequest('/', {
      method: 'POST',
      body: JSON.stringify({ productId: 'product-a', rating: 5, body: 'Vuelvo a comentar lo mismo' }),
    });

    expect(status).toBe(403);
    expect(json.error).toBeTruthy();
    expect(await Review.countDocuments({ productId: 'product-a', userId: 'user-1' })).toBe(0);
  });

  test('el baneo es especifico del producto - el mismo usuario puede comentar en otro producto', async () => {
    await ReviewBan.create({ productId: 'product-a', userId: 'user-1', userName: 'Cliente Uno', bannedBy: 'admin-1' });

    const { status } = await userRequest('/', {
      method: 'POST',
      body: JSON.stringify({ productId: 'product-b', rating: 4, body: 'Comentario en otro producto' }),
    });

    expect(status).toBe(201);
  });

  test('sin baneo, el usuario puede comentar normalmente', async () => {
    const { status } = await userRequest('/', {
      method: 'POST',
      body: JSON.stringify({ productId: 'product-a', rating: 5, body: 'Buen producto' }),
    });

    expect(status).toBe(201);
  });
});
