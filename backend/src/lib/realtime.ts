import { Notification, type NotificationAudience, type NotificationType } from '../db/models/Notification';
import { logger } from './logger';

/** In-memory WebSocket hub for real-time notifications (HU-061).
 *
 * This is intentionally single-process: the hub lives in the Bun worker's memory and fans out to
 * the sockets connected to *this* instance. Persistence (the `Notification` collection) is the
 * source of truth, so a horizontally-scaled deployment would only lose the "instant push" for
 * users pinned to another instance - they still receive everything on the next REST poll/reload.
 * Adding a Redis pub/sub bridge here (ioredis is already a dependency) would restore cross-instance
 * push without touching callers: every emit goes through {@link emitTo}. */

/** Minimal surface we need from a connected socket - matches Hono's `WSContext`. Kept structural
 * so the hub is trivially unit-testable with a plain `{ send, readyState }` stub, no real socket. */
export interface RealtimeSocket {
  send(data: string): void;
  readyState: number;
}

export interface SocketIdentity {
  clerkId: string;
  role: string;
}

const WS_OPEN = 1;

const userSockets = new Map<string, Set<RealtimeSocket>>();
const adminSockets = new Set<RealtimeSocket>();
const allSockets = new Set<RealtimeSocket>();
const socketIdentity = new Map<RealtimeSocket, SocketIdentity>();

export const LOW_STOCK_THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD || 5);

/** Register a freshly-authenticated socket. Every socket joins `allSockets` (for `audience:'all'`
 * broadcasts); admins additionally join `adminSockets`. */
export function registerSocket(identity: SocketIdentity, socket: RealtimeSocket): void {
  socketIdentity.set(socket, identity);
  allSockets.add(socket);

  let set = userSockets.get(identity.clerkId);
  if (!set) {
    set = new Set();
    userSockets.set(identity.clerkId, set);
  }
  set.add(socket);

  if (identity.role === 'admin') adminSockets.add(socket);
}

/** Drop a socket from every registry on close/error. Safe to call more than once. */
export function unregisterSocket(socket: RealtimeSocket): void {
  const identity = socketIdentity.get(socket);
  socketIdentity.delete(socket);
  allSockets.delete(socket);
  adminSockets.delete(socket);
  if (identity) {
    const set = userSockets.get(identity.clerkId);
    if (set) {
      set.delete(socket);
      if (set.size === 0) userSockets.delete(identity.clerkId);
    }
  }
}

/** Diagnostics for the observability surface (`GET /notifications/ws/status`). */
export function connectionStats() {
  return {
    totalSockets: allSockets.size,
    users: userSockets.size,
    admins: adminSockets.size,
  };
}

function sendToSet(sockets: Iterable<RealtimeSocket>, payload: string): number {
  let delivered = 0;
  for (const socket of sockets) {
    if (socket.readyState !== WS_OPEN) continue;
    try {
      socket.send(payload);
      delivered += 1;
    } catch (error) {
      logger.warn({ err: error }, '[realtime] socket send failed');
    }
  }
  return delivered;
}

/** Fan a serialized event out to the sockets an audience maps to. Returns how many sockets it
 * reached (0 doesn't mean failure - the recipient may simply be offline; the row is persisted). */
function emitTo(audience: NotificationAudience, recipientId: string | null, event: string, data: unknown): number {
  const payload = JSON.stringify({ event, data });
  if (audience === 'all') return sendToSet(allSockets, payload);
  if (audience === 'admin') return sendToSet(adminSockets, payload);
  if (!recipientId) return 0;
  const set = userSockets.get(recipientId);
  return set ? sendToSet(set, payload) : 0;
}

export interface NotificationDoc {
  _id: unknown;
  audience: NotificationAudience;
  recipientId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  data?: Record<string, unknown>;
  readBy?: string[];
  createdAt?: Date;
}

/** Shape a persisted notification for a specific requester - collapses the shared `readBy` set into
 * a per-user boolean so the client never has to know about audience/readBy mechanics. */
export function serializeNotification(doc: NotificationDoc, clerkId: string) {
  return {
    id: String(doc._id),
    type: doc.type,
    audience: doc.audience,
    title: doc.title,
    body: doc.body,
    link: doc.link ?? null,
    data: doc.data ?? {},
    read: (doc.readBy ?? []).includes(clerkId),
    createdAt: doc.createdAt ?? new Date(),
  };
}

