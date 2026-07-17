import { useState, useEffect, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useUser } from '@clerk/clerk-react';
import { useBreakpoint } from '../hooks/useBreakpoint';
import type { Product, ProductVariant } from '../types';
import { ProductImage } from '../components/shared/ProductImage';
import { Stars } from '../components/shared/Stars';
import { AnimatedButton } from '../components/shared/AnimatedButton';
import { Icon } from '../components/shared/Icon';
import { Select } from '../components/shared/Select';
import { SubscribeModal } from '../components/shared/SubscribeModal';
import { SignInModal } from '../components/chrome/SignInModal';
import { useProducts } from '../hooks/useProducts';
import { useReviews } from '../hooks/useReviews';
import { ReviewSection } from '../components/shared/ReviewSection';
import { RecentlyViewedSection } from '../components/shared/RecentlyViewedSection';
import { RelatedProductsSection } from '../components/shared/RelatedProductsSection';
import { getRelatedProducts } from '../lib/relatedProducts';
import { PRIMARY_VARIANT_TYPES, pickDefaultPrimary, sizesFor, pickDefaultSize, pickSizeKeepingCurrent, getPrimaryVariantStock } from '../lib/productVariants';
import { renderInlineText, renderRichText } from '../lib/richText';
import { isLowStock } from '../lib/stock';
import { formatPurchasesLastMonth } from '../lib/purchases';
import { formatCurrency } from '../lib/currency';

interface ProductDetailProps {
  product: Product;
  onAdd: (p: Product, qty: number, variant?: ProductVariant) => void;
  onBuyNow: (p: Product, qty: number, variant?: ProductVariant) => void;
  onOpenProduct: (p: Product) => void;
  onBack: () => void;
  subscribeModalOpen: boolean;
  onSubscribeModalOpenChange: (open: boolean) => void;
}

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

