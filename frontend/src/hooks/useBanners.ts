import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useBanners() {
  return useQuery({
    queryKey: ['banners'],
    queryFn: api.banners.list,
    staleTime: 1000 * 60 * 5,
  });
}
