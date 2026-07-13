import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { SecurityAuditLog } from './SecurityAuditLog';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: 'healthora_audit_log_test' });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await SecurityAuditLog.collection.deleteMany({});
});

describe('SecurityAuditLog', () => {
  test('creates a new entry', async () => {
    const doc = await SecurityAuditLog.create({ action: 'admin.access', actorEmail: 'a@healthora.test' });
    expect(doc.action).toBe('admin.access');
  });

  test('rejects re-saving an existing document', async () => {
    const doc = await SecurityAuditLog.create({ action: 'admin.access' });
    doc.action = 'tampered';
    await expect(doc.save()).rejects.toThrow('append-only');
  });

  test('rejects updateOne/deleteOne on the collection', async () => {
    const doc = await SecurityAuditLog.create({ action: 'admin.access' });
    // .exec() forces a real Promise - bun's expect(...).rejects doesn't drive a Mongoose Query's
    // thenable to completion the way a plain `await` does, so the assertion silently sees the
    // (non-rejected) Query object instead of running the query.
    await expect(SecurityAuditLog.updateOne({ _id: doc._id }, { action: 'tampered' }).exec()).rejects.toThrow('append-only');
    await expect(SecurityAuditLog.deleteOne({ _id: doc._id }).exec()).rejects.toThrow('append-only');
  });
});
