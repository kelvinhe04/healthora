import type { Product } from '../../types';

type SizeKey = 'xs' | 'sm' | 'md' | 'lg' | 'tile';

interface ProductImageProps {
  product: Product;
  size?: SizeKey;
  flat?: boolean;
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

export function ProductImage({ product, size = 'md', flat = false }: ProductImageProps) {
  const s = sizes[size];
  if (product.imageUrl) {
    return (
      <div style={{ width: s.w, height: s.h, background: product.color, borderRadius: flat ? 0 : 6, overflow: 'hidden', flexShrink: 0 }}>
        <img src={product.imageUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }
  const lines = product.label.split('\n');
  return (
    <div style={{ width: s.w, height: s.h, background: product.color, borderRadius: flat ? 0 : 6, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ width: '55%', height: '78%', background: `linear-gradient(180deg, ${product.swatchColor} 0%, ${product.swatchColor} 20%, ${tintOf(product.swatchColor, 0.92)} 20%, ${tintOf(product.swatchColor, 0.92)} 100%)`, borderRadius: '12px 12px 8px 8px', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 -20px 40px rgba(0,0,0,0.06), inset 3px 0 6px rgba(255,255,255,0.4)' }}>
        <div style={{ color: product.swatchColor, fontFamily: '"Geist", sans-serif', fontWeight: 700, fontSize: s.fs, textAlign: 'center', lineHeight: 1.05, marginTop: `${(s.fs as number) * 0.6}px`, letterSpacing: '-0.02em', whiteSpace: 'pre-line', filter: 'contrast(1.5)', mixBlendMode: 'multiply' }}>
          {lines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>
    </div>
  );
}
