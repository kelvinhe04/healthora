import { useState } from 'react';
import type { Product } from '../../types';
import { imageSizesForSize, imageWidthForSize, optimizeImageUrl, responsiveImageSrcSet, type ImageSizeKey } from '../../lib/cloudinary';
import { getDefaultComboImage } from '../../lib/productVariants';

type SizeKey = 'xs' | 'sm' | 'md' | 'lg' | 'tile';

interface ProductImageProps {
  product: Product;
  size?: SizeKey;
  flat?: boolean;
  imageUrl?: string;
  alt?: string;
  /** Above-the-fold images (hero): eager load, no lazy */
  priority?: boolean;
}

const sizes: Record<SizeKey, { w: number | string; h: number; fs: number }> = {
  xs: { w: 60, h: 72, fs: 9 },
  sm: { w: 120, h: 140, fs: 12 },
  md: { w: 220, h: 260, fs: 16 },
  lg: { w: 520, h: 620, fs: 28 },
  tile: { w: '100%', h: 280, fs: 14 },
};

function tintOf(color: string, amount: number) {
  return `color-mix(in oklch, ${color} ${(1 - amount) * 100}%, white)`;
}

export function ProductImage({ product, size = 'md', flat = false, imageUrl, alt, priority = false }: ProductImageProps) {
  const s = sizes[size];
  const rawSrc = imageUrl || product.imageUrl || product.images?.find((img) => img.isPrimary)?.url || product.images?.[0]?.url || getDefaultComboImage(product);
  const imageSize = size as ImageSizeKey;
  const optimizedSrc = rawSrc ? optimizeImageUrl(rawSrc, imageWidthForSize(imageSize)) : '';
  const srcSet = rawSrc ? responsiveImageSrcSet(rawSrc, imageSize) : undefined;
  const sizesAttr = imageSizesForSize(imageSize);
  const [failedOptimizedSrc, setFailedOptimizedSrc] = useState('');
  const imgSrc = failedOptimizedSrc === optimizedSrc ? rawSrc : optimizedSrc;

  if (rawSrc) {
    const imagePadding = size === 'lg' ? 24 : size === 'tile' ? 18 : size === 'md' ? 14 : 8;
    const objectFit = 'contain';
    // 'lg' es el hero de ProductDetail: ancho fijo (520px) desborda su contenedor en mobile/tablet
    // (recortado por el overflow:hidden del padre) - se vuelve fluido con el mismo aspect ratio.
    const sizeStyle = size === 'lg'
      ? { width: '100%', maxWidth: s.w, aspectRatio: `${s.w} / ${s.h}`, height: 'auto' }
      : { width: s.w, height: s.h };
    return (
      <div style={{ ...sizeStyle, background: 'white', borderRadius: flat ? 0 : 6, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: imagePadding, boxSizing: 'border-box' }}>
        <img
          src={imgSrc || rawSrc}
          srcSet={srcSet}
          sizes={srcSet ? sizesAttr : undefined}
          alt={alt || product.name}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          onError={() => {
            if (imgSrc !== rawSrc) setFailedOptimizedSrc(optimizedSrc);
          }}
          style={{ width: '100%', height: '100%', objectFit, objectPosition: 'center center' }}
        />
      </div>
    );
  }
  const placeholderLines = product.label.split('\n');
  return (
    <div
      role="img"
      aria-label={alt || product.name}
      style={{ width: s.w, height: s.h, background: product.color, borderRadius: flat ? 0 : 6, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}
    >
      <div style={{ width: '55%', height: '78%', background: `linear-gradient(180deg, ${product.swatchColor} 0%, ${product.swatchColor} 20%, ${tintOf(product.swatchColor, 0.92)} 20%, ${tintOf(product.swatchColor, 0.92)} 100%)`, borderRadius: '12px 12px 8px 8px', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 -20px 40px rgba(0,0,0,0.06), inset 3px 0 6px rgba(255,255,255,0.4)' }}>
        <div style={{ color: product.swatchColor, fontFamily: '"Geist", sans-serif', fontWeight: 700, fontSize: s.fs, textAlign: 'center', lineHeight: 1.05, marginTop: `${(s.fs as number) * 0.6}px`, letterSpacing: '-0.02em', whiteSpace: 'pre-line', filter: 'contrast(1.5)', mixBlendMode: 'multiply' }}>
          {placeholderLines.map((l, i) => <div key={i} aria-hidden="true">{l}</div>)}
        </div>
      </div>
    </div>
  );
}
