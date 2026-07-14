import { Hono } from 'hono';
import { requireAdmin } from '../../middleware/requireAdmin';
import { auditAdminMutations } from '../../middleware/auditAdminAction';
import type { AppEnv } from '../../types/hono';
import { clearCatalogCache } from '../../lib/cache';

export const adminCatalogRouter = new Hono<AppEnv>()
  .use('*', requireAdmin)
  .use('*', auditAdminMutations('catalog'))
  .post('/reindex', async (c) => {
    await clearCatalogCache();
    return c.json({ ok: true, message: 'Caché del catálogo invalidada.' });
  });
