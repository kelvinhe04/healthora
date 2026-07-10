import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Product } from '../../db/models/Product';
import { Review } from '../../db/models/Review';
import { adminReviewsRouter } from './adminReviews';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: 'healthora_admin_reviews_test' });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const adminHeaders = { 'x-test-clerk-id': 'admin-1', 'x-test-role': 'admin', 'x-test-name': 'Admin Uno' };

async function adminRequest(path: string, init: RequestInit = {}) {
  const req = new Request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...adminHeaders, ...(init.headers as Record<string, string>) },
  });
  const res = await adminReviewsRouter.fetch(req);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : undefined };
}

describe('adminReviewsRouter', () => {
  beforeEach(async () => {
    await Product.deleteMany({});
    await Review.deleteMany({});
    await Product.create({ id: 'combo-product', name: 'Combo Product', brand: 'Healthora', category: 'Vitaminas', need: 'Test', price: 10, stock: 5, active: true });

    // A review created through the current schema gets `status: 'published'` stored explicitly.
    await Review.create({ productId: 'combo-product', userId: 'user-new', userName: 'Nueva', rating: 5, body: 'Buenísimo' });

    // Simulate a review seeded/created before the `status` field existed - no `status` key at all
    // in the stored document, which is what every pre-HU-056 review actually looks like in Mongo
    // (Mongoose schema defaults don't backfill already-persisted documents).
    await mongoose.connection.collection('reviews').insertOne({
      productId: 'combo-product',
      userId: 'user-legacy',
      userName: 'Legacy',
      rating: 4,
      body: 'Reseña anterior a la migración',
      helpfulVoters: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await mongoose.connection.collection('reviews').insertOne({
      productId: 'combo-product',
      userId: 'user-hidden',
      userName: 'Oculta',
      rating: 1,
      body: 'Esta sí está oculta explícitamente',
      status: 'hidden',
      helpfulVoters: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  test('status=published includes legacy reviews that never had the status field stored', async () => {
    const { json } = await adminRequest('/?status=published');
    const names = json.items.map((r: { userName: string }) => r.userName).sort();
    expect(names).toEqual(['Legacy', 'Nueva']);
  });

  test('status=hidden only returns explicitly hidden reviews', async () => {
    const { json } = await adminRequest('/?status=hidden');
    const names = json.items.map((r: { userName: string }) => r.userName);
    expect(names).toEqual(['Oculta']);
  });

  test('no filter returns every review regardless of status', async () => {
    const { json } = await adminRequest('/');
    expect(json.total).toBe(3);
  });
});
