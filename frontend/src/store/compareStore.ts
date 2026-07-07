import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_COMPARE = 4;

interface CompareState {
  productIds: string[];
  toggle: (productId: string) => 'added' | 'removed' | 'full';
  remove: (productId: string) => void;
  clear: () => void;
  contains: (productId: string) => boolean;
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      productIds: [],
      toggle: (productId) => {
        const current = get().productIds;
        if (current.includes(productId)) {
          set({ productIds: current.filter((id) => id !== productId) });
          return 'removed';
        }
        if (current.length >= MAX_COMPARE) return 'full';
        set({ productIds: [...current, productId] });
        return 'added';
      },
      remove: (productId) => set((s) => ({ productIds: s.productIds.filter((id) => id !== productId) })),
      clear: () => set({ productIds: [] }),
      contains: (productId) => get().productIds.includes(productId),
    }),
    { name: 'healthora-compare' },
  ),
);

export const MAX_COMPARE_PRODUCTS = MAX_COMPARE;
