import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import type { Product, Category } from '../types';
import { ProductCard } from '../components/shared/ProductCard';
import { ProductImage } from '../components/shared/ProductImage';
import { Button } from '../components/shared/Button';
import { Icon } from '../components/shared/Icon';
import { useProducts } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';
import { api } from '../lib/api';

type View = 'landing' | 'catalog' | 'product' | 'checkout' | 'success' | 'admin' | 'club';

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

interface RevealSectionProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  delay?: number;
}

function RevealSection({ children, style, delay = 0, ...props }: RevealSectionProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      setIsVisible(true);
      return;
    }

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      {
        threshold: 0.18,
        rootMargin: '0px 0px -8% 0px',
      }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      {...props}
      style={{
        ...style,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 760ms cubic-bezier(.2,.8,.2,1) ${delay}ms, transform 760ms cubic-bezier(.2,.8,.2,1) ${delay}ms`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </section>
  );
}

export function Landing({ onNav, onOpenProduct, onAdd }: LandingProps) {
  const { data: products = [] } = useProducts();
  const { data: categories = [] } = useCategories();
  const [heroDeckOpen, setHeroDeckOpen] = useState(false);

  const scrollTo = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  const { data: reviewStats } = useQuery({
    queryKey: ['review-stats'],
    queryFn: api.reviews.stats,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const bestSellers = products.filter((p) => p.tag === 'Best seller').slice(0, 4);
  const featured = [...products]
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 4);
  const donnaBornInRoma = products.find((p) => p.id === 'valentino-donna-born-in-roma-eau-de-parfum');
  const goodGirl = products.find((p) => p.id === 'carolina-herrera-good-girl-eau-de-parfum');
  
  const categoryDeck = Array.from(
    new Map(
      products
        .filter((p) => p.category !== 'Fragancias' && (p.imageUrl || p.images?.length))
        .map((p) => [p.category, p])
    ).values()
  ).slice(0, 5);
  
  let deck = [];
  for (let i = 0; i < 5; i++) {
    if (i === 3 && goodGirl) {
      deck.push(goodGirl);
    } else if (i < categoryDeck.length) {
      deck.push(categoryDeck[i]);
    }
  }
  if (donnaBornInRoma) deck.push(donnaBornInRoma);
  
  const heroDeckProducts = deck;

  return (
    <main>
      {/* HERO */}
      <RevealSection style={{ padding: '32px 40px 0' }}>
        <div style={{ borderRadius: 32, overflow: 'hidden', background: 'linear-gradient(120deg, oklch(0.28 0.055 155) 0%, oklch(0.32 0.06 155) 38%, oklch(0.4 0.065 155) 100%)', color: 'var(--cream)', display: 'grid', gridTemplateColumns: '1.15fr 1fr', minHeight: 560, position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(95% 90% at 84% 24%, rgba(183, 239, 221, 0.12) 0%, rgba(183, 239, 221, 0) 52%), radial-gradient(70% 70% at 8% 92%, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 56%)' }} />
          <div style={{ padding: '64px 72px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 40 }}>
                <span style={{ width: 6, height: 6, background: 'var(--lime)', borderRadius: 999, boxShadow: '0 0 14px rgba(228, 242, 72, 0.45)' }} />
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
                <Button variant="lime" size="lg" onClick={() => onNav('catalog')} style={{ boxShadow: '0 14px 34px -20px rgba(0,0,0,0.45)' }} icon={<Icon name="arrow-right" size={14} />}>Comprar ahora</Button>
                <Button variant="outline" size="lg" onClick={() => scrollTo('bestsellers')} style={{ color: 'var(--cream)', borderColor: 'rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(6px)' }}>Ver best sellers</Button>
              </div>
            </div>
          </div>
          <div style={{ position: 'relative', overflow: 'hidden', zIndex: 2 }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em', position: 'absolute', top: 40, right: 40 }}>LIFESTYLE / MODEL SHOT</div>
              <div style={{ position: 'absolute', bottom: 40, left: 40, background: 'rgba(248, 246, 240, 0.96)', color: 'var(--ink)', padding: '18px 20px', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 14, maxWidth: 280, boxShadow: '0 30px 60px -30px rgba(0,0,0,0.3)' }}>
                <div style={{ width: 52, height: 52, borderRadius: 999, background: 'var(--lime)', color: 'oklch(0.28 0.055 155)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Instrument Serif", serif', fontSize: 22 }}>
                  {reviewStats?.avgRating ? reviewStats.avgRating.toFixed(1) : '—'}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>
                    {reviewStats?.total ? reviewStats.total.toLocaleString('es-CO') + ' clientes felices' : 'Sin reseñas aún'}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: 'var(--ink-60)', marginTop: 2 }}>PROMEDIO GLOBAL DE RESEÑAS</div>
                </div>
              </div>
              <div
                onMouseEnter={() => setHeroDeckOpen(true)}
                onMouseLeave={() => setHeroDeckOpen(false)}
                style={{ position: 'absolute', top: 34, right: 56, width: 500, height: 360 }}
              >
              {heroDeckProducts.map((product, index) => {
                const collapsed = [
                  { x: 116, y: 112, rotate: -28, z: 1 },
                  { x: 148, y: 82, rotate: -16, z: 2 },
                  { x: 176, y: 62, rotate: -6, z: 3 },
                  { x: 214, y: 76, rotate: 5, z: 4 },
                  { x: 246, y: 104, rotate: 15, z: 5 },
                  { x: 278, y: 74, rotate: 24, z: 6 },
                ][index] || { x: 180, y: 84, rotate: 0, z: 1 };
                const expanded = [
                  { x: 22, y: 132, rotate: -34, z: 1 },
                  { x: 78, y: 54, rotate: -21, z: 2 },
                  { x: 154, y: 10, rotate: -9, z: 3 },
                  { x: 238, y: 54, rotate: 6, z: 4 },
                  { x: 316, y: 126, rotate: 19, z: 5 },
                  { x: 358, y: 28, rotate: 28, z: 6 },
                ][index] || collapsed;
                const pose = heroDeckOpen ? expanded : collapsed;
                const cardShadow = heroDeckOpen
                  ? [
                      '0 14px 34px -20px rgba(0,0,0,0.22), 0 36px 80px -42px rgba(0,0,0,0.28)',
                      '0 18px 40px -22px rgba(0,0,0,0.24), 0 42px 92px -46px rgba(0,0,0,0.3)',
                      '0 22px 48px -24px rgba(0,0,0,0.28), 0 50px 104px -52px rgba(0,0,0,0.34)',
                      '0 24px 54px -24px rgba(0,0,0,0.3), 0 56px 118px -56px rgba(0,0,0,0.36)',
                      '0 28px 60px -26px rgba(0,0,0,0.34), 0 62px 130px -58px rgba(0,0,0,0.38)',
                      '0 32px 70px -28px rgba(0,0,0,0.38), 0 70px 144px -64px rgba(0,0,0,0.42)',
                    ][index]
                  : [
                      '0 10px 24px -16px rgba(0,0,0,0.18), 0 24px 56px -34px rgba(0,0,0,0.24)',
                      '0 12px 28px -16px rgba(0,0,0,0.2), 0 28px 60px -36px rgba(0,0,0,0.26)',
                      '0 14px 32px -18px rgba(0,0,0,0.22), 0 30px 68px -38px rgba(0,0,0,0.28)',
                      '0 16px 36px -20px rgba(0,0,0,0.24), 0 34px 74px -40px rgba(0,0,0,0.3)',
                      '0 18px 40px -20px rgba(0,0,0,0.28), 0 40px 86px -46px rgba(0,0,0,0.34)',
                      '0 22px 48px -22px rgba(0,0,0,0.3), 0 48px 98px -50px rgba(0,0,0,0.38)',
                    ][index];

                return (
                  <div
                    key={product.id}
                    style={{
                      position: 'absolute',
                      top: pose.y,
                      left: pose.x,
                      transform: `rotate(${pose.rotate}deg)`,
                      transition: 'top 420ms cubic-bezier(.2,.8,.2,1), left 420ms cubic-bezier(.2,.8,.2,1), transform 420ms cubic-bezier(.2,.8,.2,1), box-shadow 280ms ease',
                      zIndex: pose.z,
                    }}
                  >
                    <div style={{ opacity: 0, animation: `heroCardIn 720ms cubic-bezier(.18,.88,.24,1) ${120 + index * 90}ms forwards` }}>
                      <div style={{ animation: index % 2 === 0 ? 'heroFloatA 7.5s ease-in-out infinite' : 'heroFloatB 8.5s ease-in-out infinite' }}>
                        <div style={{ background: 'rgba(255,255,255,0.985)', borderRadius: 20, padding: 14, boxShadow: cardShadow, border: '1px solid rgba(255,255,255,0.6)' }}>
                          <ProductImage product={product} size="md" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          </div>
          <style>{`
            @keyframes heroCardIn {
              0% { opacity: 0; transform: translateY(28px) scale(0.9); }
              100% { opacity: 1; transform: translateY(0) scale(1); }
            }
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
      </RevealSection>

      {/* CATEGORIES */}
      <RevealSection id="categorias" style={{ padding: '80px 40px 0' }} delay={40}>
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
      </RevealSection>

      {/* BEST SELLERS */}
      <RevealSection id="bestsellers" style={{ padding: '80px 40px 0' }} delay={60}>
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
      </RevealSection>

      {/* PROMO BAND */}
      <RevealSection id="ofertas" style={{ padding: '80px 40px 0' }} delay={80}>
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
            <Button variant="primary" full onClick={() => onNav('club')}>Unirme al club</Button>
          </div>
        </div>
      </RevealSection>

      {/* BY NEED */}
      <RevealSection style={{ padding: '80px 40px 0' }} delay={100}>
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
      </RevealSection>

      {/* TRUST */}
      <RevealSection style={{ padding: '80px 40px 0' }} delay={120}>
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
      </RevealSection>

      {/* FEATURED */}
      <RevealSection id="nuevos" style={{ padding: '80px 40px 0' }} delay={140}>
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
      </RevealSection>
    </main>
  );
}
