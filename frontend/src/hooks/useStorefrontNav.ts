import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { Product, ProductVariant } from '../types';
import { useCartStore } from '../store/cartStore';
import { useUiStore } from '../store/uiStore';
import { normalizeCatalogFilter, rememberCatalogBrands, clearStoredCatalogBrands, type CatalogFilter } from '../lib/catalogFilter';

export type View = 'landing' | 'catalog' | 'product' | 'checkout' | 'success' | 'admin' | 'club' | 'orders' | 'sample-picker';

export function useStorefrontNav() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const add = useCartStore((s) => s.add);
  const setCartOpen = useUiStore((s) => s.setCartOpen);
  const setCheckoutItems = useUiStore((s) => s.setCheckoutItems);

  const nav = (view: View, filter?: CatalogFilter, noScroll?: boolean, productId?: string) => {
    if (view !== 'checkout') setCheckoutItems(null);

    switch (view) {
      case 'landing':
        clearStoredCatalogBrands();
        navigate({ to: '/' });
        break;
      case 'catalog': {
        const nextFilter = normalizeCatalogFilter(filter);
        rememberCatalogBrands(nextFilter);
        navigate({ to: '/catalog', search: nextFilter });
        break;
      }
      case 'product':
        if (productId) navigate({ to: '/product/$productId', params: { productId } });
        break;
      case 'checkout':
        navigate({ to: '/checkout' });
        break;
      case 'success':
        navigate({ to: '/success' });
        break;
      case 'club':
        navigate({ to: '/club' });
        break;
      case 'orders':
        navigate({ to: '/orders' });
        break;
      case 'sample-picker':
        navigate({ to: '/sample-picker' });
        break;
      case 'admin':
        navigate({ to: '/admin' });
        break;
    }

    if (!noScroll) window.scrollTo(0, 0);
  };

  const openProduct = (p: Product) => {
    queryClient.setQueryData(['product', p.id], p);
    navigate({ to: '/product/$productId', params: { productId: p.id } });
  };

  const onAdd = (p: Product, qty = 1, variant?: ProductVariant) => {
    add(p, qty, variant);
    setCheckoutItems(null);
    setCartOpen(true);
  };

  const onBuyNow = (p: Product, qty: number, variant?: ProductVariant) => {
    setCheckoutItems([{ product: p, qty, variant }]);
    setCartOpen(false);
    navigate({ to: '/checkout' });
  };

  return { nav, openProduct, onAdd, onBuyNow };
}
