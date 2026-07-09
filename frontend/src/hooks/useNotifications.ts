import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth, useUser } from '@clerk/clerk-react';
import { api } from '../lib/api';
import type { AppNotification, NotificationInbox } from '../types';

export const NOTIFICATIONS_QUERY_KEY = ['notifications'] as const;

const EMPTY_INBOX: NotificationInbox = { notifications: [], unread: 0 };

/** Reads the persistent notification inbox. Polls as a fallback so the center stays fresh even if
 * the WebSocket can't connect (e.g. behind a proxy that doesn't upgrade WS); the socket, when up,
 * pushes updates into this same cache for instant delivery. */
export function useNotifications() {
  const { isSignedIn } = useUser();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: async () => {
      const token = await getToken();
      if (!token) return EMPTY_INBOX;
      return api.notifications.list(token, 30);
    },
    enabled: !!isSignedIn,
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const inbox = query.data ?? EMPTY_INBOX;

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken();
      if (!token) return;
      await api.notifications.markRead(id, token);
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      const previous = queryClient.getQueryData<NotificationInbox>(NOTIFICATIONS_QUERY_KEY);
      queryClient.setQueryData<NotificationInbox>(NOTIFICATIONS_QUERY_KEY, (current) =>
        markOneReadInInbox(current ?? EMPTY_INBOX, id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      if (!token) return;
      await api.notifications.markAllRead(token);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      const previous = queryClient.getQueryData<NotificationInbox>(NOTIFICATIONS_QUERY_KEY);
      queryClient.setQueryData<NotificationInbox>(NOTIFICATIONS_QUERY_KEY, (current) => ({
        notifications: (current ?? EMPTY_INBOX).notifications.map((n) => ({ ...n, read: true })),
        unread: 0,
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
  }, [queryClient]);

  return {
    notifications: inbox.notifications,
    unread: inbox.unread,
    isLoading: query.isLoading,
    markRead: markRead.mutate,
    markAllRead: markAllRead.mutate,
    refresh,
  };
}

/** Prepend a pushed notification to the cached inbox, de-duplicating by id (the poll and the
 * socket can race). Exported for the realtime component and unit tests. */
export function mergePushedNotification(inbox: NotificationInbox, incoming: AppNotification): NotificationInbox {
  const withoutDup = inbox.notifications.filter((n) => n.id !== incoming.id);
  const notifications = [incoming, ...withoutDup].slice(0, 50);
  return { notifications, unread: notifications.filter((n) => !n.read).length };
}

function markOneReadInInbox(inbox: NotificationInbox, id: string): NotificationInbox {
  const notifications = inbox.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
  return { notifications, unread: notifications.filter((n) => !n.read).length };
}
