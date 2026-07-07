import { create } from 'zustand';
import type { CartItem } from '../types';

interface UiState {
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  checkoutItems: CartItem[] | null;
  setCheckoutItems: (items: CartItem[] | null) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  cartOpen: false,
  setCartOpen: (open) => set({ cartOpen: open }),
  checkoutItems: null,
  setCheckoutItems: (items) => set({ checkoutItems: items }),
}));
