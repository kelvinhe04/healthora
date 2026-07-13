import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Coupon } from '../db/models/Coupon';
import { Order } from '../db/models/Order';
import { seedCoupons } from '../db/seed-coupons';
import { validatePromotion } from './promotions';

let mongo: MongoMemoryServer;

describe('promotions', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { dbName: 'healthora_promotions_test' });
  });

  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
    await seedCoupons();
  });

  afterEach(() => {
    // keep DB clean between tests
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  test('aplica BIENVENIDA al subtotal completo', async () => {
    const result = await validatePromotion('bienvenida', [
      { product: { category: 'Suplementos', price: 19.99 }, qty: 2 },
      { product: { category: 'Hidratantes', price: 10 }, qty: 1 },
    ]);

    expect(result).toEqual({
      valid: true,
      code: 'BIENVENIDA',
      label: '15% nuevos clientes',
      discountAmount: 7.5,
    });
  });

  test('aplica PIEL25 solo a categorias elegibles antes de expirar', async () => {
    const result = await validatePromotion('PIEL25', [
      { product: { category: 'Hidratantes', price: 20 }, qty: 2 },
      { product: { category: 'Vitaminas', price: 100 }, qty: 1 },
    ]);

    expect(result).toEqual({
      valid: true,
      code: 'PIEL25',
      label: '25% rutina skincare',
      discountAmount: 10,
    });
  });

  test('rechaza codigos desconocidos, expirados o sin subtotal elegible', async () => {
    expect(await validatePromotion('NOPE', [{ product: { category: 'Hidratantes', price: 20 }, qty: 1 }])).toMatchObject({
      valid: false,
      reason: 'not_found',
    });

    expect(
      await validatePromotion('PIEL25', [{ product: { category: 'Vitaminas', price: 20 }, qty: 1 }]),
    ).toMatchObject({ valid: false, reason: 'no_eligible_items' });

    await Coupon.updateOne({ code: 'PIEL25' }, { $set: { expiresAt: new Date('2020-01-01') } });
    expect(
      await validatePromotion('PIEL25', [{ product: { category: 'Hidratantes', price: 20 }, qty: 1 }]),
    ).toMatchObject({ valid: false, reason: 'expired' });
  });

  test('rechaza BIENVENIDA si el cliente ya tiene una orden pagada', async () => {
    await Order.create({
      customerId: 'user_1',
      customerName: 'Test',
      customerEmail: 'test@example.com',
      items: [],
      subtotal: 10,
      total: 10,
      paymentStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
      status: 'paid',
      address: { name: 'T', phone: '1', address: 'a', city: 'c', postal: 'p' },
    });

    const result = await validatePromotion(
      'BIENVENIDA',
      [{ product: { category: 'Vitaminas', price: 20 }, qty: 1 }],
      { customerId: 'user_1' },
    );

    expect(result).toMatchObject({ valid: false, reason: 'first_purchase_only' });
  });
});