export interface CreateNotificationInput {
  audience: NotificationAudience;
  recipientId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  data?: Record<string, unknown>;
}

/** Persist a notification and push it to any connected sockets for its audience. A brand-new row
 * is unread by everyone, so we serialize it against a sentinel id to force `read: false`. */
export async function createNotification(input: CreateNotificationInput) {
  const doc = await Notification.create({
    audience: input.audience,
    recipientId: input.audience === 'user' ? input.recipientId ?? null : null,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link ?? null,
    data: input.data ?? {},
    readBy: [],
  });

  const serialized = serializeNotification(doc.toObject() as NotificationDoc, ' ');
  const delivered = emitTo(input.audience, input.recipientId ?? null, 'notification', serialized);
  return { notification: serialized, delivered };
}

export function notifyUser(clerkId: string, input: Omit<CreateNotificationInput, 'audience' | 'recipientId'>) {
  return createNotification({ ...input, audience: 'user', recipientId: clerkId });
}

export function notifyAdmins(input: Omit<CreateNotificationInput, 'audience' | 'recipientId'>) {
  return createNotification({ ...input, audience: 'admin' });
}

export function notifyEveryone(input: Omit<CreateNotificationInput, 'audience' | 'recipientId'>) {
  return createNotification({ ...input, audience: 'all' });
}

/** One concrete stock "cell": a product without variants, a simple variant, or a sabor×tamaño
 * combo. Low-stock alerts operate at this granularity so a critical combo isn't masked by the
 * product's healthy total (the reason the product-total approach missed low variants). */
export interface LowStockCell {
  productId: string;
  /** Mongo document id - lets the notification deep-link into the admin edit modal
   * (`?productId=<mongoId>`), since the admin UI keys products by `_id`, not the slug `productId`. */
  productMongoId?: string | null;
  productName?: string | null;
  /** null = product-level; `<id>` = simple variant; `<primary>:<size>` = combo. */
  variantId?: string | null;
  variantLabel?: string | null;
  stock: number;
}

/** Emit a low-stock admin alert for a single stock cell that is at/under the threshold. Deduped
 * per product+variant: skips if an alert for the same cell already fired within `dedupeWindowMs`,
 * so a burst of purchases (or repeated admin saves) doesn't spam admins. */
export async function maybeNotifyLowStock(
  cell: LowStockCell,
  opts: { threshold?: number; dedupeWindowMs?: number } = {},
) {
  const threshold = opts.threshold ?? LOW_STOCK_THRESHOLD;
  if (cell.stock > threshold) return null;

  const dedupeWindowMs = opts.dedupeWindowMs ?? 6 * 60 * 60 * 1000;
  const variantId = cell.variantId ?? null;
  const since = new Date(Date.now() - dedupeWindowMs);
  const recent = await Notification.findOne({
    type: 'low_stock',
    'data.productId': cell.productId,
    'data.variantId': variantId,
    createdAt: { $gte: since },
  }).lean();
  if (recent) return null;

  const label = cell.productName || cell.productId;
  const suffix = cell.variantLabel ? ` (${cell.variantLabel})` : '';
  // Deep-link straight into the admin edit modal, positioned at the exact variant/combo, so the
  // admin doesn't have to hunt for the product in the table. Falls back to the plain products list
  // if we somehow don't have a Mongo id (shouldn't happen for a real product).
  const link = cell.productMongoId
    ? `/admin?section=products&modal=edit&productId=${encodeURIComponent(cell.productMongoId)}${
        variantId ? `&highlightVariant=${encodeURIComponent(variantId)}` : ''
      }`
    : '/admin?section=products';
  return notifyAdmins({
    type: 'low_stock',
    title: 'Stock bajo',
    body: cell.stock <= 0
      ? `"${label}"${suffix} se quedó sin stock.`
      : `"${label}"${suffix} tiene ${cell.stock} unidad${cell.stock === 1 ? '' : 'es'} en stock.`,
    link,
    data: { productId: cell.productId, productMongoId: cell.productMongoId ?? null, variantId, stock: cell.stock, threshold },
  });
}

/** Test-only: clear every registry so hub state doesn't leak between test cases. */
export function __resetRealtimeForTests() {
  userSockets.clear();
  adminSockets.clear();
  allSockets.clear();
  socketIdentity.clear();
}
