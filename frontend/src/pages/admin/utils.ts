import type { FulfillmentStatus, Product, ProductVariant } from '../../types';
import type { ProductForm, VariantFormRow } from './types';
import { fulfillmentStatusSequence } from './types';
import { getDefaultComboImage, getEffectivePrice, hasTwoDimensions, PRIMARY_VARIANT_TYPES, sizesFor } from '../../lib/productVariants';
import { composeFromMatrix, decomposeToMatrix, emptyMatrixState } from './variantMatrix';
import { CATEGORY_TO_NEED } from '../../lib/needs';

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
    short: p.short || '',
    price: String(p.price),
    priceBefore: p.priceBefore ? String(p.priceBefore) : '',
    discountStartsAt: p.discountStartsAt ? p.discountStartsAt.slice(0, 10) : '',
    discountEndsAt: p.discountEndsAt ? p.discountEndsAt.slice(0, 10) : '',
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
    variantsMode: hasTwoDimensions(p.variants) ? 'matrix' : 'simple',
    variantsSimple: hasTwoDimensions(p.variants)
      ? []
      : (p.variants || []).map((v) => ({
          id: v.id,
          label: v.label,
          type: v.type,
          price: String(v.price),
          priceBefore: v.priceBefore ? String(v.priceBefore) : '',
          discountStartsAt: v.discountStartsAt ? v.discountStartsAt.slice(0, 10) : '',
          discountEndsAt: v.discountEndsAt ? v.discountEndsAt.slice(0, 10) : '',
          stock: String(v.stock),
          sku: v.sku || '',
          color: v.color || '',
          images: v.images?.length ? v.images : v.imageUrl ? [v.imageUrl] : [],
          isDefault: Boolean(v.isDefault),
        })),
    variantsMatrix: hasTwoDimensions(p.variants) ? decomposeToMatrix(p.variants || []) : emptyMatrixState(),
  };
}

function variantRowToPayload(row: VariantFormRow, usedIds: Set<string>): ProductVariant | null {
  const label = row.label.trim();
  if (!label) return null;

  let id = row.id.trim() || slugify(label);
  if (!id) id = `variant-${usedIds.size + 1}`;
  while (usedIds.has(id)) id = `${id}-${usedIds.size + 1}`;
  usedIds.add(id);

  return {
    id,
    label,
    type: row.type,
    price: parseFloat(row.price) || 0,
    stock: parseInt(row.stock, 10) || 0,
    ...(row.sku.trim() ? { sku: row.sku.trim() } : {}),
    ...(row.color.trim() ? { color: row.color.trim() } : {}),
    ...(row.images[0] ? { imageUrl: row.images[0] } : {}),
    ...(row.images.length ? { images: row.images } : {}),
    ...(row.isDefault ? { isDefault: true } : {}),
    ...(row.priceBefore.trim() ? { priceBefore: parseFloat(row.priceBefore) } : {}),
    ...(row.priceBefore.trim() && row.discountStartsAt ? { discountStartsAt: row.discountStartsAt } : {}),
    ...(row.priceBefore.trim() && row.discountEndsAt ? { discountEndsAt: row.discountEndsAt } : {}),
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

/** Sum of the stock pools that actually gate checkout: every simple variant, or every active
 * sabor×tamaño combo in matrix mode - using each combo's `stockBySize` override when set,
 * falling back to the tamaño's own stock otherwise (mirrors `getPrimaryVariantStock`). Summing
 * the tamaño rows' base stock alone (their old behavior) ignored per-combo overrides entirely. */
function sumVariantStock(variants: ProductVariant[], mode: ProductForm['variantsMode']): number {
  if (mode !== 'matrix') return variants.reduce((sum, v) => sum + (v.stock || 0), 0);
  const primaries = variants.filter((v) => PRIMARY_VARIANT_TYPES.includes(v.type));
  let total = 0;
  for (const p of primaries) {
    for (const s of sizesFor(variants, p)) {
      total += p.stockBySize?.[s.id] ?? s.stock ?? 0;
    }
  }
  return total;
}

/** How many purchasable options a product has, for admin list display. A sabor×tamaño matrix
 * stores one row per sabor plus one row per tamaño (e.g. 5 + 3 = 8 `variants` entries) - that's
 * not the number a shopper picks from, so for matrix products this counts active combo cells
 * instead of dimension rows. */
export function variantSummary(product: Product): { count: number; label: string } | null {
  if (!product.variants?.length) return null;
  if (hasTwoDimensions(product.variants)) {
    const count = Object.keys(decomposeToMatrix(product.variants).cells).length;
    return { count, label: count === 1 ? 'combinación' : 'combinaciones' };
  }
  const count = product.variants.length;
  return { count, label: count === 1 ? 'variante' : 'variantes' };
}

export function formToPayload(f: ProductForm): Partial<Product> {
  const allImages: NonNullable<Product['images']> = [];
  if (f.imageUrl) allImages.push({ url: f.imageUrl, isPrimary: true });
  if (f.image2) allImages.push({ url: f.image2 });
  if (f.image3) allImages.push({ url: f.image3 });
  if (f.image4) allImages.push({ url: f.image4 });

  const variants =
    f.variantsMode === 'matrix'
      ? composeFromMatrix(f.variantsMatrix)
      : (() => {
          const usedIds = new Set<string>();
          return f.variantsSimple
            .map((row) => variantRowToPayload(row, usedIds))
            .filter((v): v is ProductVariant => v !== null);
        })();

  const basePrice = parseFloat(f.price) || 0;
  const baseStock = parseInt(f.stock) || 0;
  // With variants, the product-level price/stock are just a fallback/display value (the admin
  // list still shows them) - derive them from the variants instead of asking the admin to keep
  // a redundant number in sync.
  const price = variants.length ? getEffectivePrice({ price: basePrice, variants } as Product) : basePrice;
  const stock = variants.length ? sumVariantStock(variants, f.variantsMode) : baseStock;
  // Same reasoning as price/stock above: with variants, the top-level cover image is derived
  // from whichever combo is marked "Default" instead of the (hidden, stale) generic image fields -
  // otherwise picking a new default variant wouldn't change the thumbnail shown in the admin list.
  const imageUrl = variants.length ? getDefaultComboImage({ price: basePrice, variants } as Product) : f.imageUrl;

  return {
    id: slugify(f.name),
    name: f.name.trim(),
    brand: f.brand.trim(),
    category: f.category.trim(),
    need: CATEGORY_TO_NEED[f.category.trim()] ?? '',
    short: f.short.trim(),
    price,
    priceBefore: f.priceBefore ? parseFloat(f.priceBefore) : null,
    discountStartsAt: f.priceBefore && f.discountStartsAt ? f.discountStartsAt : null,
    discountEndsAt: f.priceBefore && f.discountEndsAt ? f.discountEndsAt : null,
    ...(f.tag ? { tag: normalizeTag(f.tag) } : {}),
    stock,
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
    ...(imageUrl ? { imageUrl } : {}),
    images: variants.length ? (imageUrl ? [{ url: imageUrl, isPrimary: true }] : []) : allImages,
    color: f.color,
    swatchColor: f.swatchColor,
    label: f.label.trim(),
    rating: 0,
    reviews: 0,
    variants,
  };
}
