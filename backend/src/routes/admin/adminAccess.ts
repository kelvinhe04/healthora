import { Hono } from 'hono';
import { clerkAuth } from '../../middleware/clerkAuth';
import type { AppEnv } from '../../types/hono';
import { recordSecurityEvent } from '../../lib/securityAudit';

export const adminAccessRouter = new Hono<AppEnv>()
  .use('*', clerkAuth)
  .get('/', (c) => {
    const user = c.get('user');
    const allowed = user.role === 'admin' || user.role === 'owner';
    recordSecurityEvent(c, {
      actor: user,
      action: allowed ? 'admin.access_check_allowed' : 'admin.access_check_denied',
    });

    return c.json({
      allowed,
      role: user.role,
      name: user.name,
      email: user.email,
    });
  });
