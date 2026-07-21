import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Product } from '../db/models/Product';
import { Order } from '../db/models/Order';
import { Review } from '../db/models/Review';
import { ReviewBan } from '../db/models/ReviewBan';
import { SecurityAuditLog } from '../db/models/SecurityAuditLog';
import { Return } from '../db/models/Return';
import { Coupon } from '../db/models/Coupon';
import { User } from '../db/models/User';
import { Category } from '../db/models/Category';
import { Banner } from '../db/models/Banner';
import { seedCoupons } from '../db/seed-coupons';

// La tool real sube a Cloudinary via HTTP firmado (ver imageStorage.ts / cloudinaryUpload.ts) -
// mockeada para que el test no dependa de credenciales reales ni de red.
mock.module('../lib/imageStorage', () => ({
  saveImageFile: async () => 'https://res.cloudinary.com/mock/image/upload/variant.jpg',
}));

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
    await ReviewBan.deleteMany({});
    // SecurityAuditLog blocks deleteMany at the schema level (append-only, HU-051) - go through
    // the native collection to clean up between tests instead.
    await SecurityAuditLog.collection.deleteMany({});
    await Return.deleteMany({});
    await Coupon.deleteMany({});
    await User.deleteMany({});
    await Category.deleteMany({});
    await Banner.deleteMany({});
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

  test('tools/list exposes all 32 registered tools', async () => {
    const { json } = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const names = json.result.tools.map((t: { name: string }) => t.name).sort();
    expect(names).toEqual(
      [
        'analytics.getCohortReport',
        'analytics.getProductAnalytics',
        'analytics.getSalesReport',
        'audit.getAdminActions',
        'banners.listBanners',
        'banners.updateBanner',
        'catalog.listProducts',
        'catalog.upsertProduct',
        'categories.upsertCategory',
        'coupons.createCoupon',
        'coupons.listCoupons',
        'dashboard.getSummary',
        'inventory.adjustStock',
        'notifications.broadcast',
        'orders.exportOrdersCsv',
        'orders.getOrderItems',
        'orders.listUserOrders',
        'orders.updateOrderStatus',
        'promotions.applyDiscount',
        'promotions.validateCoupon',
        'recommendations.getRelatedProducts',
        'returns.approveReturn',
        'returns.listReturns',
        'reviews.banAuthor',
        'reviews.listReviews',
        'reviews.moderateReview',
        'search.reindexCatalog',
        'users.updateUserRole',
        'variants.upsertVariant',
        'variants.updateVariantStock',
        'variants.uploadVariantImage',
        'wishlist.getUserWishlist',
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

  test('search.reindexCatalog clears catalog cache', async () => {
    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/call',
      params: { name: 'search.reindexCatalog', arguments: {} },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.ok).toBe(true);
  });

  test('coupons.createCoupon creates a new coupon', async () => {
    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 11,
      method: 'tools/call',
      params: {
        name: 'coupons.createCoupon',
        arguments: {
          code: 'SAVE10',
          label: '10% en Vitaminas',
          discountType: 'percent',
          percentOff: 10,
          eligibleCategories: ['Vitaminas'],
        },
      },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.code).toBe('SAVE10');
    expect(payload.percentOff).toBe(10);
  });

  test('promotions.applyDiscount applies a category discount', async () => {
    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 12,
      method: 'tools/call',
      params: {
        name: 'promotions.applyDiscount',
        arguments: { action: 'apply', category: 'Vitaminas', discountType: 'percent', value: 10 },
      },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.updated).toBeGreaterThanOrEqual(1);
  });

  test('returns.approveReturn advances a return to approved', async () => {
    const order = await Order.create({
      customerId: 'user-1',
      customerEmail: 'buyer@test.com',
      items: [{ productId: 'combo-product', productName: 'Combo Product', qty: 1, price: 10 }],
      subtotal: 10,
      tax: 0.7,
      shipping: 0,
      total: 10.7,
      paymentStatus: 'paid',
      fulfillmentStatus: 'delivered',
      status: 'paid',
    });
    const returnDoc = await Return.create({
      orderId: order._id,
      customerId: 'user-1',
      customerEmail: 'buyer@test.com',
      reason: 'No me sirve',
      reasonCategory: 'changed_mind',
      photos: ['https://example.com/photo.jpg'],
      items: [{ productId: 'combo-product', productName: 'Combo Product', qty: 1 }],
      refundAmount: 10.7,
      status: 'requested',
      returnMethod: 'store_dropoff',
    });

    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 13,
      method: 'tools/call',
      params: {
        name: 'returns.approveReturn',
        arguments: { returnId: String(returnDoc._id), status: 'approved' },
      },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.status).toBe('approved');
  });

  test('orders.exportOrdersCsv returns csv payload', async () => {
    await Order.create({
      customerId: 'user-1',
      customerEmail: 'buyer@test.com',
      items: [{ productId: 'combo-product', productName: 'Combo Product', qty: 1, price: 10 }],
      subtotal: 10,
      tax: 0.7,
      shipping: 0,
      total: 10.7,
      paymentStatus: 'paid',
      fulfillmentStatus: 'delivered',
      status: 'paid',
    });

    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 14,
      method: 'tools/call',
      params: { name: 'orders.exportOrdersCsv', arguments: { limit: 10 } },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.format).toBe('csv');
    expect(payload.rowCount).toBeGreaterThanOrEqual(1);
    expect(payload.csv).toContain('orderId');
  });

  test('wishlist.getUserWishlist returns saved product ids', async () => {
    await User.create({
      clerkId: 'wish-user-1',
      email: 'wish@test.com',
      wishlist: ['combo-product'],
    });

    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 15,
      method: 'tools/call',
      params: { name: 'wishlist.getUserWishlist', arguments: { email: 'wish@test.com' } },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.count).toBe(1);
    expect(payload.productIds).toEqual(['combo-product']);
    expect(payload.products[0].id).toBe('combo-product');
  });

  test('analytics.getCohortReport returns cohort structure', async () => {
    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 16,
      method: 'tools/call',
      params: { name: 'analytics.getCohortReport', arguments: {} },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.maxOffset).toBe(11);
    expect(Array.isArray(payload.cohorts)).toBe(true);
    expect(payload.overall).toBeDefined();
  });

  test('coupons.listCoupons returns seeded coupons', async () => {
    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 17,
      method: 'tools/call',
      params: { name: 'coupons.listCoupons', arguments: {} },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.count).toBeGreaterThanOrEqual(1);
    expect(payload.coupons[0].code).toBeDefined();
  });

  test('returns.listReturns returns requested returns', async () => {
    const order = await Order.create({
      customerId: 'user-1',
      customerEmail: 'buyer@test.com',
      items: [{ productId: 'combo-product', productName: 'Combo Product', qty: 1, price: 10 }],
      subtotal: 10,
      tax: 0.7,
      shipping: 0,
      total: 10.7,
      paymentStatus: 'paid',
      fulfillmentStatus: 'delivered',
      status: 'paid',
    });
    await Return.create({
      orderId: order._id,
      customerId: 'user-1',
      customerEmail: 'buyer@test.com',
      reason: 'No me sirve',
      reasonCategory: 'changed_mind',
      photos: ['https://example.com/photo.jpg'],
      items: [{ productId: 'combo-product', productName: 'Combo Product', qty: 1 }],
      refundAmount: 10.7,
      status: 'requested',
      returnMethod: 'store_dropoff',
    });

    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 18,
      method: 'tools/call',
      params: { name: 'returns.listReturns', arguments: { status: 'requested' } },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.count).toBe(1);
    expect(payload.returns[0].status).toBe('requested');
  });

  test('reviews.banAuthor bans the review author for the product', async () => {
    const review = await Review.create({
      productId: 'combo-product',
      userId: 'user-ban-1',
      userName: 'Spammer',
      rating: 1,
      body: 'Spam',
    });

    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 19,
      method: 'tools/call',
      params: { name: 'reviews.banAuthor', arguments: { reviewId: String(review._id) } },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.productId).toBe('combo-product');
    expect(payload.userName).toBe('Spammer');

    const deleted = await Review.findById(review._id).lean();
    expect(deleted).toBeNull();
    const ban = await ReviewBan.findOne({ productId: 'combo-product', userId: 'user-ban-1' }).lean();
    expect(ban?.userName).toBe('Spammer');
  });

  test('dashboard.getSummary returns kpis', async () => {
    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 20,
      method: 'tools/call',
      params: { name: 'dashboard.getSummary', arguments: {} },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.kpis).toBeDefined();
    expect(Array.isArray(payload.dailySales)).toBe(true);
    expect(payload.dailySales).toHaveLength(30);
  });

  test('catalog.upsertProduct creates a new product and rejects one missing required fields', async () => {
    const created = await rpc({
      jsonrpc: '2.0',
      id: 21,
      method: 'tools/call',
      params: {
        name: 'catalog.upsertProduct',
        arguments: { id: 'new-product', name: 'Nuevo', brand: 'Healthora', category: 'Vitaminas', price: 15 },
      },
    });
    const createdPayload = JSON.parse(created.json.result.content[0].text);
    expect(createdPayload.created).toBe(true);
    expect(createdPayload.product.id).toBe('new-product');

    const updated = await rpc({
      jsonrpc: '2.0',
      id: 22,
      method: 'tools/call',
      params: { name: 'catalog.upsertProduct', arguments: { id: 'new-product', price: 20 } },
    });
    const updatedPayload = JSON.parse(updated.json.result.content[0].text);
    expect(updatedPayload.created).toBe(false);
    expect(updatedPayload.product.price).toBe(20);

    const rejected = await rpc({
      jsonrpc: '2.0',
      id: 23,
      method: 'tools/call',
      params: { name: 'catalog.upsertProduct', arguments: { id: 'incomplete-product', name: 'Solo nombre' } },
    });
    expect(rejected.json.result.isError).toBe(true);
  });

  test('categories.upsertCategory creates a category and renames it reassigning products', async () => {
    const created = await rpc({
      jsonrpc: '2.0',
      id: 24,
      method: 'tools/call',
      params: { name: 'categories.upsertCategory', arguments: { id: 'Vitaminas', label: 'Vitaminas' } },
    });
    const createdPayload = JSON.parse(created.json.result.content[0].text);
    expect(createdPayload.created).toBe(true);
    expect(createdPayload.category.id).toBe('Vitaminas');

    const renamed = await rpc({
      jsonrpc: '2.0',
      id: 25,
      method: 'tools/call',
      params: { name: 'categories.upsertCategory', arguments: { id: 'Vitaminas', newId: 'suplementos' } },
    });
    const renamedPayload = JSON.parse(renamed.json.result.content[0].text);
    expect(renamedPayload.category.id).toBe('suplementos');
    expect(renamedPayload.productsReassigned).toBe(1);

    const product = await Product.findOne({ id: 'combo-product' }).lean();
    expect(product?.category).toBe('suplementos');
  });

  test('variants.upsertVariant adds a new variant to an existing product', async () => {
    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 26,
      method: 'tools/call',
      params: {
        name: 'variants.upsertVariant',
        arguments: {
          productId: 'combo-product',
          variant: { id: 'strawberry', label: 'Fresa', type: 'flavor', price: 0, stock: 15 },
        },
      },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.created).toBe(true);

    const product = await Product.findOne({ id: 'combo-product' }).lean();
    expect(product?.variants.find((v) => v.id === 'strawberry')?.label).toBe('Fresa');
  });

  test('variants.uploadVariantImage uploads and sets the primary image', async () => {
    const imageBase64 = Buffer.from('fake-image-bytes').toString('base64');
    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 27,
      method: 'tools/call',
      params: {
        name: 'variants.uploadVariantImage',
        arguments: { productId: 'combo-product', variantId: 'chocolate', imageBase64, mimeType: 'image/jpeg' },
      },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.url).toBe('https://res.cloudinary.com/mock/image/upload/variant.jpg');

    const product = await Product.findOne({ id: 'combo-product' }).lean();
    const variant = product?.variants.find((v) => v.id === 'chocolate');
    expect(variant?.imageUrl).toBe(payload.url);
    expect(variant?.images?.[0]).toBe(payload.url);
  });

  test('orders.listUserOrders lists a customer\'s orders by email', async () => {
    await Order.create({
      customerId: 'user-1',
      customerEmail: 'buyer@test.com',
      items: [{ productId: 'combo-product', productName: 'Combo Product', qty: 1, price: 10 }],
      subtotal: 10,
      tax: 0.7,
      shipping: 0,
      total: 10.7,
      paymentStatus: 'paid',
      fulfillmentStatus: 'delivered',
      status: 'paid',
    });

    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 28,
      method: 'tools/call',
      params: { name: 'orders.listUserOrders', arguments: { email: 'buyer@test.com' } },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.count).toBe(1);
    expect(payload.orders[0].customerEmail).toBe('buyer@test.com');
  });

  test('orders.updateOrderStatus changes the payment status', async () => {
    // Deja fulfillmentStatus sin cambios para no disparar el email real de actualizacion de orden
    // (sendOrderStatusUpdateEmail solo se llama cuando cambia el fulfillment).
    const order = await Order.create({
      customerId: 'user-1',
      customerEmail: 'buyer@test.com',
      items: [{ productId: 'combo-product', productName: 'Combo Product', qty: 1, price: 10 }],
      subtotal: 10,
      tax: 0.7,
      shipping: 0,
      total: 10.7,
      paymentStatus: 'pending_payment',
      fulfillmentStatus: 'unfulfilled',
      status: 'pending_payment',
    });

    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 29,
      method: 'tools/call',
      params: { name: 'orders.updateOrderStatus', arguments: { orderId: String(order._id), paymentStatus: 'paid' } },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.paymentStatus).toBe('paid');
    expect(payload.fulfillmentStatus).toBe('unfulfilled');
  });

  test('orders.getOrderItems returns the purchased items of an order', async () => {
    const order = await Order.create({
      customerId: 'user-1',
      customerEmail: 'buyer@test.com',
      customerName: 'Cliente Uno',
      items: [{ productId: 'combo-product', productName: 'Combo Product', qty: 2, price: 10, variantId: 'vanilla:5lb' }],
      subtotal: 20,
      tax: 1.4,
      shipping: 0,
      total: 21.4,
      paymentStatus: 'paid',
      fulfillmentStatus: 'delivered',
      status: 'paid',
    });

    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 30,
      method: 'tools/call',
      params: { name: 'orders.getOrderItems', arguments: { orderId: String(order._id) } },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.customerName).toBe('Cliente Uno');
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].variantId).toBe('vanilla:5lb');
  });

  test('users.updateUserRole promotes a customer to admin', async () => {
    const user = await User.create({ clerkId: 'promo-user-1', email: 'promo@test.com', role: 'customer' });

    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 31,
      method: 'tools/call',
      params: { name: 'users.updateUserRole', arguments: { userId: String(user._id), role: 'admin' } },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.previousRole).toBe('customer');
    expect(payload.role).toBe('admin');

    const updated = await User.findById(user._id).lean();
    expect(updated?.role).toBe('admin');
  });

  test('analytics.getSalesReport summarizes revenue and top products', async () => {
    await Order.create({
      customerId: 'user-1',
      customerEmail: 'buyer@test.com',
      items: [{ productId: 'combo-product', productName: 'Combo Product', qty: 2, price: 10 }],
      subtotal: 20,
      tax: 1.4,
      shipping: 0,
      total: 21.4,
      paymentStatus: 'paid',
      fulfillmentStatus: 'delivered',
      status: 'paid',
    });

    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 32,
      method: 'tools/call',
      params: { name: 'analytics.getSalesReport', arguments: { days: 30 } },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.summary.totalOrders).toBe(1);
    expect(payload.topProducts[0].name).toBe('Combo Product');
  });

  test('analytics.getProductAnalytics reports unconfigured when PostHog has no keys', async () => {
    const previousKey = process.env.POSTHOG_PERSONAL_API_KEY;
    const previousProject = process.env.POSTHOG_PROJECT_ID;
    delete process.env.POSTHOG_PERSONAL_API_KEY;
    delete process.env.POSTHOG_PROJECT_ID;

    try {
      const { json } = await rpc({
        jsonrpc: '2.0',
        id: 33,
        method: 'tools/call',
        params: { name: 'analytics.getProductAnalytics', arguments: { days: 7 } },
      });
      const payload = JSON.parse(json.result.content[0].text);
      expect(payload.configured).toBe(false);
    } finally {
      if (previousKey !== undefined) process.env.POSTHOG_PERSONAL_API_KEY = previousKey;
      if (previousProject !== undefined) process.env.POSTHOG_PROJECT_ID = previousProject;
    }
  });

  test('reviews.listReviews returns a product\'s reviews with avgRating', async () => {
    await Review.create({ productId: 'combo-product', userId: 'user-1', userName: 'Cliente', rating: 4, body: 'Bien' });
    await Review.create({ productId: 'combo-product', userId: 'user-2', userName: 'Otro', rating: 2, body: 'Regular' });

    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 34,
      method: 'tools/call',
      params: { name: 'reviews.listReviews', arguments: { productId: 'combo-product' } },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.count).toBe(2);
    expect(payload.avgRating).toBe(3);
  });

  test('recommendations.getRelatedProducts scores by shared category/need/brand', async () => {
    await Product.create({
      id: 'related-product',
      name: 'Related',
      brand: 'Healthora',
      category: 'Vitaminas',
      need: 'Test',
      price: 8,
      stock: 5,
      active: true,
      variants: [],
    });

    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 35,
      method: 'tools/call',
      params: { name: 'recommendations.getRelatedProducts', arguments: { productId: 'combo-product' } },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.count).toBe(1);
    expect(payload.related[0].id).toBe('related-product');
  });

  test('notifications.broadcast persists a notification for all visitors', async () => {
    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 36,
      method: 'tools/call',
      params: {
        name: 'notifications.broadcast',
        arguments: { audience: 'all', title: 'Aviso', body: 'Mantenimiento programado' },
      },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.audience).toBe('all');
    expect(payload.persisted).toBe(true);
    expect(payload.notificationId).toBeDefined();
  });

  test('promotions.validateCoupon validates a seeded coupon against cart items', async () => {
    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 37,
      method: 'tools/call',
      params: {
        name: 'promotions.validateCoupon',
        arguments: { code: 'BIENVENIDA', items: [{ productId: 'combo-product', qty: 1 }] },
      },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.valid).toBe(true);
    expect(payload.code).toBe('BIENVENIDA');
    expect(payload.discountAmount).toBeGreaterThan(0);
  });

  test('banners.updateBanner edits the club banner and banners.listBanners returns it', async () => {
    const { json } = await rpc({
      jsonrpc: '2.0',
      id: 38,
      method: 'tools/call',
      params: {
        name: 'banners.updateBanner',
        arguments: { slot: 'club', title: 'Club Healthora', ctaText: 'Unirme' },
      },
    });
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.slot).toBe('club');
    expect(payload.ctaHref).toBe('/club');

    const listed = await rpc({
      jsonrpc: '2.0',
      id: 39,
      method: 'tools/call',
      params: { name: 'banners.listBanners', arguments: {} },
    });
    const listedPayload = JSON.parse(listed.json.result.content[0].text);
    expect(listedPayload.count).toBe(1);
    expect(listedPayload.banners[0].title).toBe('Club Healthora');
  });
});
