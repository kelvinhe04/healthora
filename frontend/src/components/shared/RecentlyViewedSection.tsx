import { useMemo } from 'react';
import type { Product } from '../../types';
import { useRecentlyViewedStore } from '../../store/recentlyViewedStore';
import { useProducts } from '../../hooks/useProducts';
import { ProductCard } from './ProductCard';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface RecentlyViewedSectionProps {
  onOpenProduct: (p: Product) => void;
  onAdd: (p: Product) => void;
  excludeProductId?: string;
}

export function RecentlyViewedSection({ onOpenProduct, onAdd, excludeProductId }: RecentlyViewedSectionProps) {
  const productIds = useRecentlyViewedStore((s) => s.productIds);
  const { data: allProducts = [] } = useProducts();
  const bp = useBreakpoint();
  const isSmall = bp === 'mobile' || bp === 'tablet';

  const products = useMemo(() => {
    const byId = new Map(allProducts.map((p) => [p.id, p]));
    return productIds
      .filter((id) => id !== excludeProductId)
      .map((id) => byId.get(id))
      .filter((p): p is Product => Boolean(p))
      .slice(0, 8);
  }, [allProducts, excludeProductId, productIds]);

  if (products.length === 0) return null;

  return (
    <section style={{ marginTop: isSmall ? 48 : 64 }}>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 10 }}>
        Continúa explorando
      </div>
      <h2 style={{ fontFamily: '"Instrument Serif", serif', fontSize: isSmall ? 32 : 40, letterSpacing: '-0.03em', margin: '0 0 24px', fontWeight: 400 }}>
        Vistos <em style={{ color: 'var(--green)' }}>recientemente</em>
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: isSmall ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 20 }}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} onClick={onOpenProduct} onAdd={onAdd} sectionKey="recientes" />
        ))}
      </div>
    </section>
  );
}
