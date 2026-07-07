import { Hono } from 'hono';
import { z } from 'zod';
import { ErrorReport } from '../../db/models/ErrorReport';
import { requireAdmin } from '../../middleware/requireAdmin';
import type { AppEnv } from '../../types/hono';
import { intFromInput, optionalTextField, parseQuery } from '../../lib/validation';

const errorReportsQuerySchema = z
  .object({
    from: optionalTextField(40),
    to: optionalTextField(40),
    source: z.enum(['backend', 'frontend']).optional(),
    limit: intFromInput(1, 100).default(25),
    page: intFromInput(1, 10000).default(1),
  })
  .superRefine((query, ctx) => {
    for (const field of ['from', 'to'] as const) {
      if (query[field] && Number.isNaN(Date.parse(query[field]))) {
        ctx.addIssue({ code: 'custom', path: [field], message: 'Fecha invalida' });
      }
    }
  });

export const adminErrorReportsRouter = new Hono<AppEnv>()
  .use('*', requireAdmin)
  .get('/', async (c) => {
    const parsed = parseQuery(c, errorReportsQuerySchema);
    if (!parsed.success) return parsed.response;

    const query = parsed.data;
    const filter: Record<string, unknown> = {};
    if (query.source) filter.source = query.source;
    if (query.from || query.to) {
      filter.createdAt = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    }

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      ErrorReport.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean(),
      ErrorReport.countDocuments(filter),
    ]);

    return c.json({
      items,
      total,
      page: query.page,
      limit: query.limit,
    });
  });
