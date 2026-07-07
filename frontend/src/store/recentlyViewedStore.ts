import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_ITEMS = 12;

interface RecentlyViewedState {
  productIds: string[];
  track: (productId: string) => void;
  clear: () => void;
}

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set) => ({
      productIds: [],
      track: (productId) =>
        set((state) => {
          const next = [productId, ...state.productIds.filter((id) => id !== productId)].slice(0, MAX_ITEMS);
          return { productIds: next };
        }),
      clear: () => set({ productIds: [] }),
    }),
    { name: 'healthora-recently-viewed' },
  ),
);
