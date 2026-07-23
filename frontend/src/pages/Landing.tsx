import { useEffect, useLayoutEffect, useRef, useState, useMemo, createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Parallax } from 'react-scroll-parallax';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

gsap.registerPlugin(ScrollTrigger);
import type { Product, Category, ProductVariant, Banner } from '../types';
import { ProductRow } from '../components/shared/ProductRow';
import { RecentlyViewedSection } from '../components/shared/RecentlyViewedSection';
import { ProductImage } from '../components/shared/ProductImage';
import { AnimatedButton } from '../components/shared/AnimatedButton';
import { Icon } from '../components/shared/Icon';
import { useProducts } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';
import { useBanners } from '../hooks/useBanners';
import { resolveBannerText } from '../lib/bannerText';
import { getBannerTextColors } from '../lib/bannerColor';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { api } from '../lib/api';
import { formatNumber } from '../lib/currency';
import { NEEDS } from '../lib/needs';
import { CATEGORY_I18N_KEY, translatedCategoryLabel } from '../lib/categoryLabels';

// Runs before paint on the client (so a scroll correction is never visible as a flash) while
// safely degrading to useEffect during SSR, where layout effects don't run.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// When true, we're restoring scroll after coming back to the landing (from a product, the catalog,
// the club, etc.). The reveal animations (RevealSection/StaggerItem) start hidden and fade in on
// scroll, which would leave the restored viewport blank for a beat; while restoring they render
// already-visible instead.
const RestoringContext = createContext(false);

// Flipped true once the landing has mounted at least once this session. Guards the very first
// (fresh) page load from restoring a stale saved position - only genuine back-returns restore.
let landingHasMounted = false;

// Where to restore to on a back-return: a precise per-card anchor (product cards) or the generic
// landing scroll position saved on any other outbound navigation.
type RestoreTarget =
  | { kind: 'anchor'; id: string; top: number }
  | { kind: 'scroll'; y: number };

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

/** Renders a banner title, italicizing `highlightWord` in the accent color when it's a literal
 * substring of `title` (admin-authored banners, issue #265) - falls back to plain text otherwise. */
function BannerTitle({ title, highlightWord }: { title: string; highlightWord?: string }) {
  const idx = highlightWord ? title.indexOf(highlightWord) : -1;
  if (idx === -1) return <>{title}</>;
  return (
    <>
      {title.slice(0, idx)}
      <em style={{ color: 'var(--green)' }}>{highlightWord}</em>
      {title.slice(idx + (highlightWord as string).length)}
    </>
  );
}

type BannerTextField = 'kicker' | 'title' | 'highlightWord' | 'description' | 'ctaText';

/** Picks the English sibling field (`titleEn`, `descriptionEn`, ...) when active and non-empty,
 * falling back to the Spanish field otherwise (HU-084) - the admin can translate a banner
 * gradually field by field without ever showing blank text in either language. */
