import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useReviews(productId: string) {
  return useQuery({
    queryKey: ['reviews', productId],
    queryFn: () => api.reviews.list(productId),
    staleTime: 1000 * 60 * 2,
    enabled: !!productId,
  });
}
