import { useState } from 'react';
import type { Product } from '../../types';
import { ProductImage } from './ProductImage';
import { Stars } from './Stars';
import { Icon } from './Icon';

interface ProductCardProps {
  product: Product;
  onClick: (p: Product) => void;
  onAdd: (p: Product) => void;
}

export function ProductCard({ product, onClick, onAdd }: ProductCardProps) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={() => onClick(product)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ cursor: 'pointer', background: 'var(--cream)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--ink-06)', transition: 'all 220ms cubic-bezier(.2,.8,.2,1)', transform: hover ? 'translateY(-2px)' : 'none', boxShadow: hover ? '0 18px 40px -20px rgba(0,0,0,0.15)' : '0 2px 6px -4px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <ProductImage product={product} size="tile" flat />
        {product.tag && (
          <span style={{ position: 'absolute', top: 12, left: 12, background: product.tag === 'Nuevo' ? 'var(--lime)' : 'var(--ink)', color: product.tag === 'Nuevo' ? 'var(--ink)' : 'var(--cream)', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', padding: '4px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{product.tag}</span>
        )}
        {product.priceBefore && (
          <span style={{ position: 'absolute', top: 12, right: 12, background: 'var(--coral)', color: 'white', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', padding: '4px 8px', borderRadius: 999, fontWeight: 600 }}>−{Math.round((1 - product.price / product.priceBefore) * 100)}%</span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onAdd(product); }}
          style={{ position: 'absolute', bottom: 12, right: 12, width: 40, height: 40, borderRadius: 999, background: 'var(--ink)', color: 'var(--cream)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: hover ? 'scale(1)' : 'scale(0.85)', opacity: hover ? 1 : 0.8, transition: 'all 180ms' }}
          aria-label="Agregar al carrito"
        >
          <Icon name="plus" size={16} />
        </button>
      </div>
      <div style={{ padding: '16px 16px 18px' }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: 'var(--ink-60)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{product.brand}</div>
        <div style={{ fontFamily: '"Geist", sans-serif', fontSize: 15, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.25, marginBottom: 8, letterSpacing: '-0.01em', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 38 }}>{product.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Stars value={product.rating} size={11} />
          <span style={{ fontSize: 11, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace' }}>{product.rating} · {product.reviews}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: '"Instrument Serif", serif', fontSize: 22, color: 'var(--ink)' }}>${product.price.toFixed(2)}</span>
          {product.priceBefore && <span style={{ fontSize: 13, color: 'var(--ink-40)', textDecoration: 'line-through' }}>${product.priceBefore.toFixed(2)}</span>}
        </div>
      </div>
    </div>
  );
}
