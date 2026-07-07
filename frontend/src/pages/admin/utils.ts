import type { FulfillmentStatus, Product } from '../../types';
import type { ProductForm } from './types';
import { fulfillmentStatusSequence } from './types';

export const ADMIN_PAGE_SIZE = 10;

export function getNextFulfillmentStatus(
  current: FulfillmentStatus | undefined,
): FulfillmentStatus | null {
  const idx = fulfillmentStatusSequence.indexOf(current || 'unfulfilled');
  return idx >= 0 && idx < fulfillmentStatusSequence.length - 1
    ? fulfillmentStatusSequence[idx + 1]
    : null;
}

export function paginateItems<T>(items: T[], page: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / ADMIN_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * ADMIN_PAGE_SIZE;
  return {
    page: safePage,
    totalPages,
    items: items.slice(start, start + ADMIN_PAGE_SIZE),
    start: items.length ? start + 1 : 0,
    end: Math.min(start + ADMIN_PAGE_SIZE, items.length),
  };
}

export function normalizeTag(tag: string) {
  const normalized = tag.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return '';
  if (normalized === 'best seller' || normalized === 'bestseller' || normalized === 'más vendido')
    return 'Más vendido';
  if (normalized === 'nuevo') return 'Nuevo';
  if (normalized === 'premium') return 'Premium';
  if (normalized === 'oferta') return 'Oferta';
  return tag.trim();
}

export function productToForm(p: Product): ProductForm {
  return {
    name: p.name,
    brand: p.brand,
    category: p.category,
    need: p.need || '',
    short: p.short || '',
    price: String(p.price),
    priceBefore: p.priceBefore ? String(p.priceBefore) : '',
    tag: p.tag || '',
    stock: String(p.stock),
    active: p.active,
    benefits: (p.benefits || []).join('\n'),
    usage: p.usage || '',
    ingredients: p.ingredients || '',
    warnings: p.warnings || '',
    extraTabs: p.extraTabs || [],
    imageUrl: p.imageUrl || p.images?.[0]?.url || '',
    image2: p.images?.[1]?.url || '',
    image3: p.images?.[2]?.url || '',
    image4: p.images?.[3]?.url || '',
    color: p.color || 'oklch(0.92 0.1 140)',
    swatchColor: p.swatchColor || 'oklch(0.6 0.15 140)',
    label: p.label || '',
  };
}

export function slugify(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function formToPayload(f: ProductForm): Partial<Product> {
  const allImages: NonNullable<Product['images']> = [];
  if (f.imageUrl) allImages.push({ url: f.imageUrl, isPrimary: true });
  if (f.image2) allImages.push({ url: f.image2 });
  if (f.image3) allImages.push({ url: f.image3 });
  if (f.image4) allImages.push({ url: f.image4 });
  return {
    id: slugify(f.name),
    name: f.name.trim(),
    brand: f.brand.trim(),
    category: f.category.trim(),
    need: f.need.trim(),
    short: f.short.trim(),
    price: parseFloat(f.price) || 0,
    ...(f.priceBefore ? { priceBefore: parseFloat(f.priceBefore) } : {}),
    ...(f.tag ? { tag: normalizeTag(f.tag) } : {}),
    stock: parseInt(f.stock) || 0,
    active: f.active,
    benefits: f.benefits
      .split('\n')
      .map((b) => b.trim())
      .filter(Boolean),
    usage: f.usage.trim(),
    ingredients: f.ingredients.trim(),
    warnings: f.warnings.trim(),
    extraTabs: f.extraTabs
      .filter((t) => t.label.trim() && t.content.trim())
      .map((t) => ({
        id: slugify(t.label),
        label: t.label.trim(),
        content: t.content.trim(),
      })),
    ...(f.imageUrl ? { imageUrl: f.imageUrl } : {}),
    images: allImages,
    color: f.color,
    swatchColor: f.swatchColor,
    label: f.label.trim(),
    rating: 0,
    reviews: 0,
  };
}
