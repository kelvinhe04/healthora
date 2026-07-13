import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Product } from '../db/models/Product';
import { Order } from '../db/models/Order';
import { Review } from '../db/models/Review';
import { SecurityAuditLog } from '../db/models/SecurityAuditLog';
import { seedCoupons } from '../db/seed-coupons';

let mongo: MongoMemoryServer;
let handleMcpRequest: (typeof import('./server'))['handleMcpRequest'];

async function seedProduct() {
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
      { id: 'vanilla', label: 'Vainilla', type: 'flavor', price: 0, stock: 20 },
      { id: '5lb', label: '5lb', type: 'size', price: 5, stock: 10 },
    ],
  });
}

async function rpc(body: Record<string, unknown>) {
  const req = new Request('http://localhost/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify(body),
  });
  const res = await handleMcpRequest(req);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : undefined };
}

describe('MCP server', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { dbName: 'healthora_mcp_test' });
    ({ handleMcpRequest } = await import('./server'));
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await Product.deleteMany({});
    await Order.deleteMany({});
    await Review.deleteMany({});
    // SecurityAuditLog blocks deleteMany at the schema level (append-only, HU-051) - go through
    // the native collection to clean up between tests instead.
    await SecurityAuditLog.collection.deleteMany({});
    await seedProduct();
    await seedCoupons();
  });

  test('initialize negotiates the protocol', async () => {
    const { status, json } = await rpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } },
    });
    expect(status).toBe(200);
    expect(json.result.serverInfo.name).toBe('healthora');
  });

  test('tools/list exposes all 19 registered tools', async () => {
    const { json } = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const names = json.result.tools.map((t: { name: string }) => t.name).sort();
    expect(names).toEqual(
      [
        'analytics.getSalesReport',
        'analytics.getCohortReport',
        'audit.getAdminActions',
        'catalog.listProducts',
        'catalog.upsertProduct',
        'categories.upsertCategory',
        'inventory.adjustStock',
        'notifications.broadcast',
        'orders.getOrderItems',
        'orders.listUserOrders',
        'orders.updateOrderStatus',
        'promotions.validateCoupon',
        'recommendations.getRelatedProducts',
        'reviews.listReviews',
        'reviews.moderateReview',
        'users.updateUserRole',
        'variants.upsertVariant',
        'variants.updateVariantStock',
        'variants.uploadVariantImage',
      ].sort(),
    );
  });

  test('catalog.listProducts returns the seeded product', async () => {
    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'catalog.listProducts', arguments: { category: 'Vitaminas' } },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.count).toBe(1);
    expect(payload.products[0].id).toBe('combo-product');
    expect(payload.products[0].combinations).toBe(2);
  });

  test('audit.getAdminActions filters the append-only trail by actor email and action', async () => {
    await SecurityAuditLog.create({
      actorEmail: 'admin@healthora.test',
      action: 'products.update',
      resource: 'PUT /admin/products/combo-product',
      metadata: { targetId: 'combo-product' },
    });
    await SecurityAuditLog.create({
      actorEmail: 'other@healthora.test',
      action: 'categories.delete',
      resource: 'DELETE /admin/categories/vitaminas',
    });

    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 100,
      method: 'tools/call',
      params: { name: 'audit.getAdminActions', arguments: { actorEmail: 'admin@healthora.test' } },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.total).toBe(1);
    expect(payload.items[0].action).toBe('products.update');
  });

  test('inventory.adjustStock without delta is read-only and reflects stockBySize override', async () => {
    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'inventory.adjustStock', arguments: { productId: 'combo-product', variantId: 'chocolate:5lb' } },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.stock).toBe(3);

    const product = await Product.findOne({ id: 'combo-product' }).lean();
    expect(product?.variants.find((v) => v.id === 'chocolate')?.stockBySize?.['5lb']).toBe(3);
  });

  test('inventory.adjustStock falls back to the tamaño stock when the combo has no stockBySize override', async () => {
    // vanilla has no stockBySize override for 5lb - reading `?? 0` without checking the size's
    // own stock would wrongly report 0 for every un-overridden combo (real bug, see PR history).
    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 41,
      method: 'tools/call',
      params: { name: 'inventory.adjustStock', arguments: { productId: 'combo-product', variantId: 'vanilla:5lb' } },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.stock).toBe(10);
  });

  test('variants.updateVariantStock sets an absolute value on a combo', async () => {
    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'variants.updateVariantStock', arguments: { productId: 'combo-product', variantId: 'vanilla:5lb', stock: 42 } },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.stock).toBe(42);

    const product = await Product.findOne({ id: 'combo-product' }).lean();
    expect(product?.variants.find((v) => v.id === 'vanilla')?.stockBySize?.['5lb']).toBe(42);
  });

  test('reviews.moderateReview hides a review and excludes it from the product rating', async () => {
    const review = await Review.create({
      productId: 'combo-product',
      userId: 'user-1',
      userName: 'Cliente',
      rating: 1,
      body: 'Malo',
    });

    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: { name: 'reviews.moderateReview', arguments: { reviewId: String(review._id), action: 'hide' } },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.status).toBe('hidden');

    const product = await Product.findOne({ id: 'combo-product' }).lean();
    expect(product?.reviews).toBe(0);
  });

  test('reviews.moderateReview deletes a review and recomputes the product rating', async () => {
    const review = await Review.create({
      productId: 'combo-product',
      userId: 'user-1',
      userName: 'Cliente',
      rating: 5,
      body: 'Excelente',
    });

    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: { name: 'reviews.moderateReview', arguments: { reviewId: String(review._id), action: 'delete' } },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.deleted).toBe(true);
    expect(await Review.findById(review._id)).toBeNull();
  });

  test('reviews.moderateReview returns an error result for an unknown reviewId', async () => {
    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/call',
      params: { name: 'reviews.moderateReview', arguments: { reviewId: '507f1f77bcf86cd799439011', action: 'approve' } },
    });
    expect(json.result?.isError).toBeTruthy();
  });

  test('unknown tool name returns an error result, not a crash', async () => {
    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'not.a.real.tool', arguments: {} },
    });
    expect(json.error || json.result?.isError).toBeTruthy();
  });
});
