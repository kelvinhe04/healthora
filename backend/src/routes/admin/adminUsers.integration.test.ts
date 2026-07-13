import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../../db/models/User';
import { adminUsersRouter } from './adminUsers';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: 'healthora_admin_users_test' });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const ownerHeaders = { 'x-test-clerk-id': 'owner-1', 'x-test-role': 'owner', 'x-test-name': 'Kelvin' };
const adminHeaders = { 'x-test-clerk-id': 'admin-1', 'x-test-role': 'admin', 'x-test-name': 'Admin Uno' };

async function request(path: string, headers: Record<string, string>, init: RequestInit = {}) {
  const req = new Request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...headers, ...(init.headers as Record<string, string>) },
  });
  const res = await adminUsersRouter.fetch(req);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : undefined };
}

describe('adminUsersRouter role management (HU-222)', () => {
  let ownerId: string;
  let customerId: string;

  beforeEach(async () => {
    await User.deleteMany({});
    const owner = await User.create({ clerkId: 'owner-1', name: 'Kelvin', email: 'owner@healthora.test', role: 'owner' });
    const customer = await User.create({ clerkId: 'cust-1', name: 'Cliente', email: 'cust@healthora.test', role: 'customer' });
    ownerId = owner._id.toString();
    customerId = customer._id.toString();
  });

  test('a regular admin cannot change anyone\'s role', async () => {
    const { status, json } = await request(`/${customerId}/role`, adminHeaders, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'admin' }),
    });
    expect(status).toBe(403);
    expect(json.error).toContain('owner');

    const stillCustomer = await User.findById(customerId).lean();
    expect(stillCustomer?.role).toBe('customer');
  });

  test('the owner can promote a customer to admin and back', async () => {
    const promoted = await request(`/${customerId}/role`, ownerHeaders, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'admin' }),
    });
    expect(promoted.status).toBe(200);
    expect((await User.findById(customerId).lean())?.role).toBe('admin');

    const demoted = await request(`/${customerId}/role`, ownerHeaders, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'customer' }),
    });
    expect(demoted.status).toBe(200);
    expect((await User.findById(customerId).lean())?.role).toBe('customer');
  });

  test('nobody - not even the owner - can change the owner\'s own role', async () => {
    const { status, json } = await request(`/${ownerId}/role`, ownerHeaders, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'customer' }),
    });
    expect(status).toBe(403);
    expect(json.error).toContain('owner');
    expect((await User.findById(ownerId).lean())?.role).toBe('owner');
  });

  test('the owner account cannot be deleted', async () => {
    const { status, json } = await request(`/${ownerId}`, ownerHeaders, { method: 'DELETE' });
    expect(status).toBe(403);
    expect(json.error).toContain('owner');
    expect(await User.findById(ownerId).lean()).not.toBeNull();
  });
});