function bannerField(banner: Banner | null | undefined, field: BannerTextField, isEn: boolean): string {
  if (!banner) return '';
  if (isEn) {
    switch (field) {
      case 'kicker': if (banner.kickerEn) return banner.kickerEn; break;
      case 'title': if (banner.titleEn) return banner.titleEn; break;
      case 'highlightWord': if (banner.highlightWordEn) return banner.highlightWordEn; break;
      case 'description': if (banner.descriptionEn) return banner.descriptionEn; break;
      case 'ctaText': if (banner.ctaTextEn) return banner.ctaTextEn; break;
    }
  }
  return banner[field] ?? '';
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

interface LandingProps {
  onNav: (view: View, filter?: Record<string, string>) => void;
  onOpenProduct: (p: Product) => void;
  onAdd: (p: Product, qty?: number, variant?: ProductVariant) => void;
}

const headKicker: CSSProperties = { fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 10 };
const headTitle: CSSProperties = { fontFamily: '"Instrument Serif", serif', fontSize: 56, letterSpacing: '-0.035em', lineHeight: 1, color: 'var(--ink)', margin: 0, fontWeight: 400 };
const _seeAllLink: CSSProperties = { fontSize: 13, fontFamily: '"Geist", sans-serif', color: 'var(--ink)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 999, border: '1px solid var(--ink-20)' };

interface RevealSectionProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  delay?: number;
}

function StaggerItem({ children, index, baseDelay = 0 }: { children: ReactNode; index: number; baseDelay?: number }) {
  const restoring = useContext(RestoringContext);
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(restoring);

  useEffect(() => {
    if (typeof window === 'undefined' || restoring) return;
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
  }, [restoring]);

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
  const restoring = useContext(RestoringContext);
  const ref = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(restoring);

  useEffect(() => {
    if (typeof window === 'undefined' || restoring) return;

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
  }, [restoring]);

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

// Traducible via `landing.hero.<keySuffix>.*` en common.json (HU-084) - `id` se mantiene en
// español porque es un valor funcional (filtra productos por categoría, ver `activeProducts`).
const HERO_CONTENT = [
  { id: 'Salud de la piel', keySuffix: 'skinHealth' },
  { id: 'Vitaminas', keySuffix: 'vitamins' },
  { id: 'Cuidado del bebé', keySuffix: 'babyCare' },
  { id: 'Cuidado personal', keySuffix: 'personalCare' },
  { id: 'Suplementos de Bienestar', keySuffix: 'wellnessSupplements' },
  { id: 'Fitness', keySuffix: 'fitness' },
  { id: 'Medicamentos', keySuffix: 'medications' },
  { id: 'Hidratantes', keySuffix: 'moisturizers' },
  { id: 'Fragancias', keySuffix: 'fragrances' },
  { id: 'Maquillaje', keySuffix: 'makeup' },
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

let landingInitialLoadDone = false;

export function Landing({ onNav, onOpenProduct, onAdd }: LandingProps) {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language.startsWith('en');
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const isTablet = bp === 'tablet';
  const isSmall = isMobile || isTablet;

  const secPad = isMobile ? '48px 16px 0' : isTablet ? '64px 24px 0' : '80px 40px 0';
  const secPadNoH = isMobile ? '0 16px' : isTablet ? '0 24px' : '0 40px';

  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const { data: banners } = useBanners();
  const primaryBanner = banners?.promo ?? null;
  const secondaryBanner = banners?.club ?? null;
  // {categoria}/{fechaDesde}/{fechaHasta} en el texto del banner (issue #265 feedback) se resuelven
  // acá contra la categoría/fechas reales, así nunca quedan desactualizados como el texto
  // hardcodeado original.
  const primaryCategoryRaw = categories.find((c) => c.id === primaryBanner?.categoryId)?.label;
  const primaryCategoryLabel = translatedCategoryLabel(t, primaryCategoryRaw);
  const resolvePrimaryText = (text: string) =>
    resolveBannerText(text, { categoryLabel: primaryCategoryLabel, startDate: primaryBanner?.startDate, endDate: primaryBanner?.endDate });
  const resolveSecondaryText = (text: string) =>
    resolveBannerText(text, { startDate: secondaryBanner?.startDate, endDate: secondaryBanner?.endDate });
  const primaryTextColors = getBannerTextColors(primaryBanner?.backgroundColor);
  const secondaryTextColors = getBannerTextColors(secondaryBanner?.backgroundColor);
  const routerNavigate = useNavigate();
  // ctaHref comes from the admin-authored Banner document (issue #265), not the app's closed
  // View union, so it isn't known at compile time - external links open in a new tab, internal
  // ones go through the router.
  const handleBannerCta = (href: string) => {
    if (/^https?:\/\//.test(href)) {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    routerNavigate({ to: href });
  };

  const [isMounting, setIsMounting] = useState(!landingInitialLoadDone);
  useEffect(() => {
    if (!landingInitialLoadDone) {
      const t = setTimeout(() => { setIsMounting(false); landingInitialLoadDone = true; }, 1800);
      return () => clearTimeout(t);
    }
  }, []);
  const showProductsSkeleton = productsLoading || isMounting;
  const showCategoriesSkeleton = categoriesLoading || isMounting;

  // Captured once at mount: are we returning to the landing with a saved scroll position (a product
  // card anchor, or the generic landing scroll from any other outbound click)? Drives
  // RestoringContext so the reveal animations don't blank out the restored viewport. Never true on
  // the first mount of a fresh load (landingHasMounted guard), so initial visits still animate.
  const [isRestoring] = useState(() => {
    if (typeof window === 'undefined' || !landingHasMounted) return false;
    try {
      return !!(sessionStorage.getItem('lastProductAnchor') || sessionStorage.getItem('landingScrollY'));
    } catch {
      return false;
    }
  });
  useEffect(() => {
    landingHasMounted = true;
  }, []);
  // Caches the resolved restore target once read, so the hold loop survives effect re-runs.
  // `undefined` = not read yet; `null` = nothing to restore.
  const restoreTargetRef = useRef<RestoreTarget | null | undefined>(undefined);

  const heroRef = useRef<HTMLDivElement>(null);
  const cinematicRef = useRef<HTMLDivElement>(null);
  const [activeHeroIdx, setActiveHeroIdx] = useState(0);
  const [hoveredHeroCardIdx, setHoveredHeroCardIdx] = useState<number | null>(null);
  const heroCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  
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

  // When returning to the landing (from a product, the catalog, the club, a footer link, ...) put
  // the page back where it was - directly, with no visible detour through the top. On back
  // navigation the products are already cached (so cards exist on the first render) and each product
  // tile has a fixed height, so the layout is stable and we can correct the scroll inside a layout
  // effect, before the browser paints.
  //
  // Several actors fight over the scroll right after this page mounts: TanStack Router's scroll
  // restoration first resets to the top (and may then restore), and this page's
  // ScrollTrigger.refresh() briefly scrolls to 0 while it remeasures. Instead of waiting them out
  // with a delay (what made the old version show the top for ~900ms and then jump), we re-assert
  // the target position every frame for a short window, so any stray reset is undone on the very
  // next frame rather than being seen. A genuine user gesture cancels the hold. Meanwhile
  // RestoringContext keeps the reveal animations from blanking the restored viewport.
  useIsomorphicLayoutEffect(() => {
    if (!isRestoring || showProductsSkeleton || products.length === 0) return;

    // Resolve the restore target once and cache it in a ref. Reading it via the ref (rather than
    // re-reading sessionStorage each run) lets the hold loop be torn down and restarted - by a
    // dependency change or React StrictMode's double-invoke - without the one-shot removals below
    // making a later run find nothing. A precise per-card anchor (product cards) wins over the
    // generic scroll position saved for any other outbound click (categories, promos, brands, ...).
    if (restoreTargetRef.current === undefined) {
      let target: RestoreTarget | null = null;
      try {
        const rawAnchor = sessionStorage.getItem('lastProductAnchor');
        if (rawAnchor) {
          // One-shot, and it supersedes the generic position for this return.
          sessionStorage.removeItem('lastProductAnchor');
          sessionStorage.removeItem('landingScrollY');
          const a = JSON.parse(rawAnchor);
          if (a && typeof a.id === 'string' && typeof a.top === 'number') {
            target = { kind: 'anchor', id: a.id, top: a.top };
          }
        }
        if (!target) {
          // Kept (not removed) so back/forward between the landing and another page keeps working;
          // it's overwritten on the next outbound navigation and cleared when going Home.
          const rawY = sessionStorage.getItem('landingScrollY');
          if (rawY != null) {
            const y = Number(rawY);
            if (Number.isFinite(y)) target = { kind: 'scroll', y };
          }
        }
      } catch {
        target = null;
      }
      restoreTargetRef.current = target;
    }
    const target = restoreTargetRef.current;
    if (!target) return;

    const applyOnce = () => {
      if (target.kind === 'anchor') {
        const el = document.getElementById(target.id);
        if (!el) return;
        const delta = el.getBoundingClientRect().top - target.top;
        if (Math.abs(delta) > 1) {
          window.scrollTo({ top: window.scrollY + delta, behavior: 'instant' });
        }
      } else if (Math.abs(window.scrollY - target.y) > 1) {
        window.scrollTo({ top: target.y, behavior: 'instant' });
      }
    };

    // Correct before the first paint so the reset-to-top is never shown.
    applyOnce();

    let cancelled = false;
    let rafId = 0;
    const start = performance.now();
    const stop = () => {
      cancelled = true;
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchmove', stop);
      window.removeEventListener('keydown', stop);
    };
    // Only user-initiated scrolling should end the hold early - not our own programmatic scrolls.
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchmove', stop, { passive: true });
    window.addEventListener('keydown', stop);

    const HOLD_MS = 900; // outlasts the router reset (~200ms) and ScrollTrigger.refresh (~600ms)
    const tick = () => {
      if (cancelled) return;
      applyOnce();
      if (performance.now() - start < HOLD_MS) {
        rafId = requestAnimationFrame(tick);
      } else {
        stop();
      }
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      stop();
    };
  }, [isRestoring, showProductsSkeleton, products.length]);

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

  const bestSellers = useMemo(() => {
    const tagged = products.filter((p) => p.tag === 'Más vendido').slice(0, 8);
    if (tagged.length > 0) return tagged;
    return [...products].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 8);
  }, [products]);

  const featured = useMemo(() => {
    const tagged = products.filter((p) => p.tag === 'Nuevo').slice(0, 8);
    if (tagged.length > 0) return tagged;
    return products.slice(0, 8);
  }, [products]);
  
  const activeHero = HERO_CONTENT[activeHeroIdx];
  const activeProducts = useMemo(() => {
    const withImage = (p: typeof products[number]) => Boolean(p.imageUrl || p.images?.length);
    const fromCategory = products.filter((p) => p.category === activeHero.id && withImage(p)).slice(0, 4);
    if (fromCategory.length > 0) return fromCategory;
    return products.filter(withImage).slice(0, 4);
  }, [products, activeHero.id]);

  // Fotos flotantes del banner de promoción (issue #265 feedback): salen de la categoría elegida
  // por el admin (primaryBanner.categoryId), no de nombres de producto hardcodeados.
  const promoCategoryId = primaryBanner?.categoryId;
  const [promoSkinProduct, promoHydrationProduct] = useMemo(() => {
    if (!promoCategoryId) return [];
    return products.filter((p) => p.category === promoCategoryId && (p.imageUrl || p.images?.length)).slice(0, 2);
  }, [products, promoCategoryId]);

  return (
    <RestoringContext.Provider value={isRestoring}>
    <div>
      {/* HERO */}
      <RevealSection style={{ padding: isMobile ? '16px 16px 0' : isTablet ? '24px 24px 0' : '32px 40px 0' }}>
        <div ref={heroRef} style={{ borderRadius: isMobile ? 20 : 32, overflow: 'hidden', background: 'linear-gradient(120deg, oklch(0.28 0.055 155) 0%, oklch(0.32 0.06 155) 38%, oklch(0.4 0.065 155) 100%)', color: 'oklch(0.985 0.008 85)', minHeight: isMobile ? 420 : 560, position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(95% 90% at 84% 24%, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0) 52%), radial-gradient(70% 70% at 8% 92%, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 56%)' }} />

          {/* TEXT CONTENT */}
          <div style={{ position: isMobile ? 'relative' : 'absolute', left: 0, top: 0, bottom: 0, width: isMobile ? '100%' : isTablet ? '65%' : '55%', padding: isMobile ? '36px 24px 200px' : isTablet ? '44px 40px' : '64px 72px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', zIndex: 3, pointerEvents: 'none', gap: isMobile ? 24 : 0 }}>
            <Parallax speed={isMobile ? 0 : -8} style={{ pointerEvents: 'auto' }}>
              <div>
                <div key={`pill-${activeHeroIdx}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: isMobile ? 20 : 40, animation: 'fadeInUp 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards' }}>
                  <span style={{ width: 6, height: 6, background: 'var(--lime)', borderRadius: 999, boxShadow: '0 0 10px rgba(210,230,60,0.5)' }} />
                  {t(`landing.hero.${activeHero.keySuffix}.pill`)}
                </div>
                <h1 key={`title-${activeHeroIdx}`} style={{ fontFamily: '"Instrument Serif", serif', fontSize: isMobile ? 48 : isTablet ? 64 : 86, lineHeight: 0.95, letterSpacing: '-0.035em', fontWeight: 400, margin: 0, color: 'oklch(0.985 0.008 85)', animation: 'fadeInUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards' }}>
                  {t(`landing.hero.${activeHero.keySuffix}.titlePrefix`)}<br /><span style={{ fontStyle: 'italic', color: 'var(--lime)' }}>{t(`landing.hero.${activeHero.keySuffix}.titleEmphasis`)}</span>
                </h1>
              </div>
            </Parallax>
            <Parallax speed={isMobile ? 0 : -6} style={{ pointerEvents: 'auto' }}>
              <div>
                <p key={`sub-${activeHeroIdx}`} style={{ fontSize: isMobile ? 14 : 17, lineHeight: 1.5, maxWidth: 440, color: 'oklch(0.85 0.006 85)', opacity: 0, marginBottom: isMobile ? 20 : 32, fontFamily: '"Geist", sans-serif', animation: 'fadeInUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) 0.1s forwards' }}>
                  {t(`landing.hero.${activeHero.keySuffix}.sub`)}
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <AnimatedButton variant="lime" size={isMobile ? 'md' : 'lg'} onClick={() => onNav('catalog', { category: activeHero.id })} className="hero-cta" style={{ boxShadow: '0 14px 34px -20px rgba(0,0,0,0.45)' }} icon={<Icon name="arrow-right" size={14} />} text={t('landing.ctaBuyNow')} />
                  {!isMobile && <AnimatedButton variant="outline" size="lg" onClick={() => scrollTo('bestsellers')} style={{ color: 'white', borderColor: 'rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(6px)' }} text={t('landing.ctaSeeBestsellers')} />}
                </div>
              </div>
            </Parallax>
          </div>

          {/* FLOATING & ABSOLUTE ELEMENTS */}
          {!isMobile && (
            <Parallax translateY={[-30, 30]} style={{ position: 'absolute', top: 40, right: 40, zIndex: 3 }}>
              <div key={`cat-${activeHeroIdx}`} style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em', animation: 'fadeInUp 0.5s forwards' }}>{t(`footer.categories.${activeHero.keySuffix}`).toUpperCase()}</div>
            </Parallax>
          )}

          {!isMobile && (
            <Parallax speed={8} style={{ position: 'absolute', bottom: 60, left: '60%', zIndex: 5 }}>
              <div style={{ transform: 'translateX(-50%)', background: 'rgba(248, 246, 240, 0.96)', color: 'oklch(0.2 0.015 155)', padding: '18px 20px', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 14, maxWidth: 280, boxShadow: '0 30px 60px -30px rgba(0,0,0,0.3)' }}>
                <div style={{ width: 52, height: 52, borderRadius: 999, background: 'var(--lime)', color: 'oklch(0.28 0.055 155)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Instrument Serif", serif', fontSize: 22 }}>
                  {reviewStats ? displayRating.toFixed(1) : '—'}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, color: 'oklch(0.2 0.015 155)' }}>
                    {reviewStats?.total ? t('landing.reviews.happyCustomers', { amount: formatNumber(displayTotal) }) : t('landing.reviews.noReviewsYet')}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: 'oklch(0.5 0.015 155)', marginTop: 2 }}>{t('landing.reviews.avgRatingLabel')}</div>
                </div>
              </div>
            </Parallax>
          )}

          {/* FLOATING COMPOSITION */}
          {(() => {
            const rScale = isTablet && !isMobile ? 0.7 : 1;
            const rDist = isTablet && !isMobile ? 0.65 : 1;
            const baseYOffset = isMobile ? 0 : 55;

            // Asymmetric cool composition for desktop/tablet
            const basePoses = [
              { x: 80, y: -20, rotate: -4, scale: 1.15, z: 3, delay: 0, anim: 'heroFloatA' },
              { x: -90, y: -120, rotate: -15, scale: 0.85, z: 2, delay: 0.15, anim: 'heroFloatB' },
              { x: 220, y: -60, rotate: 12, scale: 0.9, z: 4, delay: 0.3, anim: 'heroFloatC' },
              { x: -50, y: 140, rotate: 8, scale: 0.75, z: 1, delay: 0.45, anim: 'heroFloatA' }
            ];

            // Centered fan composition for mobile at the bottom
            const mobilePoses = [
              { x: 41, y: 30, rotate: 6, scale: 0.55, z: 4, delay: 0, anim: 'heroFloatA' },
              { x: -49, y: 40, rotate: -14, scale: 0.48, z: 3, delay: 0.1, anim: 'heroFloatB' },
              { x: 111, y: 45, rotate: 18, scale: 0.45, z: 2, delay: 0.2, anim: 'heroFloatC' },
              { x: -109, y: 60, rotate: -24, scale: 0.38, z: 1, delay: 0.3, anim: 'heroFloatA' }
            ];

            const activePoses = isMobile ? mobilePoses : basePoses;

            // The 4 cards are opaque rotated rectangles that overlap, so a chunk of
            // the lowest z-index card is genuinely painted over by the others. Plain
            // per-card onMouseEnter/Leave never reacts there since the browser
            // (correctly) hit-tests to whichever card is topmost at that pixel.
            //
            // Instead of trusting hit-testing, for each mousemove we test the cursor
            // against every card's own true rotated rectangle (inverse-transforming
            // the point into that card's local space, using its untransformed
            // offsetWidth/offsetHeight so rotation is exact, not an axis-aligned
            // approximation). If the cursor lands inside exactly one card's
            // rectangle, that one wins unambiguously — this matches native hit-test
            // everywhere a card is fully exposed, so it can't steal hover from a
            // clearly visible different card. Only when the cursor is inside more
            // than one card's rectangle at once (a genuine overlap zone) do we break
            // the tie by nearest center, letting the buried card win there — which is
            // exactly the "stacked photos" trick: the buried card reacts as soon as
            // the cursor is closer to it than to whatever's drawn on top. If the
            // cursor is inside no card's rectangle (background gaps), fall back to
            // nearest-edge distance.
            const handleCompositionMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
              const px = e.clientX;
              const py = e.clientY;

              // Read each card's real current box straight from the DOM (via
              // getBoundingClientRect) instead of recomputing it from the pose data.
              // The rendered position is the sum of several independent transforms
              // (this composition's own translate/rotate/scale, a GSAP scroll-linked
              // parallax translateY on `.hero-card-parallax`, and a CSS bounce
              // animation) — asking the browser for the live box sidesteps having to
              // keep all of those in sync by hand, at the cost of using its
              // axis-aligned bounding box rather than the exact rotated rectangle.
              const candidates = activeProducts.map((_product, index) => {
                const el = heroCardRefs.current[index];
                if (!el) return null;

                const rect = el.getBoundingClientRect();
                const cx = (rect.left + rect.right) / 2;
                const cy = (rect.top + rect.bottom) / 2;

                const clampedX = Math.max(rect.left, Math.min(rect.right, px));
                const clampedY = Math.max(rect.top, Math.min(rect.bottom, py));
                const edgeDist = Math.hypot(px - clampedX, py - clampedY);

                return { index, contains: edgeDist === 0, edgeDist, centerDist: Math.hypot(px - cx, py - cy) };
              }).filter((c): c is NonNullable<typeof c> => c !== null);

              if (candidates.length === 0) return;

              const containing = candidates.filter((c) => c.contains);
              const winner = containing.length > 0
                ? containing.reduce((a, b) => (a.centerDist <= b.centerDist ? a : b))
                : candidates.reduce((a, b) => (a.edgeDist <= b.edgeDist ? a : b));

              setHoveredHeroCardIdx(winner.index);
            };

            return (
              <div
                key={`comp-${activeHeroIdx}`}
                onMouseMove={handleCompositionMouseMove}
                onMouseLeave={() => setHoveredHeroCardIdx(null)}
                style={{ position: 'absolute', top: isMobile ? 'auto' : 0, left: isMobile ? 0 : 'auto', right: isMobile ? 0 : isTablet ? '5%' : '0%', bottom: isMobile ? 0 : 0, height: isMobile ? 220 : 'auto', width: isMobile ? '100%' : isTablet ? '45%' : '45%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
              >
                {activeProducts.map((product, index) => {
                  const pose = activePoses[index];
                  if (!pose) return null;

                  const x = pose.x * rDist;
                  const y = pose.y * rDist;
                  const scale = pose.scale * rScale;

                  const parallaxSpeeds = [18, 22, 20, 16];
                  const parallaxSpeed = parallaxSpeeds[index] ?? 10;
                  const isHovered = hoveredHeroCardIdx === index;

                  return (
                    <div
                      key={product.id}
                      data-hero-card-index={index}
                      style={{
                        position: 'absolute',
                        zIndex: pose.z,
                        transform: `translate(${x}px, ${y + baseYOffset}px) rotate(${pose.rotate}deg) scale(${scale})`,
                        opacity: 0,
                        animation: `cardEnterSpread 0.9s cubic-bezier(0.18, 0.88, 0.24, 1) ${pose.delay}s forwards`,
                        pointerEvents: 'auto'
                      }}
                    >
                      <div className="hero-card-parallax" data-speed={parallaxSpeed} style={{ display: 'inline-flex' }}>
                        <div style={{ animation: `${pose.anim} ${6 + index}s ease-in-out infinite` }}>
                          <div
                            ref={(el) => { heroCardRefs.current[index] = el; }}
                            style={{
                            background: 'rgba(255,255,255,0.985)',
                            borderRadius: 20,
                            padding: 14,
                            boxShadow: isHovered
                              ? '0 30px 60px -20px rgba(0,0,0,0.4), 0 60px 120px -40px rgba(0,0,0,0.5)'
                              : '0 24px 54px -24px rgba(0,0,0,0.3), 0 56px 118px -56px rgba(0,0,0,0.36)',
                            border: `1px solid ${isHovered ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.6)'}`,
                            cursor: 'pointer',
                            transform: isHovered ? 'scale(1.08) translateY(-4px)' : 'scale(1) translateY(0)',
                            transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, border-color 0.3s ease'
                          }}
                          onClick={() => onOpenProduct(product)}
                          >
                            <ProductImage product={product} size="md" priority />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
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
      <RevealSection id="categorias" style={{ padding: secPad }} delay={40}>
        <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'end', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
          <div>
            <div style={headKicker}>{t('landing.categories.kicker')}</div>
            <h2 style={{ ...headTitle, fontSize: isMobile ? 36 : isTablet ? 44 : 56 }}>{t('landing.categories.headingPrefix')} <em style={{ color: 'var(--green)' }}>{t('landing.categories.headingEmphasis')}</em></h2>
          </div>
          <AnimatedButton variant="outline" onClick={() => onNav('catalog')} icon={<Icon name="arrow-right" size={14} />} text={t('landing.categories.seeAll')} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : isTablet ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', gap: isMobile ? 10 : 16 }}>
          {showCategoriesSkeleton
            ? Array.from({ length: isMobile ? 4 : 6 }).map((_, i) => (
                <CategorySkeleton key={i} />
              ))
            : categories.slice(0, isMobile ? 4 : 6).map((cat: Category, i) => {
                const catKey = CATEGORY_I18N_KEY[cat.label];
                return (
                <StaggerItem key={cat.id} index={i}>
                  <div onClick={() => onNav('catalog', { category: cat.id })} className="category-card" style={{ background: cat.color, borderRadius: isMobile ? 16 : 20, padding: isMobile ? 18 : 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: isMobile ? 140 : 180, cursor: 'pointer', transition: 'transform 200ms' }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-3px)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}>
                    <div style={{ width: 34, height: 34, borderRadius: 999, background: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="leaf" size={16} /></div>
                    <div className="cat-text">
                      <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: isMobile ? 18 : 24, letterSpacing: '-0.02em', lineHeight: 1.05 }}>{translatedCategoryLabel(t, cat.label)}</div>
                      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6, marginTop: 6 }}>{catKey ? t(`landing.categories.subtitles.${catKey}`) : cat.sub}</div>
                    </div>
                  </div>
                </StaggerItem>
                );
              })
          }
        </div>
      </RevealSection>

      {/* BEST SELLERS */}
      <RevealSection id="bestsellers" style={{ padding: secPad }} delay={60}>
        <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'end', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
          <div>
            <div style={headKicker}>{t('landing.bestsellers.kicker')}</div>
            <h2 style={{ ...headTitle, fontSize: isMobile ? 36 : isTablet ? 44 : 56 }}>{t('landing.bestsellers.headingPrefix')} <em style={{ color: 'var(--green)' }}>{t('landing.bestsellers.headingEmphasis')}</em></h2>
          </div>
          <AnimatedButton variant="outline" onClick={() => onNav('catalog')} icon={<Icon name="arrow-right" size={14} />} text={t('landing.bestsellers.seeAll')} />
        </div>
        <ProductRow products={bestSellers} onOpenProduct={onOpenProduct} onAdd={onAdd} sectionKey="bestsellers" loading={showProductsSkeleton} priorityCount={isMobile ? 2 : 4} />
      </RevealSection>

      <RevealSection style={{ padding: secPad }} delay={70}>
        <RecentlyViewedSection onOpenProduct={onOpenProduct} onAdd={onAdd} />
      </RevealSection>

      {/* PROMO BAND — banners editables desde el admin (issue #265) */}
      {(primaryBanner || secondaryBanner) && (
        <RevealSection id="ofertas" style={{ padding: secPad }} delay={80}>
          <div style={{ display: 'grid', gridTemplateColumns: isSmall || !secondaryBanner ? '1fr' : '2fr 1fr', gap: 16 }}>
            {primaryBanner && (
              <div className="promo-banner" style={{ background: primaryBanner.backgroundColor || 'var(--lime)', borderRadius: isSmall ? 20 : 28, padding: isMobile ? 28 : isTablet ? 36 : 56, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: isMobile ? 280 : 360, position: 'relative', overflow: 'hidden' }}>
                <div style={{ maxWidth: 420 }}>
                  {bannerField(primaryBanner, 'kicker', isEn) && <div style={{ ...headKicker, color: primaryTextColors.body }}>{bannerField(primaryBanner, 'kicker', isEn)}</div>}
                  <h3 style={{ fontFamily: '"Instrument Serif", serif', fontSize: isMobile ? 36 : isTablet ? 44 : 56, letterSpacing: '-0.03em', lineHeight: 0.98, margin: '12px 0 16px', color: primaryTextColors.title }}>
                    <BannerTitle title={resolvePrimaryText(bannerField(primaryBanner, 'title', isEn))} highlightWord={bannerField(primaryBanner, 'highlightWord', isEn)} />
                  </h3>
                  {bannerField(primaryBanner, 'description', isEn) && (
                    <p style={{ fontSize: isMobile ? 13 : 15, lineHeight: 1.5, color: primaryTextColors.body, marginBottom: 24, maxWidth: 380 }}>{resolvePrimaryText(bannerField(primaryBanner, 'description', isEn))}</p>
                  )}
                  <AnimatedButton variant="primary" onClick={() => handleBannerCta(primaryBanner.ctaHref)} icon={<Icon name="arrow-right" size={14} />} text={resolvePrimaryText(bannerField(primaryBanner, 'ctaText', isEn))} />
                </div>
                {!isMobile && (
                  <div style={{ position: 'absolute', right: -15, bottom: 60, display: 'flex', gap: 16, zIndex: 10, alignItems: 'flex-end', transform: isTablet ? 'scale(0.8)' : 'none', transformOrigin: 'bottom right' }}>
                    {promoSkinProduct && (
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
                        onClick={() => onOpenProduct(promoSkinProduct)}
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
                        <ProductImage product={promoSkinProduct} size="md" priority />
                      </div>
                    </Parallax>
                  )}
                  {promoHydrationProduct && (
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
                        onClick={() => onOpenProduct(promoHydrationProduct)}
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
                        <ProductImage product={promoHydrationProduct} size="md" priority />
                      </div>
                    </Parallax>
                  )}
                  </div>
                )}
              </div>
            )}
            {secondaryBanner && (
              <div style={{ background: secondaryBanner.backgroundColor || 'var(--cream-2)', borderRadius: isSmall ? 20 : 28, padding: isMobile ? 24 : 40, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: isMobile ? 220 : 360 }}>
                <div>
                  {bannerField(secondaryBanner, 'kicker', isEn) && <div style={{ ...headKicker, color: secondaryTextColors.body }}>{bannerField(secondaryBanner, 'kicker', isEn)}</div>}
                  <h3 style={{ fontFamily: '"Instrument Serif", serif', fontSize: isMobile ? 26 : 36, letterSpacing: '-0.02em', lineHeight: 1, margin: '12px 0 16px', color: secondaryTextColors.title }}>
                    <BannerTitle title={resolveSecondaryText(bannerField(secondaryBanner, 'title', isEn))} highlightWord={bannerField(secondaryBanner, 'highlightWord', isEn)} />
                  </h3>
                  {bannerField(secondaryBanner, 'description', isEn) && (
                    <p style={{ fontSize: 14, lineHeight: 1.5, color: secondaryTextColors.body, marginBottom: 20 }}>{resolveSecondaryText(bannerField(secondaryBanner, 'description', isEn))}</p>
                  )}
                </div>
                <AnimatedButton variant="primary" full onClick={() => handleBannerCta(secondaryBanner.ctaHref)} text={resolveSecondaryText(bannerField(secondaryBanner, 'ctaText', isEn))} />
              </div>
            )}
          </div>
        </RevealSection>
      )}

      {/* PARALLAX BANNER (CINEMATIC WITH GSAP) — simplified on mobile */}
      <RevealSection style={{ padding: isMobile ? '48px 0 0' : '80px 0 0' }} delay={90}>
        <div ref={cinematicRef} style={{ position: 'relative', height: isMobile ? '60vh' : '100vh', minHeight: isMobile ? 320 : 700, overflow: 'hidden', background: 'transparent' }}>

          {/* Ambient Lights */}
          <div className="cine-light-1" style={{ position: 'absolute', top: '20%', left: '10%', width: 250, height: 250, background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)', filter: 'blur(20px)', transform: 'rotate(-15deg)', pointerEvents: 'none' }} />
          <div className="cine-light-2" style={{ position: 'absolute', bottom: '30%', right: '5%', width: 350, height: 350, background: 'radial-gradient(circle, rgba(228, 242, 72, 0.05) 0%, rgba(228, 242, 72, 0) 70%)', filter: 'blur(30px)', pointerEvents: 'none' }} />

          {/* Text Content */}
          <div className="cine-text" style={{ position: 'absolute', top: '5%', left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: 'var(--ink)', padding: isMobile ? '0 20px' : '0 40px' }}>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: isMobile ? 11 : 14, textTransform: 'uppercase', letterSpacing: '0.25em', marginBottom: 16, opacity: 0.8 }}>{t('landing.cinematic.kicker')}</div>
              <h2 style={{ fontFamily: '"Instrument Serif", serif', fontSize: isMobile ? 'clamp(32px, 8vw, 52px)' : 'clamp(64px, 8vw, 120px)', margin: 0, lineHeight: 0.9 }}>
                {t('landing.cinematic.titlePrefix')}<br/><em style={{ color: 'var(--lime)', fontStyle: 'italic' }}>{t('landing.cinematic.titleEmphasis')}</em>
              </h2>
            </div>
          </div>
          
          {/* Left/right side images — hidden on mobile */}
          {!isMobile && (<>
          <Parallax speed={-3} style={{ position: 'absolute', left: '22%', top: '50%', transform: 'translateY(-50%)', zIndex: 4 }}>
            <img className="cine-filo-left-1" src="/parallax/versace.avif" alt="Versace" style={{ width: 220, height: 'auto', maxHeight: 280, display: 'block', willChange: 'transform', filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.35))', background: 'transparent' }} />
          </Parallax>
          <Parallax speed={-5} style={{ position: 'absolute', left: '10%', top: '38%', transform: 'translateY(-50%)', zIndex: 3 }}>
            <img className="cine-filo-left-2" src="/parallax/valentino.avif" alt="Valentino" style={{ width: 220, height: 'auto', maxHeight: 280, display: 'block', willChange: 'transform', filter: 'drop-shadow(0 16px 24px rgba(0,0,0,0.3))', background: 'transparent' }} />
          </Parallax>
          <Parallax speed={4} style={{ position: 'absolute', right: '22%', top: '48%', transform: 'translateY(-50%)', zIndex: 4 }}>
            <img className="cine-filo-right-1" src="/parallax/goodgirl-blush.avif" alt="Good Girl" style={{ width: 220, height: 'auto', maxHeight: 280, display: 'block', willChange: 'transform', filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.35))', background: 'transparent' }} />
          </Parallax>
          <Parallax speed={6} style={{ position: 'absolute', right: '10%', top: '62%', transform: 'translateY(-50%)', zIndex: 3 }}>
            <img className="cine-filo-right-2" src="/parallax/paco-rabanne.avif" alt="Paco Rabanne" style={{ width: 220, height: 'auto', maxHeight: 280, display: 'block', willChange: 'transform', filter: 'drop-shadow(0 16px 24px rgba(0,0,0,0.3))', background: 'transparent' }} />
          </Parallax>
          </>)}

          {/* Main Product with rotation and scale animation */}
          <div className="cine-product" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%) scale(1.4)', filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.4))', willChange: 'transform', zIndex: 5 }}>
            <img src="/parallax/jean-paul.png" alt="Jean Paul" style={{ width: isMobile ? 160 : 260, height: 'auto', maxHeight: isMobile ? 200 : 320, background: 'transparent' }} />
          </div>
        </div>
      </RevealSection>

      {/* BY NEED */}
      <RevealSection style={{ padding: secPad }} delay={100}>
        <div style={{ marginBottom: 24 }}>
          <div style={headKicker}>{t('landing.byNeed.kicker')}</div>
          <h2 style={{ ...headTitle, fontSize: isMobile ? 36 : isTablet ? 44 : 56 }}>{t('landing.byNeed.headingPrefix')} <em style={{ color: 'var(--green)' }}>{t('landing.byNeed.headingEmphasis')}</em>{t('landing.byNeed.headingSuffix')}</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : isTablet ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 10 : 16 }}>
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
                  <div onClick={() => onNav('catalog', { category: n.category })} style={{ background: 'var(--cream-2)', borderRadius: 20, padding: '28px 24px', cursor: 'pointer', border: '1px solid var(--ink-06)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 40, minHeight: 200, height: '100%', boxSizing: 'border-box', transition: 'all 220ms' }}
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
                      <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 26, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 8 }}>{t(`landing.byNeed.items.${n.i18nKey}`)}</div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: '"Geist", sans-serif', opacity: 0.75 }}>{t('landing.byNeed.explore')} <Icon name="arrow-right" size={12} /></div>
                    </div>
                  </div>
                </StaggerItem>
              ))
          }
        </div>
      </RevealSection>

      {/* TRUST */}
      <RevealSection style={{ padding: secPad }} delay={120}>
        <div style={{ background: 'var(--cream-2)', borderRadius: isMobile ? 20 : 28, padding: isMobile ? '28px 20px' : isTablet ? '32px 28px' : '48px 40px', display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : isTablet ? '1fr 1fr' : 'repeat(4, 1fr)', gap: isMobile ? 20 : 32, border: '1px solid var(--ink-06)' }}>
          {[
            { icon: 'shield', key: 'payments' },
            { icon: 'check', key: 'verified' },
            { icon: 'truck', key: 'shipping' },
            { icon: 'headset', key: 'support' },
          ].map((item, i) => (
            <StaggerItem key={item.key} index={i}>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'center' : 'flex-start', textAlign: isMobile ? 'center' : 'left', gap: isMobile ? 10 : 14 }}>
                <div style={{ width: isMobile ? 52 : 44, height: isMobile ? 52 : 44, borderRadius: 999, background: 'var(--green)', color: 'var(--lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={item.icon} size={isMobile ? 22 : 20} /></div>
                <div>
                  <div style={{ fontFamily: '"Geist", sans-serif', fontSize: isMobile ? 13 : 15, fontWeight: 600, marginBottom: 4 }}>{t(`landing.trust.${item.key}.title`)}</div>
                  <div style={{ fontSize: isMobile ? 11 : 12, color: 'var(--ink-60)', fontFamily: '"JetBrains Mono", monospace', lineHeight: 1.4 }}>{t(`landing.trust.${item.key}.sub`)}</div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </div>
      </RevealSection>

      {/* FEATURED */}
      <RevealSection id="nuevos" style={{ padding: secPad }} delay={130}>
        <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'end', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
          <div>
            <div style={headKicker}>{t('landing.featured.kicker')}</div>
            <h2 style={{ ...headTitle, fontSize: isMobile ? 36 : isTablet ? 44 : 56 }}>{t('landing.featured.headingPrefix')} <em style={{ color: 'var(--green)' }}>{t('landing.featured.headingEmphasis')}</em></h2>
          </div>
          <AnimatedButton variant="outline" onClick={() => onNav('catalog')} icon={<Icon name="arrow-right" size={14} />} text={t('landing.featured.seeAll')} />
        </div>
        <ProductRow products={featured} onOpenProduct={onOpenProduct} onAdd={onAdd} sectionKey="nuevos" loading={showProductsSkeleton} />
      </RevealSection>

      {/* BRANDS */}
      <RevealSection id="marcas" style={{ padding: isMobile ? '48px 0 0' : isTablet ? '64px 0 0' : '80px 0 0' }} delay={150}>
        <div style={{ padding: secPadNoH, marginBottom: 32 }}>
          <div style={headKicker}>{t('landing.brands.kicker')}</div>
          <h2 style={{ ...headTitle, fontSize: isMobile ? 36 : isTablet ? 44 : 56 }}>{t('landing.brands.headingPrefix')} <em style={{ color: 'var(--green)' }}>{t('landing.brands.headingEmphasis')}</em></h2>
        </div>
        <BrandsMarquee onNav={onNav} />
      </RevealSection>
    </div>
    </RestoringContext.Provider>
  );
}
