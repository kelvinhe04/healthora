import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import type { Product } from '../types';
import { ProductImage } from '../components/shared/ProductImage';
import { ProductCard } from '../components/shared/ProductCard';
import { Stars } from '../components/shared/Stars';
import { Button } from '../components/shared/Button';
import { Icon } from '../components/shared/Icon';
import { useProducts } from '../hooks/useProducts';
import { useReviews } from '../hooks/useReviews';
import { ReviewSection } from '../components/shared/ReviewSection';

interface ProductDetailProps {
  product: Product;
  onAdd: (p: Product, qty: number) => void;
  onBuyNow: (p: Product, qty: number) => void;
  onOpenProduct: (p: Product) => void;
  onBack: () => void;
}

const qtyBtn: CSSProperties = { width: 36, height: 36, borderRadius: 999, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

export function ProductDetail({ product, onAdd, onBuyNow, onOpenProduct, onBack }: ProductDetailProps) {
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState('benefits');
  const [added, setAdded] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isZoomingOut, setIsZoomingOut] = useState(false);
  const { data: allProducts = [] } = useProducts();
  const related = allProducts.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);
  const { data: liveReviews } = useReviews(product.id);
  const liveCount = liveReviews?.length ?? 0;
  const liveRating = liveReviews && liveReviews.length > 0
    ? Math.round(liveReviews.reduce((s, r) => s + r.rating, 0) / liveReviews.length * 10) / 10
    : 0;
  const gallery = product.images?.length
    ? product.images.slice(0, 4)
    : Array.from({ length: 4 }, (_, i) => ({
        url: i === 0 ? product.imageUrl || '' : product.imageUrl || '',
        alt: `${product.name} ${i + 1}`,
        isPrimary: i === 0,
      })).filter((img) => img.url);
  const activeImage = gallery[activeImageIndex]?.url || product.imageUrl;
  const hasRealImages = Boolean(activeImage);

  const closeZoom = () => {
    setIsZoomingOut(true);
    setTimeout(() => {
      setIsZoomed(false);
      setIsZoomingOut(false);
    }, 250);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeZoom();
    };
    if (isZoomed) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZoomed]);

  useEffect(() => {
    setQty(1);
    setTab('benefits');
    setActiveImageIndex(0);
    setIsZoomed(false);
    setIsZoomingOut(false);
  }, [product.id]);

  const handleAdd = () => {
    onAdd(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  return (
    <main style={{ padding: '24px 40px 0' }}>
      {isZoomed && (
        <div 
          onClick={closeZoom} 
          style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(253, 252, 250, 0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', backdropFilter: 'blur(10px)', padding: 40, animation: isZoomingOut ? 'zoomModalOut 0.25s cubic-bezier(0.3, 0, 0.8, 0.15) forwards' : 'zoomModalBgIn 0.3s ease-out' }}
        >
          <button 
            style={{ position: 'absolute', top: 32, right: 32, background: 'var(--ink)', color: 'var(--cream)', border: 'none', borderRadius: 999, width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.2s', transform: isZoomingOut ? 'scale(0.8)' : 'scale(1)' }}
          >
            <Icon name="x" size={20} />
          </button>
          
          <div style={{ animation: isZoomingOut ? 'none' : 'zoomModalIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: isZoomingOut ? 'scale(0.95)' : 'scale(1)', opacity: isZoomingOut ? 0 : 1, transition: 'all 0.25s cubic-bezier(0.3, 0, 0.8, 0.15)' }}>
            {hasRealImages ? (
              <img src={activeImage} alt={gallery[activeImageIndex]?.alt || 'Zoom'} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 16, filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.08))' }} />
            ) : (
              <div style={{ transform: 'scale(1.5)' }}>
                <ProductImage product={product} size="lg" />
              </div>
            )}
          </div>
          <style>{`
            @keyframes zoomModalIn { from { opacity: 0; transform: scale(0.95) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
            @keyframes zoomModalBgIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes zoomModalOut { from { opacity: 1; } to { opacity: 0; pointer-events: none; } }
          `}</style>
        </div>
      )}

      <div style={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: 'var(--ink-60)', marginBottom: 24, letterSpacing: '0.06em' }}>
        <span onClick={onBack} style={{ cursor: 'pointer' }}>TIENDA</span> · {product.category.toUpperCase()} · <span style={{ color: 'var(--ink)' }}>{product.name.toUpperCase()}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 48, alignItems: 'start' }}>
        <div>
          <div 
            onClick={() => setIsZoomed(true)}
            style={{ background: hasRealImages ? 'white' : product.color, borderRadius: 28, padding: 40, minHeight: 620, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', border: hasRealImages ? '1px solid var(--ink-06)' : 'none', cursor: 'zoom-in' }}
          >
            <div style={{ position: 'absolute', top: 24, left: 24, fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: 'var(--ink-60)', letterSpacing: '0.12em', zIndex: 2 }}>{String(activeImageIndex + 1).padStart(2, '0')} / 04 · PRODUCT SHOT</div>
            <div key={activeImage} style={{ animation: 'fadeInImage 0.4s ease-out', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ProductImage product={product} size="lg" imageUrl={activeImage} alt={gallery[activeImageIndex]?.alt} />
            </div>
            <style>{`@keyframes fadeInImage { from { opacity: 0.4; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }`}</style>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            {gallery.map((image, i) => (
              <div 
                key={image.url} 
                onClick={() => setActiveImageIndex(i)} 
                onMouseEnter={() => setActiveImageIndex(i)}
                style={{ 
                  flex: 1, 
                  borderRadius: 14, 
                  padding: 16, 
                  background: hasRealImages ? 'white' : product.color, 
                  border: i === activeImageIndex ? '2px solid var(--ink)' : hasRealImages ? '1px solid var(--ink-06)' : '2px solid transparent', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  height: 100,
                  transition: 'all 0.2s ease',
                  opacity: i === activeImageIndex ? 1 : 0.6,
                  transform: i === activeImageIndex ? 'translateY(-2px)' : 'none'
                }}
                onMouseLeave={(e) => { if (i !== activeImageIndex) e.currentTarget.style.opacity = '0.6'; }}
              >
                <ProductImage product={product} size="xs" imageUrl={image.url} alt={image.alt} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ paddingTop: 8 }}>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 12 }}>{product.brand} · {product.category}</div>
          <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 64, lineHeight: 0.98, letterSpacing: '-0.035em', margin: '0 0 20px', color: 'var(--ink)', fontWeight: 400 }}>{product.name}</h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            {liveCount > 0 ? (
              <>
                <Stars value={liveRating} size={14} />
                <span style={{ fontSize: 13, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>{liveRating} · {liveCount} {liveCount === 1 ? 'reseña' : 'reseñas'}</span>
              </>
            ) : (
              <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: 'var(--ink-40)', letterSpacing: '0.06em' }}>SIN RESEÑAS AÚN</span>
            )}
            {product.stock === 0 ? (
              <span style={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: 'oklch(0.5 0.15 30)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, background: 'oklch(0.5 0.15 30)', borderRadius: 999 }} />
                AGOTADO
              </span>
            ) : (
              <span style={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, background: 'var(--green)', borderRadius: 999 }} />
                EN STOCK · {product.stock} unidades
              </span>
            )}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--ink-20)', borderRadius: 999, padding: 4, opacity: product.stock === 0 ? 0.4 : 1 }}>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={qtyBtn} disabled={product.stock === 0 || qty <= 1}><Icon name="minus" size={14} /></button>
              <span style={{ width: 40, textAlign: 'center', fontFamily: '"Geist", sans-serif', fontSize: 15 }}>{qty}</span>
              <button onClick={() => setQty((q) => Math.min(product.stock, q + 1))} style={qtyBtn} disabled={product.stock === 0 || qty >= product.stock}><Icon name="plus" size={14} /></button>
            </div>
            <Button variant="primary" size="lg" onClick={handleAdd} disabled={product.stock === 0} style={{ flex: 1 }}>
              {product.stock === 0 ? 'Sin stock' : added ? '✓ Agregado al carrito' : `Agregar al carrito · $${(product.price * qty).toFixed(2)}`}
            </Button>
          </div>
          <Button variant="outline" full onClick={() => onBuyNow(product, qty)} disabled={product.stock === 0}>Comprar ahora con un clic</Button>

          <div style={{ marginTop: 24, background: 'var(--cream-2)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid var(--ink-06)' }}>
            {[{ icon: 'truck', t: 'Envío gratis en órdenes sobre $50' }, { icon: 'shield', t: 'Pago seguro con Stripe · 3D Secure' }, { icon: 'check', t: 'Productos verificados por farmacéuticos' }].map((row) => (
              <div key={row.t} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink-80)' }}>
                <Icon name={row.icon} size={16} /> {row.t}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 32 }}>
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--ink-06)', flexWrap: 'wrap' }}>
              {[
                { id: 'benefits', label: 'Beneficios' },
                { id: 'usage', label: 'Modo de uso' },
                { id: 'ingredients', label: 'Ingredientes' },
                ...(product.nutritionFacts ? [{ id: 'nutrition', label: 'Info. nutricional' }] : []),
                ...(product.certifications?.length ? [{ id: 'certs', label: 'Certificaciones' }] : []),
                ...(product.interactions ? [{ id: 'interactions', label: 'Compatibilidad' }] : []),
                ...(product.faq?.length ? [{ id: 'faq', label: 'Preguntas frecuentes' }] : []),
                ...(product.shadeTips ? [{ id: 'shade', label: 'Tono & tez' }] : []),
                ...(product.applicationTips ? [{ id: 'application', label: 'Técnica' }] : []),
                ...(product.formulaDetails ? [{ id: 'formula', label: 'Fórmula' }] : []),
                ...(product.skinTypes?.length ? [{ id: 'skintypes', label: 'Tipos de piel' }] : []),
                ...(product.extraTabs?.length
                  ? product.extraTabs.map((t) => ({ id: `extra:${t.id}`, label: t.label }))
                  : []),
                { id: 'warnings', label: 'Advertencias' },
              ].map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '14px 4px', marginRight: 28, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: '"Geist", sans-serif', color: tab === t.id ? 'var(--ink)' : 'var(--ink-60)', borderBottom: tab === t.id ? '2px solid var(--ink)' : '2px solid transparent', marginBottom: -1, whiteSpace: 'nowrap' }}>{t.label}</button>
              ))}
            </div>
            <div style={{ padding: '20px 0', fontSize: 15, lineHeight: 1.6, color: 'var(--ink-80)', fontFamily: '"Geist", sans-serif' }}>
              {tab === 'benefits' && <ul style={{ paddingLeft: 18, margin: 0 }}>{product.benefits.map((b) => <li key={b} style={{ marginBottom: 6 }}>{b}</li>)}</ul>}
              {tab === 'usage' && <p style={{ margin: 0 }}>{product.usage}</p>}
              {tab === 'ingredients' && <p style={{ margin: 0 }}>{product.ingredients}</p>}
              {tab === 'nutrition' && product.nutritionFacts && (
                <pre style={{ margin: 0, fontFamily: '"JetBrains Mono", monospace', fontSize: 12, lineHeight: 1.9, whiteSpace: 'pre-wrap', color: 'var(--ink-80)' }}>{product.nutritionFacts}</pre>
              )}
              {tab === 'certs' && product.certifications?.length && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {product.certifications.map((c) => (
                    <span key={c} style={{ border: '1px solid var(--ink-20)', borderRadius: 999, padding: '7px 16px', fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink-80)' }}>{c}</span>
                  ))}
                </div>
              )}
              {tab === 'interactions' && product.interactions && <p style={{ margin: 0 }}>{product.interactions}</p>}
              {tab === 'faq' && product.faq?.length && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {product.faq.map(({ q, a }) => (
                    <div key={q}>
                      <p style={{ fontWeight: 600, margin: '0 0 6px', color: 'var(--ink)' }}>{q}</p>
                      <p style={{ margin: 0, color: 'var(--ink-60)' }}>{a}</p>
                    </div>
                  ))}
                </div>
              )}
              {tab === 'shade' && product.shadeTips && <p style={{ margin: 0 }}>{product.shadeTips}</p>}
              {tab === 'application' && product.applicationTips && <p style={{ margin: 0 }}>{product.applicationTips}</p>}
              {tab === 'formula' && product.formulaDetails && <p style={{ margin: 0 }}>{product.formulaDetails}</p>}
              {tab === 'skintypes' && product.skinTypes?.length && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {product.skinTypes.map((s) => (
                    <span key={s} style={{ border: '1px solid var(--ink-20)', borderRadius: 999, padding: '7px 16px', fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink-80)' }}>{s}</span>
                  ))}
                </div>
              )}
              {tab.startsWith('extra:') && (
                <p style={{ margin: 0 }}>
                  {product.extraTabs?.find((t) => `extra:${t.id}` === tab)?.content || ''}
                </p>
              )}
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

      <ReviewSection productId={product.id} />
    </main>
  );
}
