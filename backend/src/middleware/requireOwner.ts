import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../types/hono';
import { recordSecurityEvent } from '../lib/securityAudit';

/** Gates the single admin-role-management endpoint (PATCH /admin/users/:id/role) - only the
 * owner (admin supremo, HU-222) can promote/demote other admins, so no regular admin can lock
 * others out or self-promote further. Must run after requireAdmin (relies on c.get('user')). */
export const requireOwner = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user');
  if (user.role !== 'owner') {
    recordSecurityEvent(c, {
      actor: user,
      action: 'owner.access_denied',
      metadata: { reason: 'role_not_owner' },
    });
    return c.json({ error: 'Solo el owner puede realizar esta acción' }, 403);
  }

  await next();
});
