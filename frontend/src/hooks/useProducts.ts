import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ProductFilters } from '../types';

export function useProducts(filters: ProductFilters = {}) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: () => api.products.list(filters),
    staleTime: 1000 * 60 * 5,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => api.products.get(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}
