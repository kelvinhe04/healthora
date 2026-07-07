import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WishlistState {
  productIds: string[];
  toggle: (productId: string) => boolean;
  remove: (productId: string) => void;
  clear: () => void;
  contains: (productId: string) => boolean;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      productIds: [],
      toggle: (productId) => {
        const current = get().productIds;
        if (current.includes(productId)) {
          set({ productIds: current.filter((id) => id !== productId) });
          return false;
        }
        set({ productIds: [...current, productId] });
        return true;
      },
      remove: (productId) => set((s) => ({ productIds: s.productIds.filter((id) => id !== productId) })),
      clear: () => set({ productIds: [] }),
      contains: (productId) => get().productIds.includes(productId),
    }),
    { name: 'healthora-wishlist' },
  ),
);
