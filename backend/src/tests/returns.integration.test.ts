import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { returnsRouter } from '../routes/returns';
import { adminReturnsRouter } from '../routes/admin/adminReturns';
import { Order } from '../db/models/Order';
import { Return } from '../db/models/Return';
import { Product } from '../db/models/Product';

process.env.NODE_ENV = 'test';

let mongo: MongoMemoryServer;

function createTestApp() {
  const app = new Hono();
  app.route('/returns', returnsRouter);
  app.route('/admin/returns', adminReturnsRouter);
  return app;
}

const customerHeaders = {
  'content-type': 'application/json',
  'x-test-clerk-id': 'user_test_1',
  'x-test-email': 'buyer@example.com',
  'x-test-name': 'Buyer Test',
};

const adminHeaders = {
  'content-type': 'application/json',
  'x-test-clerk-id': 'admin_test_1',
  'x-test-email': 'admin@example.com',
  'x-test-name': 'Admin Test',
  'x-test-role': 'admin',
};

async function seedProduct(overrides: Partial<Record<string, unknown>> = {}) {
  return Product.create({
    id: 'vitamin-c-test',
    name: 'Vitamin C Test',
    brand: 'Healthora',
    category: 'Vitaminas',
    need: 'Inmunidad',
    price: 20,
    short: 'Producto test',
    stock: 10,
    active: true,
    ...overrides,
  });
}

async function seedPaidOrder(overrides: Partial<Record<string, unknown>> = {}) {
  return Order.create({
    customerId: 'user_test_1',
    customerName: 'Buyer Test',
    customerEmail: 'buyer@example.com',
    items: [{ productId: 'vitamin-c-test', productName: 'Vitamin C Test', qty: 2, price: 20 }],
    subtotal: 40,
    tax: 2.8,
    shipping: 0,
    total: 42.8,
    paymentStatus: 'paid',
    fulfillmentStatus: 'delivered',
    status: 'paid',
    stripeSessionId: 'cs_returns_test',
    stripePaymentIntentId: 'pi_returns_test',
    ...overrides,
  });
}

describe('returns flow', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { dbName: 'healthora_returns_test' });
  });

  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  test('customer requests a return within the window and admin approves + refunds it', async () => {
    const app = createTestApp();
    const order = await seedPaidOrder();

    const createResponse = await app.request('/returns', {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({
        orderId: order._id.toString(),
        reason: 'Llegó dañado',
        items: [{ productId: 'vitamin-c-test', qty: 1 }],
      }),
    });

    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    expect(created.status).toBe('requested');
    expect(created.refundAmount).toBe(20);
    expect(created.returnMethod).toBe('courier_pickup');
    expect(created.desiredResolution).toBe('refund');

    const listResponse = await app.request('/admin/returns', { headers: adminHeaders });
    expect(listResponse.status).toBe(200);
    const list = await listResponse.json();
    expect(list).toHaveLength(1);

    const approveResponse = await app.request(`/admin/returns/${created._id}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'refunded' }),
    });
    expect(approveResponse.status).toBe(200);
    const approved = await approveResponse.json();
    expect(approved.status).toBe('refunded');
    expect(approved.stripeRefundId).toBe('refund_test_healthora');

    const updatedOrder = await Order.findById(order._id).lean();
    expect(updatedOrder?.paymentStatus).toBe('refunded');
  });

  test('wrong item: admin resolves as replaced instead of refunded, shipping a no-charge replacement order', async () => {
    const app = createTestApp();
    await seedProduct();
    const order = await seedPaidOrder();

    const createResponse = await app.request('/returns', {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({
        orderId: order._id.toString(),
        reason: 'Llegó un producto distinto al que pedí',
        items: [{ productId: 'vitamin-c-test', qty: 1 }],
        desiredResolution: 'replacement',
      }),
    });
    const created = await createResponse.json();
    expect(created.desiredResolution).toBe('replacement');

    const replaceResponse = await app.request(`/admin/returns/${created._id}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'replaced' }),
    });
    expect(replaceResponse.status).toBe(200);
    const replaced = await replaceResponse.json();
    expect(replaced.status).toBe('replaced');
    expect(replaced.replacementOrderId).toBeTruthy();

    // Original order is untouched - this isn't a refund, so paymentStatus stays 'paid'.
    const originalOrder = await Order.findById(order._id).lean();
    expect(originalOrder?.paymentStatus).toBe('paid');

    const replacementOrder = await Order.findById(replaced.replacementOrderId).lean();
    expect(replacementOrder?.total).toBe(0);
    expect(replacementOrder?.paymentStatus).toBe('paid');
    expect(replacementOrder?.fulfillmentStatus).toBe('unfulfilled');
    expect(replacementOrder?.replacesOrderId?.toString()).toBe(order._id.toString());
    expect(replacementOrder?.items).toHaveLength(1);
    expect(replacementOrder?.items[0].productId).toBe('vitamin-c-test');
    expect(replacementOrder?.items[0].qty).toBe(1);

    const product = await Product.findOne({ id: 'vitamin-c-test' }).lean();
    expect(product?.stock).toBe(9);
  });

  test('derives store_dropoff returnMethod for a pickup order (no courier on the way out either)', async () => {
    const app = createTestApp();
    const order = await seedPaidOrder({ shippingMethod: 'pickup' });

    const createResponse = await app.request('/returns', {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({
        orderId: order._id.toString(),
        reason: 'No era lo que esperaba',
        items: [{ productId: 'vitamin-c-test', qty: 1 }],
      }),
    });

    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    expect(created.returnMethod).toBe('store_dropoff');
  });

  test('rejects a return request outside the return window', async () => {
    const app = createTestApp();
    const order = await seedPaidOrder({ createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) });
    await Order.updateOne({ _id: order._id }, { createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) });

    const response = await app.request('/returns', {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({
        orderId: order._id.toString(),
        reason: 'Cambié de opinión',
        items: [{ productId: 'vitamin-c-test', qty: 1 }],
      }),
    });

    expect(response.status).toBe(400);
    expect((await Return.countDocuments())).toBe(0);
  });

  test('rejects a duplicate return request for the same order', async () => {
    const app = createTestApp();
    const order = await seedPaidOrder();

    await app.request('/returns', {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({
        orderId: order._id.toString(),
        reason: 'Primera solicitud',
        items: [{ productId: 'vitamin-c-test', qty: 1 }],
      }),
    });

    const secondResponse = await app.request('/returns', {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({
        orderId: order._id.toString(),
        reason: 'Segunda solicitud',
        items: [{ productId: 'vitamin-c-test', qty: 1 }],
      }),
    });

    expect(secondResponse.status).toBe(409);
  });
});
