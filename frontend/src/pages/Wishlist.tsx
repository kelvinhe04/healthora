import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product } from '../types';
import { useWishlistStore } from '../store/wishlistStore';
import { useProducts } from '../hooks/useProducts';
import { ProductCard } from '../components/shared/ProductCard';
import { AnimatedButton } from '../components/shared/AnimatedButton';
import { Icon } from '../components/shared/Icon';
import { useBreakpoint } from '../hooks/useBreakpoint';

interface WishlistSectionProps {
  onOpenProduct: (p: Product) => void;
  onAdd: (p: Product) => void;
  onBrowse?: () => void;
}

export function WishlistPage({ onOpenProduct, onAdd, onBrowse }: WishlistSectionProps) {
  const { t } = useTranslation();
  const productIds = useWishlistStore((s) => s.productIds);
  const clear = useWishlistStore((s) => s.clear);
  const { data: allProducts = [] } = useProducts();
  const bp = useBreakpoint();
  const isSmall = bp === 'mobile' || bp === 'tablet';

  const products = useMemo(() => {
    const byId = new Map(allProducts.map((p) => [p.id, p]));
    return productIds.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
  }, [allProducts, productIds]);

  return (
    <div style={{ padding: isSmall ? '24px 16px 60px' : '40px 40px 80px', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
        <div>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 8 }}>
            {t('wishlist.kicker', { count: products.length })}
          </div>
          <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: isSmall ? 36 : 44, letterSpacing: '-0.03em', margin: 0, fontWeight: 400 }}>
            {t('wishlist.headingPrefix')} <em style={{ color: 'var(--green)' }}>{t('wishlist.headingEmphasis')}</em>
          </h1>
        </div>
        {products.length > 0 && (
          <AnimatedButton variant="outline" onClick={clear} text={t('wishlist.clearList')} />
        )}
      </div>

      {products.length === 0 ? (
        <div style={{ background: 'var(--cream-2)', border: '1px solid var(--ink-06)', borderRadius: 20, padding: 40, textAlign: 'center' }}>
          <Icon name="heart" size={28} stroke="var(--ink-40)" />
          <p style={{ margin: '16px 0', color: 'var(--ink-60)' }}>{t('wishlist.empty')}</p>
          {onBrowse && <AnimatedButton variant="primary" onClick={onBrowse} text={t('wishlist.exploreCatalog')} />}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isSmall ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 20 }}>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} onClick={onOpenProduct} onAdd={onAdd} showWishlist={false} />
          ))}
        </div>
      )}
    </div>
  );
}
