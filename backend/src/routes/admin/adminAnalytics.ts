import { Hono } from 'hono';
import { z } from 'zod';
import { ErrorReport } from '../../db/models/ErrorReport';
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

    const { days } = parsed.data;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [analytics, totalErrors, backendErrors, frontendErrors] = await Promise.all([
      getProductAnalytics(days),
      ErrorReport.countDocuments({ createdAt: { $gte: since } }),
      ErrorReport.countDocuments({ createdAt: { $gte: since }, source: 'backend' }),
      ErrorReport.countDocuments({ createdAt: { $gte: since }, source: 'frontend' }),
    ]);

    return c.json({
      ...analytics,
      errors: { total: totalErrors, backend: backendErrors, frontend: frontendErrors },
    });
  });
