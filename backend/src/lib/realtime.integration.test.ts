import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Notification } from '../db/models/Notification';
import { Product } from '../db/models/Product';
import {
  registerSocket,
  unregisterSocket,
  createNotification,
  notifyUser,
  notifyAdmins,
  notifyEveryone,
  serializeNotification,
  maybeNotifyLowStock,
  connectionStats,
  __resetRealtimeForTests,
  type RealtimeSocket,
  type NotificationDoc,
} from './realtime';
import { notificationsRouter } from '../routes/notifications';

let mongo: MongoMemoryServer;

// One connection for the whole file. bun runs every test file in the same process against
// mongoose's single default connection, so leaving one open (or opening a second) would make the
// *next* test file's `mongoose.connect()` throw "active connection with different connection
// strings". Connect once here, disconnect once at the end.
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: 'healthora_realtime_test' });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

/** Structural stub matching {@link RealtimeSocket} - records everything the hub sends to it. */
function fakeSocket(readyState = 1): RealtimeSocket & { sent: string[] } {
  const sent: string[] = [];
  return { sent, readyState, send: (d: string) => void sent.push(d) };
}

function parseSent(socket: { sent: string[] }) {
  return socket.sent.map((s) => JSON.parse(s));
}

async function authedRequest(path: string, init: RequestInit, headers: Record<string, string>) {
  const req = new Request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...headers, ...(init.headers as Record<string, string>) },
  });
  const res = await notificationsRouter.fetch(req);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : undefined };
}

const customerHeaders = { 'x-test-clerk-id': 'cust-1', 'x-test-role': 'customer', 'x-test-name': 'Cliente Uno' };
const adminHeaders = { 'x-test-clerk-id': 'admin-1', 'x-test-role': 'admin', 'x-test-name': 'Admin Uno' };

describe('realtime notification hub', () => {
  beforeEach(async () => {
    await Notification.deleteMany({});
    await Product.deleteMany({});
    __resetRealtimeForTests();
  });

  afterEach(() => {
    __resetRealtimeForTests();
  });

  test('emits a user notification only to that user\'s sockets', async () => {
    const custSocket = fakeSocket();
    const otherSocket = fakeSocket();
    registerSocket({ clerkId: 'cust-1', role: 'customer' }, custSocket);
    registerSocket({ clerkId: 'cust-2', role: 'customer' }, otherSocket);

    const { delivered } = await notifyUser('cust-1', {
      type: 'order_paid',
      title: 'Pago confirmado',
      body: 'Gracias',
    });

    expect(delivered).toBe(1);
    expect(parseSent(custSocket)).toHaveLength(1);
    expect(parseSent(custSocket)[0]).toMatchObject({ event: 'notification', data: { type: 'order_paid', read: false } });
    expect(otherSocket.sent).toHaveLength(0);
  });

  test('admin notifications reach only admin sockets; broadcasts reach everyone', async () => {
    const adminSocket = fakeSocket();
    const custSocket = fakeSocket();
    registerSocket({ clerkId: 'admin-1', role: 'admin' }, adminSocket);
    registerSocket({ clerkId: 'cust-1', role: 'customer' }, custSocket);

    await notifyAdmins({ type: 'new_review', title: 'Nueva reseña', body: '5★' });
    expect(adminSocket.sent).toHaveLength(1);
    expect(custSocket.sent).toHaveLength(0);

    await notifyEveryone({ type: 'broadcast', title: 'Aviso', body: 'Para todos' });
    expect(adminSocket.sent).toHaveLength(2);
    expect(custSocket.sent).toHaveLength(1);
  });

  test('does not send to a closed socket and cleans up on unregister', async () => {
    const closed = fakeSocket(3); // CLOSED
    registerSocket({ clerkId: 'cust-1', role: 'customer' }, closed);
    const { delivered } = await notifyUser('cust-1', { type: 'order_status', title: 'x', body: 'y' });
    expect(delivered).toBe(0);
    expect(closed.sent).toHaveLength(0);

    unregisterSocket(closed);
    expect(connectionStats()).toEqual({ totalSockets: 0, users: 0, admins: 0 });
  });

  test('createNotification persists the row and serializes read state per user', async () => {
    await createNotification({ audience: 'admin', type: 'new_review', title: 'r', body: 'b' });
    const doc = await Notification.findOne({}).lean();
    expect(doc).toBeTruthy();

    const raw = doc as unknown as NotificationDoc;
    expect(serializeNotification(raw, 'admin-1').read).toBe(false);

    await Notification.updateOne({ _id: raw._id }, { $addToSet: { readBy: 'admin-1' } });
    const after = (await Notification.findById(raw._id).lean()) as unknown as NotificationDoc;
    expect(serializeNotification(after, 'admin-1').read).toBe(true);
    expect(serializeNotification(after, 'admin-2').read).toBe(false);
  });

  test('maybeNotifyLowStock fires once under threshold and dedupes bursts', async () => {
    const product = { id: 'olly', name: 'Olly', stock: 3 };
    const first = await maybeNotifyLowStock(product, { threshold: 5 });
    expect(first).not.toBeNull();

    const second = await maybeNotifyLowStock(product, { threshold: 5 });
    expect(second).toBeNull(); // deduped within the window

    expect(await Notification.countDocuments({ type: 'low_stock' })).toBe(1);
  });

  test('maybeNotifyLowStock ignores products above threshold', async () => {
    const result = await maybeNotifyLowStock({ id: 'plenty', name: 'Plenty', stock: 40 }, { threshold: 5 });
    expect(result).toBeNull();
    expect(await Notification.countDocuments({ type: 'low_stock' })).toBe(0);
  });
});

