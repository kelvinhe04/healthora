import { Hono } from 'hono';
import { requireAdmin } from '../../middleware/requireAdmin';
import type { AppEnv } from '../../types/hono';
import { getDashboardSummary } from '../../lib/dashboardSummary';

export const adminDashboardRouter = new Hono<AppEnv>()
  .use('*', requireAdmin)
  .get('/', async (c) => c.json(await getDashboardSummary()));
