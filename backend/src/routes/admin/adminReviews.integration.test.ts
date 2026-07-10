import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Product } from '../../db/models/Product';
import { Review } from '../../db/models/Review';
import { ReviewBan } from '../../db/models/ReviewBan';
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
    await Product.create({ id: 'other-product', name: 'Vitamina D3', brand: 'Healthora', category: 'Vitaminas', need: 'Test', price: 8, stock: 5, active: true });

    // A review created through the current schema gets `status: 'published'` stored explicitly.
    await Review.create({ productId: 'combo-product', userId: 'user-new', userName: 'Nueva', rating: 5, body: 'Buenísimo' });
    await Review.create({ productId: 'other-product', userId: 'user-other', userName: 'Otra Persona', rating: 3, body: 'Regular nomás' });

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
    expect(names).toEqual(['Legacy', 'Nueva', 'Otra Persona']);
  });

  test('status=hidden only returns explicitly hidden reviews', async () => {
    const { json } = await adminRequest('/?status=hidden');
    const names = json.items.map((r: { userName: string }) => r.userName);
    expect(names).toEqual(['Oculta']);
  });

  test('no filter returns every review regardless of status', async () => {
    const { json } = await adminRequest('/');
    expect(json.total).toBe(4);
  });

  test('rating filters to an exact star count', async () => {
    const { json } = await adminRequest('/?rating=5');
    const names = json.items.map((r: { userName: string }) => r.userName);
    expect(names).toEqual(['Nueva']);
  });

  test('search matches review text and product name', async () => {
    const byBody = await adminRequest('/?search=Buenísimo');
    expect(byBody.json.items.map((r: { userName: string }) => r.userName)).toEqual(['Nueva']);

    const byProductName = await adminRequest('/?search=Vitamina');
    expect(byProductName.json.items.map((r: { userName: string }) => r.userName)).toEqual(['Otra Persona']);

    const byUserName = await adminRequest('/?search=Legacy');
    expect(byUserName.json.items.map((r: { userName: string }) => r.userName)).toEqual(['Legacy']);

    const noMatch = await adminRequest('/?search=zzz-nomatch');
    expect(noMatch.json.items).toEqual([]);
  });
});

describe('adminReviewsRouter — banear autor por producto', () => {
  beforeEach(async () => {
    await Product.deleteMany({});
    await Review.deleteMany({});
    await ReviewBan.deleteMany({});
    await Product.create({ id: 'combo-product', name: 'Combo Product', brand: 'Healthora', category: 'Vitaminas', need: 'Test', price: 10, stock: 5, active: true });
  });

  test('POST /:id/ban elimina la reseña y crea el baneo para ese producto', async () => {
    const review = await Review.create({ productId: 'combo-product', userId: 'user-spam', userName: 'Spammer', rating: 1, body: 'Contenido inapropiado' });

    const { status, json } = await adminRequest(`/${review._id}/ban`, { method: 'POST' });

    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(await Review.findById(review._id)).toBeNull();

    const ban = await ReviewBan.findOne({ productId: 'combo-product', userId: 'user-spam' }).lean();
    expect(ban).not.toBeNull();
    expect(ban?.bannedBy).toBe('admin-1');
  });

  test('POST /:id/ban con un id inexistente devuelve 404', async () => {
    const { status } = await adminRequest('/64b000000000000000000000/ban', { method: 'POST' });
    expect(status).toBe(404);
  });

  test('GET /bans lista los baneos activos con el nombre del producto', async () => {
    await ReviewBan.create({ productId: 'combo-product', userId: 'user-spam', userName: 'Spammer', bannedBy: 'admin-1' });

    const { status, json } = await adminRequest('/bans');

    expect(status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0].productName).toBe('Combo Product');
    expect(json[0].userName).toBe('Spammer');
  });

  test('DELETE /bans/:id quita el baneo', async () => {
    const ban = await ReviewBan.create({ productId: 'combo-product', userId: 'user-spam', userName: 'Spammer', bannedBy: 'admin-1' });

    const { status, json } = await adminRequest(`/bans/${ban._id}`, { method: 'DELETE' });

    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(await ReviewBan.findById(ban._id)).toBeNull();
  });

  test('DELETE /bans/:id con un id inexistente devuelve 404', async () => {
    const { status } = await adminRequest('/bans/64b000000000000000000000', { method: 'DELETE' });
    expect(status).toBe(404);
  });
});
