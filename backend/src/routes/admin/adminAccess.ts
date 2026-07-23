import { Hono } from 'hono';
import { clerkAuth } from '../../middleware/clerkAuth';
import type { AppEnv } from '../../types/hono';
import { recordSecurityEvent } from '../../lib/securityAudit';
import { shouldRecordThrottled, AUDIT_ACCESS_THROTTLE_MS } from '../../lib/auditThrottle';

export const adminAccessRouter = new Hono<AppEnv>()
  .use('*', clerkAuth)
  .get('/', (c) => {
    const user = c.get('user');
    const allowed = user.role === 'admin' || user.role === 'owner';
    const action = allowed ? 'admin.access_check_allowed' : 'admin.access_check_denied';
    // The frontend re-checks this on every route change to decide whether to show the admin nav
    // link, for every logged-in user - throttled per clerkId+action for the same reason as
    // auth.login/admin.access above (#315).
    if (shouldRecordThrottled(`${action}:${user.clerkId}`, AUDIT_ACCESS_THROTTLE_MS)) {
      recordSecurityEvent(c, {
        actor: user,
        action,
      });
    }

    return c.json({
      allowed,
      role: user.role,
      name: user.name,
      email: user.email,
    });
  });