export function ProductDetail({ product, onAdd, onBuyNow, onOpenProduct, onBack, subscribeModalOpen, onSubscribeModalOpenChange }: ProductDetailProps) {
  const { t } = useTranslation();
  const variantTypeLabel = (type: string) => t(`productDetail.variantTypes.${type}`, type.toUpperCase());
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const isTablet = bp === 'tablet';
  const isSmall = isMobile || isTablet;
  const { isSignedIn, isLoaded } = useUser();
  const [showSignInModal, setShowSignInModal] = useState(false);

  useEffect(() => {
    if (subscribeModalOpen && isLoaded && !isSignedIn) {
      onSubscribeModalOpenChange(false);
      setShowSignInModal(true);
    }
  }, [subscribeModalOpen, isLoaded, isSignedIn, onSubscribeModalOpenChange]);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState('benefits');
  const [added, setAdded] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isZoomingOut, setIsZoomingOut] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(() => pickDefaultPrimary(product.variants));
  const [selectedSize, setSelectedSize] = useState<ProductVariant | null>(() => pickDefaultSize(product.variants, pickDefaultPrimary(product.variants)));
  const { data: allProducts = [] } = useProducts();
  const related = useMemo(() => getRelatedProducts(product, allProducts, 4), [allProducts, product]);
  const { data: liveReviews } = useReviews(product.id);
  const liveCount = liveReviews?.length ?? 0;
  const liveRating = liveReviews && liveReviews.length > 0
    ? Math.round(liveReviews.reduce((s, r) => s + r.rating, 0) / liveReviews.length * 10) / 10
    : 0;
  const purchasesLabel = formatPurchasesLastMonth(product.purchasesLastMonth ?? 0);
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
    ...(benefits.length ? [{ id: 'benefits', label: t('productDetail.tabs.benefits') }] : []),
    ...(hasText(product.usage) ? [{ id: 'usage', label: t('productDetail.tabs.usage') }] : []),
    ...(hasText(product.ingredients) ? [{ id: 'ingredients', label: t('productDetail.tabs.ingredients') }] : []),
    ...(hasText(product.nutritionFacts) ? [{ id: 'nutrition', label: t('productDetail.tabs.nutrition') }] : []),
    ...(product.certifications?.length ? [{ id: 'certs', label: t('productDetail.tabs.certs') }] : []),
    ...(hasText(product.interactions) ? [{ id: 'interactions', label: t('productDetail.tabs.interactions') }] : []),
    ...(product.faq?.length ? [{ id: 'faq', label: t('productDetail.tabs.faq') }] : []),
    ...(hasText(product.shadeTips) ? [{ id: 'shade', label: t('productDetail.tabs.shade') }] : []),
    ...(hasText(product.applicationTips) ? [{ id: 'application', label: t('productDetail.tabs.application') }] : []),
    ...(hasText(product.formulaDetails) ? [{ id: 'formula', label: t('productDetail.tabs.formula') }] : []),
    ...(product.skinTypes?.length ? [{ id: 'skintypes', label: t('productDetail.tabs.skintypes') }] : []),
    ...(product.extraTabs?.length
      ? product.extraTabs
          .filter((extraTab) => hasText(extraTab.label) && hasText(extraTab.content))
          .map((extraTab) => ({ id: `extra:${extraTab.id}`, label: extraTab.label }))
      : []),
    ...(hasText(product.warnings) ? [{ id: 'warnings', label: t('productDetail.tabs.warnings') }] : []),
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

  const primaryVariantsRaw = product.variants?.filter((v) => PRIMARY_VARIANT_TYPES.includes(v.type)) ?? [];
  const sizeVariants = product.variants?.filter((v) => v.type === 'size') ?? [];
  const hasTwoDimensions = primaryVariantsRaw.length > 0 && sizeVariants.length > 0;
  // The primary's own `.stock` isn't meaningful in matrix mode (see getPrimaryVariantStock) - swap
  // it out here so every pill/dropdown consumer below just reads `.stock` like normal.
  const primaryVariants = hasTwoDimensions
    ? primaryVariantsRaw.map((v) => ({ ...v, stock: getPrimaryVariantStock(product.variants, v) }))
    : primaryVariantsRaw;
  const availableSizeVariants = sizesFor(product.variants, selectedVariant);
  // Reflect the selected sabor's combo-specific stock (stockBySize) in the tamaño picker,
  // instead of only the tamaño's own shared stock.
  const availableSizeVariantsWithStock = availableSizeVariants.map((v) => {
    const override = selectedVariant?.stockBySize?.[v.id];
    return override != null ? { ...v, stock: override } : v;
  });

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

  // A background refetch (cross-tab admin edit, refocus revalidation, etc.) gives a new
  // `product.variants` array even when it's the same product. `selectedVariant`/`selectedSize`
  // were captured by value, not re-derived from props, so without this they'd keep showing the
  // price/stock/images from whenever they were first picked - re-resolve them by id here instead
  // of resetting the whole selection (which would also yank qty/tab/zoom back to defaults).
  useEffect(() => {
    setSelectedVariant((prev) => (prev ? product.variants?.find((v) => v.id === prev.id) ?? prev : prev));
    setSelectedSize((prev) => (prev ? product.variants?.find((v) => v.id === prev.id) ?? prev : prev));
  }, [product.variants]);

  const priceOverride = hasTwoDimensions && selectedSize ? selectedVariant?.priceBySize?.[selectedSize.id] : undefined;
  const effectivePrice = priceOverride ?? ((selectedVariant?.price ?? product.price) + (hasTwoDimensions ? (selectedSize?.price ?? 0) : 0));
  const comboPriceBefore = hasTwoDimensions && selectedSize ? selectedVariant?.priceBeforeBySize?.[selectedSize.id] : undefined;
  const effectivePriceBefore = comboPriceBefore ?? selectedVariant?.priceBefore ?? product.priceBefore;
  const effectiveStock = hasTwoDimensions
    ? (selectedSize && selectedVariant?.stockBySize?.[selectedSize.id]) ?? selectedSize?.stock ?? selectedVariant?.stock ?? product.stock
    : (selectedVariant?.stock ?? product.stock);
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
          aria-label={t('productDetail.zoomAria', { name: product.name })}
          onClick={closeZoom} 
          style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(253, 252, 250, 0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', backdropFilter: 'blur(10px)', padding: 40, animation: isZoomingOut ? 'zoomModalOut 0.25s cubic-bezier(0.3, 0, 0.8, 0.15) forwards' : 'zoomModalBgIn 0.3s ease-out' }}
        >
          <button
            type="button"
            aria-label={t('productDetail.closeZoomAria')}
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
        <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit' }}>{t('productDetail.store')}</button> · {product.category.toUpperCase()} · <span style={{ color: 'var(--ink)' }}>{product.name.toUpperCase()}</span>
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
            aria-label={t('productDetail.thumbnailsAria')}
            style={{ display: 'flex', gap: 10, marginTop: 12 }}
          >
            {gallery.map((image, i) => (
              <button
                type="button"
                key={image.url}
                role="tab"
                aria-selected={i === activeImageIndex}
                aria-label={image.alt || t('productDetail.imageAltFallback', { n: i + 1 })}
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
                <span style={{ fontSize: 13, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif' }}>{liveRating} · {t('productDetail.reviewsCount', { count: liveCount })}</span>
              </>
            ) : (
              <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: 'var(--ink-40)', letterSpacing: '0.06em' }}>{t('productDetail.noReviewsYet')}</span>
            )}
            {effectiveStock === 0 ? (
              <span style={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: 'oklch(0.5 0.15 30)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, background: 'oklch(0.5 0.15 30)', borderRadius: 999 }} />
                {t('productDetail.outOfStock')}
              </span>
            ) : isLowStock(effectiveStock) ? (
              <span style={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: 'var(--coral)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, background: 'var(--coral)', borderRadius: 999 }} />
                {t('productDetail.lowStock', { count: effectiveStock })}
              </span>
            ) : (
              <span style={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, background: 'var(--green)', borderRadius: 999 }} />
                {t('productDetail.inStock')}
              </span>
            )}
          </div>

          {purchasesLabel && (
            <div style={{ fontSize: 13, color: 'var(--ink-60)', fontFamily: '"Geist", sans-serif', marginBottom: 20 }}>{t('productCard.purchasesLastMonth', { count: purchasesLabel })}</div>
          )}

          <p style={{ fontSize: 17, lineHeight: 1.55, color: 'var(--ink-80)', marginBottom: product.variants?.length ? 20 : 32, maxWidth: 480 }}>{product.short}</p>

          {product.variants && product.variants.length > 0 && (() => {
            const pillBtn = (v: ProductVariant, selected: boolean, onClick: () => void) => (
              <button
                type="button"
                key={v.id}
                onClick={onClick}
                disabled={v.stock === 0}
                aria-pressed={selected}
                aria-label={`${v.label}${v.stock === 0 ? t('productDetail.outOfStockSuffix') : ''}`}
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
            const colorSwatchBtn = (v: ProductVariant, selected: boolean, onClick: () => void) => (
              <button
                type="button"
                key={v.id}
                onClick={onClick}
                aria-label={t('productDetail.colorAria', { label: v.label }) + (v.stock === 0 ? t('productDetail.outOfStockSuffix') : '')}
                aria-pressed={selected}
                disabled={v.stock === 0}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: v.color ?? '#ccc',
                  border: selected ? '2.5px solid var(--ink)' : '2px solid transparent',
                  outline: selected ? '2px solid var(--ink)' : '2px solid var(--ink-10)',
                  outlineOffset: 2,
                  boxShadow: 'inset 0 0 0 1.5px rgba(0,0,0,0.18)',
                  cursor: v.stock === 0 ? 'not-allowed' : 'pointer',
                  opacity: v.stock === 0 ? 0.35 : 1,
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  flexShrink: 0,
                }}
              />
            );
            // Con muchas opciones (ej. 25 sabores) los pills se ven desbordados; a partir de 7
            // opciones se compacta en un <select> nativo.
            const DROPDOWN_THRESHOLD = 7;
            const dropdown = (options: ProductVariant[], selected: ProductVariant | null, onChange: (v: ProductVariant) => void, label: string) => (
              <Select
                aria-label={label}
                value={selected?.id ?? ''}
                onChange={(e) => {
                  const v = options.find((o) => o.id === e.target.value);
                  if (v) onChange(v);
                }}
                wrapperStyle={{ maxWidth: 320 }}
                style={{
                  padding: isMobile ? '14px 36px 14px 14px' : '10px 36px 10px 14px',
                  minHeight: isMobile ? 48 : undefined,
                  borderRadius: 10,
                  fontSize: 14,
                }}
              >
                {options.map((v) => (
                  <option key={v.id} value={v.id} disabled={v.stock === 0}>
                    {v.label}{v.stock === 0 ? t('productDetail.noStockOption') : ''}
                  </option>
                ))}
              </Select>
            );

            if (hasTwoDimensions) {
              const primaryType = primaryVariants[0]?.type;
              const primaryLabel = variantTypeLabel(primaryType);
              const isPrimaryColor = primaryType === 'color';
              return (
                <div style={{ marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.1em', color: 'var(--ink-60)', marginBottom: 10 }}>
                      {primaryLabel}{selectedVariant && <span style={{ color: 'var(--ink)' }}> · {selectedVariant.label.toUpperCase()}</span>}
                    </div>
                    {!isPrimaryColor && primaryVariants.length > DROPDOWN_THRESHOLD ? (
                      dropdown(primaryVariants, selectedVariant, (v) => {
                        setSelectedVariant(v);
                        setSelectedSize(pickSizeKeepingCurrent(product.variants, v, selectedSize));
                        setQty(1);
                      }, primaryLabel)
                    ) : (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {primaryVariants.map((v) => (isPrimaryColor ? colorSwatchBtn : pillBtn)(v, selectedVariant?.id === v.id, () => {
                          setSelectedVariant(v);
                          setSelectedSize(pickSizeKeepingCurrent(product.variants, v, selectedSize));
                          setQty(1);
                        }))}
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.1em', color: 'var(--ink-60)', marginBottom: 10 }}>
                      {variantTypeLabel('size')}{selectedSize && <span style={{ color: 'var(--ink)' }}> · {selectedSize.label.toUpperCase()}</span>}
                    </div>
                    {availableSizeVariantsWithStock.length > DROPDOWN_THRESHOLD ? (
                      dropdown(availableSizeVariantsWithStock, selectedSize, (v) => setSelectedSize(v), variantTypeLabel('size'))
                    ) : (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {availableSizeVariantsWithStock.map((v) => pillBtn(v, selectedSize?.id === v.id, () => setSelectedSize(v)))}
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
                  {variantTypeLabel(variantType)}
                  {selectedVariant && <span style={{ color: 'var(--ink)' }}> · {selectedVariant.label.toUpperCase()}</span>}
                </div>
                {!isColor && product.variants!.length > DROPDOWN_THRESHOLD ? (
                  dropdown(product.variants!, selectedVariant, (v) => { setSelectedVariant(v); setQty(1); }, variantTypeLabel(variantType))
                ) : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {product.variants!.map((v) => (isColor ? colorSwatchBtn : pillBtn)(v, selectedVariant?.id === v.id, () => { setSelectedVariant(v); setQty(1); }))}
                  </div>
                )}
              </div>
            );
          })()}

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid var(--ink-06)', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: '"Instrument Serif", serif', fontSize: isMobile ? 36 : isTablet ? 42 : 48, color: 'var(--ink)', lineHeight: 1 }}>{formatCurrency(effectivePrice)}</span>
            {effectivePriceBefore && (
              <>
                <span style={{ fontSize: 20, color: 'var(--ink-40)', textDecoration: 'line-through' }}>{formatCurrency(effectivePriceBefore)}</span>
                <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', background: 'var(--coral)', color: 'white', padding: '4px 8px', borderRadius: 999, fontWeight: 600 }}>{t('productDetail.savings', { amount: formatCurrency(effectivePriceBefore - effectivePrice) })}</span>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', marginBottom: 16, flexDirection: isMobile ? 'column' : 'row' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--ink-20)', borderRadius: 999, padding: 4, opacity: effectiveStock === 0 ? 0.4 : 1, alignSelf: isMobile ? 'flex-start' : undefined }}>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={qtyBtn(isMobile)} disabled={effectiveStock === 0 || qty <= 1} aria-label={t('productDetail.decreaseQtyAria')}><Icon name="minus" size={14} /></button>
              <span style={{ width: 40, textAlign: 'center', fontFamily: '"Geist", sans-serif', fontSize: 15 }}>{qty}</span>
              <button onClick={() => setQty((q) => Math.min(effectiveStock, q + 1))} style={qtyBtn(isMobile)} disabled={effectiveStock === 0 || qty >= effectiveStock} aria-label={t('productDetail.increaseQtyAria')}><Icon name="plus" size={14} /></button>
            </div>
            <AnimatedButton variant="primary" size="lg" onClick={handleAdd} disabled={effectiveStock === 0} style={{ flex: 1, width: isMobile ? '100%' : undefined }} text={effectiveStock === 0 ? t('productDetail.outOfStockButton') : added ? t('productDetail.addedToCart') : t('productDetail.addToCart', { price: formatCurrency(effectivePrice * qty) })} />
          </div>
          <AnimatedButton aria-label={t('productDetail.buyNow')} variant="outline" full onClick={() => onBuyNow(product, qty, cartVariant)} disabled={effectiveStock === 0} text={t('productDetail.buyNow')} />
          <AnimatedButton
            aria-label={t('productDetail.subscribe')}
            variant="outline"
            full
            icon={<Icon name="repeat" size={14} />}
            onClick={() => (isSignedIn ? onSubscribeModalOpenChange(true) : setShowSignInModal(true))}
            disabled={effectiveStock === 0}
            style={{ marginTop: 8, border: '1px solid var(--ink-12)', color: 'var(--ink-80)' }}
            text={t('productDetail.subscribe')}
          />

          <div style={{ marginTop: 24, background: 'var(--cream-2)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid var(--ink-06)' }}>
            {[
              { icon: 'truck', label: t('productDetail.trust.freeShipping', { amount: formatCurrency(50) }) },
              { icon: 'shield', label: t('productDetail.trust.securePayment') },
              { icon: 'check', label: t('productDetail.trust.verified') },
            ].map((row) => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink-80)' }}>
                <Icon name={row.icon} size={16} /> {row.label}
              </div>
            ))}
          </div>

          {detailTabs.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--ink-06)', flexWrap: 'wrap' }}>
              {detailTabs.map((tabItem) => (
                <button key={tabItem.id} onClick={() => setTab(tabItem.id)} style={{ padding: '14px 4px', marginRight: 28, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: '"Geist", sans-serif', color: tab === tabItem.id ? 'var(--ink)' : 'var(--ink-60)', borderBottom: tab === tabItem.id ? '2px solid var(--ink)' : '2px solid transparent', marginBottom: -1, whiteSpace: 'nowrap' }}>{tabItem.label}</button>
              ))}
            </div>
            <div style={{ padding: '20px 0', fontSize: 15, lineHeight: 1.6, color: 'var(--ink-80)', fontFamily: '"Geist", sans-serif', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
              {tab === 'benefits' && <ul style={{ paddingLeft: 18, margin: 0 }}>{benefits.map((b) => <li key={b} style={{ marginBottom: 6 }}>{renderInlineText(b, b)}</li>)}</ul>}
              {tab === 'usage' && hasText(product.usage) && renderRichText(product.usage)}
              {tab === 'ingredients' && hasText(product.ingredients) && renderRichText(product.ingredients)}
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
              {tab.startsWith('extra:') &&
                renderRichText(product.extraTabs?.find((extraTab) => `extra:${extraTab.id}` === tab)?.content || '')}
              {tab === 'warnings' && hasText(product.warnings) && (
                <div style={{ color: 'var(--coral)' }}>
                  <span>⚠ </span>
                  {renderRichText(product.warnings)}
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </div>

      <RecentlyViewedSection
        onOpenProduct={onOpenProduct}
        onAdd={onAdd}
        excludeProductId={product.id}
      />

      <RelatedProductsSection
        subtitle={t('productDetail.related.subtitle')}
        title={<>{t('productDetail.related.titlePrefix')} <em style={{ color: 'var(--green)' }}>{t('productDetail.related.titleEmphasis')}</em></>}
        products={related}
        onOpenProduct={onOpenProduct}
        onAdd={onAdd}
      />

      <ReviewSection productId={product.id} />

      <SubscribeModal
        open={subscribeModalOpen}
        onClose={() => onSubscribeModalOpenChange(false)}
        productId={product.id}
        variantId={cartVariant?.id}
        productLabel={`${product.name}${cartVariant ? ` · ${cartVariant.label}` : ''}`}
        unitPrice={effectivePrice}
        taxExempt={product.taxExempt}
        defaultQty={qty}
      />
      <SignInModal open={showSignInModal} onClose={() => setShowSignInModal(false)} />
    </div>
  );
}
