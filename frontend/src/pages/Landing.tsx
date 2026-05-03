import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Parallax } from 'react-scroll-parallax';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

gsap.registerPlugin(ScrollTrigger);
import type { Product, Category } from '../types';
import { ProductCard, ProductCardSkeleton } from '../components/shared/ProductCard';
import { ProductImage } from '../components/shared/ProductImage';
import { AnimatedButton } from '../components/shared/AnimatedButton';
import { Icon } from '../components/shared/Icon';
import { useProducts } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';
import { api } from '../lib/api';

type View = 'landing' | 'catalog' | 'product' | 'checkout' | 'success' | 'admin' | 'club';

type BrandStyle = 'serif' | 'sans' | 'mono';
type BrandItem = { name: string; s: BrandStyle };

const BRAND_ROWS: BrandItem[][] = [
  // skincare / dermatología
  [
    { name: 'CeraVe', s: 'sans' }, { name: 'La Roche-Posay', s: 'serif' }, { name: 'Neutrogena', s: 'sans' },
    { name: 'The Ordinary', s: 'sans' }, { name: "Paula's Choice", s: 'serif' }, { name: 'Aveeno', s: 'sans' },
    { name: 'EltaMD', s: 'mono' }, { name: 'Biossance', s: 'sans' }, { name: 'Naturium', s: 'sans' },
    { name: 'Laneige', s: 'serif' }, { name: 'COSRX', s: 'mono' }, { name: 'TATCHA', s: 'mono' },
    { name: 'Cetaphil', s: 'sans' }, { name: 'Differin', s: 'mono' }, { name: 'Eucerin', s: 'sans' },
  ],
  // farmacia / OTC
  [
    { name: 'Tylenol', s: 'sans' }, { name: 'Advil', s: 'sans' }, { name: 'Zyrtec', s: 'mono' },
    { name: 'Mucinex', s: 'sans' }, { name: 'Flonase', s: 'mono' }, { name: 'Claritin', s: 'sans' },
    { name: 'Nexium 24HR', s: 'mono' }, { name: 'Benadryl', s: 'sans' }, { name: 'Pepto Bismol', s: 'sans' },
    { name: 'Pepcid', s: 'mono' }, { name: 'Robitussin', s: 'sans' }, { name: 'Voltaren', s: 'mono' },
    { name: 'TUMS', s: 'mono' }, { name: 'Excedrin', s: 'sans' }, { name: 'Salonpas', s: 'mono' },
  ],
  // suplementos / nutrición
  [
    { name: 'Nature Made', s: 'serif' }, { name: 'Centrum', s: 'sans' }, { name: 'Nordic Naturals', s: 'serif' },
    { name: 'Vital Proteins', s: 'mono' }, { name: 'Garden of Life', s: 'serif' }, { name: 'OLLY', s: 'mono' },
    { name: 'Ritual', s: 'mono' }, { name: 'Culturelle', s: 'serif' }, { name: 'Emergen-C', s: 'mono' },
    { name: 'NOW Foods', s: 'sans' }, { name: 'Orgain', s: 'serif' }, { name: 'Nuun', s: 'mono' },
    { name: 'LMNT', s: 'mono' }, { name: "Nature's Bounty", s: 'serif' }, { name: 'SmartyPants', s: 'serif' },
  ],
  // cuidado personal
  [
    { name: 'Dove', s: 'sans' }, { name: 'Colgate', s: 'sans' }, { name: 'Listerine', s: 'serif' },
    { name: 'Gillette', s: 'serif' }, { name: 'Native', s: 'sans' }, { name: 'Oral-B', s: 'mono' },
    { name: 'Crest', s: 'sans' }, { name: 'Degree', s: 'sans' }, { name: 'Old Spice', s: 'serif' },
    { name: 'Tree Hut', s: 'serif' }, { name: "Dr. Bronner's", s: 'serif' }, { name: 'method', s: 'sans' },
    { name: 'Secret', s: 'sans' }, { name: "Dr Teal's", s: 'serif' }, { name: 'Aquaphor', s: 'sans' },
  ],
  // belleza / fragancias / deporte
  [
    { name: 'Dior', s: 'serif' }, { name: 'Valentino', s: 'serif' }, { name: 'Fenty Beauty', s: 'sans' },
    { name: 'NARS', s: 'mono' }, { name: 'Too Faced', s: 'serif' }, { name: 'Rare Beauty', s: 'sans' },
    { name: 'Glossier', s: 'sans' }, { name: 'Maybelline', s: 'sans' }, { name: 'Optimum Nutrition', s: 'mono' },
    { name: 'Yves Saint Laurent', s: 'serif' }, { name: 'Versace', s: 'serif' }, { name: 'BSN', s: 'mono' },
    { name: 'Cellucor', s: 'mono' }, { name: 'Sol de Janeiro', s: 'serif' }, { name: 'Vitafusion', s: 'sans' },
  ],
];

