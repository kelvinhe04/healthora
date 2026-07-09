import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { Product, ProductVariant } from '../types';
import { useCartStore } from '../store/cartStore';
import { useUiStore } from '../store/uiStore';
import { normalizeCatalogFilter, rememberCatalogBrands, clearStoredCatalogBrands, type CatalogFilter } from '../lib/catalogFilter';

export type View = 'landing' | 'catalog' | 'product' | 'checkout' | 'success' | 'admin' | 'club' | 'orders' | 'profile' | 'sample-picker' | 'compare' | 'wishlist';

// Remember where the landing was scrolled when we leave it via an in-app navigation, so the browser
// back button can return to that spot (the landing reads this on mount). Only meaningful while we're
// actually on the landing; other routes handle their own scroll.
function rememberLandingScroll() {
  if (typeof window === 'undefined' || window.location.pathname !== '/') return;
  try {
    sessionStorage.setItem('landingScrollY', String(Math.round(window.scrollY)));
  } catch {
    // sessionStorage unavailable - restoration just falls back to default
  }
}

function forgetLandingScroll() {
  try {
    sessionStorage.removeItem('landingScrollY');
    sessionStorage.removeItem('lastProductAnchor');
  } catch {
    // ignore
  }
}

export function useStorefrontNav() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const add = useCartStore((s) => s.add);
  const setCartOpen = useUiStore((s) => s.setCartOpen);
  const setCheckoutItems = useUiStore((s) => s.setCheckoutItems);

  const nav = (view: View, filter?: CatalogFilter, noScroll?: boolean, productId?: string) => {
    if (view !== 'checkout') setCheckoutItems(null);
    if (view === 'landing') {
      // Deliberately going to the landing (Home/logo) should land at the top, not restore.
      forgetLandingScroll();
    } else {
      // Leaving the landing for another view: remember the scroll position so browser-back returns
      // here. A non-product navigation must not reuse a stale precise product-card anchor.
      rememberLandingScroll();
      try {
        sessionStorage.removeItem('lastProductAnchor');
      } catch {
        // ignore
      }
    }

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
      case 'profile':
        navigate({ to: '/profile' });
        break;
      case 'sample-picker':
        navigate({ to: '/sample-picker' });
        break;
      case 'compare':
        navigate({ to: '/compare' });
        break;
      case 'wishlist':
        navigate({ to: '/wishlist' });
        break;
      case 'admin':
        navigate({ to: '/admin' });
        break;
    }

    if (!noScroll) window.scrollTo(0, 0);
  };

  const openProduct = (p: Product) => {
    // Hero/promo cards open products without going through nav(); remember the landing scroll here
    // too. Grid product cards additionally save a precise per-card anchor (see ProductCard).
    rememberLandingScroll();
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
