import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../types/hono';
import { clerkAuth } from './clerkAuth';
import { recordSecurityEvent } from '../lib/securityAudit';

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const authResponse = await clerkAuth(c, async () => undefined);
  if (authResponse) return authResponse;

  const user = c.get('user');
  if (user.role !== 'admin') {
    recordSecurityEvent(c, {
      actor: user,
      action: 'admin.access_denied',
      metadata: { reason: 'role_not_admin' },
    });
    return c.json({ error: 'Forbidden' }, 403);
  }

  recordSecurityEvent(c, {
    actor: user,
    action: 'admin.access',
  });

  await next();
});
