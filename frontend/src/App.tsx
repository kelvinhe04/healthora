import { useState, useEffect, useRef } from 'react';
import type { CartItem, Product } from './types';
import { useAuth, useUser } from '@clerk/clerk-react';
import { Topbar } from './components/chrome/Topbar';
import { Header } from './components/chrome/Header';
import { Footer } from './components/chrome/Footer';
import { Landing } from './pages/Landing';
import { Catalog } from './pages/Catalog';
import { ProductDetail } from './pages/ProductDetail';
import { CartDrawer } from './pages/CartDrawer';
import { Checkout } from './pages/Checkout';
import { Success } from './pages/Success';
import { Club } from './pages/Club';
import { Orders } from './pages/Orders';
import { AdminApp } from './pages/admin/AdminApp';
import { SSOCallbackPage } from './components/SSOCallback';
import { CustomCursor } from './components/shared/CustomCursor';
import { useCartStore } from './store/cartStore';
import { useSearchParams, useLocation } from 'react-router-dom';
import { api } from './lib/api';
import { useProduct } from './hooks/useProducts';

type View = 'landing' | 'catalog' | 'product' | 'checkout' | 'success' | 'admin' | 'club' | 'orders';
type CatalogFilter = { category?: string; need?: string; search?: string; page?: number; brand?: string; brands?: string[] };
const CATALOG_BRANDS_STORAGE_KEY = 'healthora_catalog_brands';

function getFilterBrands(filter?: CatalogFilter): string[] {
  return filter?.brands?.length ? filter.brands : filter?.brand ? [filter.brand] : [];
}

