import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, Product } from '../types';

interface CartState {
  items: CartItem[];
  add: (product: Product, qty?: number) => void;
  update: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  count: () => number;
  subtotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (product, qty = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.product.id === product.id);
          if (existing) {
            return { items: s.items.map((i) => i.product.id === product.id ? { ...i, qty: i.qty + qty } : i) };
          }
          return { items: [...s.items, { product, qty }] };
        }),
      update: (productId, qty) =>
        set((s) => ({
          items: qty <= 0
            ? s.items.filter((i) => i.product.id !== productId)
            : s.items.map((i) => i.product.id === productId ? { ...i, qty } : i),
        })),
      remove: (productId) =>
        set((s) => ({ items: s.items.filter((i) => i.product.id !== productId) })),
      clear: () => set({ items: [] }),
      count: () => get().items.reduce((n, i) => n + i.qty, 0),
      subtotal: () => get().items.reduce((n, i) => n + i.product.price * i.qty, 0),
    }),
    { name: 'healthora-cart' }
  )
);
