import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product, ProductVariant } from '../../types';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useReviews } from '../../hooks/useReviews';
import { ProductImage } from './ProductImage';
import { Stars } from './Stars';
import { AnimatedButton } from './AnimatedButton';
import { getEffectivePrice } from '../../lib/productVariants';
import { isLowStock } from '../../lib/stock';
import { formatCurrency } from '../../lib/currency';

interface SimilarProductsCompareSectionProps {
  product: Product;
  related: Product[];
  onOpenProduct: (p: Product) => void;
  onAdd: (p: Product, qty?: number, variant?: ProductVariant) => void;
}

/** product.rating es estático del seed (siempre 0); el rating real vive en reviews, igual que en
 * Compare.tsx - necesita su propio componente porque useReviews es un hook. */
function CompareRatingCell({ product }: { product: Product }) {
  const { t } = useTranslation();
  const { data: reviews } = useReviews(product.id);
  const count = reviews?.length ?? 0;
  const rating = count > 0 ? Math.round((reviews!.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;
  if (count === 0) {
    return <span style={{ color: 'var(--ink-40)' }}>{t('productDetail.noReviewsYet')}</span>;
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Stars value={rating} size={12} />
      <span style={{ fontSize: 12, color: 'var(--ink-60)' }}>{rating} · {count}</span>
    </div>
  );
}

export function SimilarProductsCompareSection({ product, related, onOpenProduct, onAdd }: SimilarProductsCompareSectionProps) {
  const { t } = useTranslation();
  const bp = useBreakpoint();
  const isSmall = bp === 'mobile' || bp === 'tablet';

  const columns = useMemo(() => [product, ...related], [product, related]);

  if (related.length === 0) return null;

  const rows = [
    { label: t('compare.rows.brand'), render: (p: Product) => p.brand },
    { label: t('compare.rows.category'), render: (p: Product) => p.category },
    { label: t('compare.rows.price'), render: (p: Product) => formatCurrency(getEffectivePrice(p)) },
    { label: t('compare.rows.rating'), render: (p: Product) => <CompareRatingCell product={p} /> },
    {
      label: t('compare.rows.stock'),
      render: (p: Product) =>
        p.stock === 0 ? (
          t('compare.outOfStock')
        ) : isLowStock(p.stock) ? (
          <span style={{ color: 'var(--coral)' }}>{t('compare.lowStock', { count: p.stock })}</span>
        ) : (
          t('compare.inStock')
        ),
    },
  ];

  return (
    <section style={{ marginTop: isSmall ? 48 : 64 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 10 }}>
          {t('similarCompare.kicker')}
        </div>
        <h2 style={{ fontFamily: '"Instrument Serif", serif', fontSize: isSmall ? 32 : 44, letterSpacing: '-0.03em', margin: 0, color: 'var(--ink)', fontWeight: 400 }}>
          {t('similarCompare.headingPrefix')} <em style={{ color: 'var(--green)' }}>{t('similarCompare.headingEmphasis')}</em>
        </h2>
      </div>

      <div style={{ position: 'relative' }}>
        {isSmall && columns.length > 1 && (
          <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 32, pointerEvents: 'none', background: 'linear-gradient(to right, transparent, var(--cream) 85%)', zIndex: 1 }} />
        )}
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', touchAction: 'pan-x pan-y' }}>
          <table style={{ width: '100%', minWidth: isSmall ? 640 : undefined, borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: 'var(--ink-60)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--ink-06)' }}>
                  {t('compare.attribute')}
                </th>
                {columns.map((p, i) => (
                  <th key={p.id} style={{ verticalAlign: 'top', padding: '12px 16px', borderBottom: i === 0 ? '2px solid var(--green)' : '1px solid var(--ink-06)', minWidth: 180 }}>
                    <div onClick={() => i > 0 && onOpenProduct(p)} style={{ cursor: i > 0 ? 'pointer' : 'default' }}>
                      <ProductImage product={p} size="sm" />
                      <div style={{ marginTop: 10, fontFamily: '"Geist", sans-serif', fontSize: 14, fontWeight: 500, lineHeight: 1.3 }}>
                        {i === 0 && (
                          <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                            {t('similarCompare.thisProduct')}
                          </div>
                        )}
                        {p.name}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td style={{ padding: '14px 16px', fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: 'var(--ink-60)', borderBottom: '1px solid var(--ink-06)', verticalAlign: 'top' }}>
                    {row.label}
                  </td>
                  {columns.map((p) => (
                    <td key={`${row.label}-${p.id}`} style={{ padding: '14px 16px', fontSize: 14, color: 'var(--ink-80)', borderBottom: '1px solid var(--ink-06)', verticalAlign: 'top' }}>
                      {row.render(p)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td style={{ padding: '16px' }} />
                {columns.map((p, i) => (
                  <td key={`actions-${p.id}`} style={{ padding: '16px' }}>
                    {i > 0 && (
                      <AnimatedButton
                        variant="primary"
                        size="sm"
                        onClick={() => onAdd(p)}
                        disabled={p.stock === 0}
                        text={p.stock === 0 ? t('compare.outOfStockButton') : t('compare.addButton')}
                      />
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
