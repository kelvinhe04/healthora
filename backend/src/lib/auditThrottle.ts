const lastRecordedAt = new Map<string, number>();

/** auth.login / admin.access / admin.access_check_* fire on every authenticated request instead
 * of once per session, flooding the append-only audit log until whoever is currently most active
 * drowns out everyone else's real actions (#315). Collapses repeats of the same actor+action
 * within `windowMs` down to a single entry - in-memory rather than a DB read so it doesn't add a
 * query to every authenticated request; resets on process restart, which just means one extra log
 * line gets written, never a missing one. */
export function shouldRecordThrottled(key: string, windowMs: number): boolean {
  const now = Date.now();
  const last = lastRecordedAt.get(key);
  if (last !== undefined && now - last < windowMs) return false;
  lastRecordedAt.set(key, now);
  return true;
}

export const AUDIT_ACCESS_THROTTLE_MS = 10 * 60 * 1000;

export function __resetAuditThrottleForTests() {
  lastRecordedAt.clear();
}
