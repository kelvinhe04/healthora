import { useEffect, useRef } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useQueryClient } from '@tanstack/react-query';
import { getNotificationsWsUrl } from '../../lib/notificationsSocket';
import { NOTIFICATIONS_QUERY_KEY, mergePushedNotification } from '../../hooks/useNotifications';
import { useNotificationToastStore } from '../../store/notificationToastStore';
import type { AppNotification, NotificationInbox } from '../../types';

const EMPTY_INBOX: NotificationInbox = { notifications: [], unread: 0 };
const MAX_BACKOFF_MS = 30_000;

/** Which list/dashboard queries to refresh when a given notification type arrives, so the panel
 * updates live instead of waiting for a manual reload. Covers both admin-audience events
 * (`new_review`, `low_stock`, `new_order`, `return_requested`) and user-audience events
 * (`order_status`, `order_shipped`, `order_paid`, `return_status`) - each client only ever
 * receives notifications addressed to it (see notifyUser/notifyAdmins), so invalidating a query
 * key that isn't mounted on that client (e.g. an admin key on a customer's browser) is a harmless
 * no-op. Safe to grow as more events get their own notification type. */
const INVALIDATION_BY_TYPE: Partial<Record<AppNotification['type'], string[][]>> = {
  new_review: [['admin', 'reviews'], ['admin-dashboard']],
  low_stock: [['admin-products'], ['admin-products-count'], ['admin-dashboard']],
  new_order: [['admin-orders'], ['admin-dashboard']],
  return_requested: [['admin', 'returns'], ['admin-dashboard'], ['admin-returns-count']],
  order_paid: [['orders']],
  order_shipped: [['orders']],
  order_status: [['orders']],
  return_status: [['returns'], ['orders']],
};

/** Headless component (mounted once at the app root) that keeps a live WebSocket to the backend
 * notification channel (HU-061). Incoming events are folded into the shared React Query cache so
 * the bell and dropdown update instantly, and a transient toast is raised. Reconnects with
 * exponential backoff; when signed out it closes and stays closed. If the socket can never
 * connect, the REST poll in useNotifications keeps the center functional. */
export function NotificationsRealtime() {
  const { isSignedIn } = useUser();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const pushToast = useNotificationToastStore((s) => s.push);

  // Latest values without retriggering the connect effect on every render. Synced in an effect
  // (never written during render) so the socket lifecycle only keys off sign-in state.
  const getTokenRef = useRef(getToken);
  const pushToastRef = useRef(pushToast);
  useEffect(() => {
    getTokenRef.current = getToken;
    pushToastRef.current = pushToast;
  });

  useEffect(() => {
    if (!isSignedIn || typeof window === 'undefined') return;

    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let attempts = 0;
    let disposed = false;

    const handleNotification = (notification: AppNotification) => {
      queryClient.setQueryData<NotificationInbox>(NOTIFICATIONS_QUERY_KEY, (current) =>
        mergePushedNotification(current ?? EMPTY_INBOX, notification),
      );
      pushToastRef.current(notification);
      for (const queryKey of INVALIDATION_BY_TYPE[notification.type] ?? []) {
        void queryClient.invalidateQueries({ queryKey });
      }
    };

    const scheduleReconnect = () => {
      if (disposed) return;
      attempts += 1;
      const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.min(attempts, 5));
      reconnectTimer = window.setTimeout(connect, delay);
    };

    const connect = async () => {
      if (disposed) return;
      let token: string | null;
      try {
        token = await getTokenRef.current();
      } catch {
        token = null;
      }
      if (disposed || !token) {
        scheduleReconnect();
        return;
      }

      try {
        socket = new WebSocket(getNotificationsWsUrl(token));
      } catch {
        scheduleReconnect();
        return;
      }

      socket.onopen = () => {
        attempts = 0;
        // Reconcile against anything missed while the socket was down.
        void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data as string) as { event: string; data: unknown };
          if (parsed.event === 'notification') {
            handleNotification(parsed.data as AppNotification);
          }
        } catch {
          /* ignore malformed frames */
        }
      };

      socket.onclose = () => {
        socket = null;
        scheduleReconnect();
      };

      socket.onerror = () => {
        // onclose fires after onerror and handles the reconnect; just close defensively.
        try {
          socket?.close();
        } catch {
          /* noop */
        }
      };
    };

    void connect();

    return () => {
      disposed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (socket) {
        socket.onclose = null;
        socket.onerror = null;
        try {
          socket.close();
        } catch {
          /* noop */
        }
      }
    };
  }, [isSignedIn, queryClient]);

  return null;
}
