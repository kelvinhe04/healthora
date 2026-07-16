import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product, ProductVariant } from '../../types';
import { useRecentlyViewedStore } from '../../store/recentlyViewedStore';
import { useProducts } from '../../hooks/useProducts';
import { ProductRow } from './ProductRow';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface RecentlyViewedSectionProps {
  onOpenProduct: (p: Product) => void;
  onAdd: (p: Product, qty?: number, variant?: ProductVariant) => void;
  excludeProductId?: string;
}

export function RecentlyViewedSection({ onOpenProduct, onAdd, excludeProductId }: RecentlyViewedSectionProps) {
  const { t } = useTranslation();
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
      .slice(0, 12);
  }, [allProducts, excludeProductId, productIds]);

  if (products.length === 0) return null;

  return (
    <section id="vistos-recientemente" style={{ marginTop: isSmall ? 48 : 64 }}>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 10 }}>
        {t('recentlyViewedSection.eyebrow')}
      </div>
      <h2 style={{ fontFamily: '"Instrument Serif", serif', fontSize: isSmall ? 32 : 40, letterSpacing: '-0.03em', margin: '0 0 24px', fontWeight: 400 }}>
        {t('recentlyViewedSection.heading')} <em style={{ color: 'var(--green)' }}>{t('recentlyViewedSection.headingEmphasis')}</em>
      </h2>
      <ProductRow products={products} onOpenProduct={onOpenProduct} onAdd={onAdd} sectionKey="recientes" />
    </section>
  );
}
