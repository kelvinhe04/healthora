import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { checkoutRouter } from '../routes/checkout';
import { ordersRouter } from '../routes/orders';
import { webhooksRouter } from '../routes/webhooks';
import { Product } from '../db/models/Product';
import { Order } from '../db/models/Order';
import { getLastTestStripeSession } from '../lib/stripe';

process.env.NODE_ENV = 'test';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

let mongo: MongoMemoryServer;

const address = {
  name: 'Test User',
  phone: '555-5555',
  address: '123 Test St',
  city: 'Panama',
  postal: '00000',
};

function createTestApp() {
  const app = new Hono();
  app.route('/checkout', checkoutRouter);
  app.route('/orders', ordersRouter);
  app.route('/webhooks', webhooksRouter);
  return app;
}

async function seedProduct() {
  await Product.create({
    id: 'vitamin-c-test',
    name: 'Vitamin C Test',
    brand: 'Healthora',
    category: 'Vitaminas',
    need: 'Inmunidad',
    price: 20,
    short: 'Producto test',
    stock: 10,
    active: true,
    images: [{ url: 'https://example.com/vitamin-c.png', isPrimary: true }],
  });
}

const authHeaders = {
  'content-type': 'application/json',
  origin: 'http://localhost:5173',
  'x-test-clerk-id': 'user_test_1',
  'x-test-email': 'buyer@example.com',
  'x-test-name': 'Buyer Test',
};

describe('payment integration flow', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { dbName: 'healthora_integration_test' });
  });

  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
    await seedProduct();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  test('creates a Stripe checkout session with cart and address metadata', async () => {
    const app = createTestApp();

    const response = await app.request('/checkout/session', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        items: [{ productId: 'vitamin-c-test', qty: 2 }],
        address,
        shippingMethod: 'delivery',
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: 'https://checkout.stripe.test/session' });

    const session = getLastTestStripeSession();
    expect(session?.metadata?.customerId).toBe('user_test_1');
    expect(session?.metadata?.customerEmail).toBe('buyer@example.com');
    expect(session?.metadata?.cartItems).toContain('vitamin-c-test');
    expect(session?.metadata?.address).toContain('123 Test St');
  });

  test('creates an order from a paid Stripe session when queried by session id', async () => {
    const app = createTestApp();

    await app.request('/checkout/session', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        items: [{ productId: 'vitamin-c-test', qty: 1 }],
        address,
        shippingMethod: 'delivery',
      }),
    });

    const response = await app.request('/orders?stripeSessionId=cs_test_healthora', {
      headers: authHeaders,
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.paymentStatus).toBe('paid');
    expect(body.items[0].productId).toBe('vitamin-c-test');

    const orderCount = await Order.countDocuments();
    const product = await Product.findOne({ id: 'vitamin-c-test' }).lean();
    expect(orderCount).toBe(1);
    expect(product?.stock).toBe(9);
  });

  test('processes checkout.session.completed webhook and persists the paid order', async () => {
    const app = createTestApp();
    const metadata = {
      customerId: 'user_test_1',
      customerName: 'Buyer Test',
      customerEmail: 'buyer@example.com',
      cartItems: JSON.stringify([{ productId: 'vitamin-c-test', qty: 2 }]),
      address: JSON.stringify(address),
      discountCode: '',
      discountAmount: '0',
      tax: '2.8',
      shipping: '6.9',
    };

    const response = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: {
        'stripe-signature': 'test-signature',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_webhook_test',
            metadata,
            customer_email: 'buyer@example.com',
            payment_intent: 'pi_webhook_test',
          },
        },
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });

    const order = await Order.findOne({ stripeSessionId: 'cs_webhook_test' }).lean();
    const product = await Product.findOne({ id: 'vitamin-c-test' }).lean();
    expect(order?.paymentStatus).toBe('paid');
    expect(order?.items[0].qty).toBe(2);
    expect(order?.total).toBe(49.7);
    expect(product?.stock).toBe(8);
  });
});
