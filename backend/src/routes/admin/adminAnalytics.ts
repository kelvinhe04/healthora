import { Hono } from 'hono';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/requireAdmin';
import type { AppEnv } from '../../types/hono';
import { intFromInput, parseQuery } from '../../lib/validation';
import { getProductAnalytics } from '../../lib/posthogAnalytics';

const productAnalyticsQuerySchema = z.object({
  days: intFromInput(1, 365).default(30),
});

export const adminAnalyticsRouter = new Hono<AppEnv>()
  .use('*', requireAdmin)
  .get('/product', async (c) => {
    const parsed = parseQuery(c, productAnalyticsQuerySchema);
    if (!parsed.success) return parsed.response;

    const analytics = await getProductAnalytics(parsed.data.days);
    return c.json(analytics);
  });
