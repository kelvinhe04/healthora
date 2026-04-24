import { useState, useEffect, useRef } from 'react';
import type { Product } from './types';
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
import { AdminApp } from './pages/admin/AdminApp';
import { useCartStore } from './store/cartStore';
import { useSearchParams } from 'react-router-dom';
import { api } from './lib/api';

type View = 'landing' | 'catalog' | 'product' | 'checkout' | 'success' | 'admin';

function AppInner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = (searchParams.get('view') as View) || (localStorage.getItem('healthora_view') as View) || 'landing';
  const [view, setView] = useState<View>(initialView);
  const [catalogFilter, setCatalogFilter] = useState<{ category?: string; need?: string }>({});
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const { user } = useUser();
  const { getToken } = useAuth();
  const lastLoadedOwnerRef = useRef<string | null>(null);
  const skipNextCartSaveRef = useRef(false);
  const { add, items, bindOwner, replaceItems } = useCartStore();

  useEffect(() => {
    const v = searchParams.get('view') as View | null;
    if (v && v !== view) setView(v);
  }, [searchParams]);

  useEffect(() => {
    localStorage.setItem('healthora_view', view);
  }, [view]);

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

  const nav = (v: View, filter?: Record<string, string>, noScroll?: boolean) => {
    setView(v);
    if (filter) setCatalogFilter(filter);
    setSearchParams(v !== 'landing' ? { view: v } : {});
    if (!noScroll) window.scrollTo(0, 0);
  };

  const openProduct = (p: Product) => {
    setSelectedProduct(p);
    nav('product');
  };

  if (view === 'admin') {
    return <AdminApp onGoToStore={() => nav('landing')} />;
  }

  return (
    <>
      <Topbar />
      <Header onNav={nav} onOpenCart={() => setCartOpen(true)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} onCheckout={() => { setCartOpen(false); nav('checkout'); }} />
      <div style={{ minHeight: 'calc(100vh - 200px)' }}>
        {view === 'landing' && <Landing onNav={nav} onOpenProduct={openProduct} onAdd={(p, qty = 1) => { add(p, qty); setCartOpen(true); }} />}
        {view === 'catalog' && <Catalog initialFilter={catalogFilter} onOpenProduct={openProduct} onAdd={(p) => { add(p, 1); setCartOpen(true); }} />}
        {view === 'product' && selectedProduct && <ProductDetail product={selectedProduct} onAdd={(p, qty) => { add(p, qty); setCartOpen(true); }} onOpenProduct={openProduct} onBack={() => nav('catalog')} />}
        {view === 'checkout' && <Checkout items={items} onBack={() => nav('catalog')} />}
        {view === 'success' && <Success onBack={() => nav('landing')} />}
      </div>
      <Footer />
    </>
  );
}

export function App() {
  return <AppInner />;
}
