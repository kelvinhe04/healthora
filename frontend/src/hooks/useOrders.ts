import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { api } from '../lib/api';

export function useOrders() {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const token = await getToken();
      return api.orders.list(token!);
    },
    staleTime: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useOrderBySession(sessionId: string) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ['order-session', sessionId],
    queryFn: async () => {
      const token = await getToken();
      return api.orders.bySession(sessionId, token!);
    },
    enabled: !!sessionId,
    retry: 5,
    retryDelay: 1500,
  });
}
