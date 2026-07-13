import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../types/hono';
import { recordSecurityEvent } from '../lib/securityAudit';

const VERB_BY_METHOD: Record<string, string> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

/** Logs every write (non-GET) request under a resource-scoped, filterable action name (e.g.
 * "products.update") to the append-only audit trail (HU-051) - requireAdmin already logs
 * 'admin.access' for literally every admin request, GETs included, which is too generic/noisy to
 * answer "who changed what, when". Runs after the handler so only requests that actually
 * succeeded get logged, and captures the route's :id (if any) as the affected target. */
export function auditAdminMutations(resource: string) {
  return createMiddleware<AppEnv>(async (c, next) => {
    await next();

    const verb = VERB_BY_METHOD[c.req.method];
    if (!verb || c.res.status >= 400) return;

    recordSecurityEvent(c, {
      actor: c.get('user'),
      action: `${resource}.${verb}`,
      resource: `${c.req.method} ${new URL(c.req.url).pathname}`,
      metadata: { targetId: c.req.param('id') },
    });
  });
}
