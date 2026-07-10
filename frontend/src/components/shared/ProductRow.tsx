import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Product, ProductVariant } from '../../types';
import { ProductCard, ProductCardSkeleton } from './ProductCard';
import { Icon } from './Icon';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface ProductRowProps {
  products: Product[];
  onOpenProduct: (p: Product) => void;
  onAdd: (p: Product, qty?: number, variant?: ProductVariant) => void;
  sectionKey: string;
  loading?: boolean;
  skeletonCount?: number;
  priorityCount?: number;
}

// Renders one visible row of product cards (2 columns on mobile/tablet, 4 on desktop) with
// left/right arrow buttons to scroll horizontally when the underlying list has more products
// than fit in a single row. Arrows only render once there's actually overflow to scroll to.
export function ProductRow({ products, onOpenProduct, onAdd, sectionKey, loading = false, skeletonCount = 4, priorityCount = 4 }: ProductRowProps) {
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const isTablet = bp === 'tablet';
  const columns = isMobile || isTablet ? 2 : 4;
  const gap = isMobile ? 12 : 20;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateScrollState();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [products.length, columns]);

  const scrollByPage = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: 'smooth' });
  };

  const itemBasis = `calc((100% - ${gap * (columns - 1)}px) / ${columns})`;
  const showArrows = !loading && products.length > columns;

  const arrowStyle = (side: 'left' | 'right', enabled: boolean): CSSProperties => ({
    position: 'absolute',
    top: '35%',
    [side]: isMobile ? -8 : -20,
    transform: 'translateY(-50%)',
    width: isMobile ? 38 : 44,
    height: isMobile ? 38 : 44,
    borderRadius: 999,
    border: '1.5px solid var(--ink-40)',
    background: 'var(--cream)',
    color: enabled ? 'var(--ink)' : 'var(--ink-40)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: enabled ? 'pointer' : 'default',
    opacity: enabled ? 1 : 0.5,
    boxShadow: '0 12px 30px -10px rgba(0,0,0,0.4)',
    zIndex: 3,
    transition: 'background 150ms ease, opacity 150ms ease',
  });

  return (
    <div style={{ position: 'relative' }}>
      {showArrows && (
        <button
          type="button"
          aria-label="Anterior"
          onClick={() => scrollByPage(-1)}
          disabled={!canScrollLeft}
          style={arrowStyle('left', canScrollLeft)}
          onMouseEnter={(e) => { if (canScrollLeft) e.currentTarget.style.background = 'var(--cream-2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--cream)'; }}
        >
          <Icon name="arrow-left" size={16} />
        </button>
      )}

      <div
        ref={scrollerRef}
        className="product-row-scroller"
        style={{
          display: 'flex',
          gap,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
        }}
      >
        {loading
          ? Array.from({ length: skeletonCount }).map((_, i) => (
              <div key={i} style={{ flex: `0 0 ${itemBasis}`, scrollSnapAlign: 'start' }}>
                <ProductCardSkeleton />
              </div>
            ))
          : products.map((p, i) => (
              <div key={p.id} style={{ flex: `0 0 ${itemBasis}`, scrollSnapAlign: 'start' }}>
                <ProductCard product={p} onClick={onOpenProduct} onAdd={onAdd} sectionKey={sectionKey} priority={i < priorityCount} />
              </div>
            ))}
      </div>

      {showArrows && (
        <button
          type="button"
          aria-label="Siguiente"
          onClick={() => scrollByPage(1)}
          disabled={!canScrollRight}
          style={arrowStyle('right', canScrollRight)}
          onMouseEnter={(e) => { if (canScrollRight) e.currentTarget.style.background = 'var(--cream-2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--cream)'; }}
        >
          <Icon name="arrow-right" size={16} />
        </button>
      )}

      <style>{`.product-row-scroller::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}
