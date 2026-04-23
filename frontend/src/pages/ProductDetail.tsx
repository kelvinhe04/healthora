import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Product } from '../types';
import { ProductImage } from '../components/shared/ProductImage';
import { ProductCard } from '../components/shared/ProductCard';
import { Stars } from '../components/shared/Stars';
import { Button } from '../components/shared/Button';
import { Icon } from '../components/shared/Icon';
import { useProducts } from '../hooks/useProducts';

interface ProductDetailProps {
  product: Product;
  onAdd: (p: Product, qty: number) => void;
  onOpenProduct: (p: Product) => void;
  onBack: () => void;
}

const qtyBtn: CSSProperties = { width: 36, height: 36, borderRadius: 999, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

export function ProductDetail({ product, onAdd, onOpenProduct, onBack }: ProductDetailProps) {
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState('benefits');
  const [added, setAdded] = useState(false);
  const { data: allProducts = [] } = useProducts();
  const related = allProducts.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);

  const handleAdd = () => {
    onAdd(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  return (
    <main style={{ padding: '24px 40px 0' }}>
      <div style={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: 'var(--ink-60)', marginBottom: 24, letterSpacing: '0.06em' }}>
        <span onClick={onBack} style={{ cursor: 'pointer' }}>TIENDA</span> · {product.category.toUpperCase()} · <span style={{ color: 'var(--ink)' }}>{product.name.toUpperCase()}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 48, alignItems: 'start' }}>
        <div>
          <div style={{ background: product.color, borderRadius: 28, padding: 40, minHeight: 620, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 24, left: 24, fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: 'var(--ink-60)', letterSpacing: '0.12em' }}>01 / 04 · PRODUCT SHOT</div>
            <ProductImage product={product} size="lg" />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ flex: 1, borderRadius: 14, padding: 16, background: product.color, border: i === 0 ? '2px solid var(--ink)' : '2px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100 }}>
                <ProductImage product={product} size="xs" />
              </div>
            ))}
          </div>
        </div>

        <div style={{ paddingTop: 8 }}>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 12 }}>{product.brand} · {product.category}</div>
          <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 64, lineHeight: 0.98, letterSpacing: '-0.035em', margin: '0 0 20px', color: 'var(--ink)', fontWeight: 400 }}>{product.name}</h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <Stars value={product.rating} size={14} />
            <span style={{ fontSize: 13, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>{product.rating} ({product.reviews} reseñas)</span>
            <span style={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, background: 'var(--green)', borderRadius: 999 }} />
              EN STOCK · {product.stock} unidades
            </span>
          </div>

          <p style={{ fontSize: 17, lineHeight: 1.55, color: 'var(--ink-80)', marginBottom: 32, maxWidth: 480 }}>{product.short}</p>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid var(--ink-06)' }}>
            <span style={{ fontFamily: '"Instrument Serif", serif', fontSize: 48, color: 'var(--ink)', lineHeight: 1 }}>${product.price.toFixed(2)}</span>
            {product.priceBefore && (
              <>
                <span style={{ fontSize: 20, color: 'var(--ink-40)', textDecoration: 'line-through' }}>${product.priceBefore.toFixed(2)}</span>
                <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', background: 'var(--coral)', color: 'white', padding: '4px 8px', borderRadius: 999, fontWeight: 600 }}>AHORRA ${(product.priceBefore - product.price).toFixed(2)}</span>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--ink-20)', borderRadius: 999, padding: 4 }}>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={qtyBtn}><Icon name="minus" size={14} /></button>
              <span style={{ width: 40, textAlign: 'center', fontFamily: '"Geist", sans-serif', fontSize: 15 }}>{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} style={qtyBtn}><Icon name="plus" size={14} /></button>
            </div>
            <Button variant="primary" size="lg" onClick={handleAdd} style={{ flex: 1 }}>
              {added ? '✓ Agregado al carrito' : `Agregar al carrito · $${(product.price * qty).toFixed(2)}`}
            </Button>
          </div>
          <Button variant="outline" full>Comprar ahora con un clic</Button>

          <div style={{ marginTop: 24, background: 'var(--cream-2)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid var(--ink-06)' }}>
            {[{ icon: 'truck', t: 'Envío gratis en órdenes sobre $50' }, { icon: 'shield', t: 'Pago seguro con Stripe · 3D Secure' }, { icon: 'check', t: 'Productos verificados por farmacéuticos' }].map((row) => (
              <div key={row.t} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink-80)' }}>
                <Icon name={row.icon} size={16} /> {row.t}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 32 }}>
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--ink-06)' }}>
              {[{ id: 'benefits', label: 'Beneficios' }, { id: 'usage', label: 'Modo de uso' }, { id: 'ingredients', label: 'Ingredientes' }, { id: 'warnings', label: 'Advertencias' }].map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '14px 4px', marginRight: 28, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: '"Geist", sans-serif', color: tab === t.id ? 'var(--ink)' : 'var(--ink-60)', borderBottom: tab === t.id ? '2px solid var(--ink)' : '2px solid transparent', marginBottom: -1 }}>{t.label}</button>
              ))}
            </div>
            <div style={{ padding: '20px 0', fontSize: 15, lineHeight: 1.6, color: 'var(--ink-80)', fontFamily: '"Geist", sans-serif' }}>
              {tab === 'benefits' && <ul style={{ paddingLeft: 18, margin: 0 }}>{product.benefits.map((b) => <li key={b} style={{ marginBottom: 6 }}>{b}</li>)}</ul>}
              {tab === 'usage' && <p style={{ margin: 0 }}>{product.usage}</p>}
              {tab === 'ingredients' && <p style={{ margin: 0 }}>{product.ingredients}</p>}
              {tab === 'warnings' && <p style={{ margin: 0, color: 'var(--coral)' }}>⚠ {product.warnings}</p>}
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section style={{ marginTop: 80 }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 10 }}>También te puede gustar</div>
            <h2 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 44, letterSpacing: '-0.03em', margin: 0, color: 'var(--ink)', fontWeight: 400 }}>Productos <em style={{ color: 'var(--green)' }}>relacionados</em></h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
            {related.map((p) => <ProductCard key={p.id} product={p} onClick={onOpenProduct} onAdd={(pr) => onAdd(pr, 1)} />)}
          </div>
        </section>
      )}
    </main>
  );
}