describe('notifications router', () => {
  beforeEach(async () => {
    await Notification.deleteMany({});
    __resetRealtimeForTests();
  });

  test('inbox returns own + broadcast rows for a customer, plus admin rows for an admin', async () => {
    await notifyUser('cust-1', { type: 'order_paid', title: 'p', body: 'b' });
    await notifyAdmins({ type: 'new_review', title: 'r', body: 'b' });
    await notifyEveryone({ type: 'broadcast', title: 'g', body: 'b' });

    const asCustomer = await authedRequest('/', {}, customerHeaders);
    expect(asCustomer.status).toBe(200);
    expect(asCustomer.json.notifications).toHaveLength(2); // own + broadcast, not the admin row
    expect(asCustomer.json.unread).toBe(2);

    const asAdmin = await authedRequest('/', {}, adminHeaders);
    expect(asAdmin.json.notifications).toHaveLength(2); // admin row + broadcast
    expect(asAdmin.json.unread).toBe(2);
  });

  test('marking read is per-user and does not leak across users', async () => {
    await notifyEveryone({ type: 'broadcast', title: 'g', body: 'b' });
    const list = await authedRequest('/', {}, customerHeaders);
    const id = list.json.notifications[0].id;

    const read = await authedRequest(`/${id}/read`, { method: 'PATCH' }, customerHeaders);
    expect(read.status).toBe(200);
    expect(read.json.read).toBe(true);

    const custAgain = await authedRequest('/', {}, customerHeaders);
    expect(custAgain.json.unread).toBe(0);

    const otherCustomer = await authedRequest('/', {}, { ...customerHeaders, 'x-test-clerk-id': 'cust-9' });
    expect(otherCustomer.json.unread).toBe(1); // still unread for a different user
  });

  test('read-all clears the unread count for the requester', async () => {
    await notifyUser('cust-1', { type: 'order_paid', title: 'a', body: 'b' });
    await notifyEveryone({ type: 'broadcast', title: 'c', body: 'd' });

    const before = await authedRequest('/', {}, customerHeaders);
    expect(before.json.unread).toBe(2);

    const readAll = await authedRequest('/read-all', { method: 'POST' }, customerHeaders);
    expect(readAll.json.updated).toBe(2);

    const after = await authedRequest('/', {}, customerHeaders);
    expect(after.json.unread).toBe(0);
  });

  test('ws/status exposes connection counts (observability)', async () => {
    registerSocket({ clerkId: 'admin-1', role: 'admin' }, fakeSocket());
    const res = await authedRequest('/ws/status', {}, {});
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ admins: 1, totalSockets: 1 });
  });
});
