import type { Context } from 'hono';
import { SecurityAuditLog } from '../db/models/SecurityAuditLog';
import type { AuthUser } from '../types/hono';

type AuditUser = Partial<AuthUser> & {
  email?: string;
};

type AuditTarget = {
  clerkId?: string;
  userId?: unknown;
  email?: string;
};

type AuditEvent = {
  actor?: AuditUser | null;
  action: string;
  resource?: string;
  target?: AuditTarget | null;
  metadata?: Record<string, unknown>;
};

function getRequestIp(c?: Context) {
  return (
    c?.req.header('cf-connecting-ip') ||
    c?.req.header('x-real-ip') ||
    c?.req.header('x-forwarded-for')?.split(',')[0]?.trim()
  );
}

export function recordSecurityEvent(c: Context | undefined, event: AuditEvent) {
  const actor = event.actor;
  const target = event.target;

  SecurityAuditLog.create({
    actorClerkId: actor?.clerkId,
    actorUserId: actor?._id,
    actorEmail: actor?.email,
    actorRole: actor?.role,
    action: event.action,
    resource: event.resource || (c ? `${c.req.method} ${new URL(c.req.url).pathname}` : undefined),
    targetClerkId: target?.clerkId,
    targetUserId: target?.userId,
    targetEmail: target?.email,
    ip: getRequestIp(c),
    userAgent: c?.req.header('user-agent'),
    metadata: event.metadata,
  }).catch((error) => {
    console.error('[SECURITY_AUDIT] Failed to write audit log:', error);
  });
}
