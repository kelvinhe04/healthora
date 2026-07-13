import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { accountRouter } from './account';
import { User } from '../db/models/User';
import { resetTestStripeState, seedTestPaymentMethod } from '../lib/stripe';

process.env.NODE_ENV = 'test';

let mongo: MongoMemoryServer;

function createTestApp() {
  const app = new Hono();
  app.route('/account', accountRouter);
  return app;
}

const authHeaders = {
  'content-type': 'application/json',
  'x-test-clerk-id': 'user_test_1',
  'x-test-email': 'buyer@example.com',
  'x-test-name': 'Buyer Test',
};

const otherAuthHeaders = {
  'content-type': 'application/json',
  'x-test-clerk-id': 'user_test_2',
  'x-test-email': 'other@example.com',
  'x-test-name': 'Other Buyer',
};

describe('account payment methods', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { dbName: 'healthora_account_test' });
  });

  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
    resetTestStripeState();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  test('GET /payment-methods returns an empty list when the user has no Stripe customer yet', async () => {
    const app = createTestApp();
    const response = await app.request('/account/payment-methods', { headers: authHeaders });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  test('POST /payment-methods/setup-intent creates (and persists) a Stripe customer for the user', async () => {
    const app = createTestApp();
    const response = await app.request('/account/payment-methods/setup-intent', {
      method: 'POST',
      headers: authHeaders,
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { clientSecret: string };
    expect(body.clientSecret).toBeTruthy();

    const user = await User.findOne({ clerkId: 'user_test_1' }).lean();
    expect(user?.stripeCustomerId).toBeTruthy();
  });

  test('setup-intent reuses the same Stripe customer on a second call instead of creating a new one', async () => {
    const app = createTestApp();
    await app.request('/account/payment-methods/setup-intent', { method: 'POST', headers: authHeaders });
    const firstUser = await User.findOne({ clerkId: 'user_test_1' }).lean();

    await app.request('/account/payment-methods/setup-intent', { method: 'POST', headers: authHeaders });
    const secondUser = await User.findOne({ clerkId: 'user_test_1' }).lean();

    expect(secondUser?.stripeCustomerId).toBe(firstUser?.stripeCustomerId as string);
  });

  test('GET /payment-methods lists saved cards for the user\'s Stripe customer', async () => {
    const app = createTestApp();
    await app.request('/account/payment-methods/setup-intent', { method: 'POST', headers: authHeaders });
    const user = await User.findOne({ clerkId: 'user_test_1' }).lean();
    seedTestPaymentMethod(user!.stripeCustomerId as string, {
      id: 'pm_visa_test',
      brand: 'visa',
      last4: '4242',
      expMonth: 12,
      expYear: 2030,
    });

    const response = await app.request('/account/payment-methods', { headers: authHeaders });
    const body = await response.json();
    expect(body).toEqual([{ id: 'pm_visa_test', brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030 }]);
  });

  test('DELETE /payment-methods/:id detaches a card owned by the requesting user', async () => {
    const app = createTestApp();
    await app.request('/account/payment-methods/setup-intent', { method: 'POST', headers: authHeaders });
    const user = await User.findOne({ clerkId: 'user_test_1' }).lean();
    seedTestPaymentMethod(user!.stripeCustomerId as string, {
      id: 'pm_visa_test',
      brand: 'visa',
      last4: '4242',
      expMonth: 12,
      expYear: 2030,
    });

    const del = await app.request('/account/payment-methods/pm_visa_test', {
      method: 'DELETE',
      headers: authHeaders,
    });
    expect(del.status).toBe(200);

    const list = await app.request('/account/payment-methods', { headers: authHeaders });
    expect(await list.json()).toEqual([]);
  });

  test('DELETE /payment-methods/:id refuses to detach a card that belongs to a different customer', async () => {
    const app = createTestApp();
    await app.request('/account/payment-methods/setup-intent', { method: 'POST', headers: authHeaders });
    const owner = await User.findOne({ clerkId: 'user_test_1' }).lean();
    seedTestPaymentMethod(owner!.stripeCustomerId as string, {
      id: 'pm_visa_test',
      brand: 'visa',
      last4: '4242',
      expMonth: 12,
      expYear: 2030,
    });

    // A second, different authenticated user tries to detach the first user's card by id.
    await app.request('/account/payment-methods/setup-intent', { method: 'POST', headers: otherAuthHeaders });
    const del = await app.request('/account/payment-methods/pm_visa_test', {
      method: 'DELETE',
      headers: otherAuthHeaders,
    });
    expect(del.status).toBe(404);

    const list = await app.request('/account/payment-methods', { headers: authHeaders });
    expect(await list.json()).toEqual([{ id: 'pm_visa_test', brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030 }]);
  });
});
