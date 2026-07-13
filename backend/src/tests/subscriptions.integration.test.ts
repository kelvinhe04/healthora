import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { subscriptionsRouter } from '../routes/subscriptions';
import { webhooksRouter } from '../routes/webhooks';
import { Product } from '../db/models/Product';
import { Order } from '../db/models/Order';
import { ProductSubscription } from '../db/models/ProductSubscription';
import { getLastTestStripeSession, getTestSubscription, resetTestStripeState } from '../lib/stripe';

process.env.NODE_ENV = 'test';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

let mongo: MongoMemoryServer;

function createTestApp() {
  const app = new Hono();
  app.route('/subscriptions', subscriptionsRouter);
  app.route('/webhooks', webhooksRouter);
  return app;
}

async function seedProduct() {
  await Product.create({
    id: 'vitamin-c-sub-test',
    name: 'Vitamin C Test',
    brand: 'Healthora',
    category: 'Vitaminas',
    need: 'Inmunidad',
    price: 20,
    short: 'Producto test',
    stock: 50,
    active: true,
    images: [{ url: 'https://example.com/vitamin-c.png', isPrimary: true }],
  });
}

const address = {
  name: 'Test User',
  phone: '555-5555',
  address: '123 Test St',
  city: 'Panama',
  postal: '00000',
};

const authHeaders = {
  'content-type': 'application/json',
  origin: 'http://localhost:5173',
  'x-test-clerk-id': 'user_test_1',
  'x-test-email': 'buyer@example.com',
  'x-test-name': 'Buyer Test',
};

const otherAuthHeaders = {
  'content-type': 'application/json',
  origin: 'http://localhost:5173',
  'x-test-clerk-id': 'user_test_2',
  'x-test-email': 'other@example.com',
  'x-test-name': 'Other Buyer',
};

async function subscribe(app: Hono, headers: Record<string, string> = authHeaders) {
  const response = await app.request('/subscriptions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      productId: 'vitamin-c-sub-test',
      qty: 2,
      intervalDays: 30,
      address,
      shippingMethod: 'delivery',
    }),
  });
  return response;
}

async function completeSubscriptionCheckout(app: Hono) {
  const session = getLastTestStripeSession();
  const webhookResponse = await app.request('/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': 'test-signature', 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'checkout.session.completed',
      data: { object: session },
    }),
  });
  expect(webhookResponse.status).toBe(200);
  return session;
}

