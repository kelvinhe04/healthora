import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Order } from '../db/models/Order';
import { User } from '../db/models/User';
import { LoyaltyTransaction } from '../db/models/LoyaltyTransaction';
import { Settings } from '../db/models/Settings';
import { computeRedeemablePoints, getLoyaltyAccount, settleLoyaltyForOrder } from './loyalty';

let mongo: MongoMemoryServer;

async function seedUser(overrides: Record<string, unknown> = {}) {
  return User.create({ clerkId: 'user_1', email: 'ana@example.com', loyaltyPoints: 0, ...overrides });
}

async function seedOrder(overrides: Record<string, unknown> = {}) {
  return Order.create({
    customerId: 'user_1',
    customerName: 'Ana',
    items: [{ productId: 'vitamin-c', productName: 'Vitamin C', qty: 1, price: 15 }],
    subtotal: 15,
    tax: 1.05,
    shipping: 0,
    total: 16.05,
    paymentStatus: 'paid',
    fulfillmentStatus: 'unfulfilled',
    status: 'paid',
    ...overrides,
  });
}

describe('computeRedeemablePoints', () => {
  test('capa por el saldo disponible cuando alcanza para menos que el maximo', () => {
    const result = computeRedeemablePoints({ availablePoints: 50, maxDiscountCents: 10_000, pointValueCents: 1 });
    expect(result).toEqual({ pointsToRedeem: 50, discountCents: 50 });
  });

  test('capa por el maximo (subtotal) cuando el saldo alcanza para mas', () => {
    const result = computeRedeemablePoints({ availablePoints: 10_000, maxDiscountCents: 500, pointValueCents: 1 });
    expect(result).toEqual({ pointsToRedeem: 500, discountCents: 500 });
  });

  test('sin saldo, sin maximo o sin valor de canje no redime nada', () => {
    expect(computeRedeemablePoints({ availablePoints: 0, maxDiscountCents: 500, pointValueCents: 1 })).toEqual({ pointsToRedeem: 0, discountCents: 0 });
    expect(computeRedeemablePoints({ availablePoints: 100, maxDiscountCents: 0, pointValueCents: 1 })).toEqual({ pointsToRedeem: 0, discountCents: 0 });
    expect(computeRedeemablePoints({ availablePoints: 100, maxDiscountCents: 500, pointValueCents: 0 })).toEqual({ pointsToRedeem: 0, discountCents: 0 });
  });
});

describe('settleLoyaltyForOrder', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { dbName: 'healthora_loyalty_test' });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await Order.deleteMany({});
    await User.deleteMany({});
    await LoyaltyTransaction.deleteMany({});
    await Settings.deleteMany({});
  });

  test('acredita puntos segun el total de la orden y la tasa configurada (default 1pt/$1)', async () => {
    await seedUser();
    const order = await seedOrder({ total: 16.05, loyaltyPointsEarned: 16 });

    await settleLoyaltyForOrder(order);

    const user = await User.findOne({ clerkId: 'user_1' }).lean();
    expect(user?.loyaltyPoints).toBe(16);

    const ledger = await LoyaltyTransaction.find({ customerId: 'user_1' }).lean();
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ type: 'earn', points: 16, balanceAfter: 16 });
  });

  test('no acredita nada si loyaltyPointsEarned es 0 (ej. orden de reemplazo a costo $0)', async () => {
    await seedUser();
    const order = await seedOrder({ total: 0, loyaltyPointsEarned: 0 });

    await settleLoyaltyForOrder(order);

    const user = await User.findOne({ clerkId: 'user_1' }).lean();
    expect(user?.loyaltyPoints).toBe(0);
    expect(await LoyaltyTransaction.countDocuments({})).toBe(0);
  });

  test('descuenta el canje del saldo y deja constancia en el ledger', async () => {
    await seedUser({ loyaltyPoints: 100 });
    const order = await seedOrder({ total: 10, loyaltyPointsRedeemed: 60, loyaltyDiscountAmount: 0.6, loyaltyPointsEarned: 10 });

    await settleLoyaltyForOrder(order);

    const user = await User.findOne({ clerkId: 'user_1' }).lean();
    // 100 - 60 canjeados + 10 ganados = 50
    expect(user?.loyaltyPoints).toBe(50);

    const redeemEntry = await LoyaltyTransaction.findOne({ type: 'redeem' }).lean();
    expect(redeemEntry).toMatchObject({ points: 60, balanceAfter: 40 });
    const earnEntry = await LoyaltyTransaction.findOne({ type: 'earn' }).lean();
    expect(earnEntry).toMatchObject({ points: 10, balanceAfter: 50 });
  });

  test('no descuenta el canje si el saldo ya no alcanza al momento de liquidar (no rompe la orden)', async () => {
    await seedUser({ loyaltyPoints: 10 });
    const order = await seedOrder({ total: 10, loyaltyPointsRedeemed: 60, loyaltyDiscountAmount: 0.6, loyaltyPointsEarned: 10 });

    await settleLoyaltyForOrder(order);

    const user = await User.findOne({ clerkId: 'user_1' }).lean();
    // El canje no se aplico (saldo insuficiente), pero lo ganado si se acredita.
    expect(user?.loyaltyPoints).toBe(20);
    expect(await LoyaltyTransaction.countDocuments({ type: 'redeem' })).toBe(0);
  });

  test('es idempotente: liquidar la misma orden dos veces no duplica el ledger ni el saldo', async () => {
    await seedUser({ loyaltyPoints: 100 });
    const order = await seedOrder({ total: 10, loyaltyPointsRedeemed: 30, loyaltyDiscountAmount: 0.3, loyaltyPointsEarned: 10 });

    await settleLoyaltyForOrder(order);
    await settleLoyaltyForOrder(order);

    const user = await User.findOne({ clerkId: 'user_1' }).lean();
    expect(user?.loyaltyPoints).toBe(80);
    expect(await LoyaltyTransaction.countDocuments({})).toBe(2);
  });
});

describe('getLoyaltyAccount', () => {
  let localMongo: MongoMemoryServer;

  beforeAll(async () => {
    localMongo = await MongoMemoryServer.create();
    await mongoose.connect(localMongo.getUri(), { dbName: 'healthora_loyalty_account_test' });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await localMongo.stop();
  });

  beforeEach(async () => {
    await Order.deleteMany({});
    await User.deleteMany({});
    await LoyaltyTransaction.deleteMany({});
    await Settings.deleteMany({});
  });

  test('devuelve el saldo, las tasas configuradas y el historial mas reciente primero', async () => {
    await seedUser({ loyaltyPoints: 42 });
    await Settings.create({ key: 'global', loyaltyPointsPerDollar: 2, loyaltyPointValueCents: 5 });
    const order = await seedOrder({ loyaltyPointsEarned: 10 });
    await settleLoyaltyForOrder(order);

    const account = await getLoyaltyAccount('user_1');
    expect(account.pointsPerDollar).toBe(2);
    expect(account.pointValueCents).toBe(5);
    expect(account.balance).toBe(52);
    expect(account.transactions).toHaveLength(1);
    expect(account.transactions[0]).toMatchObject({ type: 'earn', points: 10 });
  });
});
