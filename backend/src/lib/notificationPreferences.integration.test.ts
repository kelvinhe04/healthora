import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../db/models/User';
import { getNotificationPreferences, shouldSendEmail } from './notificationPreferences';

let mongo: MongoMemoryServer;

describe('notificationPreferences', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { dbName: 'healthora_notification_prefs_test' });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  test('sin usuario en la base, se manda por defecto (falla abierto)', async () => {
    expect(await shouldSendEmail('user_inexistente', 'orderUpdates')).toBe(true);
    expect(await shouldSendEmail('user_inexistente', 'promotions')).toBe(true);
  });

  test('usuario sin preferencias guardadas (default de todo el schema) manda todo', async () => {
    await User.create({ clerkId: 'user_1', email: 'ana@example.com' });
    expect(await shouldSendEmail('user_1', 'orderUpdates')).toBe(true);
    expect(await shouldSendEmail('user_1', 'promotions')).toBe(true);
  });

  test('desactivar orderUpdates no afecta promotions', async () => {
    await User.create({
      clerkId: 'user_1',
      email: 'ana@example.com',
      notificationPreferences: { orderUpdates: false, promotions: true, unsubscribedAll: false },
    });
    expect(await shouldSendEmail('user_1', 'orderUpdates')).toBe(false);
    expect(await shouldSendEmail('user_1', 'promotions')).toBe(true);
  });

  test('desactivar promotions no afecta orderUpdates', async () => {
    await User.create({
      clerkId: 'user_1',
      email: 'ana@example.com',
      notificationPreferences: { orderUpdates: true, promotions: false, unsubscribedAll: false },
    });
    expect(await shouldSendEmail('user_1', 'orderUpdates')).toBe(true);
    expect(await shouldSendEmail('user_1', 'promotions')).toBe(false);
  });

  test('unsubscribedAll anula ambas categorias sin importar su valor individual', async () => {
    await User.create({
      clerkId: 'user_1',
      email: 'ana@example.com',
      notificationPreferences: { orderUpdates: true, promotions: true, unsubscribedAll: true },
    });
    expect(await shouldSendEmail('user_1', 'orderUpdates')).toBe(false);
    expect(await shouldSendEmail('user_1', 'promotions')).toBe(false);
  });

  test('getNotificationPreferences devuelve los defaults para un usuario nuevo', async () => {
    await User.create({ clerkId: 'user_1', email: 'ana@example.com' });
    expect(await getNotificationPreferences('user_1')).toEqual({
      orderUpdates: true,
      promotions: true,
      unsubscribedAll: false,
    });
  });

  test('getNotificationPreferences refleja lo guardado', async () => {
    await User.create({
      clerkId: 'user_1',
      email: 'ana@example.com',
      notificationPreferences: { orderUpdates: false, promotions: true, unsubscribedAll: false },
    });
    expect(await getNotificationPreferences('user_1')).toEqual({
      orderUpdates: false,
      promotions: true,
      unsubscribedAll: false,
    });
  });
});
