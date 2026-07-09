import { maybeNotifyLowStock, type LowStockCell } from './realtime';

/** Enumerate a product's stock at the granularity that actually holds units, then alert admins for
 * each cell at/under the threshold (HU-061). This replaces the old product-total check, which
 * masked a critical variant/combo behind a healthy sum (see #153 for the same blindspot in the
 * dashboard). Deduping lives in {@link maybeNotifyLowStock}, so callers can fire this after *any*
 * stock mutation (sale, MCP adjust, admin edit) without worrying about spamming. */

// Mirrors PRIMARY_VARIANT_TYPES in productVariants.ts / lib/inventory.ts: any non-size type can be
// the primary dimension of a matrix.
const PRIMARY_VARIANT_TYPES = ['scent', 'flavor', 'color', 'weight', 'count'];

interface VariantLike {
  id: string;
  label: string;
  type: string;
  stock?: number;
  stockBySize?: Record<string, number>;
  availableFor?: string[];
}

interface ProductLike {
  id: string;
  name?: string;
  stock?: number;
  variants?: VariantLike[];
}

/** Break a product into its stock cells: product-level, per simple variant, or per sabor×tamaño
 * combo (respecting `availableFor`). Matches the enumeration used by `computeTotalStock`. */
export function enumerateStockCells(product: ProductLike): LowStockCell[] {
  const variants = product.variants;
  const productName = product.name ?? null;

  if (!variants?.length) {
    return [{ productId: product.id, productName, variantId: null, variantLabel: null, stock: product.stock ?? 0 }];
  }

  const sizes = variants.filter((v) => v.type === 'size');
  const primaries = variants.filter((v) => PRIMARY_VARIANT_TYPES.includes(v.type));

  // Two-dimensional matrix (sabor/color × tamaño): stock lives per combo, falling back to the
  // tamaño's own stock when a combo has no override.
  if (sizes.length && primaries.length) {
    const cells: LowStockCell[] = [];
    for (const primary of primaries) {
      for (const size of sizes) {
        // `availableFor` missing => available for everyone; an empty array => for no one.
        if (size.availableFor && !size.availableFor.includes(primary.id)) continue;
        const stock = primary.stockBySize?.[size.id] ?? size.stock ?? 0;
        cells.push({
          productId: product.id,
          productName,
          variantId: `${primary.id}:${size.id}`,
          variantLabel: `${primary.label} · ${size.label}`,
          stock,
        });
      }
    }
    return cells;
  }

  // One-dimensional: each variant owns its stock.
  return variants.map((variant) => ({
    productId: product.id,
    productName,
    variantId: variant.id,
    variantLabel: variant.label,
    stock: variant.stock ?? 0,
  }));
}

/** Scan every stock cell of a product and fire a (deduped) low-stock alert for each critical one.
 * Returns the cells that triggered an alert. */
export async function scanAndNotifyLowStock(product: ProductLike, opts: { threshold?: number } = {}) {
  const triggered: LowStockCell[] = [];
  for (const cell of enumerateStockCells(product)) {
    const result = await maybeNotifyLowStock(cell, opts);
    if (result) triggered.push(cell);
  }
  return triggered;
}
