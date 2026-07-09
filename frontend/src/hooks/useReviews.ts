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

/** Per-product rating averages in one request - used by the admin products table (rating column
 * + sort) instead of one useReviews() per row. */
export function useReviewsSummary(enabled: boolean) {
  return useQuery({
    queryKey: ['reviews-summary'],
    queryFn: () => api.reviews.summary(),
    staleTime: 1000 * 60 * 2,
    enabled,
  });
}
