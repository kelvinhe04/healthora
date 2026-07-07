import type { ReactNode } from 'react';
import type { Product } from '../../types';
import { ProductCard } from './ProductCard';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface RelatedProductsSectionProps {
  title?: ReactNode;
  subtitle?: string;
  products: Product[];
  onOpenProduct: (p: Product) => void;
  onAdd: (p: Product) => void;
}

export function RelatedProductsSection({
  title = 'Productos relacionados',
  subtitle = 'Recomendados para ti',
  products,
  onOpenProduct,
  onAdd,
}: RelatedProductsSectionProps) {
  const bp = useBreakpoint();
  const isSmall = bp === 'mobile' || bp === 'tablet';

  if (products.length === 0) return null;

  return (
    <section style={{ marginTop: isSmall ? 48 : 64 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 10 }}>
          {subtitle}
        </div>
        <h2 style={{ fontFamily: '"Instrument Serif", serif', fontSize: isSmall ? 32 : 44, letterSpacing: '-0.03em', margin: 0, color: 'var(--ink)', fontWeight: 400 }}>
          {title}
        </h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isSmall ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 20 }}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} onClick={onOpenProduct} onAdd={onAdd} />
        ))}
      </div>
    </section>
  );
}
