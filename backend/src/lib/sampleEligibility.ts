import { getVariantCombos, hasTwoDimensions, resolveVariantPricing } from './productVariants';

// Mirrors the local VariantLike/ProductLike shape productVariants.ts itself works with (not
// exported from there - see lib/lowStock.ts for the same pattern).
type VariantLike = {
  id: string;
  label: string;
  type: string;
  price: number;
  priceBySize?: Record<string, number>;
  stock: number;
  stockBySize?: Record<string, number>;
  availableFor?: string[];
};

type ProductLike = {
  id: string;
  name: string;
  price: number;
  stock: number;
  variants?: VariantLike[];
  category: string;
  taxExempt?: boolean;
  images?: Array<{ url: string; isPrimary?: boolean }>;
  imageUrl?: string;
  /** Tri-state manual override - see Product.ts. */
  sampleEligible?: boolean | null;
};

export type SampleCell = {
  productId: string;
  /** null for a product with no variants - matches resolveVariantPricing's own convention. */
  variantId: string | null;
  label: string | null;
  price: number;
  stock: number;
};

/** Every purchasable cell of a product (product-level, simple variant, or sabor×tamaño combo)
 * with its resolved price/stock - same cell granularity as enumerateStockCells (lib/lowStock.ts),
 * since a sample offered here must also actually have stock. */
export function enumerateSampleCells(product: ProductLike): SampleCell[] {
  const variants = product.variants;
  if (!variants?.length) {
    return [{ productId: product.id, variantId: null, label: null, price: product.price, stock: product.stock }];
  }

  if (hasTwoDimensions(variants)) {
    return getVariantCombos(variants).map(({ primary, size }) => {
      const variantId = `${primary.id}:${size.id}`;
      const resolved = resolveVariantPricing(product, variantId);
      return { productId: product.id, variantId, label: resolved.label ?? null, price: resolved.price, stock: resolved.stock };
    });
  }

  return variants.map((variant) => {
    const resolved = resolveVariantPricing(product, variant.id);
    return { productId: product.id, variantId: variant.id, label: resolved.label ?? null, price: resolved.price, stock: resolved.stock };
  });
}

/** Club Healthora "muestra gratis" (issue #151): a cell qualifies if the admin didn't force an
 * override (`sampleEligible` true/false forces every cell of the product in/out regardless of
 * price) or, absent an override, if its resolved price is within `sampleMaxPrice`. Stock is the
 * caller's responsibility (different callers want it filtered differently - the public listing
 * drops out-of-stock cells entirely, checkout re-validates a single cell against live stock). */
export function getEligibleSampleCells(product: ProductLike, sampleMaxPrice: number): SampleCell[] {
  if (product.sampleEligible === false) return [];
  const cells = enumerateSampleCells(product);
  if (product.sampleEligible === true) return cells;
  return cells.filter((cell) => cell.price <= sampleMaxPrice);
}

/** Single-cell check for checkout, where re-enumerating every cell of the product would be
 * wasteful - only the one requested (productId, variantId) needs validating. */
export function isSampleCellEligible(product: ProductLike, variantId: string | undefined, sampleMaxPrice: number): boolean {
  if (product.sampleEligible === false) return false;
  if (product.sampleEligible === true) return true;
  const resolved = resolveVariantPricing(product, variantId);
  return resolved.price <= sampleMaxPrice;
}
