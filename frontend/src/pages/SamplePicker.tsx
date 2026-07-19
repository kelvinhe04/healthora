import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { SampleOption } from '../types';
import { api } from '../lib/api';
import { useCartStore } from '../store/cartStore';
import { ProductImage } from '../components/shared/ProductImage';
import { AnimatedButton } from '../components/shared/AnimatedButton';
import { Icon } from '../components/shared/Icon';
import { ProductCardSkeleton } from '../components/shared/ProductCard';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { formatCurrency } from '../lib/currency';

interface SamplePickerProps {
  onBack: () => void;
  onConfirm: () => void;
}

const PAGE_SIZE = 12;

// Deterministic per-cell hash (xmur3-style, same construction as Catalog.tsx's stableShuffleKey)
// combined with a seed rolled once per mount (see shuffleSeed below). That gives a genuinely
// different order each time a shopper opens the picker (the "estilo Temu" ask in #151), while
// staying stable across re-renders and pagination within that same visit - reshuffling on every
// render was the exact bug Catalog.tsx's comment describes fixing for its own shuffled view.
function seededShuffleKey(id: string, seed: string): number {
  const input = `${seed}:${id}`;
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

const optionKey = (option: Pick<SampleOption, 'productId' | 'variantId'>) => `${option.productId}:${option.variantId ?? ''}`;

export function SamplePicker({ onBack, onConfirm }: SamplePickerProps) {
  const { t } = useTranslation();
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const isTablet = bp === 'tablet';
  const cols = isMobile ? 2 : isTablet ? 3 : 4;

  const { freeSample, setFreeSample } = useCartStore();
  const { data: allOptions, isLoading } = useQuery({
    queryKey: ['products', 'sample-options'],
    queryFn: () => api.products.sampleOptions(),
  });
  const [page, setPage] = useState(1);
  const [shuffleSeed] = useState(() => Math.random().toString(36));

  const options = useMemo(() => {
    if (!allOptions) return [];
    return allOptions
      .map((o) => ({ o, k: seededShuffleKey(optionKey(o), shuffleSeed) }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.o);
  }, [allOptions, shuffleSeed]);

  const totalPages = Math.max(1, Math.ceil(options.length / PAGE_SIZE));
  const paginated = options.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const goToPage = (n: number) => {
    setPage(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ padding: isMobile ? '20px 16px 120px' : '32px 40px 120px', maxWidth: 1280, margin: '0 auto' }}>
      <button
        onClick={onBack}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-60)', fontSize: 13, marginBottom: 32, fontFamily: '"Geist", sans-serif' }}
      >
        <Icon name="arrow-left" size={14} /> {t('samplePicker.backToCart')}
      </button>

      <div style={{ marginBottom: 36 }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--green)', marginBottom: 10 }}>
          {t('samplePicker.kicker')}
        </div>
        <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: isMobile ? 40 : 56, letterSpacing: '-0.035em', lineHeight: 1, margin: '0 0 12px', color: 'var(--ink)', fontWeight: 400 }}>
          {t('samplePicker.headingPrefix')} <em style={{ color: 'var(--green)' }}>{t('samplePicker.headingEmphasis')}</em>
        </h1>
        <p style={{ fontSize: 15, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif', margin: 0 }}>
          {t('samplePicker.subtitle')}
          {!isLoading && options.length > 0 && (
            <span style={{ marginLeft: 8, color: 'var(--ink-40)', fontSize: 13 }}>
              {t('samplePicker.optionsAvailable', { count: options.length })}
            </span>
          )}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: isMobile ? 12 : 20 }}>
        {isLoading
          ? Array.from({ length: PAGE_SIZE }).map((_, i) => <ProductCardSkeleton key={i} />)
          : paginated.map((option) => (
              <SampleCard
                key={optionKey(option)}
                option={option}
                selected={!!freeSample && optionKey(freeSample) === optionKey(option)}
                onSelect={() => setFreeSample(freeSample && optionKey(freeSample) === optionKey(option) ? null : option)}
              />
            ))}
      </div>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 40 }}>
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page === 1}
            style={{ width: 36, height: 36, borderRadius: 999, border: '1px solid var(--ink-12)', background: 'var(--cream-2)', cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: page === 1 ? 'var(--ink-30)' : 'var(--ink)', transition: 'all 150ms' }}
          >
            <Icon name="arrow-left" size={14} />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => {
            const isActive = n === page;
            const isNear = Math.abs(n - page) <= 1 || n === 1 || n === totalPages;
            const isPrevEllipsis = n === page - 2 && page > 3;
            const isNextEllipsis = n === page + 2 && page < totalPages - 2;

            if (isPrevEllipsis || isNextEllipsis) {
              return <span key={n} style={{ fontSize: 13, color: 'var(--ink-40)', fontFamily: '"JetBrains Mono", monospace', padding: '0 2px' }}>…</span>;
            }
            if (!isNear) return null;

            return (
              <button
                key={n}
                onClick={() => goToPage(n)}
                style={{ width: 36, height: 36, borderRadius: 999, border: isActive ? 'none' : '1px solid var(--ink-12)', background: isActive ? 'var(--green)' : 'var(--cream-2)', color: isActive ? 'white' : 'var(--ink)', cursor: 'pointer', fontSize: 13, fontFamily: '"JetBrains Mono", monospace', fontWeight: isActive ? 700 : 400, transition: 'all 150ms' }}
              >
                {n}
              </button>
            );
          })}

          <button
            onClick={() => goToPage(page + 1)}
            disabled={page === totalPages}
            style={{ width: 36, height: 36, borderRadius: 999, border: '1px solid var(--ink-12)', background: 'var(--cream-2)', cursor: page === totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: page === totalPages ? 'var(--ink-30)' : 'var(--ink)', transition: 'all 150ms' }}
          >
            <Icon name="arrow-right" size={14} />
          </button>
        </div>
      )}

      {/* Sticky confirm bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: isMobile ? '14px 16px' : '16px 40px',
        background: 'var(--cream)',
        borderTop: '1px solid var(--ink-06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        zIndex: 50,
        boxShadow: '0 -8px 32px -16px rgba(0,0,0,0.12)',
        transform: freeSample ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 280ms cubic-bezier(.2,.8,.2,1)',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: 'var(--green)', letterSpacing: '0.08em', marginBottom: 2 }}>{t('samplePicker.selectedKicker')}</div>
          <div style={{ fontSize: 14, fontFamily: '"Geist", sans-serif', fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {freeSample?.product.name}{freeSample?.label ? ` · ${freeSample.label}` : ''}
          </div>
        </div>
        <AnimatedButton
          variant="primary"
          onClick={onConfirm}
          text={t('samplePicker.confirmButton')}
          icon={<Icon name="arrow-right" size={14} />}
        />
      </div>
    </div>
  );
}

interface SampleCardProps {
  option: SampleOption;
  selected: boolean;
  onSelect: () => void;
}

function SampleCard({ option, selected, onSelect }: SampleCardProps) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        cursor: 'pointer',
        background: 'var(--cream)',
        borderRadius: 14,
        overflow: 'hidden',
        border: selected ? '2px solid var(--green)' : '1px solid var(--ink-06)',
        transition: 'all 200ms cubic-bezier(.2,.8,.2,1)',
        transform: hover && !selected ? 'translateY(-2px)' : 'none',
        boxShadow: selected
          ? '0 0 0 4px color-mix(in srgb, var(--green) 18%, transparent)'
          : hover ? '0 18px 40px -20px rgba(0,0,0,0.15)' : '0 2px 6px -4px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {selected && (
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          width: 26,
          height: 26,
          borderRadius: 999,
          background: 'var(--green)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          <Icon name="check" size={13} />
        </div>
      )}

      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ transform: hover ? 'scale(1.06)' : 'scale(1)', transition: 'transform 380ms cubic-bezier(.2,.8,.2,1)' }}>
          <ProductImage product={option.product} size="tile" flat imageUrl={option.imageUrl} />
        </div>
      </div>

      <div style={{ padding: '14px 14px 16px' }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: 'var(--ink-60)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{option.product.brand}</div>
        <div style={{ fontFamily: '"Geist", sans-serif', fontSize: 14, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.25, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 34 }}>
          {option.product.name}
          {option.label && <span style={{ color: 'var(--ink-60)', fontWeight: 400 }}> · {option.label}</span>}
        </div>
        <div style={{ fontFamily: '"Instrument Serif", serif', fontSize: 20, color: selected ? 'var(--green)' : 'var(--ink)' }}>
          {formatCurrency(option.price)}
        </div>
      </div>
    </div>
  );
}
