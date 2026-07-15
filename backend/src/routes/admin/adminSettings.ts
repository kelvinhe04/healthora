import { Hono } from 'hono';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/requireAdmin';
import { auditAdminMutations } from '../../middleware/auditAdminAction';
import type { AppEnv } from '../../types/hono';
import { Settings, getSettings } from '../../db/models/Settings';
import { parseJson } from '../../lib/validation';

const settingsPayloadSchema = z.object({
  sampleMaxPrice: z.coerce.number().min(0).max(999999),
});

export const adminSettingsRouter = new Hono<AppEnv>()
  .use('*', requireAdmin)
  .use('*', auditAdminMutations('settings'))
  .get('/', async (c) => c.json(await getSettings()))
  .put('/', async (c) => {
    const parsed = await parseJson(c, settingsPayloadSchema);
    if (!parsed.success) return parsed.response;

    const settings = await Settings.findOneAndUpdate(
      { key: 'global' },
      { $set: parsed.data },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean();
    return c.json(settings);
  });