const BRAND_FONTS: Record<BrandStyle, CSSProperties> = {
  serif: { fontFamily: '"Instrument Serif", serif', fontStyle: 'italic', fontSize: 26, fontWeight: 400 },
  sans:  { fontFamily: '"Geist", sans-serif', fontWeight: 600, fontSize: 19, letterSpacing: '-0.02em' },
  mono:  { fontFamily: '"JetBrains Mono", monospace', fontSize: 13, letterSpacing: '0.1em', fontWeight: 700, textTransform: 'uppercase' as const },
};

function BrandLogo({ brand, onBrandClick }: { brand: BrandItem; onBrandClick: (name: string) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={() => onBrandClick(brand.name)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', padding: '8px 32px',
        cursor: 'pointer', whiteSpace: 'nowrap', color: 'var(--ink)',
        opacity: hovered ? 1 : 0.42,
        transform: hovered ? 'scale(1.08)' : 'scale(1)',
        transition: 'opacity 220ms ease, transform 200ms ease',
        ...BRAND_FONTS[brand.s],
      }}
    >
      {brand.name}
    </div>
  );
}

function BrandsMarquee({ onNav }: { onNav: (view: View, filter?: Record<string, string>) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const SPEEDS = [38, 58, 44, 52, 34];

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  const handleBrandClick = (name: string) => onNav('catalog', { brand: name });

  return (
    <div ref={ref} style={{ position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes bscroll-l { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes bscroll-r { from { transform: translateX(-50%) } to { transform: translateX(0) } }
        .brow-track:hover { animation-play-state: paused !important; }
      `}</style>
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', background: 'linear-gradient(to right, var(--cream) 0%, transparent 8%, transparent 92%, var(--cream) 100%)' }} />
      {BRAND_ROWS.map((row, ri) => {
        const doubled = [...row, ...row];
        const anim = `bscroll-${ri % 2 === 0 ? 'l' : 'r'} ${SPEEDS[ri]}s linear infinite`;
        return (
          <div
            key={ri}
            style={{
              overflow: 'hidden', marginBottom: ri < 4 ? 8 : 0,
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(20px)',
              transition: `opacity 680ms cubic-bezier(.2,.8,.2,1) ${ri * 130}ms, transform 680ms cubic-bezier(.2,.8,.2,1) ${ri * 130}ms`,
            }}
          >
            <div className="brow-track" style={{ display: 'flex', width: 'max-content', animation: anim, willChange: 'transform' }}>
              {doubled.map((brand, i) => (
                <BrandLogo key={i} brand={brand} onBrandClick={handleBrandClick} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

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

function StaggerItem({ children, index, baseDelay = 0 }: { children: ReactNode; index: number; baseDelay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setIsVisible(true);
        obs.disconnect();
      },
      { threshold: 0.15 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 600ms cubic-bezier(.2,.8,.2,1) ${baseDelay + index * 140}ms, transform 600ms cubic-bezier(.2,.8,.2,1) ${baseDelay + index * 140}ms`,
      }}
    >
      {children}
    </div>
  );
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

const HERO_CONTENT = [
  {
    id: 'Salud de la piel',
    pill: 'Dermatología avanzada',
    title: <>Piel radiante y<br /><span style={{ fontStyle: 'italic', color: 'var(--lime)' }}>saludable</span></>,
    sub: 'Dermocosmética de grado médico para proteger y revitalizar tu rostro día tras día.',
  },
  {
    id: 'Vitaminas',
    pill: 'Defensas al máximo',
    title: <>Vitalidad para tu<br /><span style={{ fontStyle: 'italic', color: 'var(--lime)' }}>día a día</span></>,
    sub: 'Refuerza tu sistema inmune y mantén tu energía con nuestra selección de vitaminas.',
  },
  {
    id: 'Cuidado del bebé',
    pill: 'Para los más pequeños',
    title: <>Protección muy<br /><span style={{ fontStyle: 'italic', color: 'var(--lime)' }}>delicada</span></>,
    sub: 'Fórmulas suaves, hipoalergénicas y pediátricas para cuidar la piel de tu bebé.',
  },
  {
    id: 'Cuidado personal',
    pill: 'Rutina de higiene',
    title: <>Siéntete bien<br /><span style={{ fontStyle: 'italic', color: 'var(--lime)' }}>por dentro y fuera</span></>,
    sub: 'Productos esenciales para tu cuidado e higiene personal de todos los días.',
  },
  {
    id: 'Suplementos',
    pill: 'Nutrición integral',
    title: <>Optimiza tu<br /><span style={{ fontStyle: 'italic', color: 'var(--lime)' }}>bienestar total</span></>,
    sub: 'Complementos nutricionales de alta calidad para cubrir tus requerimientos diarios.',
  },
  {
    id: 'Fitness',
    pill: 'Rendimiento deportivo',
    title: <>Alcanza tu<br /><span style={{ fontStyle: 'italic', color: 'var(--lime)' }}>máximo nivel</span></>,
    sub: 'Potencia tus entrenamientos, recupera músculos y supera tus límites.',
  },
  {
    id: 'Medicamentos',
    pill: 'Botiquín esencial',
    title: <>Alivio rápido<br /><span style={{ fontStyle: 'italic', color: 'var(--lime)' }}>y seguro</span></>,
    sub: 'Tu farmacia de confianza con medicamentos OTC para cualquier malestar.',
  },
  {
    id: 'Hidratantes',
    pill: 'Humectación profunda',
    title: <>Un oasis para<br /><span style={{ fontStyle: 'italic', color: 'var(--lime)' }}>tu piel</span></>,
    sub: 'Fórmulas que retienen la humedad durante 24 horas para una piel sedosa y suave.',
  },
  {
    id: 'Fragancias',
    pill: 'Aromas exclusivos',
    title: <>Descubre tu<br /><span style={{ fontStyle: 'italic', color: 'var(--lime)' }}>firma personal</span></>,
    sub: 'Perfumes de diseñador con notas inolvidables que dejan huella.',
  },
  {
    id: 'Maquillaje',
    pill: 'Expresa tu belleza',
    title: <>Color y<br /><span style={{ fontStyle: 'italic', color: 'var(--lime)' }}>luminosidad</span></>,
    sub: 'Cosméticos en tendencia y clásicos infalibles para realzar tu rostro.',
  }
];


function CategorySkeleton() {
  return (
    <div
      style={{
        borderRadius: 20,
        overflow: 'hidden',
        height: 180,
        background: 'var(--skeleton-base)',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, transparent 0%, var(--skeleton-shimmer) 50%, transparent 100%)',
          animation: 'shimmer 1.4s linear infinite',
          willChange: 'transform',
        }}
      />
    </div>
  );
}

export function Landing({ onNav, onOpenProduct, onAdd }: LandingProps) {
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();

  // Show skeleton for 1800ms on every mount — matches admin skeleton duration.
  // Without this, cached data makes isLoading=false instantly on navigation.
  const [isMounting, setIsMounting] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIsMounting(false), 1800);
    return () => clearTimeout(t);
  }, []);
  const showProductsSkeleton = productsLoading || isMounting;
  const showCategoriesSkeleton = categoriesLoading || isMounting;

  const heroRef = useRef<HTMLDivElement>(null);
  const cinematicRef = useRef<HTMLDivElement>(null);
  const [activeHeroIdx, setActiveHeroIdx] = useState(0);
  
  useGSAP(() => {
    if (!cinematicRef.current) return;
    
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: cinematicRef.current,
        start: 'top 140%',
        end: 'bottom 20%',
        scrub: 0.6,
      }
    });

    // Text starts slow at top, speeds up in middle, goes beyond section
    tl.to('.cine-text', { 
      y: '380%', 
      ease: 'power2.in', 
    }, 0);
    
    // Product comes from bottom, scales up, and rotates into view - FASTER
    tl.fromTo('.cine-product', 
      { y: '120vh', scale: 0.6, rotation: -45 },
      { y: '-20vh', scale: 2.0, rotation: 20, ease: 'power1.inOut' },
      0
    );
    
    // Ambient lights float up
    tl.to('.cine-light-1', { y: '-40vh', x: '10vw', ease: 'none' }, 0);
    tl.to('.cine-light-2', { y: '-50vh', x: '-10vw', ease: 'none' }, 0);
    
    // Left side images launch into view with different speeds - FASTER
    tl.fromTo('.cine-filo-left-1', 
      { y: '95vh', scale: 0.55, rotation: -42 },
      { y: '-60px', scale: 1.5, rotation: 18, ease: 'power1.inOut' },
      0
    );
    tl.fromTo('.cine-filo-left-2', 
      { y: '105vh', scale: 0.5, rotation: -50 },
      { y: '-80px', scale: 1.6, rotation: 25, ease: 'power1.inOut' },
      0.05
    );
    
    // Right side images launch into view with different speeds - FASTER
    tl.fromTo('.cine-filo-right-1', 
      { y: '95vh', scale: 0.55, rotation: 42 },
      { y: '-50px', scale: 1.5, rotation: -15, ease: 'power1.inOut' },
      0.02
    );
    tl.fromTo('.cine-filo-right-2', 
      { y: '105vh', scale: 0.5, rotation: 50 },
      { y: '-70px', scale: 1.6, rotation: -22, ease: 'power1.inOut' },
      0.02
    );

  }, { scope: cinematicRef });

  useGSAP(() => {
    const container = heroRef.current;
    if (!container) return;

    const items = gsap.utils.toArray<HTMLElement>('.hero-card-parallax', container);
    items.forEach((el) => {
      const speed = Number(el.dataset.speed ?? 10);
      const distance = speed * 6;
      gsap.to(el, {
        y: -distance,
        ease: 'none',
        scrollTrigger: {
          trigger: container,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      });
    });
  }, { scope: heroRef, dependencies: [activeHeroIdx, products.length] });

  useEffect(() => {
    if (products.length === 0) return;
    const rafId = requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });

    return () => cancelAnimationFrame(rafId);
  }, [products.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveHeroIdx((prev) => (prev + 1) % HERO_CONTENT.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

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

  const [displayRating, setDisplayRating] = useState(0);
  const [displayTotal, setDisplayTotal] = useState(0);

  useEffect(() => {
    if (!reviewStats) return;
    const targetRating = reviewStats.avgRating ? Number(reviewStats.avgRating.toFixed(1)) : 0;
    const targetTotal = reviewStats.total ?? 0;
    const duration = 1600;
    let start = 0;
    let rafId: number;

    const tick = (now: number) => {
      if (!start) start = now;
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setDisplayRating(Number((targetRating * eased).toFixed(1)));
      setDisplayTotal(Math.floor(targetTotal * eased));

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [reviewStats]);

  const bestSellers = products.filter((p) => p.tag === 'Best seller').slice(0, 4);
  const featured = [...products]
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 4);
  
  const activeHero = HERO_CONTENT[activeHeroIdx];
  const activeProducts = products
    .filter((p) => p.category === activeHero.id && (p.imageUrl || p.images?.length))
    .slice(0, 4); // Take up to 4 to display 3 or 4 in the floating composition

  return (
    <main>
      {/* HERO */}
      <RevealSection style={{ padding: '32px 40px 0' }}>
        <div ref={heroRef} style={{ borderRadius: 32, overflow: 'hidden', background: 'linear-gradient(120deg, oklch(0.28 0.055 155) 0%, oklch(0.32 0.06 155) 38%, oklch(0.4 0.065 155) 100%)', color: 'oklch(0.985 0.008 85)', minHeight: 560, position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(95% 90% at 84% 24%, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0) 52%), radial-gradient(70% 70% at 8% 92%, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 56%)' }} />
          
          {/* TEXT CONTENT */}
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '55%', padding: '64px 72px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', zIndex: 3, pointerEvents: 'none' }}>
            <Parallax speed={-8} style={{ pointerEvents: 'auto' }}>
              <div>
                <div key={`pill-${activeHeroIdx}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 40, animation: 'fadeInUp 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards' }}>
                  <span style={{ width: 6, height: 6, background: 'var(--lime)', borderRadius: 999, boxShadow: '0 0 10px rgba(210,230,60,0.5)' }} />
                  {activeHero.pill}
                </div>
                <h1 key={`title-${activeHeroIdx}`} style={{ fontFamily: '"Instrument Serif", serif', fontSize: 86, lineHeight: 0.95, letterSpacing: '-0.035em', fontWeight: 400, margin: 0, color: 'oklch(0.985 0.008 85)', animation: 'fadeInUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards' }}>
                  {activeHero.title}
                </h1>
              </div>
            </Parallax>
            <Parallax speed={-6} style={{ pointerEvents: 'auto' }}>
              <div>
                <p key={`sub-${activeHeroIdx}`} style={{ fontSize: 17, lineHeight: 1.5, maxWidth: 440, color: 'oklch(0.85 0.006 85)', opacity: 0, marginBottom: 32, fontFamily: '"Geist", sans-serif', animation: 'fadeInUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) 0.1s forwards' }}>
                  {activeHero.sub}
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                  <AnimatedButton variant="lime" size="lg" onClick={() => onNav('catalog', { category: activeHero.id })} className="hero-cta" style={{ boxShadow: '0 14px 34px -20px rgba(0,0,0,0.45)' }} icon={<Icon name="arrow-right" size={14} />} text="Comprar ahora" />
                  <AnimatedButton variant="outline" size="lg" onClick={() => scrollTo('bestsellers')} style={{ color: 'white', borderColor: 'rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(6px)' }} text="Ver best sellers" />
                </div>
              </div>
            </Parallax>
          </div>

          {/* FLOATING & ABSOLUTE ELEMENTS */}
          <Parallax translateY={[-30, 30]} style={{ position: 'absolute', top: 40, right: 40, zIndex: 3 }}>
            <div key={`cat-${activeHeroIdx}`} style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em', animation: 'fadeInUp 0.5s forwards' }}>{activeHero.id.toUpperCase()}</div>
          </Parallax>
          
          <Parallax speed={8} style={{ position: 'absolute', bottom: 60, left: '60%', zIndex: 5 }}>
            <div style={{ transform: 'translateX(-50%)', background: 'rgba(248, 246, 240, 0.96)', color: 'oklch(0.2 0.015 155)', padding: '18px 20px', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 14, maxWidth: 280, boxShadow: '0 30px 60px -30px rgba(0,0,0,0.3)' }}>
              <div style={{ width: 52, height: 52, borderRadius: 999, background: 'var(--lime)', color: 'oklch(0.28 0.055 155)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Instrument Serif", serif', fontSize: 22 }}>
                {reviewStats ? displayRating.toFixed(1) : '—'}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, color: 'oklch(0.2 0.015 155)' }}>
                  {reviewStats?.total ? displayTotal.toLocaleString('es-CO') + ' clientes felices' : 'Sin reseñas aún'}
                </div>
                <div style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: 'oklch(0.5 0.015 155)', marginTop: 2 }}>PROMEDIO GLOBAL DE RESEÑAS</div>
              </div>
            </div>
          </Parallax>

          {/* FLOATING COMPOSITION SPREAD OUT */}
          <div key={`comp-${activeHeroIdx}`} style={{ position: 'absolute', top: 0, right: '0%', bottom: 0, width: '45%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 2 }}>
            {activeProducts.map((product, index) => {
              // Asymmetric cool composition, moved further right
              const poses = [
                // Main central card
                { x: 80, y: -20, rotate: -4, scale: 1.15, z: 3, delay: 0, anim: 'heroFloatA' },
                // Top left card
                { x: -90, y: -120, rotate: -15, scale: 0.85, z: 2, delay: 0.15, anim: 'heroFloatB' },
                // Top right card
                { x: 220, y: -60, rotate: 12, scale: 0.9, z: 4, delay: 0.3, anim: 'heroFloatC' },
                // Bottom left card
                { x: -50, y: 140, rotate: 8, scale: 0.75, z: 1, delay: 0.45, anim: 'heroFloatA' }
              ];
              
              const pose = poses[index];
              if (!pose) return null;

              const baseYOffset = 55;

              const parallaxSpeeds = [18, 22, 20, 16];
              const parallaxSpeed = parallaxSpeeds[index] ?? 10;

              return (
                <div
                  key={product.id}
                  style={{
                    position: 'absolute',
                    zIndex: pose.z,
                    transform: `translate(${pose.x}px, ${pose.y + baseYOffset}px) rotate(${pose.rotate}deg) scale(${pose.scale})`,
                    opacity: 0,
                    animation: `cardEnterSpread 0.9s cubic-bezier(0.18, 0.88, 0.24, 1) ${pose.delay}s forwards`,
                    pointerEvents: 'auto'
                  }}
                >
                  <div className="hero-card-parallax" data-speed={parallaxSpeed} style={{ display: 'inline-flex' }}>
                    <div style={{ animation: `${pose.anim} ${6 + index}s ease-in-out infinite` }}>
                      <div style={{ 
                        background: 'rgba(255,255,255,0.985)', 
                        borderRadius: 20, 
                        padding: 14, 
                        boxShadow: '0 24px 54px -24px rgba(0,0,0,0.3), 0 56px 118px -56px rgba(0,0,0,0.36)', 
                        border: '1px solid rgba(255,255,255,0.6)',
                        cursor: 'pointer',
                        transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, border-color 0.3s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.08) translateY(-4px)';
                        e.currentTarget.style.boxShadow = '0 30px 60px -20px rgba(0,0,0,0.4), 0 60px 120px -40px rgba(0,0,0,0.5)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1) translateY(0)';
                        e.currentTarget.style.boxShadow = '0 24px 54px -24px rgba(0,0,0,0.3), 0 56px 118px -56px rgba(0,0,0,0.36)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)';
                      }}
                      onClick={() => onOpenProduct(product)}
                      >
                        <ProductImage product={product} size="md" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
<style>{`
            @keyframes fadeInUp {
              0% { opacity: 0; transform: translateY(20px); }
              100% { opacity: 1; transform: translateY(0); }
            }
            @keyframes cardEnterSpread {
              0% { opacity: 0; transform: translate(var(--startX, 150px), var(--startY, 80px)) rotate(calc(var(--rot, 0) + 15deg)) scale(calc(var(--s, 1) * 0.7)); }
              100% { opacity: 1; } /* Uses the inline style transform destination */
            }
            @keyframes heroFloatA {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-16px); }
            }
            @keyframes heroFloatB {
              0%, 100% { transform: translateY(0) rotate(0deg); }
              50% { transform: translateY(12px) rotate(-3deg); }
            }
            @keyframes heroFloatC {
              0%, 100% { transform: translateY(0) rotate(0deg); }
              50% { transform: translateY(-14px) rotate(4deg); }
            }
            .promo-card:hover {
              transform: scale(1.1) translateY(-8px) rotate(0deg) !important;
              filter: drop-shadow(0 20px 30px rgba(0,0,0,0.25)) !important;
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
          <AnimatedButton variant="outline" onClick={() => onNav('catalog')} icon={<Icon name="arrow-right" size={14} />} text="Ver todas las categorías" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
          {showCategoriesSkeleton
            ? Array.from({ length: 6 }).map((_, i) => (
                <CategorySkeleton key={i} />
              ))
            : categories.slice(0, 6).map((cat: Category, i) => (
                <StaggerItem key={cat.id} index={i}>
                  <div onClick={() => onNav('catalog', { category: cat.id })} className="category-card" style={{ background: cat.color, borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 180, cursor: 'pointer', transition: 'transform 200ms' }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-3px)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}>
                    <div style={{ width: 38, height: 38, borderRadius: 999, background: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="leaf" size={18} /></div>
                    <div className="cat-text">
                      <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 24, letterSpacing: '-0.02em', lineHeight: 1.05 }}>{cat.label}</div>
                      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6, marginTop: 6 }}>{cat.sub}</div>
                    </div>
                  </div>
                </StaggerItem>
              ))
          }
        </div>
      </RevealSection>

      {/* BEST SELLERS */}
      <RevealSection id="bestsellers" style={{ padding: '80px 40px 0' }} delay={60}>
        <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <div style={headKicker}>02 · Más vendidos</div>
            <h2 style={headTitle}>Lo más vendido <em style={{ color: 'var(--green)' }}>esta semana</em></h2>
          </div>
          <AnimatedButton variant="outline" onClick={() => onNav('catalog')} icon={<Icon name="arrow-right" size={14} />} text="Ver todos" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {showProductsSkeleton
            ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : bestSellers.map((p, i) => (
                <StaggerItem key={p.id} index={i}>
                  <ProductCard product={p} onClick={onOpenProduct} onAdd={onAdd} />
                </StaggerItem>
              ))
          }
        </div>
      </RevealSection>

      {/* PROMO BAND */}
      <RevealSection id="ofertas" style={{ padding: '80px 40px 0' }} delay={80}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <div className="promo-banner" style={{ background: 'var(--lime)', borderRadius: 28, padding: 56, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 360, position: 'relative', overflow: 'hidden' }}>
            <div style={{ maxWidth: 420 }}>
              <div style={{ ...headKicker, color: 'var(--ink-60)' }}>Promoción destacada</div>
              <h3 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 56, letterSpacing: '-0.03em', lineHeight: 0.98, margin: '12px 0 20px', color: 'var(--ink)' }}>25% OFF en tu<br />rutina de skincare</h3>
              <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--ink-60)', marginBottom: 12, maxWidth: 380 }}>Aplica en productos de <strong>Salud de la piel</strong> e <strong>Hidratantes</strong>. Válido hasta el 30 de abril con el código <strong>PIEL25</strong>.</p>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 28, padding: '8px 12px', borderRadius: 999, background: 'rgba(8, 6, 13, 0.08)', color: 'var(--ink)', fontSize: 11, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Categorías: Salud de la piel · Hidratantes
              </div>
              <AnimatedButton variant="primary" onClick={() => onNav('catalog')} icon={<Icon name="arrow-right" size={14} />} text="Comprar rutina" />
            </div>
            <div style={{ position: 'absolute', right: -15, bottom: 60, display: 'flex', gap: 16, zIndex: 10, alignItems: 'flex-end' }}>
              {products[2] && (
                <Parallax speed={4} style={{ pointerEvents: 'auto' }}>
                  <div 
                    className="promo-card" 
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'rotate(-6deg) scale(1.08) translateY(-8px)';
                      e.currentTarget.style.filter = 'drop-shadow(0 20px 30px rgba(0,0,0,0.25))';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'rotate(-6deg) scale(1) translateY(0)';
                      e.currentTarget.style.filter = 'drop-shadow(0 8px 16px rgba(0,0,0,0.15))';
                    }}
                    onClick={() => onOpenProduct(products[2])}
                    style={{ 
                      transform: 'rotate(-6deg)', 
                      cursor: 'pointer', 
                      transition: 'transform 0.25s ease, filter 0.25s ease', 
                      filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.15))',
                      pointerEvents: 'auto',
                      minWidth: 120,
                      minHeight: 140,
                    }}
                  >
                    <ProductImage product={products[2]} size="md" />
                  </div>
                </Parallax>
              )}
              {products[6] && (
                <Parallax speed={6} style={{ pointerEvents: 'auto' }}>
                  <div 
                    className="promo-card" 
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'rotate(14deg) translateY(12px) scale(1.08) translateY(-8px)';
                      e.currentTarget.style.filter = 'drop-shadow(0 20px 30px rgba(0,0,0,0.25))';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'rotate(14deg) translateY(20px) scale(1) translateY(0)';
                      e.currentTarget.style.filter = 'drop-shadow(0 8px 16px rgba(0,0,0,0.15))';
                    }}
                    onClick={() => onOpenProduct(products[6])}
                    style={{ 
                      transform: 'rotate(14deg) translateY(20px)',
                      cursor: 'pointer', 
                      transition: 'transform 0.25s ease, filter 0.25s ease', 
                      filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.15))',
                      pointerEvents: 'auto',
                      minWidth: 120,
                      minHeight: 140,
                    }}
                  >
                    <ProductImage product={products[6]} size="md" />
                  </div>
                </Parallax>
              )}
            </div>
          </div>
          <div style={{ background: 'var(--cream-2)', borderRadius: 28, padding: 40, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 360 }}>
            <div>
              <div style={headKicker}>Club Healthora</div>
              <h3 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 36, letterSpacing: '-0.02em', lineHeight: 1, margin: '12px 0 16px' }}>Una muestra <em style={{ color: 'var(--green)' }}>gratis</em> en órdenes premium</h3>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--ink-60)', marginBottom: 20 }}>Regístrate y recibe 1 muestra seleccionada en compras mayores a $200.</p>
            </div>
            <AnimatedButton variant="primary" full onClick={() => onNav('club')} text="Unirme al club" />
          </div>
        </div>
      </RevealSection>

      {/* PARALLAX BANNER (CINEMATIC WITH GSAP) */}
      <RevealSection style={{ padding: '80px 0 0' }} delay={90}>
        <div ref={cinematicRef} style={{ position: 'relative', height: '100vh', minHeight: 700, overflow: 'hidden', background: 'transparent' }}>
          
          {/* Ambient Lights */}
          <div className="cine-light-1" style={{ position: 'absolute', top: '20%', left: '10%', width: 250, height: 250, background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)', filter: 'blur(20px)', transform: 'rotate(-15deg)', pointerEvents: 'none' }} />
          <div className="cine-light-2" style={{ position: 'absolute', bottom: '30%', right: '5%', width: 350, height: 350, background: 'radial-gradient(circle, rgba(228, 242, 72, 0.05) 0%, rgba(228, 242, 72, 0) 70%)', filter: 'blur(30px)', pointerEvents: 'none' }} />
          
          {/* Text Content */}
          <div className="cine-text" style={{ position: 'absolute', top: '5%', left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: 'var(--ink)', padding: '0 40px' }}>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.25em', marginBottom: 24, opacity: 0.8 }}>Filosofía Healthora</div>
              <h2 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 'clamp(64px, 8vw, 120px)', margin: 0, lineHeight: 0.9 }}>
                Ciencia y naturaleza<br/><em style={{ color: 'var(--lime)', fontStyle: 'italic' }}>para tu bienestar</em>
              </h2>
            </div>
          </div>
          
          {/* Left side images */}
          <Parallax speed={-3} style={{ position: 'absolute', left: '22%', top: '50%', transform: 'translateY(-50%)', zIndex: 4 }}>
            <img className="cine-filo-left-1" src="/parallax/versace.avif" alt="Versace" style={{ width: 220, height: 'auto', maxHeight: 280, display: 'block', willChange: 'transform', filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.35))', background: 'transparent' }} />
          </Parallax>
          <Parallax speed={-5} style={{ position: 'absolute', left: '10%', top: '38%', transform: 'translateY(-50%)', zIndex: 3 }}>
            <img className="cine-filo-left-2" src="/parallax/valentino.avif" alt="Valentino" style={{ width: 220, height: 'auto', maxHeight: 280, display: 'block', willChange: 'transform', filter: 'drop-shadow(0 16px 24px rgba(0,0,0,0.3))', background: 'transparent' }} />
          </Parallax>
          
          {/* Right side images */}
          <Parallax speed={4} style={{ position: 'absolute', right: '22%', top: '48%', transform: 'translateY(-50%)', zIndex: 4 }}>
            <img className="cine-filo-right-1" src="/parallax/goodgirl-blush.avif" alt="Good Girl" style={{ width: 220, height: 'auto', maxHeight: 280, display: 'block', willChange: 'transform', filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.35))', background: 'transparent' }} />
          </Parallax>
          <Parallax speed={6} style={{ position: 'absolute', right: '10%', top: '62%', transform: 'translateY(-50%)', zIndex: 3 }}>
            <img className="cine-filo-right-2" src="/parallax/paco-rabanne.avif" alt="Paco Rabanne" style={{ width: 220, height: 'auto', maxHeight: 280, display: 'block', willChange: 'transform', filter: 'drop-shadow(0 16px 24px rgba(0,0,0,0.3))', background: 'transparent' }} />
          </Parallax>
          
          {/* Main Product with rotation and scale animation */}
          <div className="cine-product" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%) scale(1.4)', filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.4))', willChange: 'transform', zIndex: 5 }}>
            <img src="/parallax/jean-paul.png" alt="Jean Paul" style={{ width: 260, height: 'auto', maxHeight: 320, background: 'transparent' }} />
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
          {showProductsSkeleton
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ background: 'var(--cream-2)', borderRadius: 20, padding: '28px 24px', border: '1px solid var(--ink-06)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 200, gap: 40 }}>
                  {/* Icon circle */}
                  <div style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--skeleton-base)', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent 0%, var(--skeleton-shimmer) 50%, transparent 100%)', animation: 'shimmer 1.4s linear infinite' }} />
                  </div>
                  {/* Text block */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ height: 26, width: '70%', borderRadius: 6, background: 'var(--skeleton-base)', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent 0%, var(--skeleton-shimmer) 50%, transparent 100%)', animation: 'shimmer 1.4s linear infinite' }} />
                    </div>
                    <div style={{ height: 12, width: '40%', borderRadius: 4, background: 'var(--skeleton-base)', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent 0%, var(--skeleton-shimmer) 50%, transparent 100%)', animation: 'shimmer 1.4s linear infinite' }} />
                    </div>
                  </div>
                </div>
              ))
            : NEEDS.map((n, i) => (
                <StaggerItem key={n.id} index={i}>
                  <div onClick={() => onNav('catalog', { need: n.id })} style={{ background: 'var(--cream-2)', borderRadius: 20, padding: '28px 24px', cursor: 'pointer', border: '1px solid var(--ink-06)', display: 'flex', flexDirection: 'column', gap: 40, minHeight: 200, transition: 'all 220ms' }}
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
                </StaggerItem>
              ))
          }
        </div>
      </RevealSection>

      {/* TRUST */}
      <RevealSection style={{ padding: '80px 40px 0' }} delay={120}>
        <div style={{ background: 'var(--cream-2)', borderRadius: 28, padding: '48px 40px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32, border: '1px solid var(--ink-06)' }}>
          {[{ icon: 'shield', title: 'Pagos seguros', sub: 'Stripe · PCI DSS · 3D Secure' }, { icon: 'check', title: 'Productos verificados', sub: 'Farmacéuticos colegiados' }, { icon: 'truck', title: 'Envíos rápidos', sub: '24–48h en toda la región' }, { icon: 'headset', title: 'Atención al cliente', sub: 'Lun a sáb · 8am–8pm' }].map((t, i) => (
            <StaggerItem key={t.title} index={i}>
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--green)', color: 'var(--lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={t.icon} size={20} /></div>
                <div>
                  <div style={{ fontFamily: '"Geist", sans-serif', fontSize: 15, fontWeight: 500, marginBottom: 4 }}>{t.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace' }}>{t.sub}</div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </div>
      </RevealSection>

      {/* FEATURED */}
      <RevealSection id="nuevos" style={{ padding: '80px 40px 0' }} delay={130}>
        <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <div style={headKicker}>04 · Nuevos ingresos</div>
            <h2 style={headTitle}>Recién <em style={{ color: 'var(--green)' }}>llegados</em></h2>
          </div>
          <AnimatedButton variant="outline" onClick={() => onNav('catalog')} icon={<Icon name="arrow-right" size={14} />} text="Ver catálogo completo" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {showProductsSkeleton
            ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : featured.map((p, i) => (
                <StaggerItem key={p.id} index={i}>
                  <ProductCard product={p} onClick={onOpenProduct} onAdd={onAdd} />
                </StaggerItem>
              ))
          }
        </div>
      </RevealSection>

      {/* BRANDS */}
      <RevealSection id="marcas" style={{ padding: '80px 0 0' }} delay={150}>
        <div style={{ padding: '0 40px', marginBottom: 40 }}>
          <div style={headKicker}>05 · Marcas</div>
          <h2 style={headTitle}>Las marcas en las que <em style={{ color: 'var(--green)' }}>confías</em></h2>
        </div>
        <BrandsMarquee onNav={onNav} />
      </RevealSection>
    </main>
  );
}
