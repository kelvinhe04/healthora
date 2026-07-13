import { Hono } from 'hono';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/requireAdmin';
import type { AppEnv } from '../../types/hono';
import { intFromInput, optionalTextField, parseQuery } from '../../lib/validation';
import { listAuditLogs } from '../../lib/auditLogs';

const auditLogsQuerySchema = z
  .object({
    from: optionalTextField(40),
    to: optionalTextField(40),
    action: optionalTextField(120),
    actorClerkId: optionalTextField(180),
    actorEmail: optionalTextField(254),
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

    return c.json(await listAuditLogs(parsed.data));
  });
