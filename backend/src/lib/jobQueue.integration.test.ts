import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { EmailJob } from '../db/models/EmailJob';
import { enqueueEmailJob, processEmailJobs } from './jobQueue';

let mongo: MongoMemoryServer;

describe('jobQueue', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { dbName: 'healthora_job_queue_test' });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await EmailJob.deleteMany({});
  });

  test('enqueueEmailJob creates a pending job with the given payload', async () => {
    await enqueueEmailJob('order_confirmation', {
      customerName: 'Ana',
      customerEmail: 'ana@example.com',
      orderId: 'order-1',
      items: [{ productId: 'p1', productName: 'Producto', qty: 1, price: 10 }],
      subtotal: 10,
      tax: 0.7,
      shipping: 0,
      total: 10.7,
      address: { name: 'Ana', phone: '000', address: 'Calle 1', city: 'Ciudad', postal: '00000' },
      createdAt: new Date(),
    });

    const jobs = await EmailJob.find({});
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe('pending');
    expect(jobs[0].attempts).toBe(0);
    expect(jobs[0].type).toBe('order_confirmation');
    expect(jobs[0].payload.customerEmail).toBe('ana@example.com');
  });

  test('processEmailJobs marks a due job as completed', async () => {
    await enqueueEmailJob('order_confirmation', {
      customerName: 'Ana',
      customerEmail: 'ana@example.com',
      orderId: 'order-2',
      items: [],
      subtotal: 0,
      tax: 0,
      shipping: 0,
      total: 0,
      address: { name: 'Ana', phone: '000', address: 'Calle 1', city: 'Ciudad', postal: '00000' },
      createdAt: new Date(),
    });

    const processed = await processEmailJobs();
    expect(processed).toBe(1);

    const job = await EmailJob.findOne({});
    expect(job?.status).toBe('completed');
    expect(job?.completedAt).toBeInstanceOf(Date);
  });

  test('processEmailJobs ignores jobs whose nextAttemptAt is still in the future', async () => {
    await EmailJob.create({
      type: 'order_confirmation',
      payload: { customerEmail: 'ana@example.com' },
      status: 'pending',
      nextAttemptAt: new Date(Date.now() + 60_000),
    });

    const processed = await processEmailJobs();
    expect(processed).toBe(0);

    const job = await EmailJob.findOne({});
    expect(job?.status).toBe('pending');
  });

  test('a stale "processing" job is reclaimed, requeued with backoff, and attempts incremented', async () => {
    const job = await EmailJob.create({
      type: 'newsletter_subscription',
      payload: { email: 'ana@example.com' },
      status: 'processing',
      attempts: 1,
      maxAttempts: 5,
    });
    // Bypass Mongoose's automatic timestamps (which would overwrite updatedAt on any save/update
    // through the model) to simulate a job that's been stuck in "processing" since a crash.
    await EmailJob.collection.updateOne(
      { _id: job._id },
      { $set: { updatedAt: new Date(Date.now() - 20 * 60_000) } },
    );

    await processEmailJobs();

    const reaped = await EmailJob.findById(job._id);
    expect(reaped?.status).toBe('pending');
    expect(reaped?.attempts).toBe(2);
    expect(reaped?.lastError).toContain('interrumpido');
    expect(reaped?.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  test('a stale "processing" job that already exhausted its retries is marked failed instead of requeued', async () => {
    const job = await EmailJob.create({
      type: 'newsletter_subscription',
      payload: { email: 'ana@example.com' },
      status: 'processing',
      attempts: 4,
      maxAttempts: 5,
    });
    await EmailJob.collection.updateOne(
      { _id: job._id },
      { $set: { updatedAt: new Date(Date.now() - 20 * 60_000) } },
    );

    await processEmailJobs();

    const reaped = await EmailJob.findById(job._id);
    expect(reaped?.status).toBe('failed');
    expect(reaped?.attempts).toBe(5);
  });
});
