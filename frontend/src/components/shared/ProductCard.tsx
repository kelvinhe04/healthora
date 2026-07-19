import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product, ProductVariant } from '../../types';
import { ProductImage } from './ProductImage';
import { Stars } from './Stars';
import { Icon } from './Icon';
import { useReviews } from '../../hooks/useReviews';
import { useThemeStore } from '../../store/themeStore';
import { pickDefaultCombo, pickDefaultCartVariant, getEffectivePrice, getEffectivePriceBefore } from '../../lib/productVariants';
import { useCompareStore } from '../../store/compareStore';
import { useWishlistStore } from '../../store/wishlistStore';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { isLowStock } from '../../lib/stock';
import { formatPurchasesLastMonth } from '../../lib/purchases';
import { formatCurrency } from '../../lib/currency';

// product.tag values coming from the backend stay in Spanish (they're compared elsewhere for
// styling/filtering, e.g. `product.tag === 'Nuevo'`) - only the on-screen badge text is translated.
const TAG_I18N_KEY: Record<string, string> = {
  Nuevo: 'productCard.tags.new',
  'Más vendido': 'productCard.tags.bestseller',
};

// ─── Shared shimmer helper ────────────────────────────────────────────────────
function ShimmerBox({ style }: { style?: CSSProperties }) {
  return (
    <div
      style={{
        background: 'var(--skeleton-base)',
        borderRadius: 6,
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, transparent 0%, var(--skeleton-shimmer) 50%, transparent 100%)',
          animation: 'shimmer 1.4s linear infinite',
          willChange: 'transform',
        }}
      />
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div
      style={{
        background: 'var(--cream)',
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid var(--ink-06)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Image area */}
      <ShimmerBox style={{ height: 280, borderRadius: 0 }} />

      {/* Text content */}
      <div style={{ padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Brand */}
        <ShimmerBox style={{ height: 10, width: '40%' }} />
        {/* Name line 1 */}
        <ShimmerBox style={{ height: 14, width: '90%' }} />
        {/* Name line 2 */}
        <ShimmerBox style={{ height: 14, width: '65%' }} />
        {/* Rating */}
        <ShimmerBox style={{ height: 10, width: '50%', marginTop: 2 }} />
        {/* Price */}
        <ShimmerBox style={{ height: 18, width: '35%', marginTop: 4 }} />
      </div>
    </div>
  );
}

interface ProductCardProps {
  product: Product;
  onClick: (p: Product) => void;
  onAdd: (p: Product, qty?: number, variant?: ProductVariant) => void;
  priority?: boolean;
  showCompare?: boolean;
  showWishlist?: boolean;
  /**
   * Identifies which section/list this card is rendered in (e.g. "bestsellers", "nuevos",
   * "recientes"). The same product can appear in more than one section on a page, so the
   * DOM id can't be based on product.id alone - that would collide and make
   * getElementById resolve to the wrong section when restoring scroll position after
   * visiting the product detail page. Defaults to "card" for callers that don't care.
   */
  sectionKey?: string;
}

export function ProductCard({ product, onClick, onAdd, priority = false, showCompare = true, showWishlist = true, sectionKey = 'card' }: ProductCardProps) {
  const { t } = useTranslation();
  const domId = `product-card-${sectionKey}-${product.id}`;
  const [hover, setHover] = useState(false);
  const [compareHint, setCompareHint] = useState('');
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const dark = useThemeStore((s) => s.theme === 'dark');
  const toggleCompare = useCompareStore((s) => s.toggle);
  const isCompared = useCompareStore((s) => s.contains(product.id));
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const isWishlisted = useWishlistStore((s) => s.contains(product.id));
  const { data: liveReviews } = useReviews(product.id);
  const liveCount = liveReviews?.length ?? 0;
  const liveRating = liveReviews && liveReviews.length > 0
    ? Math.round(liveReviews.reduce((s, r) => s + r.rating, 0) / liveReviews.length * 10) / 10
    : 0;
  const { variant: defaultVariant, size: defaultSize } = pickDefaultCombo(product);
  // Once a combo has its own imagesBySize override, that override is authoritative for this
  // combo - even if it only has 1 photo, it means "no hover swap for this combo", not "fall back
  // to the sabor's own images[1]" (a different combo's hover photo bleeding into this one).
  const comboImages = defaultVariant?.imagesBySize && defaultSize ? defaultVariant.imagesBySize[defaultSize.id] : undefined;
  const primaryImage = comboImages?.[0] || defaultVariant?.images?.[0] || product.imageUrl || product.images?.find((img) => img.isPrimary)?.url || product.images?.[0]?.url;
  const secondaryImage = comboImages
    ? comboImages[1]
    : defaultVariant?.images?.[1] || product.images?.find((img, i) => img.url && img.url !== primaryImage && i !== 0)?.url || product.images?.[1]?.url;
  const effectivePrice = getEffectivePrice(product);
  const effectivePriceBefore = getEffectivePriceBefore(product);
  const purchasesLabel = formatPurchasesLastMonth(product.purchasesLastMonth ?? 0);
  const showOverlayActions = isMobile || hover || isWishlisted || isCompared;
  const overlayActionStyle = {
    opacity: showOverlayActions ? (hover || isMobile ? 1 : 0.85) : 0,
    transform: showOverlayActions ? 'scale(1)' : 'scale(0.85)',
    transition: 'all 500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
    pointerEvents: showOverlayActions ? ('auto' as const) : ('none' as const),
  };

  return (
    <div
      id={domId}
      onClick={(e) => {
        try {
          const top = e.currentTarget.getBoundingClientRect().top;
          sessionStorage.setItem('lastProductAnchor', JSON.stringify({ id: domId, top }));
        } catch {
          // sessionStorage unavailable (e.g. private mode) - scroll restoration just falls back to default
        }
        onClick(product);
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ cursor: 'pointer', background: 'var(--cream)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--ink-06)', transition: 'all 220ms cubic-bezier(.2,.8,.2,1)', transform: hover ? 'translateY(-2px)' : 'none', boxShadow: hover ? '0 18px 40px -20px rgba(0,0,0,0.15)' : '0 2px 6px -4px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}
    >
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ transform: hover ? 'scale(1.08)' : 'scale(1)', transition: 'transform 400ms cubic-bezier(.2,.8,.2,1)', width: '100%', height: '100%' }}>
          {secondaryImage ? (
            <div style={{ position: 'relative' }}>
              <div style={{ opacity: hover ? 0 : 1, transform: hover ? 'scale(0.985)' : 'scale(1)', transition: 'opacity 280ms ease, transform 380ms cubic-bezier(.2,.8,.2,1)' }}>
                <ProductImage product={product} size="tile" flat imageUrl={primaryImage} priority={priority} />
              </div>
              <div style={{ position: 'absolute', inset: 0, opacity: hover ? 1 : 0, transform: hover ? 'scale(1)' : 'scale(1.015)', transition: 'opacity 320ms ease, transform 420ms cubic-bezier(.2,.8,.2,1)' }}>
                <ProductImage product={product} size="tile" flat imageUrl={secondaryImage} />
              </div>
            </div>
          ) : (
            <ProductImage product={product} size="tile" flat imageUrl={primaryImage} priority={priority} />
          )}
        </div>
        

        {/* Out of stock overlay rendered BEFORE badges so it doesn't cover them */}
        {product.stock === 0 && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.6)', backdropFilter: 'grayscale(1)' }} />
        )}

        {/* Badges */}
        <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
          {product.stock === 0 ? (
            <span style={{ background: dark ? 'oklch(0.10 0.012 155)' : 'var(--ink)', color: dark ? 'oklch(0.96 0.006 85)' : 'var(--cream)', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', padding: '4px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{t('productCard.outOfStock')}</span>
          ) : (
            <>
              {product.tag && (
                <span style={{ background: product.tag === 'Nuevo' ? 'var(--lime)' : 'oklch(0.18 0.03 155)', color: product.tag === 'Nuevo' ? 'oklch(0.18 0.03 155)' : 'white', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', padding: '4px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{TAG_I18N_KEY[product.tag] ? t(TAG_I18N_KEY[product.tag]) : product.tag}</span>
              )}
              {isLowStock(product.stock) && (
                <span style={{ background: 'var(--coral)', color: 'white', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', padding: '4px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{t('productCard.lowStock', { count: product.stock })}</span>
              )}
            </>
          )}
        </div>
        
        {product.stock > 0 && effectivePriceBefore && (
          <span style={{ position: 'absolute', top: 12, right: 12, background: 'var(--coral)', color: 'white', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', padding: '4px 8px', borderRadius: 999, fontWeight: 600 }}>−{Math.round((1 - effectivePrice / effectivePriceBefore) * 100)}%</span>
        )}

        {showCompare && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const result = toggleCompare(product.id);
              if (result === 'full') {
                setCompareHint(t('productCard.compareMax'));
                window.setTimeout(() => setCompareHint(''), 1800);
              }
            }}
            aria-label={isCompared ? t('productCard.removeFromCompareAria') : t('productCard.addToCompareAria')}
            aria-pressed={isCompared}
            style={{
              position: 'absolute',
              bottom: 12,
              // Al lado del corazón de wishlist (no arriba, donde el badge de descuento lo empujaba
              // de lugar según el producto y desalineaba el ícono entre tarjetas de la misma fila).
              left: 12 + (isMobile ? 32 : 40) + 8,
              width: isMobile ? 32 : 40,
              height: isMobile ? 32 : 40,
              borderRadius: 999,
              border: isCompared ? '2px solid var(--green)' : '1px solid var(--ink-12)',
              background: isCompared ? 'color-mix(in oklab, var(--green) 12%, white)' : 'rgba(255,255,255,0.92)',
              color: 'var(--ink)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
              ...overlayActionStyle,
            }}
          >
            <Icon name="layers" size={16} />
          </button>
        )}
        
        {showWishlist && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleWishlist(product.id);
            }}
            aria-label={isWishlisted ? t('productCard.removeFromWishlistAria') : t('productCard.addToWishlistAria')}
            aria-pressed={isWishlisted}
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              width: isMobile ? 32 : 40,
              height: isMobile ? 32 : 40,
              borderRadius: 999,
              border: isWishlisted ? '2px solid var(--coral)' : '1px solid var(--ink-12)',
              background: isWishlisted ? 'color-mix(in oklab, var(--coral) 12%, white)' : 'rgba(255,255,255,0.92)',
              color: isWishlisted ? 'var(--coral)' : 'var(--ink)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
              ...overlayActionStyle,
            }}
          >
            <Icon name="heart" size={16} stroke={isWishlisted ? 'var(--coral)' : 'currentColor'} />
          </button>
        )}

        {/* Add to cart button */}
        {product.stock > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(product, 1, pickDefaultCartVariant(product)); }}
            style={{ position: 'absolute', bottom: 12, right: 12, width: 40, height: 40, borderRadius: 999, background: 'oklch(0.18 0.03 155)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: hover ? 'scale(1.1) rotate(180deg)' : 'scale(0.85) rotate(0deg)', opacity: hover ? 1 : 0.8, transition: 'all 500ms cubic-bezier(0.34, 1.56, 0.64, 1)', boxShadow: hover ? '0 8px 20px rgba(0,0,0,0.15)' : 'none', zIndex: 2 }}
            aria-label={t('productCard.addToCartAria')}
          >
            <Icon name="plus" size={16} />
          </button>
        )}
      </div>
      <div style={{ padding: '16px 16px 18px' }}>
        {compareHint && (
          <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: 'var(--coral)', marginBottom: 6 }}>{compareHint}</div>
        )}
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: 'var(--ink-60)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{product.brand}</div>
        <div style={{ fontFamily: '"Geist", sans-serif', fontSize: 15, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.25, marginBottom: 8, letterSpacing: '-0.01em', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 38 }}>{product.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, minHeight: 18 }}>
          {liveCount > 0 ? (
            <>
              <Stars value={liveRating} size={11} />
              <span style={{ fontSize: 11, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace' }}>{liveRating} · {liveCount}</span>
            </>
          ) : (
            <span style={{ fontSize: 10, color: 'var(--ink-40)', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em' }}>{t('productCard.noReviews')}</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif', marginBottom: 8, minHeight: 14 }}>
          {purchasesLabel && t('productCard.purchasesLastMonth', { count: purchasesLabel })}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: '"Instrument Serif", serif', fontSize: 22, color: 'var(--ink)' }}>{formatCurrency(effectivePrice)}</span>
          {effectivePriceBefore && <span style={{ fontSize: 13, color: 'var(--ink-40)', textDecoration: 'line-through' }}>{formatCurrency(effectivePriceBefore)}</span>}
        </div>
      </div>
    </div>
  );
}
