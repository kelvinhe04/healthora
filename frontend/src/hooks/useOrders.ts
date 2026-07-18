import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useEffectiveToken } from './useEffectiveToken';

export function useOrders() {
  const getToken = useEffectiveToken();
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
  const getToken = useEffectiveToken();
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

export function useOrderByPaymentIntent(paymentIntentId: string) {
  const getToken = useEffectiveToken();
  return useQuery({
    queryKey: ['order-payment-intent', paymentIntentId],
    queryFn: async () => {
      const token = await getToken();
      return api.orders.byPaymentIntent(paymentIntentId, token!);
    },
    enabled: !!paymentIntentId,
    retry: 5,
    retryDelay: 1500,
  });
}
