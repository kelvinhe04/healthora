import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, Product, ProductVariant } from '../types';

const GUEST_OWNER = '__guest__';

const itemKey = (productId: string, variantId?: string) =>
  variantId ? `${productId}:${variantId}` : productId;

const matchItem = (i: CartItem, productId: string, variantId?: string) =>
  i.product.id === productId && i.variant?.id === variantId;

const itemPrice = (i: CartItem) => i.variant?.price ?? i.product.price;
const itemStock = (i: CartItem) => i.variant?.stock ?? i.product.stock;

interface CartState {
  ownerId: string;
  items: CartItem[];
  cartsByOwner: Record<string, CartItem[]>;
  freeSample: Product | null;
  bindOwner: (ownerId: string | null | undefined) => void;
  replaceItems: (items: CartItem[]) => void;
  add: (product: Product, qty?: number, variant?: ProductVariant) => void;
  update: (productId: string, qty: number, variantId?: string) => void;
  changeVariant: (productId: string, oldVariantId: string | undefined, newVariant: ProductVariant) => void;
  remove: (productId: string, variantId?: string) => void;
  clear: () => void;
  count: () => number;
  subtotal: () => number;
  setFreeSample: (p: Product | null) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      ownerId: GUEST_OWNER,
      items: [],
      cartsByOwner: {},
      freeSample: null,
      bindOwner: (ownerId) =>
        set((s) => {
          const nextOwnerId = ownerId || GUEST_OWNER;
          const nextCartsByOwner = nextOwnerId === GUEST_OWNER
            ? { ...s.cartsByOwner, [GUEST_OWNER]: [] }
            : s.cartsByOwner;

          return {
            ownerId: nextOwnerId,
            cartsByOwner: nextCartsByOwner,
            items: nextCartsByOwner[nextOwnerId] || [],
          };
        }),
      replaceItems: (items) =>
        set((s) => ({
          items,
          cartsByOwner: { ...s.cartsByOwner, [s.ownerId]: items },
        })),
      add: (product, qty = 1, variant) =>
        set((s) => {
          const effectiveStock = variant?.stock ?? product.stock;
          if (effectiveStock === 0) return s;
          const ownerItems = s.cartsByOwner[s.ownerId] || [];
          const existing = ownerItems.find((i) => matchItem(i, product.id, variant?.id));
          const currentQty = existing?.qty ?? 0;
          const allowed = Math.min(qty, effectiveStock - currentQty);
          if (allowed <= 0) return s;
          const nextItems = existing
            ? ownerItems.map((i) => matchItem(i, product.id, variant?.id) ? { ...i, qty: currentQty + allowed } : i)
            : [...ownerItems, { product, qty: allowed, variant }];

          return {
            items: nextItems,
            cartsByOwner: { ...s.cartsByOwner, [s.ownerId]: nextItems },
          };
        }),
      update: (productId, qty, variantId) =>
        set((s) => {
          const ownerItems = s.cartsByOwner[s.ownerId] || [];
          const existing = ownerItems.find((i) => matchItem(i, productId, variantId));
          const stock = existing ? itemStock(existing) : Infinity;
          const nextItems = qty <= 0
            ? ownerItems.filter((i) => !matchItem(i, productId, variantId))
            : ownerItems.map((i) => matchItem(i, productId, variantId) ? { ...i, qty: Math.min(qty, stock) } : i);

          return {
            items: nextItems,
            cartsByOwner: { ...s.cartsByOwner, [s.ownerId]: nextItems },
          };
        }),
      // Swaps the variant/combo of an existing line (e.g. wrong sabor/tamaño picked at add-to-cart
      // time). If the target variant is already a separate line in the cart, merge quantities into
      // it (capped at the new variant's stock) instead of ending up with two lines for the same
      // combo.
      changeVariant: (productId, oldVariantId, newVariant) =>
        set((s) => {
          const ownerItems = s.cartsByOwner[s.ownerId] || [];
          const existing = ownerItems.find((i) => matchItem(i, productId, oldVariantId));
          if (!existing || newVariant.stock <= 0) return s;

          const mergeTarget = ownerItems.find(
            (i) => !matchItem(i, productId, oldVariantId) && matchItem(i, productId, newVariant.id),
          );

          let nextItems: CartItem[];
          if (mergeTarget) {
            const mergedQty = Math.min(existing.qty + mergeTarget.qty, newVariant.stock);
            nextItems = ownerItems
              .filter((i) => !matchItem(i, productId, oldVariantId))
              .map((i) => (matchItem(i, productId, newVariant.id) ? { ...i, qty: mergedQty } : i));
          } else {
            const clampedQty = Math.min(existing.qty, newVariant.stock);
            nextItems = ownerItems.map((i) =>
              matchItem(i, productId, oldVariantId) ? { ...i, variant: newVariant, qty: clampedQty } : i,
            );
          }

          return {
            items: nextItems,
            cartsByOwner: { ...s.cartsByOwner, [s.ownerId]: nextItems },
          };
        }),
      remove: (productId, variantId) =>
        set((s) => {
          const nextItems = (s.cartsByOwner[s.ownerId] || []).filter((i) => !matchItem(i, productId, variantId));

          return {
            items: nextItems,
            cartsByOwner: { ...s.cartsByOwner, [s.ownerId]: nextItems },
          };
        }),
      clear: () =>
        set((s) => ({
          items: [],
          cartsByOwner: { ...s.cartsByOwner, [s.ownerId]: [] },
          freeSample: null,
        })),
      count: () => get().items.reduce((n, i) => n + i.qty, 0),
      subtotal: () => get().items.reduce((n, i) => n + itemPrice(i) * i.qty, 0),
      setFreeSample: (p) => set({ freeSample: p }),
    }),
    { name: 'healthora-cart' }
  )
);

export { itemKey };
