import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../types/hono';
import { clerkAuth } from './clerkAuth';
import { recordSecurityEvent } from '../lib/securityAudit';
import { shouldRecordThrottled, AUDIT_ACCESS_THROTTLE_MS } from '../lib/auditThrottle';

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const authResponse = await clerkAuth(c, async () => undefined);
  if (authResponse) return authResponse;

  const user = c.get('user');
  if (user.role !== 'admin' && user.role !== 'owner') {
    // Denials are rare and always worth a full trail, so these skip the throttle below.
    recordSecurityEvent(c, {
      actor: user,
      action: 'admin.access_denied',
      metadata: { reason: 'role_not_admin' },
    });
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Fires on every admin request (GETs included), so it's throttled per clerkId - real mutations
  // still get their own untouched, per-request entry via auditAdminMutations (#315).
  if (shouldRecordThrottled(`admin.access:${user.clerkId}`, AUDIT_ACCESS_THROTTLE_MS)) {
    recordSecurityEvent(c, {
      actor: user,
      action: 'admin.access',
    });
  }

  await next();
});
