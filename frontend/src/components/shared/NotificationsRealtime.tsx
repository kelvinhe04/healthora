import { useEffect, useRef } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useQueryClient } from '@tanstack/react-query';
import { getNotificationsWsUrl } from '../../lib/notificationsSocket';
import { NOTIFICATIONS_QUERY_KEY, mergePushedNotification } from '../../hooks/useNotifications';
import { useNotificationToastStore } from '../../store/notificationToastStore';
import type { AppNotification, NotificationInbox } from '../../types';

const EMPTY_INBOX: NotificationInbox = { notifications: [], unread: 0 };
const MAX_BACKOFF_MS = 30_000;

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

      // A new order only ever reaches an admin socket (server-side audience routing), so no role
      // check is needed here - refresh the admin orders table + dashboard KPIs so a just-placed
      // order shows up without a manual page reload.
      if (notification.type === 'new_order') {
        void queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
        void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
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
