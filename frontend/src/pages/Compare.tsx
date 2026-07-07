import { useMemo } from 'react';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useProducts } from '../hooks/useProducts';
import { useCompareStore } from '../store/compareStore';
import { ProductImage } from '../components/shared/ProductImage';
import { Stars } from '../components/shared/Stars';
import { AnimatedButton } from '../components/shared/AnimatedButton';
import { Icon } from '../components/shared/Icon';
import type { Product } from '../types';
import { getEffectivePrice } from '../lib/productVariants';

interface CompareProps {
  onBack: () => void;
  onOpenProduct: (p: Product) => void;
  onAdd: (p: Product) => void;
}

export function Compare({ onBack, onOpenProduct, onAdd }: CompareProps) {
  const productIds = useCompareStore((s) => s.productIds);
  const remove = useCompareStore((s) => s.remove);
  const clear = useCompareStore((s) => s.clear);
  const { data: allProducts = [] } = useProducts();
  const bp = useBreakpoint();
  const isSmall = bp === 'mobile' || bp === 'tablet';

  const products = useMemo(() => {
    const byId = new Map(allProducts.map((p) => [p.id, p]));
    return productIds.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
  }, [allProducts, productIds]);

  return (
    <div style={{ padding: isSmall ? '24px 16px 60px' : '40px 40px 80px', maxWidth: 1280, margin: '0 auto' }}>
      <button type="button" onClick={onBack} aria-label="Volver al catálogo" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-60)', fontSize: 13, marginBottom: 24, fontFamily: '"Geist", sans-serif' }}>
        <Icon name="arrow-left" size={14} /> Volver
      </button>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
        <div>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 8 }}>
            Comparador · {products.length} producto{products.length === 1 ? '' : 's'}
          </div>
          <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: isSmall ? 36 : 44, letterSpacing: '-0.03em', margin: 0, fontWeight: 400 }}>
            Comparar <em style={{ color: 'var(--green)' }}>productos</em>
          </h1>
        </div>
        {products.length > 0 && (
          <AnimatedButton variant="outline" onClick={clear} text="Limpiar comparación" />
        )}
      </div>

      {products.length === 0 ? (
        <div style={{ background: 'var(--cream-2)', border: '1px solid var(--ink-06)', borderRadius: 20, padding: 40, textAlign: 'center' }}>
          <p style={{ margin: '0 0 16px', color: 'var(--ink-60)' }}>Agrega hasta 4 productos desde el catálogo usando el botón de comparar.</p>
          <AnimatedButton variant="primary" onClick={onBack} text="Ir al catálogo" />
        </div>
      ) : (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', minWidth: isSmall ? 640 : undefined, borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: 'var(--ink-60)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--ink-06)' }}>Atributo</th>
                {products.map((p) => (
                  <th key={p.id} style={{ verticalAlign: 'top', padding: '12px 16px', borderBottom: '1px solid var(--ink-06)', minWidth: 180 }}>
                    <div style={{ position: 'relative' }}>
                      <button type="button" aria-label={`Quitar ${p.name} de la comparación`} onClick={() => remove(p.id)} style={{ position: 'absolute', top: 0, right: 0, border: 'none', background: 'var(--cream-2)', borderRadius: 999, width: 32, height: 32, cursor: 'pointer' }}>
                        <Icon name="x" size={14} />
                      </button>
                      <div onClick={() => onOpenProduct(p)} style={{ cursor: 'pointer' }}>
                        <ProductImage product={p} size="sm" />
                        <div style={{ marginTop: 10, fontFamily: '"Geist", sans-serif', fontSize: 14, fontWeight: 500, lineHeight: 1.3 }}>{p.name}</div>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Marca', render: (p: Product) => p.brand },
                { label: 'Categoría', render: (p: Product) => p.category },
                { label: 'Precio', render: (p: Product) => `$${getEffectivePrice(p).toFixed(2)}` },
                { label: 'Rating', render: (p: Product) => <Stars value={p.rating} size={12} /> },
                { label: 'Stock', render: (p: Product) => (p.stock > 0 ? `${p.stock} uds.` : 'Agotado') },
                { label: 'Descripción', render: (p: Product) => p.short },
              ].map((row) => (
                <tr key={row.label}>
                  <td style={{ padding: '14px 16px', fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: 'var(--ink-60)', borderBottom: '1px solid var(--ink-06)', verticalAlign: 'top' }}>{row.label}</td>
                  {products.map((p) => (
                    <td key={`${row.label}-${p.id}`} style={{ padding: '14px 16px', fontSize: 14, color: 'var(--ink-80)', borderBottom: '1px solid var(--ink-06)', verticalAlign: 'top' }}>
                      {row.render(p)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td style={{ padding: '16px' }} />
                {products.map((p) => (
                  <td key={`actions-${p.id}`} style={{ padding: '16px' }}>
                    <AnimatedButton variant="primary" size="sm" onClick={() => onAdd(p)} disabled={p.stock === 0} text={p.stock === 0 ? 'Sin stock' : 'Agregar'} />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
