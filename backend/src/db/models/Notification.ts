import { Schema, model } from 'mongoose';

/** Real-time notification (HU-061). Persisted so the notification center survives reloads and so
 * the WebSocket layer is only an *accelerator* - a client that was offline when the event fired
 * still sees it on next `GET /notifications`.
 *
 * `audience` decides who the row is for:
 *  - `user`  -> a single customer, identified by `recipientId` (Clerk id).
 *  - `admin` -> every admin (shared row, no `recipientId`).
 *  - `all`   -> every authenticated visitor (shared row, used by `notifications.broadcast`).
 *
 * Read state is tracked per-user via `readBy` (a set of Clerk ids) rather than a single `read`
 * flag, so a shared `admin`/`all` row can be read by one admin without marking it read for the
 * rest. `read` in the API payload is computed per requester as `readBy.includes(clerkId)`. */
export type NotificationAudience = 'user' | 'admin' | 'all';

export type NotificationType =
  | 'order_paid'
  | 'order_shipped'
  | 'order_status'
  | 'new_order'
  | 'low_stock'
  | 'new_review'
  | 'return_requested'
  | 'return_status'
  | 'broadcast';

const NotificationSchema = new Schema(
  {
    audience: { type: String, enum: ['user', 'admin', 'all'], required: true },
    // Only set when audience === 'user'. Indexed for the per-user inbox query.
    recipientId: { type: String, default: null },
    type: {
      type: String,
      enum: ['order_paid', 'order_shipped', 'order_status', 'new_order', 'low_stock', 'new_review', 'return_requested', 'return_status', 'broadcast'],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    // Optional in-app deep link the frontend can navigate to (e.g. '/orders', '/product/olly').
    link: { type: String, default: null },
    // Free-form payload for the client (orderId, productId, rating, etc.).
    data: { type: Schema.Types.Mixed, default: {} },
    readBy: { type: [String], default: [] },
    // Per-user "delete": a user dismisses a notification by adding their Clerk id here. Shared
    // `admin`/`all` rows can't be row-deleted for one user without hiding them from the rest, so
    // the inbox simply excludes rows the requester has dismissed (same pattern as `readBy`).
    dismissedBy: { type: [String], default: [] },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipientId: 1, createdAt: -1 });
NotificationSchema.index({ audience: 1, createdAt: -1 });
// Supports the low-stock dedupe lookup (recent notification for a given product).
NotificationSchema.index({ type: 1, 'data.productId': 1, createdAt: -1 });
// Auto-retention: notifications self-expire after NOTIFICATION_TTL_DAYS (default 60) so the
// collection doesn't grow unbounded - the notification center is a recent-activity feed, not an
// archive. TTL is coarse (Mongo's background sweep runs ~every 60s); that's fine here.
NotificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: Number(process.env.NOTIFICATION_TTL_DAYS || 60) * 24 * 60 * 60 },
);

export const Notification = model('Notification', NotificationSchema);
