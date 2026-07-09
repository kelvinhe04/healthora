import type { Product, ProductVariant } from '../types';

// A "primary" variant dimension (any non-size type) can be paired with a "size" dimension, where
// each size option may be restricted to specific primary variants via `availableFor`.
export const PRIMARY_VARIANT_TYPES = ['scent', 'flavor', 'color', 'weight', 'count'];

export function pickDefaultPrimary(variants?: ProductVariant[]): ProductVariant | null {
  if (!variants?.length) return null;
  const primary = variants.filter((v) => PRIMARY_VARIANT_TYPES.includes(v.type));
  if (primary.length) return primary.find((v) => v.isDefault) ?? primary[0];
  return variants.find((v) => v.isDefault) ?? variants[0];
}

export function sizesFor(variants: ProductVariant[] | undefined, primary: ProductVariant | null): ProductVariant[] {
  return (variants?.filter((v) => v.type === 'size') ?? []).filter(
    // `availableFor` missing/undefined means "no restriction" (available for every primary). An
    // *empty* array is a real restriction - "active for no one" - and must not be treated the
    // same as "no restriction" just because its length is falsy.
    (v) => !v.availableFor || !primary || v.availableFor.includes(primary.id)
  );
}

export function pickDefaultSize(variants: ProductVariant[] | undefined, primary: ProductVariant | null): ProductVariant | null {
  const sizes = sizesFor(variants, primary);
  return sizes.find((v) => v.isDefault) ?? sizes[0] ?? null;
}

/** Size to show after switching the primary (sabor/aroma/…) selection. Keeps `currentSize` if it's
 * still offered for the new primary (respecting `availableFor`), so picking a different flavor
 * doesn't yank an already-chosen tamaño back to the default. Falls back to the default size only
 * when the current one isn't available for the new primary. */
export function pickSizeKeepingCurrent(
  variants: ProductVariant[] | undefined,
  primary: ProductVariant | null,
  currentSize: ProductVariant | null,
): ProductVariant | null {
  const sizes = sizesFor(variants, primary);
  const stillAvailable = currentSize && sizes.find((v) => v.id === currentSize.id);
  return stillAvailable || pickDefaultSize(variants, primary);
}

/** Stock to show for a primary (sabor/aroma/…) option in a two-dimension matrix product.
 * The primary variant's own top-level `stock` isn't editable in the matrix editor and stays 0 -
 * actual stock lives per combo (`stockBySize`, falling back to the tamaño's own stock). Summing
 * across the sizes available for this primary is what determines whether it should be selectable. */
export function getPrimaryVariantStock(variants: ProductVariant[] | undefined, primary: ProductVariant): number {
  const sizes = sizesFor(variants, primary);
  if (!sizes.length) return primary.stock;
  return sizes.reduce((sum, s) => sum + (primary.stockBySize?.[s.id] ?? s.stock ?? 0), 0);
}

/** Sum of stock across every purchasable option: every simple variant, or every active
 * sabor×tamaño combo in matrix mode (using each combo's `stockBySize` override when set,
 * falling back to the tamaño's own stock). Computed live from `variants` rather than trusting
 * the persisted `product.stock` - that field is a denormalized cache written at save time, so
 * a product edited before this combo-aware total existed would otherwise keep showing a stale
 * sum of just the tamaño rows' base stock until someone re-saves it. */
export function getTotalStock(product: Pick<Product, 'stock' | 'variants'>): number {
  const variants = product.variants;
  if (!variants?.length) return product.stock;
  const sizes = variants.filter((v) => v.type === 'size');
  const primaries = variants.filter((v) => PRIMARY_VARIANT_TYPES.includes(v.type));
  if (!sizes.length || !primaries.length) return variants.reduce((sum, v) => sum + (v.stock || 0), 0);
  let total = 0;
  for (const p of primaries) {
    for (const s of sizesFor(variants, p)) {
      total += p.stockBySize?.[s.id] ?? s.stock ?? 0;
    }
  }
  return total;
}

export function hasTwoDimensions(variants?: ProductVariant[]): boolean {
  if (!variants?.length) return false;
  const hasPrimary = variants.some((v) => PRIMARY_VARIANT_TYPES.includes(v.type));
  const hasSize = variants.some((v) => v.type === 'size');
  return hasPrimary && hasSize;
}

/** Default variant + size combo for a product, used for catalog/card price and image display. */
export function pickDefaultCombo(product: Product): { variant: ProductVariant | null; size: ProductVariant | null } {
  const primary = pickDefaultPrimary(product.variants);
  if (hasTwoDimensions(product.variants)) {
    return { variant: primary, size: pickDefaultSize(product.variants, primary) };
  }
  return { variant: primary, size: null };
}

/** The variant to attach when a product is added to the cart without going through a variant
 * picker (e.g. the quick-add "+" on a catalog card). Without this, a product with variants would
 * land in the cart as a bare line with no variant at all - unable to show or edit sabor/tamaño
 * later, since the cart UI only offers that for lines that already carry a variant. Resolves to
 * the same composite id (`primary:size`) a real selection would produce. */
export function pickDefaultCartVariant(product: Product): ProductVariant | undefined {
  const { variant, size } = pickDefaultCombo(product);
  if (!variant) return undefined;
  if (size) return resolveVariantById(product.variants, `${variant.id}:${size.id}`);
  return variant;
}

/** Cover image for the default sabor×tamaño combo (or single default variant). Mirrors the
 * combo-image priority used for cart/order line items (`resolveVariantById`): a combo-specific
 * photo first, then the sabor's own photos, then the tamaño's. Used by catalog cards / product
 * tiles so picking a "Default" combo in the admin actually changes the cover shown to shoppers. */
export function getDefaultComboImage(product: Product): string | undefined {
  const { variant, size } = pickDefaultCombo(product);
  if (!variant) return undefined;
  const comboImages = size ? variant.imagesBySize?.[size.id] : undefined;
  const images = comboImages ?? variant.images ?? size?.images;
  return images?.[0] ?? variant.imageUrl ?? size?.imageUrl;
}

export function getEffectivePrice(product: Product): number {
  const { variant, size } = pickDefaultCombo(product);
  const override = size ? variant?.priceBySize?.[size.id] : undefined;
  if (override != null) return override;
  return (variant?.price ?? product.price) + (size?.price ?? 0);
}

export function getEffectivePriceBefore(product: Product): number | undefined {
  const { variant } = pickDefaultCombo(product);
  return variant?.priceBefore ?? product.priceBefore;
}

/** Reconstructs the exact ProductVariant (single or combo) that a persisted `variantId` refers to, for reorder/cart flows. */
export function resolveVariantById(variants: ProductVariant[] | undefined, variantId?: string): ProductVariant | undefined {
  if (!variantId || !variants?.length) return undefined;

  if (variantId.includes(':')) {
    const [primaryId, sizeId] = variantId.split(':');
    const primary = variants.find((v) => v.id === primaryId);
    const size = variants.find((v) => v.id === sizeId);
    if (!primary || !size) return undefined;
    const images = primary.imagesBySize?.[size.id] ?? primary.images ?? size.images;
    const priceOverride = primary.priceBySize?.[size.id];
    return {
      ...primary,
      id: variantId,
      label: `${primary.label} · ${size.label}`,
      price: priceOverride ?? primary.price + size.price,
      stock: primary.stockBySize?.[size.id] ?? size.stock ?? primary.stock,
      images,
      imageUrl: primary.imageUrl ?? size.imageUrl,
    };
  }

  return variants.find((v) => v.id === variantId);
}
