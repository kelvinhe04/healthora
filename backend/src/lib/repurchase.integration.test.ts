import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Order } from '../db/models/Order';
import { Product } from '../db/models/Product';
import { RepurchaseReminder } from '../db/models/RepurchaseReminder';
import { getReorderCycleDays, scanAndSendRepurchaseReminders } from './repurchase';

let mongo: MongoMemoryServer;

const DAY_MS = 24 * 60 * 60 * 1000;

async function seedProduct(overrides: Record<string, unknown> = {}) {
  await Product.create({
    id: 'vitamin-c',
    name: 'Vitamin C',
    brand: 'Healthora',
    category: 'Vitaminas', // default 30-day cycle
    need: 'Test',
    price: 15,
    stock: 100,
    active: true,
    ...overrides,
  });
}

async function createPaidOrder(daysAgo: number, opts: { isSample?: boolean; productId?: string } = {}) {
  return Order.create({
    customerId: 'user_1',
    customerName: 'Ana',
    customerEmail: 'ana@example.com',
    items: [
      {
        productId: opts.productId ?? 'vitamin-c',
        productName: 'Vitamin C',
        qty: 1,
        price: 15,
        category: 'Vitaminas',
        isSample: opts.isSample ?? false,
      },
    ],
    subtotal: 15,
    tax: 1.05,
    shipping: 0,
    total: 16.05,
    paymentStatus: 'paid',
    fulfillmentStatus: 'delivered',
    status: 'paid',
    createdAt: new Date(Date.now() - daysAgo * DAY_MS),
  });
}

describe('getReorderCycleDays', () => {
  test('usa el override del producto si existe', () => {
    expect(getReorderCycleDays({ category: 'Vitaminas', reorderCycleDays: 10 })).toBe(10);
  });

  test('cae al default de la categoria sin override', () => {
    expect(getReorderCycleDays({ category: 'Fragancias' })).toBe(90);
  });

  test('cae al default global sin categoria conocida', () => {
    expect(getReorderCycleDays({ category: 'Categoria inexistente' })).toBe(30);
  });
});

describe('scanAndSendRepurchaseReminders', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { dbName: 'healthora_repurchase_test' });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await Order.deleteMany({});
    await Product.deleteMany({});
    await RepurchaseReminder.deleteMany({});
  });

  test('manda un recordatorio cuando la fecha estimada de agotamiento cae dentro de la ventana', async () => {
    await seedProduct();
    // Vitaminas: 30 dias de ciclo. Comprado hace 28 dias -> se agota en 2 dias, dentro de la
    // ventana default de 3 dias de anticipacion.
    await createPaidOrder(28);

    const result = await scanAndSendRepurchaseReminders();
    expect(result).toEqual({ scanned: 1, sent: 1 });

    const reminders = await RepurchaseReminder.find({});
    expect(reminders).toHaveLength(1);
    expect(reminders[0].customerEmail).toBe('ana@example.com');
    expect(reminders[0].productId).toBe('vitamin-c');
    expect(reminders[0].reorderCycleDays).toBe(30);
  });

  test('no manda nada si la fecha estimada esta lejos en el futuro', async () => {
    await seedProduct();
    // Comprado hace apenas 2 dias -> se agota en 28 dias, muy lejos de la ventana de 3 dias.
    await createPaidOrder(2);

    const result = await scanAndSendRepurchaseReminders();
    expect(result).toEqual({ scanned: 1, sent: 0 });
    expect(await RepurchaseReminder.countDocuments({})).toBe(0);
  });

  test('no manda nada si la fecha estimada ya paso', async () => {
    await seedProduct();
    // Comprado hace 40 dias -> se agoto hace 10 dias, ya paso la ventana.
    await createPaidOrder(40);

    const result = await scanAndSendRepurchaseReminders();
    expect(result).toEqual({ scanned: 1, sent: 0 });
  });

  test('ignora items de muestra gratis', async () => {
    await seedProduct();
    await createPaidOrder(28, { isSample: true });

    const result = await scanAndSendRepurchaseReminders();
    expect(result).toEqual({ scanned: 0, sent: 0 });
  });

  test('no duplica el recordatorio para el mismo ciclo de compra en un segundo escaneo', async () => {
    await seedProduct();
    await createPaidOrder(28);

    const first = await scanAndSendRepurchaseReminders();
    expect(first.sent).toBe(1);

    const second = await scanAndSendRepurchaseReminders();
    expect(second.sent).toBe(0);
    expect(await RepurchaseReminder.countDocuments({})).toBe(1);
  });

  test('un producto con reorderCycleDays propio anula el default de categoria', async () => {
    await seedProduct({ reorderCycleDays: 5 });
    // Con ciclo de 5 dias, comprado hace 3 dias -> se agota en 2 dias, dentro de la ventana.
    await createPaidOrder(3);

    const result = await scanAndSendRepurchaseReminders();
    expect(result.sent).toBe(1);
    const reminder = await RepurchaseReminder.findOne({});
    expect(reminder?.reorderCycleDays).toBe(5);
  });

  test('una recompra mas reciente adelanta el ciclo (usa la ultima compra, no la primera)', async () => {
    await seedProduct();
    await createPaidOrder(60); // ciclo viejo, ya vencido hace tiempo
    await createPaidOrder(28); // recompra reciente -> nuevo ciclo, se agota en 2 dias

    const result = await scanAndSendRepurchaseReminders();
    expect(result.scanned).toBe(1); // un solo grupo (mismo cliente+producto)
    expect(result.sent).toBe(1);
  });
});