function readStoredCatalogBrands(): string[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CATALOG_BRANDS_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function rememberCatalogBrands(filter?: CatalogFilter) {
  const brands = getFilterBrands(filter);
  if (brands.length) {
    sessionStorage.setItem(CATALOG_BRANDS_STORAGE_KEY, JSON.stringify(brands));
  } else {
    sessionStorage.removeItem(CATALOG_BRANDS_STORAGE_KEY);
  }
}

function hasCatalogUrlFilters(searchParams: URLSearchParams): boolean {
  return ['category', 'need', 'search', 'page', 'brand'].some((key) => searchParams.has(key));
}

function readCatalogFilter(searchParams: URLSearchParams): CatalogFilter {
  const category = searchParams.get('category') || undefined;
  const need = searchParams.get('need') || undefined;
  const search = searchParams.get('search') || undefined;
  const brand = searchParams.get('brand') || undefined;
  const pageValue = Number(searchParams.get('page'));
  const page = Number.isFinite(pageValue) && pageValue > 1 ? pageValue : undefined;
  return { category, need, search, page, brand };
}

function normalizeCatalogFilter(filter?: CatalogFilter): CatalogFilter {
  const brands = getFilterBrands(filter);
  return {
    category: filter?.category && filter.category !== 'Todos' ? filter.category : undefined,
    need: filter?.need || undefined,
    search: filter?.search?.trim() ? filter.search : undefined,
    page: filter?.page && filter.page > 1 ? filter.page : undefined,
    brand: brands[0] || undefined,
    brands: brands.length ? brands : undefined,
  };
}

function buildSearchParams(view: View, filter?: CatalogFilter, productId?: string) {
  const normalized = normalizeCatalogFilter(filter);
  return view === 'landing'
    ? {}
    : {
        view,
        ...(normalized.category ? { category: normalized.category } : {}),
        ...(normalized.need ? { need: normalized.need } : {}),
        ...(normalized.search ? { search: normalized.search } : {}),
        ...(normalized.page ? { page: String(normalized.page) } : {}),
        ...(view === 'product' && productId ? { productId } : {}),
      };
}

function AppInner() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSSOCallback = location.pathname === '/sso-callback';
  const initialView = (searchParams.get('view') as View) || (localStorage.getItem('healthora_view') as View) || 'landing';
  const [view, setView] = useState<View>(initialView);
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>(() => readCatalogFilter(searchParams));
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [checkoutItems, setCheckoutItems] = useState<CartItem[] | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const { user } = useUser();
  const { getToken } = useAuth();
  const productIdFromUrl = searchParams.get('productId') || '';
  const lastLoadedOwnerRef = useRef<string | null>(null);
  const skipNextCartSaveRef = useRef(false);
  const { add, items, bindOwner, replaceItems } = useCartStore();
  const { data: productFromUrl, isLoading: isProductLoading } = useProduct(view === 'product' ? productIdFromUrl : '');
  const activeProduct = selectedProduct && (!productIdFromUrl || selectedProduct.id === productIdFromUrl) ? selectedProduct : (productFromUrl ?? null);

  useEffect(() => {
    const v = searchParams.get('view') as View | null;
    if (v && v !== view) setView(v);
    const nextFilter = readCatalogFilter(searchParams);
    const nextView = v || view;
    const hasUrlFilters = hasCatalogUrlFilters(searchParams);
    if (nextView === 'catalog' && !hasUrlFilters) {
      const storedBrands = readStoredCatalogBrands();
      if (storedBrands.length) {
        nextFilter.brand = storedBrands[0];
        nextFilter.brands = storedBrands;
      }
    }
    if (nextView !== 'catalog' && !hasUrlFilters) return;
    setCatalogFilter(nextFilter);
  }, [searchParams]);

  useEffect(() => {
    localStorage.setItem('healthora_view', view);
  }, [view]);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 500);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    bindOwner(user?.id ?? null);
  }, [bindOwner, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      lastLoadedOwnerRef.current = null;
      return;
    }

    let cancelled = false;

    const loadRemoteCart = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const remoteItems = await api.cart.get(token);
        if (cancelled) return;
        skipNextCartSaveRef.current = true;
        replaceItems(remoteItems);
        lastLoadedOwnerRef.current = user.id;
      } catch (error) {
        console.error('Failed to load remote cart', error);
      }
    };

    void loadRemoteCart();

    return () => {
      cancelled = true;
    };
  }, [getToken, replaceItems, user?.id]);

  useEffect(() => {
    if (!user?.id || lastLoadedOwnerRef.current !== user.id) return;
    if (skipNextCartSaveRef.current) {
      skipNextCartSaveRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const token = await getToken();
          if (!token) return;
          await api.cart.save(
            items.map((item) => ({ productId: item.product.id, qty: item.qty })),
            token
          );
        } catch (error) {
          console.error('Failed to save remote cart', error);
        }
      })();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [getToken, items, user?.id]);

  const nav = (v: View, filter?: CatalogFilter, noScroll?: boolean, productId?: string) => {
    const nextFilter = filter ? normalizeCatalogFilter(filter) : catalogFilter;
    setView(v);
    if (filter) setCatalogFilter(nextFilter);
    if (v === 'catalog') rememberCatalogBrands(nextFilter);
    if (v === 'landing') sessionStorage.removeItem(CATALOG_BRANDS_STORAGE_KEY);
    if (v !== 'checkout') setCheckoutItems(null);
    setSearchParams(buildSearchParams(v, nextFilter, productId));
    if (!noScroll) window.scrollTo(0, 0);
  };

  const syncCatalogFilter = (filter: CatalogFilter) => {
    const nextFilter = normalizeCatalogFilter(filter);
    setCatalogFilter(nextFilter);
    rememberCatalogBrands(nextFilter);
    setSearchParams(buildSearchParams('catalog', nextFilter), { replace: true });
  };

  const openProduct = (p: Product) => {
    setSelectedProduct(p);
    nav('product', undefined, undefined, p.id);
  };

  useEffect(() => {
    if (view !== 'product') return;
    if (activeProduct || isProductLoading) return;
    nav('catalog', catalogFilter, true);
  }, [activeProduct, catalogFilter, isProductLoading, view]);

  if (isSSOCallback) {
    return <SSOCallbackPage onSuccess={() => nav('landing')} />;
  }

  if (view === 'admin') {
    return <AdminApp onGoToStore={() => nav('landing')} />;
  }

  return (
    <>
      <CustomCursor />
      <Topbar />
      <Header onNav={nav} onOpenCart={() => setCartOpen(true)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} onCheckout={() => { setCheckoutItems(null); setCartOpen(false); nav('checkout'); }} />
      <div style={{ minHeight: 'calc(100vh - 200px)' }}>
        {view === 'landing' && <Landing onNav={nav} onOpenProduct={openProduct} onAdd={(p, qty = 1) => { add(p, qty); setCheckoutItems(null); setCartOpen(true); }} />}
        {view === 'catalog' && <Catalog initialFilter={catalogFilter} onFilterChange={syncCatalogFilter} onOpenProduct={openProduct} onAdd={(p) => { add(p, 1); setCheckoutItems(null); setCartOpen(true); }} />}
        {view === 'product' && activeProduct && (
          <ProductDetail
            product={activeProduct}
            onAdd={(p, qty) => { add(p, qty); setCheckoutItems(null); setCartOpen(true); }}
            onBuyNow={(p, qty) => {
              setCheckoutItems([{ product: p, qty }]);
              setCartOpen(false);
              nav('checkout');
            }}
            onOpenProduct={openProduct}
            onBack={() => nav('catalog')}
          />
        )}
        {view === 'checkout' && <Checkout items={checkoutItems ?? items} onBack={() => nav('catalog')} />}
        {view === 'success' && <Success onBack={() => nav('landing')} />}
        {view === 'club' && <Club onNav={nav} />}
        {view === 'orders' && <Orders onBack={() => nav('catalog')} />}
      </div>
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Volver arriba"
          style={{ position: 'fixed', right: 28, bottom: 28, width: 52, height: 52, borderRadius: 999, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--green)', color: 'var(--lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 18px 40px -18px rgba(0,0,0,0.35)', zIndex: 80, transition: 'transform 180ms ease, opacity 180ms ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.04)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; }}
        >
          <span style={{ transform: 'rotate(-90deg)', display: 'inline-flex' }}>
            <HeaderBackToTopIcon />
          </span>
        </button>
      )}
      <Footer />
    </>
  );
}

function HeaderBackToTopIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function App() {
  return <AppInner />;
}
