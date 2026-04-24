import type { CSSProperties } from 'react';
import type { Product, Category } from '../types';
import { ProductCard } from '../components/shared/ProductCard';
import { ProductImage } from '../components/shared/ProductImage';
import { Button } from '../components/shared/Button';
import { Icon } from '../components/shared/Icon';
import { useProducts } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';

type View = 'landing' | 'catalog' | 'product' | 'checkout' | 'success' | 'admin';

const NEEDS = [
  { id: 'Piel seca', label: 'Piel seca', tone: 'half-left' },
  { id: 'Energía y vitaminas', label: 'Energía y vitaminas', tone: 'half-right' },
  { id: 'Cuidado del bebé', label: 'Cuidado del bebé', tone: 'ring' },
  { id: 'Fitness y recuperación', label: 'Fitness y recuperación', tone: 'solid' },
];

interface LandingProps {
  onNav: (view: View, filter?: Record<string, string>) => void;
  onOpenProduct: (p: Product) => void;
  onAdd: (p: Product, qty?: number) => void;
}

const headKicker: CSSProperties = { fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 10 };
const headTitle: CSSProperties = { fontFamily: '"Instrument Serif", serif', fontSize: 56, letterSpacing: '-0.035em', lineHeight: 1, color: 'var(--ink)', margin: 0, fontWeight: 400 };
const seeAllLink: CSSProperties = { fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 999, border: '1px solid var(--ink-20)' };

