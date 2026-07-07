import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useBreakpoint } from '../hooks/useBreakpoint';
import type { Product, ProductVariant } from '../types';
import { ProductImage } from '../components/shared/ProductImage';
import { ProductCard } from '../components/shared/ProductCard';
import { Stars } from '../components/shared/Stars';
import { AnimatedButton } from '../components/shared/AnimatedButton';
import { Icon } from '../components/shared/Icon';
import { useProducts } from '../hooks/useProducts';
import { useReviews } from '../hooks/useReviews';
import { ReviewSection } from '../components/shared/ReviewSection';
import { RecentlyViewedSection } from '../components/shared/RecentlyViewedSection';
import { PRIMARY_VARIANT_TYPES, pickDefaultPrimary, sizesFor, pickDefaultSize } from '../lib/productVariants';

interface ProductDetailProps {
  product: Product;
  onAdd: (p: Product, qty: number, variant?: ProductVariant) => void;
  onBuyNow: (p: Product, qty: number, variant?: ProductVariant) => void;
  onOpenProduct: (p: Product) => void;
  onBack: () => void;
}

const VARIANT_TYPE_LABEL: Record<string, string> = {
  size: 'TAMAÑO',
  color: 'COLOR',
  weight: 'PESO',
  count: 'PRESENTACIÓN',
  flavor: 'SABOR',
  scent: 'FRAGANCIA',
};

