import { Hono } from 'hono';
import { z } from 'zod';
import { RepurchaseReminder } from '../../db/models/RepurchaseReminder';
import { requireAdmin } from '../../middleware/requireAdmin';
import type { AppEnv } from '../../types/hono';
import { intFromInput, parseQuery } from '../../lib/validation';
import { scanAndSendRepurchaseReminders } from '../../lib/repurchase';

const repurchaseRemindersQuerySchema = z.object({
  limit: intFromInput(1, 100).default(25),
  page: intFromInput(1, 10000).default(1),
});

export const adminRepurchaseRemindersRouter = new Hono<AppEnv>()
  .use('*', requireAdmin)
  .get('/', async (c) => {
    const parsed = parseQuery(c, repurchaseRemindersQuerySchema);
    if (!parsed.success) return parsed.response;

    const { page, limit } = parsed.data;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      RepurchaseReminder.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      RepurchaseReminder.countDocuments({}),
    ]);

    return c.json({ items, total, page, limit });
  })
  // Dispara el escaneo bajo demanda, sin esperar al intervalo de 24h - util para probar la
  // funcionalidad manualmente (ver docs/seguimiento-hu.md, HU-102).
  .post('/scan', async (c) => {
    const result = await scanAndSendRepurchaseReminders();
    return c.json(result);
  });