export function Landing({ onNav, onOpenProduct, onAdd }: LandingProps) {
  const { data: products = [] } = useProducts();
  const { data: categories = [] } = useCategories();

  const scrollTo = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  const bestSellers = products.filter((p) => p.tag === 'Best seller').slice(0, 4);
  const featured = products.slice(4, 8);

  return (
    <main>
      {/* HERO */}
      <section style={{ padding: '32px 40px 0' }}>
        <div style={{ borderRadius: 32, overflow: 'hidden', background: 'linear-gradient(120deg, oklch(0.3 0.07 155) 0%, var(--green) 42%, oklch(0.37 0.075 155) 100%)', color: 'var(--cream)', display: 'grid', gridTemplateColumns: '1.15fr 1fr', minHeight: 560, position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(95% 90% at 84% 24%, rgba(207, 237, 53, 0.2) 0%, rgba(207, 237, 53, 0) 52%), radial-gradient(70% 70% at 8% 92%, rgba(255, 255, 255, 0.09) 0%, rgba(255, 255, 255, 0) 56%)' }} />
          <div style={{ padding: '64px 72px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 40 }}>
                <span style={{ width: 6, height: 6, background: 'var(--lime)', borderRadius: 999 }} />
                Nueva temporada · Otoño
              </div>
              <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 92, lineHeight: 0.92, letterSpacing: '-0.035em', fontWeight: 400, margin: 0 }}>
                Todo para tu<br />
                <span style={{ fontStyle: 'italic', color: 'var(--lime)' }}>salud</span>, cuidado<br />
                y bienestar.
              </h1>
            </div>
            <div>
              <p style={{ fontSize: 17, lineHeight: 1.5, maxWidth: 440, opacity: 0.82, marginBottom: 32, fontFamily: '"Geist", sans-serif' }}>
                Vitaminas, skincare, medicamentos, cuidado personal y más desde un solo lugar, con envío rápido y pago seguro.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <Button variant="lime" size="lg" onClick={() => onNav('catalog')} icon={<Icon name="arrow-right" size={14} />}>Comprar ahora</Button>
                <Button variant="outline" size="lg" onClick={() => scrollTo('bestsellers')} style={{ color: 'var(--cream)', borderColor: 'rgba(255,255,255,0.28)', backdropFilter: 'blur(2px)' }}>Ver best sellers</Button>
              </div>
            </div>
          </div>
          <div style={{ position: 'relative', overflow: 'hidden', zIndex: 2 }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em', position: 'absolute', top: 40, right: 40 }}>LIFESTYLE / MODEL SHOT</div>
              <div style={{ position: 'absolute', bottom: 40, left: 40, background: 'var(--cream)', color: 'var(--ink)', padding: '18px 20px', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 14, maxWidth: 280, boxShadow: '0 30px 60px -30px rgba(0,0,0,0.3)' }}>
                <div style={{ width: 52, height: 52, borderRadius: 999, background: 'var(--lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Instrument Serif", serif', fontSize: 22 }}>4.9</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>24,812 clientes felices</div>
                  <div style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: 'var(--ink-60)', marginTop: 2 }}>PROMEDIO GLOBAL DE ÓRDENES</div>
                </div>
              </div>
              {products[0] && <div style={{ position: 'absolute', top: 80, right: 60, transform: 'rotate(-8deg)', animation: 'heroFloatA 7.5s ease-in-out infinite' }}><ProductImage product={products[0]} size="md" /></div>}
              {products[2] && <div style={{ position: 'absolute', bottom: 110, right: 40, transform: 'rotate(6deg)', animation: 'heroFloatB 8.5s ease-in-out infinite' }}><ProductImage product={products[2]} size="sm" /></div>}
            </div>
          </div>
          <style>{`
            @keyframes heroFloatA {
              0%, 100% { transform: rotate(-8deg) translateY(0); }
              50% { transform: rotate(-5deg) translateY(-8px); }
            }
            @keyframes heroFloatB {
              0%, 100% { transform: rotate(6deg) translateY(0); }
              50% { transform: rotate(8deg) translateY(8px); }
            }
          `}</style>
        </div>
      </section>

      {/* CATEGORIES */}
      <section id="categorias" style={{ padding: '80px 40px 0' }}>
        <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <div style={headKicker}>01 · Categorías</div>
            <h2 style={headTitle}>Compra por <em style={{ color: 'var(--green)' }}>necesidad</em></h2>
          </div>
          <a onClick={() => onNav('catalog')} style={seeAllLink}>Ver todas las categorías <Icon name="arrow-right" size={14} /></a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
          {categories.slice(0, 6).map((cat: Category) => (
            <div key={cat.id} onClick={() => onNav('catalog', { category: cat.id })} style={{ background: cat.color, borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 180, cursor: 'pointer', transition: 'transform 200ms' }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-3px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}>
              <div style={{ width: 38, height: 38, borderRadius: 999, background: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="leaf" size={18} /></div>
              <div>
                <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 24, letterSpacing: '-0.02em', lineHeight: 1.05 }}>{cat.label}</div>
                <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6, marginTop: 6 }}>{cat.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* BEST SELLERS */}
      <section id="bestsellers" style={{ padding: '80px 40px 0' }}>
        <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <div style={headKicker}>02 · Best sellers</div>
            <h2 style={headTitle}>Lo más vendido <em style={{ color: 'var(--green)' }}>esta semana</em></h2>
          </div>
          <a onClick={() => onNav('catalog')} style={seeAllLink}>Ver todos <Icon name="arrow-right" size={14} /></a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {bestSellers.map((p) => <ProductCard key={p.id} product={p} onClick={onOpenProduct} onAdd={onAdd} />)}
        </div>
      </section>

      {/* PROMO BAND */}
      <section id="ofertas" style={{ padding: '80px 40px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <div style={{ background: 'var(--lime)', borderRadius: 28, padding: 56, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 360, position: 'relative', overflow: 'hidden' }}>
            <div style={{ maxWidth: 420 }}>
              <div style={{ ...headKicker, color: 'var(--ink-60)' }}>Promoción destacada</div>
              <h3 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 56, letterSpacing: '-0.03em', lineHeight: 0.98, margin: '12px 0 20px', color: 'var(--ink)' }}>25% OFF en tu<br />rutina de skincare</h3>
              <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--ink-60)', marginBottom: 28, maxWidth: 360 }}>Retinol, hidratantes y tratamientos seleccionados. Válido hasta el 30 de abril con el código <strong>PIEL25</strong>.</p>
              <Button variant="primary" onClick={() => onNav('catalog')} icon={<Icon name="arrow-right" size={14} />}>Comprar rutina</Button>
            </div>
            <div style={{ position: 'absolute', right: 40, bottom: 40, display: 'flex', gap: 16 }}>
              {products[2] && <div style={{ transform: 'rotate(-6deg)' }}><ProductImage product={products[2]} size="md" /></div>}
              {products[6] && <div style={{ transform: 'rotate(6deg) translateY(20px)' }}><ProductImage product={products[6]} size="md" /></div>}
            </div>
          </div>
          <div style={{ background: 'var(--cream-2)', borderRadius: 28, padding: 40, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 360 }}>
            <div>
              <div style={headKicker}>Club Healthora</div>
              <h3 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 36, letterSpacing: '-0.02em', lineHeight: 1, margin: '12px 0 16px' }}>Muestras <em style={{ color: 'var(--green)' }}>gratis</em> en cada orden</h3>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--ink-60)', marginBottom: 20 }}>Regístrate y elige 2 muestras por compra mayor a $60.</p>
            </div>
            <Button variant="primary" full>Unirme al club</Button>
          </div>
        </div>
      </section>

      {/* BY NEED */}
      <section style={{ padding: '80px 40px 0' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={headKicker}>03 · Por necesidad</div>
          <h2 style={headTitle}>¿Qué estás <em style={{ color: 'var(--green)' }}>buscando</em>?</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {NEEDS.map((n) => (
            <div key={n.id} onClick={() => onNav('catalog', { need: n.id })} style={{ background: 'var(--cream-2)', borderRadius: 20, padding: '28px 24px', cursor: 'pointer', border: '1px solid var(--ink-06)', display: 'flex', flexDirection: 'column', gap: 40, minHeight: 200, transition: 'all 220ms' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--green)'; e.currentTarget.style.color = 'var(--cream)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--cream-2)'; e.currentTarget.style.color = 'var(--ink)'; }}>
              <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    border: n.tone === 'ring' ? '2px solid currentColor' : 'none',
                    background:
                      n.tone === 'solid'
                        ? 'currentColor'
                        : n.tone === 'half-left'
                          ? 'linear-gradient(90deg, currentColor 0 50%, transparent 50% 100%)'
                          : n.tone === 'half-right'
                            ? 'linear-gradient(90deg, transparent 0 50%, currentColor 50% 100%)'
                            : 'transparent',
                    outline: n.tone === 'half-left' || n.tone === 'half-right' ? '2px solid currentColor' : 'none',
                    outlineOffset: '-2px',
                    display: 'block',
                  }}
                />
              </div>
              <div>
                <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 26, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 8 }}>{n.label}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: '"Geist", sans-serif', opacity: 0.75 }}>Explorar <Icon name="arrow-right" size={12} /></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* TRUST */}
      <section style={{ padding: '80px 40px 0' }}>
        <div style={{ background: 'var(--cream-2)', borderRadius: 28, padding: '48px 40px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32, border: '1px solid var(--ink-06)' }}>
          {[{ icon: 'shield', title: 'Pagos seguros', sub: 'Stripe · PCI DSS · 3D Secure' }, { icon: 'check', title: 'Productos verificados', sub: 'Farmacéuticos colegiados' }, { icon: 'truck', title: 'Envíos rápidos', sub: '24–48h en toda la región' }, { icon: 'headset', title: 'Atención al cliente', sub: 'Lun a sáb · 8am–8pm' }].map((t) => (
            <div key={t.title} style={{ display: 'flex', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--green)', color: 'var(--lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={t.icon} size={20} /></div>
              <div>
                <div style={{ fontFamily: '"Geist", sans-serif', fontSize: 15, fontWeight: 500, marginBottom: 4 }}>{t.title}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace' }}>{t.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURED */}
      <section id="nuevos" style={{ padding: '80px 40px 0' }}>
        <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <div style={headKicker}>04 · Nuevos ingresos</div>
            <h2 style={headTitle}>Recién <em style={{ color: 'var(--green)' }}>llegados</em></h2>
          </div>
          <a onClick={() => onNav('catalog')} style={seeAllLink}>Ver catálogo completo <Icon name="arrow-right" size={14} /></a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {featured.map((p) => <ProductCard key={p.id} product={p} onClick={onOpenProduct} onAdd={onAdd} />)}
        </div>
      </section>
    </main>
  );
}
