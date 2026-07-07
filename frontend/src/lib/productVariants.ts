import type { Product, ProductVariant } from '../types';

// A "primary" variant dimension (flavor/scent) can be paired with a "size" dimension, where
// each size option may be restricted to specific primary variants via `availableFor`.
export const PRIMARY_VARIANT_TYPES = ['scent', 'flavor'];

export function pickDefaultPrimary(variants?: ProductVariant[]): ProductVariant | null {
  if (!variants?.length) return null;
  const primary = variants.filter((v) => PRIMARY_VARIANT_TYPES.includes(v.type));
  if (primary.length) return primary.find((v) => v.isDefault) ?? primary[0];
  return variants.find((v) => v.isDefault) ?? variants[0];
}

export function sizesFor(variants: ProductVariant[] | undefined, primary: ProductVariant | null): ProductVariant[] {
  return (variants?.filter((v) => v.type === 'size') ?? []).filter(
    (v) => !v.availableFor?.length || !primary || v.availableFor.includes(primary.id)
  );
}

export function pickDefaultSize(variants: ProductVariant[] | undefined, primary: ProductVariant | null): ProductVariant | null {
  const sizes = sizesFor(variants, primary);
  return sizes.find((v) => v.isDefault) ?? sizes[0] ?? null;
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

export function getEffectivePrice(product: Product): number {
  const { variant, size } = pickDefaultCombo(product);
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
    return {
      ...primary,
      id: variantId,
      label: `${primary.label} · ${size.label}`,
      price: primary.price + size.price,
      stock: primary.stockBySize?.[size.id] ?? size.stock ?? primary.stock,
      images,
      imageUrl: primary.imageUrl ?? size.imageUrl,
    };
  }

  return variants.find((v) => v.id === variantId);
}
