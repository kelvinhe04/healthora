import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useAuth, useUser } from "@clerk/clerk-react";
import { Topbar } from "../components/chrome/Topbar";
import { Header } from "../components/chrome/Header";
import { Footer } from "../components/chrome/Footer";
import { CartDrawer } from "../pages/CartDrawer";
import { SkipToContent } from "../components/shared/SkipToContent";
import { useCartStore } from "../store/cartStore";
import { useWishlistStore } from "../store/wishlistStore";
import { useUiStore } from "../store/uiStore";
import { useThemeStore, applyTheme } from "../store/themeStore";
import { api } from "../lib/api";
import { useStorefrontNav } from "../hooks/useStorefrontNav";
import { getE2EAuthToken, getE2EUser } from "../lib/e2eAuth";
import { resolveVariantById } from "../lib/productVariants";
import type { CartItem } from "../types";

export const Route = createFileRoute("/_storefront")({
  component: StorefrontLayout,
});

function StorefrontLayout() {
  const { nav } = useStorefrontNav();
  const cartOpen = useUiStore((s) => s.cartOpen);
  const setCartOpen = useUiStore((s) => s.setCartOpen);
  const setCheckoutItems = useUiStore((s) => s.setCheckoutItems);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const { user: clerkUser } = useUser();
  const { getToken } = useAuth();
  const e2eUser = getE2EUser();
  const user = e2eUser ?? clerkUser;
  const getEffectiveToken = useCallback(async () => getE2EAuthToken() ?? getToken(), [getToken]);
  const { bindOwner, items, replaceItems } = useCartStore();
  const wishlistProductIds = useWishlistStore((s) => s.productIds);
  const replaceWishlistProductIds = useWishlistStore((s) => s.replaceProductIds);
  const lastLoadedOwnerRef = useRef<string | null>(null);
  const skipNextCartSaveRef = useRef(false);
  const skipNextWishlistSaveRef = useRef(false);

  const theme = useThemeStore((s) => s.theme);
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
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
        const token = await getEffectiveToken();
        if (!token) return;
        const remoteItems = await api.cart.get(token);
        if (cancelled) return;
        skipNextCartSaveRef.current = true;
        const resolvedItems: CartItem[] = remoteItems.map((line) => ({
          product: line.product,
          qty: line.qty,
          variant: resolveVariantById(line.product.variants, line.variantId),
        }));
        replaceItems(resolvedItems);
        lastLoadedOwnerRef.current = user.id;
      } catch (error) {
        console.error("Failed to load remote cart", error);
      }
    };

    void loadRemoteCart();

    const loadRemoteWishlist = async () => {
      try {
        const token = await getEffectiveToken();
        if (!token) return;
        const remote = await api.wishlist.get(token);
        if (cancelled) return;
        const localIds = useWishlistStore.getState().productIds;
        const merged = [...new Set([...localIds, ...remote.productIds])];
        skipNextWishlistSaveRef.current = true;
        replaceWishlistProductIds(merged);
        if (merged.length !== remote.productIds.length || merged.some((id, i) => remote.productIds[i] !== id)) {
          await api.wishlist.save(merged, token);
        }
      } catch (error) {
        console.error("Failed to load remote wishlist", error);
      }
    };

    void loadRemoteWishlist();

    return () => {
      cancelled = true;
    };
  }, [getEffectiveToken, replaceItems, replaceWishlistProductIds, user?.id]);

  useEffect(() => {
    if (!user?.id || lastLoadedOwnerRef.current !== user.id) return;
    if (skipNextWishlistSaveRef.current) {
      skipNextWishlistSaveRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const token = await getEffectiveToken();
          if (!token) return;
          await api.wishlist.save(wishlistProductIds, token);
        } catch (error) {
          console.error("Failed to save remote wishlist", error);
        }
      })();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [getEffectiveToken, user?.id, wishlistProductIds]);

  useEffect(() => {
    if (!user?.id || lastLoadedOwnerRef.current !== user.id) return;
    if (skipNextCartSaveRef.current) {
      skipNextCartSaveRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const token = await getEffectiveToken();
          if (!token) return;
          await api.cart.save(
            items.map((item) => ({
              productId: item.product.id,
              qty: item.qty,
              ...(item.variant?.id ? { variantId: item.variant.id } : {}),
            })),
            token,
          );
        } catch (error) {
          console.error("Failed to save remote cart", error);
        }
      })();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [getEffectiveToken, items, user?.id]);

  return (
    <>
      <SkipToContent />
      {/* <CustomCursor /> */}
      <Topbar />
      <Header onNav={nav} onOpenCart={() => setCartOpen(true)} />
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onCheckout={() => {
          setCheckoutItems(null);
          setCartOpen(false);
          nav("checkout");
        }}
        onOpenSamplePicker={() => {
          setCartOpen(false);
          nav("sample-picker");
        }}
      />
      <main
        id="main-content"
        style={{ minHeight: "calc(100vh - 200px)", overflowX: "clip", maxWidth: "100vw" }}
        tabIndex={-1}
      >
        <Outlet />
      </main>
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Volver arriba"
        style={{
          position: "fixed",
          right: 28,
          bottom: 28,
          width: 52,
          height: 52,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "var(--green)",
          color: "var(--lime)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 18px 40px -18px rgba(0,0,0,0.35)",
          zIndex: 80,
          opacity: showBackToTop ? 1 : 0,
          transform: showBackToTop
            ? "translateY(0) scale(1)"
            : "translateY(10px) scale(0.92)",
          pointerEvents: showBackToTop ? "auto" : "none",
          transition:
            "opacity 280ms ease, transform 280ms cubic-bezier(0.34,1.56,0.64,1)",
        }}
        onMouseEnter={(e) => {
          if (showBackToTop)
            e.currentTarget.style.transform = "translateY(-2px) scale(1.04)";
        }}
        onMouseLeave={(e) => {
          if (showBackToTop)
            e.currentTarget.style.transform = "translateY(0) scale(1)";
        }}
      >
        <span style={{ transform: "rotate(-90deg)", display: "inline-flex" }}>
          <BackToTopIcon />
        </span>
      </button>
      <Footer onNav={(view, filter) => nav(view, filter)} />
    </>
  );
}

function BackToTopIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}
