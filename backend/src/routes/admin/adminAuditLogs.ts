import { Hono } from 'hono';
import { z } from 'zod';
import { SecurityAuditLog } from '../../db/models/SecurityAuditLog';
import { requireAdmin } from '../../middleware/requireAdmin';
import type { AppEnv } from '../../types/hono';
import { intFromInput, optionalTextField, parseQuery } from '../../lib/validation';

const auditLogsQuerySchema = z
  .object({
    from: optionalTextField(40),
    to: optionalTextField(40),
    action: optionalTextField(120),
    actorClerkId: optionalTextField(180),
    targetClerkId: optionalTextField(180),
    limit: intFromInput(1, 200).default(50),
    page: intFromInput(1, 10000).default(1),
  })
  .superRefine((query, ctx) => {
    for (const field of ['from', 'to'] as const) {
      if (query[field] && Number.isNaN(Date.parse(query[field]))) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: 'Fecha invalida',
        });
      }
    }
  });

export const adminAuditLogsRouter = new Hono<AppEnv>()
  .use('*', requireAdmin)
  .get('/', async (c) => {
    const parsed = parseQuery(c, auditLogsQuerySchema);
    if (!parsed.success) return parsed.response;

    const query = parsed.data;
    const filter: Record<string, unknown> = {};

    if (query.from || query.to) {
      filter.createdAt = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    }
    if (query.action) filter.action = query.action;
    if (query.actorClerkId) filter.actorClerkId = query.actorClerkId;
    if (query.targetClerkId) filter.targetClerkId = query.targetClerkId;

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      SecurityAuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean(),
      SecurityAuditLog.countDocuments(filter),
    ]);

    return c.json({
      items,
      total,
      page: query.page,
      limit: query.limit,
    });
  });