const qtyBtn = (compact: boolean): CSSProperties => ({
  width: compact ? 44 : 36,
  height: compact ? 44 : 36,
  borderRadius: 999,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export function ProductDetail({ product, onAdd, onBuyNow, onOpenProduct, onBack }: ProductDetailProps) {
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const isTablet = bp === 'tablet';
  const isSmall = isMobile || isTablet;
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState('benefits');
  const [added, setAdded] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isZoomingOut, setIsZoomingOut] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(() => pickDefaultPrimary(product.variants));
  const [selectedSize, setSelectedSize] = useState<ProductVariant | null>(() => pickDefaultSize(product.variants, pickDefaultPrimary(product.variants)));
  const { data: allProducts = [] } = useProducts();
  const related = allProducts.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);
  const { data: liveReviews } = useReviews(product.id);
  const liveCount = liveReviews?.length ?? 0;
  const liveRating = liveReviews && liveReviews.length > 0
    ? Math.round(liveReviews.reduce((s, r) => s + r.rating, 0) / liveReviews.length * 10) / 10
    : 0;
  const baseGallery = product.images?.length
    ? product.images.slice(0, 4)
    : Array.from({ length: 4 }, (_, i) => ({
        url: i === 0 ? product.imageUrl || '' : product.imageUrl || '',
        alt: `${product.name} ${i + 1}`,
        isPrimary: i === 0,
      })).filter((img) => img.url);
  const imagesBySizeMatch = selectedVariant?.imagesBySize && selectedSize ? selectedVariant.imagesBySize[selectedSize.id] : null;
  // Si el sabor no trae fotos propias, se usa la foto del tamaño (ej. bolsa vs caja multipack)
  // para que la galeria siga cambiando con la seleccion.
  const variantImages = imagesBySizeMatch ?? selectedVariant?.images ?? selectedSize?.images;
  const variantImageUrl = selectedVariant?.imageUrl ?? selectedSize?.imageUrl;
  const galleryLabel = imagesBySizeMatch?.length || selectedVariant?.images?.length || selectedVariant?.imageUrl
    ? selectedVariant?.label
    : selectedSize?.label ?? selectedVariant?.label;
  const gallery = variantImages && variantImages.length > 0
    ? variantImages.map((url, i) => ({ url, alt: `${product.name} · ${galleryLabel} ${i + 1}`, isPrimary: i === 0 }))
    : variantImageUrl
    ? [{ url: variantImageUrl, alt: `${product.name} · ${galleryLabel}`, isPrimary: true }, ...baseGallery.slice(1)]
    : baseGallery;
  const activeImage = gallery[activeImageIndex]?.url || product.imageUrl;
  const hasRealImages = Boolean(activeImage);
  const hasText = (value?: string) => Boolean(value?.trim());
  const benefits = (product.benefits || []).filter((benefit) => benefit.trim());
  const detailTabs = [
    ...(benefits.length ? [{ id: 'benefits', label: 'Beneficios' }] : []),
    ...(hasText(product.usage) ? [{ id: 'usage', label: 'Modo de uso' }] : []),
    ...(hasText(product.ingredients) ? [{ id: 'ingredients', label: 'Ingredientes' }] : []),
    ...(hasText(product.nutritionFacts) ? [{ id: 'nutrition', label: 'Info. nutricional' }] : []),
    ...(product.certifications?.length ? [{ id: 'certs', label: 'Certificaciones' }] : []),
    ...(hasText(product.interactions) ? [{ id: 'interactions', label: 'Compatibilidad' }] : []),
    ...(product.faq?.length ? [{ id: 'faq', label: 'Preguntas frecuentes' }] : []),
    ...(hasText(product.shadeTips) ? [{ id: 'shade', label: 'Tono & tez' }] : []),
    ...(hasText(product.applicationTips) ? [{ id: 'application', label: 'Técnica' }] : []),
    ...(hasText(product.formulaDetails) ? [{ id: 'formula', label: 'Fórmula' }] : []),
    ...(product.skinTypes?.length ? [{ id: 'skintypes', label: 'Tipos de piel' }] : []),
    ...(product.extraTabs?.length
      ? product.extraTabs
          .filter((extraTab) => hasText(extraTab.label) && hasText(extraTab.content))
          .map((extraTab) => ({ id: `extra:${extraTab.id}`, label: extraTab.label }))
      : []),
    ...(hasText(product.warnings) ? [{ id: 'warnings', label: 'Advertencias' }] : []),
  ];

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

  const primaryVariants = product.variants?.filter((v) => PRIMARY_VARIANT_TYPES.includes(v.type)) ?? [];
  const sizeVariants = product.variants?.filter((v) => v.type === 'size') ?? [];
  const hasTwoDimensions = primaryVariants.length > 0 && sizeVariants.length > 0;
  const availableSizeVariants = sizesFor(product.variants, selectedVariant);

  useEffect(() => {
    setQty(1);
    setTab(detailTabs[0]?.id || '');
    setActiveImageIndex(0);
    setIsZoomed(false);
    setIsZoomingOut(false);
    const primary = pickDefaultPrimary(product.variants);
    setSelectedVariant(primary);
    setSelectedSize(pickDefaultSize(product.variants, primary));
  }, [product.id]);

  const effectivePrice = (selectedVariant?.price ?? product.price) + (hasTwoDimensions ? (selectedSize?.price ?? 0) : 0);
  const effectivePriceBefore = selectedVariant?.priceBefore ?? product.priceBefore;
  const effectiveStock = hasTwoDimensions ? (selectedSize?.stock ?? selectedVariant?.stock ?? product.stock) : (selectedVariant?.stock ?? product.stock);
  // For a flavor+size combo, cart/checkout need a single variant carrying the combined price,
  // stock and a unique id (so different sizes of the same flavor don't collapse into one cart line).
  const cartVariant: ProductVariant | undefined = selectedVariant
    ? hasTwoDimensions && selectedSize
      ? { ...selectedVariant, id: `${selectedVariant.id}:${selectedSize.id}`, label: `${selectedVariant.label} · ${selectedSize.label}`, price: effectivePrice, stock: effectiveStock }
      : selectedVariant
    : undefined;

  useEffect(() => {
    setActiveImageIndex(0);
  }, [selectedVariant?.id, selectedSize?.id]);

  const handleAdd = () => {
    onAdd(product, qty, cartVariant);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  return (
    <div style={{ padding: isMobile ? '20px 16px 0' : isTablet ? '24px 24px 0' : '24px 40px 0' }}>
      {isZoomed && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-label={`Vista ampliada de ${product.name}`}
          onClick={closeZoom} 
          style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(253, 252, 250, 0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', backdropFilter: 'blur(10px)', padding: 40, animation: isZoomingOut ? 'zoomModalOut 0.25s cubic-bezier(0.3, 0, 0.8, 0.15) forwards' : 'zoomModalBgIn 0.3s ease-out' }}
        >
          <button
            type="button"
            aria-label="Cerrar vista ampliada"
            onClick={closeZoom}
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
        <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit' }}>TIENDA</button> · {product.category.toUpperCase()} · <span style={{ color: 'var(--ink)' }}>{product.name.toUpperCase()}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isSmall ? '1fr' : '1.1fr 1fr', gap: isSmall ? 24 : 48, alignItems: 'start' }}>
        <div>
          <div 
            onClick={() => setIsZoomed(true)}
            style={{ background: hasRealImages ? 'white' : product.color, borderRadius: 28, padding: 40, minHeight: 620, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', border: hasRealImages ? '1px solid var(--ink-06)' : 'none', cursor: 'zoom-in' }}
          >
            <div style={{ position: 'absolute', top: 24, left: 24, fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: 'var(--ink-60)', letterSpacing: '0.12em', zIndex: 2 }}>{String(activeImageIndex + 1).padStart(2, '0')} / 04 · PRODUCT SHOT</div>
            <div key={activeImage} style={{ animation: 'fadeInImage 0.4s ease-out', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ProductImage product={product} size="lg" imageUrl={activeImage} alt={gallery[activeImageIndex]?.alt} priority />
            </div>
            <style>{`@keyframes fadeInImage { from { opacity: 0.4; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }`}</style>
          </div>
          <div
            role="tablist"
            aria-label="Miniaturas del producto"
            style={{ display: 'flex', gap: 10, marginTop: 12 }}
          >
            {gallery.map((image, i) => (
              <button
                type="button"
                key={image.url}
                role="tab"
                aria-selected={i === activeImageIndex}
                aria-label={image.alt || `Imagen ${i + 1}`}
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
              </button>
            ))}
          </div>
        </div>

        <div style={{ paddingTop: 8 }}>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 12 }}>{product.brand} · {product.category}</div>
          <h1 style={{ fontFamily: '"Instrument Serif", serif', fontSize: isMobile ? 42 : isTablet ? 52 : 64, lineHeight: 0.98, letterSpacing: '-0.035em', margin: '0 0 20px', color: 'var(--ink)', fontWeight: 400 }}>{product.name}{selectedVariant ? ` · ${selectedVariant.label}` : ''}{hasTwoDimensions && selectedSize ? ` · ${selectedSize.label}` : ''}</h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            {liveCount > 0 ? (
              <>
                <Stars value={liveRating} size={14} />
                <span style={{ fontSize: 13, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>{liveRating} · {liveCount} {liveCount === 1 ? 'reseña' : 'reseñas'}</span>
              </>
            ) : (
              <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: 'var(--ink-40)', letterSpacing: '0.06em' }}>SIN RESEÑAS AÚN</span>
            )}
            {effectiveStock === 0 ? (
              <span style={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: 'oklch(0.5 0.15 30)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, background: 'oklch(0.5 0.15 30)', borderRadius: 999 }} />
                AGOTADO
              </span>
            ) : (
              <span style={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, background: 'var(--green)', borderRadius: 999 }} />
                EN STOCK · {effectiveStock} unidades
              </span>
            )}
          </div>

          <p style={{ fontSize: 17, lineHeight: 1.55, color: 'var(--ink-80)', marginBottom: product.variants?.length ? 20 : 32, maxWidth: 480 }}>{product.short}</p>

          {product.variants && product.variants.length > 0 && (() => {
            const pillBtn = (v: ProductVariant, selected: boolean, onClick: () => void) => (
              <button
                type="button"
                key={v.id}
                onClick={onClick}
                disabled={v.stock === 0}
                aria-pressed={selected}
                aria-label={`${v.label}${v.stock === 0 ? ', agotado' : ''}`}
                style={{
                  padding: isMobile ? '12px 18px' : '8px 16px',
                  minHeight: isMobile ? 44 : undefined,
                  borderRadius: 999,
                  border: selected ? '2px solid var(--ink)' : '1px solid var(--ink-20)',
                  background: selected ? 'var(--ink)' : 'transparent',
                  color: selected ? 'var(--cream)' : v.stock === 0 ? 'var(--ink-40)' : 'var(--ink)',
                  cursor: v.stock === 0 ? 'not-allowed' : 'pointer',
                  opacity: v.stock === 0 ? 0.5 : 1,
                  fontSize: 13,
                  fontFamily: '"Geist", sans-serif',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                  textDecoration: v.stock === 0 ? 'line-through' : 'none',
                }}
              >
                {v.label}
              </button>
            );
            // Con muchas opciones (ej. 25 sabores) los pills se ven desbordados; a partir de 7
            // opciones se compacta en un <select> nativo.
            const DROPDOWN_THRESHOLD = 7;
            const dropdown = (options: ProductVariant[], selected: ProductVariant | null, onChange: (v: ProductVariant) => void, label: string) => (
              <div style={{ position: 'relative', maxWidth: 320 }}>
                <select
                  aria-label={label}
                  value={selected?.id ?? ''}
                  onChange={(e) => {
                    const v = options.find((o) => o.id === e.target.value);
                    if (v) onChange(v);
                  }}
                  style={{
                    width: '100%',
                    padding: isMobile ? '14px 36px 14px 14px' : '10px 36px 10px 14px',
                    minHeight: isMobile ? 48 : undefined,
                    borderRadius: 10,
                    border: '1px solid var(--ink-20)',
                    background: 'var(--cream)',
                    color: 'var(--ink)',
                    fontSize: 14,
                    fontFamily: '"Geist", sans-serif',
                    cursor: 'pointer',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                  }}
                >
                  {options.map((v) => (
                    <option key={v.id} value={v.id} disabled={v.stock === 0}>
                      {v.label}{v.stock === 0 ? ' · Sin stock' : ''}
                    </option>
                  ))}
                </select>
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--ink-60)' }}>
                  <Icon name="chevron-down" size={14} />
                </span>
              </div>
            );

            if (hasTwoDimensions) {
              const primaryLabel = VARIANT_TYPE_LABEL[primaryVariants[0]?.type] ?? primaryVariants[0]?.type.toUpperCase();
              return (
                <div style={{ marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.1em', color: 'var(--ink-60)', marginBottom: 10 }}>
                      {primaryLabel}{selectedVariant && <span style={{ color: 'var(--ink)' }}> · {selectedVariant.label.toUpperCase()}</span>}
                    </div>
                    {primaryVariants.length > DROPDOWN_THRESHOLD ? (
                      dropdown(primaryVariants, selectedVariant, (v) => {
                        setSelectedVariant(v);
                        setSelectedSize(pickDefaultSize(product.variants, v));
                        setQty(1);
                      }, primaryLabel)
                    ) : (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {primaryVariants.map((v) => pillBtn(v, selectedVariant?.id === v.id, () => {
                          setSelectedVariant(v);
                          setSelectedSize(pickDefaultSize(product.variants, v));
                          setQty(1);
                        }))}
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.1em', color: 'var(--ink-60)', marginBottom: 10 }}>
                      TAMAÑO{selectedSize && <span style={{ color: 'var(--ink)' }}> · {selectedSize.label.toUpperCase()}</span>}
                    </div>
                    {availableSizeVariants.length > DROPDOWN_THRESHOLD ? (
                      dropdown(availableSizeVariants, selectedSize, (v) => setSelectedSize(v), 'TAMAÑO')
                    ) : (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {availableSizeVariants.map((v) => pillBtn(v, selectedSize?.id === v.id, () => setSelectedSize(v)))}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            const variantType = product.variants![0].type;
            const isColor = variantType === 'color';
            return (
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.1em', color: 'var(--ink-60)', marginBottom: 10 }}>
                  {VARIANT_TYPE_LABEL[variantType] ?? variantType.toUpperCase()}
                  {selectedVariant && <span style={{ color: 'var(--ink)' }}> · {selectedVariant.label.toUpperCase()}</span>}
                </div>
                {!isColor && product.variants!.length > DROPDOWN_THRESHOLD ? (
                  dropdown(product.variants!, selectedVariant, (v) => { setSelectedVariant(v); setQty(1); }, VARIANT_TYPE_LABEL[variantType] ?? variantType.toUpperCase())
                ) : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {product.variants!.map((v) => (
                      isColor ? (
                        <button
                          type="button"
                          key={v.id}
                          onClick={() => { setSelectedVariant(v); setQty(1); }}
                          aria-label={`Color ${v.label}`}
                          aria-pressed={selectedVariant?.id === v.id}
                          disabled={v.stock === 0}
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            background: v.color ?? '#ccc',
                            border: selectedVariant?.id === v.id ? '2.5px solid var(--ink)' : '2px solid transparent',
                            outline: selectedVariant?.id === v.id ? '2px solid var(--ink)' : '2px solid var(--ink-10)',
                            outlineOffset: 2,
                            boxShadow: 'inset 0 0 0 1.5px rgba(0,0,0,0.18)',
                            cursor: v.stock === 0 ? 'not-allowed' : 'pointer',
                            opacity: v.stock === 0 ? 0.35 : 1,
                            transition: 'all 0.15s ease',
                            position: 'relative',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        pillBtn(v, selectedVariant?.id === v.id, () => { setSelectedVariant(v); setQty(1); })
                      )
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid var(--ink-06)', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: '"Instrument Serif", serif', fontSize: isMobile ? 36 : isTablet ? 42 : 48, color: 'var(--ink)', lineHeight: 1 }}>${effectivePrice.toFixed(2)}</span>
            {effectivePriceBefore && (
              <>
                <span style={{ fontSize: 20, color: 'var(--ink-40)', textDecoration: 'line-through' }}>${effectivePriceBefore.toFixed(2)}</span>
                <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', background: 'var(--coral)', color: 'white', padding: '4px 8px', borderRadius: 999, fontWeight: 600 }}>AHORRA ${(effectivePriceBefore - effectivePrice).toFixed(2)}</span>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', marginBottom: 16, flexDirection: isMobile ? 'column' : 'row' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--ink-20)', borderRadius: 999, padding: 4, opacity: effectiveStock === 0 ? 0.4 : 1, alignSelf: isMobile ? 'flex-start' : undefined }}>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={qtyBtn(isMobile)} disabled={effectiveStock === 0 || qty <= 1} aria-label="Disminuir cantidad"><Icon name="minus" size={14} /></button>
              <span style={{ width: 40, textAlign: 'center', fontFamily: '"Geist", sans-serif', fontSize: 15 }}>{qty}</span>
              <button onClick={() => setQty((q) => Math.min(effectiveStock, q + 1))} style={qtyBtn(isMobile)} disabled={effectiveStock === 0 || qty >= effectiveStock} aria-label="Aumentar cantidad"><Icon name="plus" size={14} /></button>
            </div>
            <AnimatedButton variant="primary" size="lg" onClick={handleAdd} disabled={effectiveStock === 0} style={{ flex: 1, width: isMobile ? '100%' : undefined }} text={effectiveStock === 0 ? 'Sin stock' : added ? '✓ Agregado al carrito' : `Agregar al carrito · $${(effectivePrice * qty).toFixed(2)}`} />
          </div>
          <AnimatedButton aria-label="Comprar ahora con un clic" variant="outline" full onClick={() => onBuyNow(product, qty, cartVariant)} disabled={effectiveStock === 0} text="Comprar ahora con un clic" />

          <div style={{ marginTop: 24, background: 'var(--cream-2)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid var(--ink-06)' }}>
            {[{ icon: 'truck', t: 'Envío gratis en órdenes sobre $50' }, { icon: 'shield', t: 'Pago seguro con Stripe · 3D Secure' }, { icon: 'check', t: 'Productos verificados por farmacéuticos' }].map((row) => (
              <div key={row.t} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink-80)' }}>
                <Icon name={row.icon} size={16} /> {row.t}
              </div>
            ))}
          </div>

          {detailTabs.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--ink-06)', flexWrap: 'wrap' }}>
              {detailTabs.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '14px 4px', marginRight: 28, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: '"Geist", sans-serif', color: tab === t.id ? 'var(--ink)' : 'var(--ink-60)', borderBottom: tab === t.id ? '2px solid var(--ink)' : '2px solid transparent', marginBottom: -1, whiteSpace: 'nowrap' }}>{t.label}</button>
              ))}
            </div>
            <div style={{ padding: '20px 0', fontSize: 15, lineHeight: 1.6, color: 'var(--ink-80)', fontFamily: '"Geist", sans-serif' }}>
              {tab === 'benefits' && <ul style={{ paddingLeft: 18, margin: 0 }}>{benefits.map((b) => <li key={b} style={{ marginBottom: 6 }}>{b}</li>)}</ul>}
              {tab === 'usage' && hasText(product.usage) && <p style={{ margin: 0 }}>{product.usage}</p>}
              {tab === 'ingredients' && hasText(product.ingredients) && <p style={{ margin: 0 }}>{product.ingredients}</p>}
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
              {tab === 'warnings' && hasText(product.warnings) && <p style={{ margin: 0, color: 'var(--coral)' }}>⚠ {product.warnings}</p>}
            </div>
          </div>
          )}
        </div>
      </div>

      <RecentlyViewedSection
        onOpenProduct={onOpenProduct}
        onAdd={(p) => onAdd(p, 1)}
        excludeProductId={product.id}
      />

      {related.length > 0 && (
        <section style={{ marginTop: 80 }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-60)', marginBottom: 10 }}>También te puede gustar</div>
            <h2 style={{ fontFamily: '"Instrument Serif", serif', fontSize: 44, letterSpacing: '-0.03em', margin: 0, color: 'var(--ink)', fontWeight: 400 }}>Productos <em style={{ color: 'var(--green)' }}>relacionados</em></h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isSmall ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 20 }}>
            {related.map((p) => <ProductCard key={p.id} product={p} onClick={onOpenProduct} onAdd={(pr) => onAdd(pr, 1)} />)}
          </div>
        </section>
      )}

      <ReviewSection productId={product.id} />
    </div>
  );
}
