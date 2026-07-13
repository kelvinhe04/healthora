import { Hono } from 'hono';
import { z } from 'zod';
import { EmailJob, EMAIL_JOB_STATUSES, EMAIL_JOB_TYPES } from '../../db/models/EmailJob';
import { requireAdmin } from '../../middleware/requireAdmin';
import type { AppEnv } from '../../types/hono';
import { intFromInput, parseQuery } from '../../lib/validation';

const emailJobsQuerySchema = z.object({
  status: z.enum(EMAIL_JOB_STATUSES).optional(),
  type: z.enum(EMAIL_JOB_TYPES).optional(),
  limit: intFromInput(1, 100).default(25),
  page: intFromInput(1, 10000).default(1),
});

export const adminJobsRouter = new Hono<AppEnv>()
  .use('*', requireAdmin)
  .get('/', async (c) => {
    const parsed = parseQuery(c, emailJobsQuerySchema);
    if (!parsed.success) return parsed.response;

    const query = parsed.data;
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      EmailJob.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean(),
      EmailJob.countDocuments(filter),
    ]);

    return c.json({ items, total, page: query.page, limit: query.limit });
  })
  .get('/summary', async (c) => {
    const counts = await EmailJob.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    const byStatus: Record<string, number> = Object.fromEntries(EMAIL_JOB_STATUSES.map((s) => [s, 0]));
    for (const row of counts) {
      byStatus[row._id] = row.count;
    }
    return c.json({ byStatus, total: Object.values(byStatus).reduce((sum, n) => sum + n, 0) });
  })
  .post('/:id/retry', async (c) => {
    const id = c.req.param('id');
    const job = await EmailJob.findById(id);
    if (!job) return c.json({ error: 'Trabajo no encontrado' }, 404);
    if (job.status !== 'failed') {
      return c.json({ error: 'Solo se puede reintentar un trabajo marcado como failed' }, 400);
    }
    job.status = 'pending';
    job.nextAttemptAt = new Date();
    job.lastError = undefined;
    await job.save();
    return c.json({ success: true, job });
  });
