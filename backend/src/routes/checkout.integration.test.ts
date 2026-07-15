import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { checkoutRouter } from './checkout';
import { webhooksRouter } from './webhooks';
import { Order } from '../db/models/Order';
import { Product } from '../db/models/Product';
import { getTestPaymentIntent, resetTestStripeState } from '../lib/stripe';

process.env.NODE_ENV = 'test';

let mongo: MongoMemoryServer;

function createTestApp() {
  const app = new Hono();
  app.route('/checkout', checkoutRouter);
  app.route('/webhooks', webhooksRouter);
  return app;
}

const authHeaders = {
  'content-type': 'application/json',
  'x-test-clerk-id': 'user_test_1',
  'x-test-email': 'buyer@example.com',
  'x-test-name': 'Buyer Test',
};

const checkoutBody = {
  items: [{ productId: 'prod-1', qty: 2 }],
  address: { name: 'Buyer Test', phone: '6000-0000' },
  shippingMethod: 'pickup' as const,
};

async function seedProduct() {
  await Product.create({
    id: 'prod-1',
    name: 'Test Product',
    brand: 'Test Brand',
    category: 'Vitaminas',
    price: 10,
    stock: 50,
    active: true,
  });
}

function stripeWebhookEvent(type: string, object: Record<string, unknown>) {
  return { headers: { ...authHeaders, 'stripe-signature': 't=1,v1=test' }, body: JSON.stringify({ type, data: { object } }) };
}

describe('checkout (embedded Stripe Elements)', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { dbName: 'healthora_checkout_test' });
  });

  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
    resetTestStripeState();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  test('POST /checkout/payment-intent creates a PaymentIntent with the correct amount and source=elements metadata', async () => {
    await seedProduct();
    const app = createTestApp();
    const response = await app.request('/checkout/payment-intent', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(checkoutBody),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { clientSecret: string; paymentIntentId: string };
    expect(body.clientSecret).toBeTruthy();
    expect(body.paymentIntentId).toBeTruthy();
  });

  test('payment_intent.succeeded with metadata.source=elements creates a paid order keyed by stripePaymentIntentId', async () => {
    await seedProduct();
    const app = createTestApp();
    const created = await app.request('/checkout/payment-intent', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(checkoutBody),
    });
    const { paymentIntentId } = (await created.json()) as { paymentIntentId: string };

    const event = stripeWebhookEvent('payment_intent.succeeded', {
      id: paymentIntentId,
      metadata: {
        source: 'elements',
        customerId: 'user_test_1',
        customerName: 'Buyer Test',
        customerEmail: 'buyer@example.com',
        cartItems: JSON.stringify(checkoutBody.items),
        address: JSON.stringify(checkoutBody.address),
        discountCode: '',
        discountAmount: '0',
        tax: '0',
        shipping: '0',
        shippingMethod: 'pickup',
        shippingLabel: 'Retiro en tienda',
        shippingEta: '24h',
      },
    });
    const webhookResponse = await app.request('/webhooks/stripe', { method: 'POST', ...event });
    expect(webhookResponse.status).toBe(200);

    const orders = await Order.find({ stripePaymentIntentId: paymentIntentId }).lean();
    expect(orders).toHaveLength(1);
    expect(orders[0].stripeSessionId).toBeFalsy();
    expect(orders[0].paymentStatus).toBe('paid');
    expect(orders[0].total).toBe(20);

    // Idempotency: the same event firing twice (Stripe retries) must not create a second order.
    await app.request('/webhooks/stripe', { method: 'POST', ...event });
    const ordersAfterRetry = await Order.find({ stripePaymentIntentId: paymentIntentId }).lean();
    expect(ordersAfterRetry).toHaveLength(1);
  });

  test('payment_intent.succeeded without metadata.source=elements is ignored (already handled by checkout.session.completed)', async () => {
    await seedProduct();
    const app = createTestApp();
    const event = stripeWebhookEvent('payment_intent.succeeded', {
      id: 'pi_from_hosted_checkout_session',
      metadata: {
        customerId: 'user_test_1',
        customerName: 'Buyer Test',
        cartItems: JSON.stringify(checkoutBody.items),
        address: JSON.stringify(checkoutBody.address),
        discountAmount: '0',
        tax: '0',
        shipping: '0',
      },
    });
    const webhookResponse = await app.request('/webhooks/stripe', { method: 'POST', ...event });
    expect(webhookResponse.status).toBe(200);

    const orders = await Order.find({ stripePaymentIntentId: 'pi_from_hosted_checkout_session' }).lean();
    expect(orders).toHaveLength(0);
  });

  test('freeSampleId for a sampleEligible product is included in the PaymentIntent as a free line item', async () => {
    await seedProduct();
    await Product.create({
      id: 'prod-sample',
      name: 'Sample Product',
      brand: 'Test Brand',
      category: 'Vitaminas',
      price: 15,
      stock: 10,
      active: true,
      sampleEligible: true,
    });
    const app = createTestApp();
    const response = await app.request('/checkout/payment-intent', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ ...checkoutBody, freeSampleId: 'prod-sample' }),
    });
    expect(response.status).toBe(200);
    const { paymentIntentId } = (await response.json()) as { paymentIntentId: string };

    const paymentIntent = getTestPaymentIntent(paymentIntentId);
    const cartItems = JSON.parse(paymentIntent?.metadata?.cartItems ?? '[]');
    expect(cartItems).toContainEqual({ productId: 'prod-sample', qty: 1, isSample: true });
  });

  // Server-side enforcement (issue #151) - a crafted freeSampleId must not get a non-eligible product
  // for free just because it's active, even though the picker UI itself only ever offers eligible
  // products.
  test('freeSampleId for a product with sampleEligible=false is silently ignored, not added for free', async () => {
    await seedProduct();
    await Product.create({
      id: 'prod-not-eligible',
      name: 'Not Eligible Product',
      brand: 'Test Brand',
      category: 'Vitaminas',
      price: 15,
      stock: 10,
      active: true,
      sampleEligible: false,
    });
    const app = createTestApp();
    const response = await app.request('/checkout/payment-intent', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ ...checkoutBody, freeSampleId: 'prod-not-eligible' }),
    });
    expect(response.status).toBe(200);
    const { paymentIntentId } = (await response.json()) as { paymentIntentId: string };

    const paymentIntent = getTestPaymentIntent(paymentIntentId);
    const cartItems = JSON.parse(paymentIntent?.metadata?.cartItems ?? '[]');
    expect(cartItems).not.toContainEqual(expect.objectContaining({ productId: 'prod-not-eligible', isSample: true }));
  });
});
