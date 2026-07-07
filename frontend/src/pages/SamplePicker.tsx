import { useMemo, useState } from 'react';
import type { Product } from '../types';
import { useProducts } from '../hooks/useProducts';
import { useCartStore } from '../store/cartStore';
import { ProductImage } from '../components/shared/ProductImage';
import { AnimatedButton } from '../components/shared/AnimatedButton';
import { Icon } from '../components/shared/Icon';
import { ProductCardSkeleton } from '../components/shared/ProductCard';
import { useBreakpoint } from '../hooks/useBreakpoint';

interface SamplePickerProps {
  onBack: () => void;
  onConfirm: () => void;
}

const PAGE_SIZE = 12;

export function SamplePicker({ onBack, onConfirm }: SamplePickerProps) {
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const isTablet = bp === 'tablet';
  const cols = isMobile ? 2 : isTablet ? 3 : 4;

  const { freeSample, setFreeSample } = useCartStore();
  const { data: allProducts, isLoading } = useProducts({ inStock: true });
  const [page, setPage] = useState(1);

  const products = useMemo(() => {
    if (!allProducts) return [];
    return allProducts.filter((p) => p.stock > 0 && p.price < 25);
  }, [allProducts]);

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const paginated = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const goToPage = (n: number) => {
    setPage(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ padding: isMobile ? '20px 16px 120px' : '32px 40px 120px', maxWidth: 1280, margin: '0 auto' }}>
      <button
        onClick={onBack}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-60)', fontSize: 13, marginBottom: 32, fontFamily: '"Geist", sans-serif' }}
      >
        <Icon name="arrow-left" size={14} /> Volver al carrito
      </button>

      <div style={{ marginBottom: 36 }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--green)', marginBottom: 10 }}>
          Club Healthora · Muestra gratis
        </div>
        <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: isMobile ? 40 : 56, letterSpacing: '-0.035em', lineHeight: 1, margin: '0 0 12px', color: 'var(--ink)', fontWeight: 400 }}>
          Elige tu muestra <em style={{ color: 'var(--green)' }}>gratis</em>
        </h1>
        <p style={{ fontSize: 15, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif', margin: 0 }}>
          Selecciona 1 producto. Se incluirá en tu orden sin costo adicional.
          {!isLoading && products.length > 0 && (
            <span style={{ marginLeft: 8, color: 'var(--ink-40)', fontSize: 13 }}>
              {products.length} productos disponibles
            </span>
          )}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: isMobile ? 12 : 20 }}>
        {isLoading
          ? Array.from({ length: PAGE_SIZE }).map((_, i) => <ProductCardSkeleton key={i} />)
          : paginated.map((p) => (
              <SampleCard
                key={p.id}
                product={p}
                selected={freeSample?.id === p.id}
                onSelect={() => setFreeSample(freeSample?.id === p.id ? null : p)}
              />
            ))}
      </div>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 40 }}>
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page === 1}
            style={{ width: 36, height: 36, borderRadius: 999, border: '1px solid var(--ink-12)', background: 'var(--cream)', cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: page === 1 ? 'var(--ink-30)' : 'var(--ink)', transition: 'all 150ms' }}
          >
            <Icon name="arrow-left" size={14} />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => {
            const isActive = n === page;
            const isNear = Math.abs(n - page) <= 1 || n === 1 || n === totalPages;
            const isPrevEllipsis = n === page - 2 && page > 3;
            const isNextEllipsis = n === page + 2 && page < totalPages - 2;

            if (isPrevEllipsis || isNextEllipsis) {
              return <span key={n} style={{ fontSize: 13, color: 'var(--ink-40)', fontFamily: '"JetBrains Mono", monospace', padding: '0 2px' }}>…</span>;
            }
            if (!isNear) return null;

            return (
              <button
                key={n}
                onClick={() => goToPage(n)}
                style={{ width: 36, height: 36, borderRadius: 999, border: isActive ? 'none' : '1px solid var(--ink-12)', background: isActive ? 'var(--green)' : 'var(--cream)', color: isActive ? 'white' : 'var(--ink)', cursor: 'pointer', fontSize: 13, fontFamily: '"JetBrains Mono", monospace', fontWeight: isActive ? 700 : 400, transition: 'all 150ms' }}
              >
                {n}
              </button>
            );
          })}

          <button
            onClick={() => goToPage(page + 1)}
            disabled={page === totalPages}
            style={{ width: 36, height: 36, borderRadius: 999, border: '1px solid var(--ink-12)', background: 'var(--cream)', cursor: page === totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: page === totalPages ? 'var(--ink-30)' : 'var(--ink)', transition: 'all 150ms' }}
          >
            <Icon name="arrow-right" size={14} />
          </button>
        </div>
      )}

      {/* Sticky confirm bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: isMobile ? '14px 16px' : '16px 40px',
        background: 'var(--cream)',
        borderTop: '1px solid var(--ink-06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        zIndex: 50,
        boxShadow: '0 -8px 32px -16px rgba(0,0,0,0.12)',
        transform: freeSample ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 280ms cubic-bezier(.2,.8,.2,1)',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: 'var(--green)', letterSpacing: '0.08em', marginBottom: 2 }}>MUESTRA SELECCIONADA</div>
          <div style={{ fontSize: 14, fontFamily: '"Geist", sans-serif', fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {freeSample?.name}
          </div>
        </div>
        <AnimatedButton
          variant="primary"
          onClick={onConfirm}
          text="Confirmar y volver"
          icon={<Icon name="arrow-right" size={14} />}
        />
      </div>
    </div>
  );
}

interface SampleCardProps {
  product: Product;
  selected: boolean;
  onSelect: () => void;
}

function SampleCard({ product, selected, onSelect }: SampleCardProps) {
  const [hover, setHover] = useState(false);
  const primaryImage = product.imageUrl || product.images?.find((img) => img.isPrimary)?.url || product.images?.[0]?.url;
  const secondaryImage = product.images?.find((img) => img.url && img.url !== primaryImage)?.url;

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        cursor: 'pointer',
        background: 'var(--cream)',
        borderRadius: 14,
        overflow: 'hidden',
        border: selected ? '2px solid var(--green)' : '1px solid var(--ink-06)',
        transition: 'all 200ms cubic-bezier(.2,.8,.2,1)',
        transform: hover && !selected ? 'translateY(-2px)' : 'none',
        boxShadow: selected
          ? '0 0 0 4px color-mix(in srgb, var(--green) 18%, transparent)'
          : hover ? '0 18px 40px -20px rgba(0,0,0,0.15)' : '0 2px 6px -4px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {selected && (
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          width: 26,
          height: 26,
          borderRadius: 999,
          background: 'var(--green)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          <Icon name="check" size={13} />
        </div>
      )}

      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ transform: hover ? 'scale(1.06)' : 'scale(1)', transition: 'transform 380ms cubic-bezier(.2,.8,.2,1)' }}>
          {secondaryImage ? (
            <div style={{ position: 'relative' }}>
              <div style={{ opacity: hover ? 0 : 1, transform: hover ? 'scale(0.985)' : 'scale(1)', transition: 'opacity 280ms ease, transform 380ms cubic-bezier(.2,.8,.2,1)' }}>
                <ProductImage product={product} size="tile" flat imageUrl={primaryImage} />
              </div>
              <div style={{ position: 'absolute', inset: 0, opacity: hover ? 1 : 0, transform: hover ? 'scale(1)' : 'scale(1.015)', transition: 'opacity 320ms ease, transform 420ms cubic-bezier(.2,.8,.2,1)' }}>
                <ProductImage product={product} size="tile" flat imageUrl={secondaryImage} />
              </div>
            </div>
          ) : (
            <ProductImage product={product} size="tile" flat imageUrl={primaryImage} />
          )}
        </div>
      </div>

      <div style={{ padding: '14px 14px 16px' }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: 'var(--ink-60)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{product.brand}</div>
        <div style={{ fontFamily: '"Geist", sans-serif', fontSize: 14, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.25, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 34 }}>{product.name}</div>
        <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 20, color: selected ? 'var(--green)' : 'var(--ink)' }}>
          ${product.price.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
