import { Hono } from 'hono';
import { createBunWebSocket } from 'hono/bun';
import { verifyToken } from '@clerk/backend';
import { z } from 'zod';
import type { AppEnv } from '../types/hono';
import { Notification } from '../db/models/Notification';
import { User } from '../db/models/User';
import { clerkAuth } from '../middleware/clerkAuth';
import { objectIdSchema, parseParams, parseQuery } from '../lib/validation';
import {
  registerSocket,
  unregisterSocket,
  serializeNotification,
  connectionStats,
  type NotificationDoc,
  type SocketIdentity,
} from '../lib/realtime';
import { logger } from '../lib/logger';

const { upgradeWebSocket, websocket } = createBunWebSocket();

// Mirrors AUTHORIZED_PARTIES in middleware/clerkAuth.ts - the dev frontend origins Clerk tokens
// are minted for. Kept as a local copy so the WS handshake validates against the same set.
const AUTHORIZED_PARTIES = ['http://localhost:5173', 'http://localhost:5175', 'http://localhost:3001'];

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
});

const notificationIdParamsSchema = z.object({
  id: objectIdSchema,
});

/** Audiences a requester can see: their own `user` rows, every `all` broadcast, and - only if
 * they're an admin - the shared `admin` rows. */
function audienceFilter(clerkId: string, role: string) {
  const or: Record<string, unknown>[] = [
    { audience: 'user', recipientId: clerkId },
    { audience: 'all' },
  ];
  if (role === 'admin') or.push({ audience: 'admin' });
  return { $or: or };
}

/** Full inbox filter: audiences the requester can see, minus the rows they've dismissed. */
function inboxFilter(clerkId: string, role: string) {
  return { ...audienceFilter(clerkId, role), dismissedBy: { $ne: clerkId } };
}

/** Resolve a Clerk session token (passed as a WS query param, since browsers can't set an
 * Authorization header on the WebSocket handshake) into the identity the hub keys sockets by.
 * Returns null on any failure so the caller can reject the upgrade. */
async function resolveSocketIdentity(token: string | undefined): Promise<SocketIdentity | null> {
  if (!token) return null;

  // Test hook: `test:<clerkId>:<role>` avoids needing a live Clerk instance in integration tests.
  if (process.env.NODE_ENV === 'test' && token.startsWith('test:')) {
    const [, clerkId, role = 'customer'] = token.split(':');
    return clerkId ? { clerkId, role } : null;
  }

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties: AUTHORIZED_PARTIES,
    });
    if (!payload?.sub) return null;
    const user = await User.findOne({ clerkId: payload.sub }).lean();
    return { clerkId: payload.sub, role: user?.role || 'customer' };
  } catch (error) {
    logger.warn({ err: error }, '[notifications] WS token verification failed');
    return null;
  }
}

export const notificationsRouter = new Hono<AppEnv>()
  // Snapshot of connected sockets - lets the admin dashboard show the realtime channel is alive
  // (acceptance criterion: "el estado de la cola/canal es observable").
  .get('/ws/status', (c) => c.json(connectionStats()))

  .get('/', clerkAuth, async (c) => {
    const parsed = parseQuery(c, listQuerySchema);
    if (!parsed.success) return parsed.response;

    const user = c.get('user');
    const filter = inboxFilter(user.clerkId, user.role);
    const docs = await Notification.find(filter).sort({ createdAt: -1 }).limit(parsed.data.limit).lean();
    const notifications = docs.map((doc) => serializeNotification(doc as NotificationDoc, user.clerkId));
    const unread = notifications.filter((n) => !n.read).length;
    return c.json({ notifications, unread });
  })

  .patch('/:id/read', clerkAuth, async (c) => {
    const parsed = parseParams(c, notificationIdParamsSchema);
    if (!parsed.success) return parsed.response;

    const user = c.get('user');
    // Re-check audience so a user can't mark a notification that isn't addressed to them.
    const updated = await Notification.findOneAndUpdate(
      { _id: parsed.data.id, ...inboxFilter(user.clerkId, user.role) },
      { $addToSet: { readBy: user.clerkId } },
      { returnDocument: 'after' },
    ).lean();
    if (!updated) return c.json({ error: 'Not found' }, 404);
    return c.json(serializeNotification(updated as NotificationDoc, user.clerkId));
  })

  .post('/read-all', clerkAuth, async (c) => {
    const user = c.get('user');
    const result = await Notification.updateMany(
      { ...inboxFilter(user.clerkId, user.role), readBy: { $ne: user.clerkId } },
      { $addToSet: { readBy: user.clerkId } },
    );
    return c.json({ updated: result.modifiedCount ?? 0 });
  })

  // "Delete" for a user = dismiss (hide from their inbox). Shared admin/all rows stay for other
  // users; personal rows just get hidden. Matches on audience membership so re-deleting is a no-op.
  .delete('/:id', clerkAuth, async (c) => {
    const parsed = parseParams(c, notificationIdParamsSchema);
    if (!parsed.success) return parsed.response;

    const user = c.get('user');
    const updated = await Notification.findOneAndUpdate(
      { _id: parsed.data.id, ...audienceFilter(user.clerkId, user.role) },
      { $addToSet: { dismissedBy: user.clerkId } },
    ).lean();
    if (!updated) return c.json({ error: 'Not found' }, 404);
    return c.json({ success: true });
  })

  // Clear every notification currently in the requester's inbox (dismiss all).
  .delete('/', clerkAuth, async (c) => {
    const user = c.get('user');
    const result = await Notification.updateMany(
      inboxFilter(user.clerkId, user.role),
      { $addToSet: { dismissedBy: user.clerkId } },
    );
    return c.json({ cleared: result.modifiedCount ?? 0 });
  })

  // WebSocket channel. The Clerk token arrives as `?token=` (no auth header on WS handshakes). We
  // verify it inside the upgrade factory and, if valid, register the socket with the hub; an
  // invalid token gets an immediate close with policy-violation code 1008.
  .get(
    '/ws',
    upgradeWebSocket(async (c) => {
      const identity = await resolveSocketIdentity(c.req.query('token'));
      return {
        onOpen(_event, ws) {
          if (!identity) {
            ws.close(1008, 'unauthorized');
            return;
          }
          registerSocket(identity, ws);
          try {
            ws.send(JSON.stringify({ event: 'ready', data: { clerkId: identity.clerkId, role: identity.role } }));
          } catch {
            /* socket may already be gone */
          }
        },
        onClose(_event, ws) {
          unregisterSocket(ws);
        },
        onError(_event, ws) {
          unregisterSocket(ws);
        },
      };
    }),
  );

// Re-export Bun's websocket handler so index.ts can hand it to Bun.serve.
export { websocket };
