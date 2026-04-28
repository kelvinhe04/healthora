import { useState } from 'react';
import type { Product } from '../../types';
import { ProductImage } from './ProductImage';
import { Stars } from './Stars';
import { Icon } from './Icon';
import { useReviews } from '../../hooks/useReviews';

interface ProductCardProps {
  product: Product;
  onClick: (p: Product) => void;
  onAdd: (p: Product) => void;
}

export function ProductCard({ product, onClick, onAdd }: ProductCardProps) {
  const [hover, setHover] = useState(false);
  const { data: liveReviews } = useReviews(product.id);
  const liveCount = liveReviews?.length ?? 0;
  const liveRating = liveReviews && liveReviews.length > 0
    ? Math.round(liveReviews.reduce((s, r) => s + r.rating, 0) / liveReviews.length * 10) / 10
    : 0;
  const primaryImage = product.imageUrl || product.images?.find((img) => img.isPrimary)?.url || product.images?.[0]?.url;
  const secondaryImage = product.images?.find((img) => img.url && img.url !== primaryImage)?.url;

  return (
    <div
      onClick={() => onClick(product)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ cursor: 'pointer', background: 'var(--cream)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--ink-06)', transition: 'all 220ms cubic-bezier(.2,.8,.2,1)', transform: hover ? 'translateY(-2px)' : 'none', boxShadow: hover ? '0 18px 40px -20px rgba(0,0,0,0.15)' : '0 2px 6px -4px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ transform: hover ? 'scale(1.08)' : 'scale(1)', transition: 'transform 400ms cubic-bezier(.2,.8,.2,1)', width: '100%', height: '100%' }}>
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
        {product.stock === 0 ? (
          <span style={{ position: 'absolute', top: 12, left: 12, background: 'var(--ink)', color: 'var(--cream)', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', padding: '4px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7 }}>Agotado</span>
        ) : product.tag ? (
          <span style={{ position: 'absolute', top: 12, left: 12, background: product.tag === 'Nuevo' ? 'var(--lime)' : 'var(--ink)', color: product.tag === 'Nuevo' ? 'var(--ink)' : 'var(--cream)', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', padding: '4px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{product.tag}</span>
        ) : null}
        {product.stock > 0 && product.priceBefore && (
          <span style={{ position: 'absolute', top: 12, right: 12, background: 'var(--coral)', color: 'white', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', padding: '4px 8px', borderRadius: 999, fontWeight: 600 }}>−{Math.round((1 - product.price / product.priceBefore) * 100)}%</span>
        )}
        {product.stock === 0 ? (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(253,252,250,0.45)', backdropFilter: 'grayscale(0.4)' }} />
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(product); }}
            style={{ position: 'absolute', bottom: 12, right: 12, width: 40, height: 40, borderRadius: 999, background: 'var(--ink)', color: 'var(--cream)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: hover ? 'scale(1.1) rotate(180deg)' : 'scale(0.85) rotate(0deg)', opacity: hover ? 1 : 0.8, transition: 'all 500ms cubic-bezier(0.34, 1.56, 0.64, 1)', boxShadow: hover ? '0 8px 20px rgba(0,0,0,0.15)' : 'none' }}
            aria-label="Agregar al carrito"
          >
            <Icon name="plus" size={16} />
          </button>
        )}
      </div>
      <div style={{ padding: '16px 16px 18px' }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: 'var(--ink-60)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{product.brand}</div>
        <div style={{ fontFamily: '"Geist", sans-serif', fontSize: 15, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.25, marginBottom: 8, letterSpacing: '-0.01em', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 38 }}>{product.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, minHeight: 18 }}>
          {liveCount > 0 ? (
            <>
              <Stars value={liveRating} size={11} />
              <span style={{ fontSize: 11, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace' }}>{liveRating} · {liveCount}</span>
            </>
          ) : (
            <span style={{ fontSize: 10, color: 'var(--ink-40)', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em' }}>SIN RESEÑAS</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: '"Instrument Serif", serif', fontSize: 22, color: 'var(--ink)' }}>${product.price.toFixed(2)}</span>
          {product.priceBefore && <span style={{ fontSize: 13, color: 'var(--ink-40)', textDecoration: 'line-through' }}>${product.priceBefore.toFixed(2)}</span>}
        </div>
      </div>
    </div>
  );
}