describe('product subscriptions (HU-101)', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { dbName: 'healthora_subscriptions_test' });
  });

  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
    resetTestStripeState();
    await seedProduct();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  test('POST /subscriptions creates a Stripe subscription checkout session with full metadata', async () => {
    const app = createTestApp();
    const response = await subscribe(app);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: 'https://checkout.stripe.test/session' });

    const session = getLastTestStripeSession();
    expect(session?.mode).toBe('subscription');
    expect(session?.metadata?.customerId).toBe('user_test_1');
    expect(session?.metadata?.productId).toBe('vitamin-c-sub-test');
    expect(session?.metadata?.qty).toBe('2');
    expect(session?.metadata?.intervalDays).toBe('30');
    // subtotal 2*20=40, tax 7% = 2.8, delivery under $50 => $6.90 shipping
    expect(session?.metadata?.subtotal).toBe('40');
    expect(session?.metadata?.tax).toBe('2.8');
    expect(session?.metadata?.shipping).toBe('6.9');
    expect(session?.metadata?.total).toBe('49.7');
  });

  test('rejects an interval that is not one of 7/15/30/60 days', async () => {
    const app = createTestApp();
    const response = await app.request('/subscriptions', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        productId: 'vitamin-c-sub-test',
        qty: 1,
        intervalDays: 10,
        address,
        shippingMethod: 'delivery',
      }),
    });
    expect(response.status).toBe(400);
  });

  test('checkout.session.completed (subscription) creates the subscription and its first order', async () => {
    const app = createTestApp();
    await subscribe(app);
    await completeSubscriptionCheckout(app);

    const sub = await ProductSubscription.findOne({ customerId: 'user_test_1' }).lean();
    expect(sub).toBeTruthy();
    expect(sub?.status).toBe('active');
    expect(sub?.intervalDays).toBe(30);
    expect(sub?.total).toBe(49.7);

    const orders = await Order.find({ customerId: 'user_test_1' }).lean();
    expect(orders).toHaveLength(1);
    expect(orders[0].subscriptionId?.toString()).toBe(sub?._id.toString());
    expect(orders[0].paymentStatus).toBe('paid');
    expect(orders[0].total).toBe(49.7);

    const product = await Product.findOne({ id: 'vitamin-c-sub-test' }).lean();
    expect(product?.stock).toBe(48);
  });

  test('is idempotent: replaying the same checkout.session.completed does not duplicate the subscription or order', async () => {
    const app = createTestApp();
    await subscribe(app);
    const session = await completeSubscriptionCheckout(app);

    await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'test-signature', 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'checkout.session.completed', data: { object: session } }),
    });

    expect(await ProductSubscription.countDocuments({})).toBe(1);
    expect(await Order.countDocuments({})).toBe(1);
  });

  test('invoice.payment_succeeded with billing_reason=subscription_cycle creates a renewal order', async () => {
    const app = createTestApp();
    await subscribe(app);
    const session = await completeSubscriptionCheckout(app);

    const renewalWebhook = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'test-signature', 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            subscription: session?.subscription,
            billing_reason: 'subscription_cycle',
            period_end: 1893456000, // 2030-01-01
          },
        },
      }),
    });
    expect(renewalWebhook.status).toBe(200);

    const orders = await Order.find({ customerId: 'user_test_1' }).sort({ createdAt: 1 }).lean();
    expect(orders).toHaveLength(2);

    const sub = await ProductSubscription.findOne({ customerId: 'user_test_1' }).lean();
    expect(sub?.nextBillingDate?.toISOString().slice(0, 10)).toBe('2030-01-01');

    const product = await Product.findOne({ id: 'vitamin-c-sub-test' }).lean();
    expect(product?.stock).toBe(46); // 50 - 2 (first order) - 2 (renewal)
  });

  test('invoice.payment_succeeded with billing_reason=subscription_create is ignored (first order already made)', async () => {
    const app = createTestApp();
    await subscribe(app);
    const session = await completeSubscriptionCheckout(app);

    await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'test-signature', 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'invoice.payment_succeeded',
        data: { object: { subscription: session?.subscription, billing_reason: 'subscription_create' } },
      }),
    });

    expect(await Order.countDocuments({})).toBe(1);
  });

  test('customer.subscription.deleted marks the local subscription canceled', async () => {
    const app = createTestApp();
    await subscribe(app);
    const session = await completeSubscriptionCheckout(app);

    await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'test-signature', 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'customer.subscription.deleted',
        data: { object: { id: session?.subscription } },
      }),
    });

    const sub = await ProductSubscription.findOne({ customerId: 'user_test_1' }).lean();
    expect(sub?.status).toBe('canceled');
  });

  test('POST /:id/pause pauses in Stripe and locally, only for the owning customer', async () => {
    const app = createTestApp();
    await subscribe(app);
    const session = await completeSubscriptionCheckout(app);
    const sub = await ProductSubscription.findOne({ customerId: 'user_test_1' }).lean();

    const otherAttempt = await app.request(`/subscriptions/${sub?._id}/pause`, {
      method: 'POST',
      headers: otherAuthHeaders,
    });
    expect(otherAttempt.status).toBe(404);

    const pauseResponse = await app.request(`/subscriptions/${sub?._id}/pause`, {
      method: 'POST',
      headers: authHeaders,
    });
    expect(pauseResponse.status).toBe(200);
    expect((await pauseResponse.json()).status).toBe('paused');

    const stripeSub = getTestSubscription(session?.subscription as string);
    expect(stripeSub?.pause_collection).toEqual({ behavior: 'void' });
  });

  test('POST /:id/resume clears the Stripe pause and reactivates locally', async () => {
    const app = createTestApp();
    await subscribe(app);
    const session = await completeSubscriptionCheckout(app);
    const sub = await ProductSubscription.findOne({ customerId: 'user_test_1' }).lean();

    await app.request(`/subscriptions/${sub?._id}/pause`, { method: 'POST', headers: authHeaders });
    const resumeResponse = await app.request(`/subscriptions/${sub?._id}/resume`, {
      method: 'POST',
      headers: authHeaders,
    });
    expect(resumeResponse.status).toBe(200);
    expect((await resumeResponse.json()).status).toBe('active');

    const stripeSub = getTestSubscription(session?.subscription as string);
    expect(stripeSub?.pause_collection).toBeNull();
  });

  test('DELETE /:id cancels in Stripe and locally, only for the owning customer', async () => {
    const app = createTestApp();
    await subscribe(app);
    const session = await completeSubscriptionCheckout(app);
    const sub = await ProductSubscription.findOne({ customerId: 'user_test_1' }).lean();

    const otherAttempt = await app.request(`/subscriptions/${sub?._id}`, {
      method: 'DELETE',
      headers: otherAuthHeaders,
    });
    expect(otherAttempt.status).toBe(404);

    const cancelResponse = await app.request(`/subscriptions/${sub?._id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    expect(cancelResponse.status).toBe(200);
    expect((await cancelResponse.json()).status).toBe('canceled');

    const stripeSub = getTestSubscription(session?.subscription as string);
    expect(stripeSub?.status).toBe('canceled');
  });

  test('GET /subscriptions only returns the requesting customer\'s subscriptions', async () => {
    const app = createTestApp();
    await subscribe(app, authHeaders);
    await completeSubscriptionCheckout(app);
    await subscribe(app, otherAuthHeaders);
    await completeSubscriptionCheckout(app);

    const response = await app.request('/subscriptions', { headers: authHeaders });
    const list = await response.json();
    expect(list).toHaveLength(1);
    expect(list[0].customerId).toBe('user_test_1');
  });
});
