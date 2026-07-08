import { Product } from '../db/models/Product';
import { resolveVariantPricing, type ResolvedVariantPricing } from './productVariants';

type ProductStockLike = Parameters<typeof resolveVariantPricing>[0];

type StockLikeVariant = {
  id: string;
  type: string;
  stock: number;
  stockBySize?: Record<string, number>;
  availableFor?: string[];
};

/** Mirrors the admin form's `sumVariantStock`: the product-level `stock` field is a denormalized
 * total used by the storefront catalog card and the admin low-stock dashboard, neither of which
 * look at individual variants. Keep it in sync whenever a variant's stock changes, the same way
 * saving the product through the admin UI would. In sabor×tamaño matrix products, stock lives per
 * combo (`stockBySize`, falling back to the tamaño's own stock) - not on the sabor/tamaño rows
 * themselves. */
function computeTotalStock(product: { stock: number; variants?: StockLikeVariant[] }): number {
  const variants = product.variants;
  if (!variants?.length) return product.stock;
  const sizes = variants.filter((v) => v.type === 'size');
  const primaries = variants.filter((v) => v.type !== 'size');
  if (!sizes.length || !primaries.length) return variants.reduce((sum, v) => sum + (v.stock || 0), 0);

  let total = 0;
  for (const p of primaries) {
    for (const s of sizes) {
      // `availableFor` missing means "active for everyone"; an *empty* array means "active for
      // no one" and must not be treated as no restriction just because its length is falsy.
      if (s.availableFor && !s.availableFor.includes(p.id)) continue;
      total += p.stockBySize?.[s.id] ?? s.stock ?? 0;
    }
  }
  return total;
}

export function resolveStockTarget(
  product: ProductStockLike,
  variantId?: string,
): Pick<ResolvedVariantPricing, 'stock' | 'stockVariantId' | 'stockField'> {
  const { stock, stockVariantId, stockField } = resolveVariantPricing(product, variantId);
  return { stock, stockVariantId, stockField };
}

export async function decrementStock(
  productId: string,
  qty: number,
  variantId?: string,
): Promise<boolean> {
  if (qty <= 0) return true;

  const product = await Product.findOne({ id: productId }).lean();
  if (!product) return false;

  const { stockVariantId, stockField } = resolveVariantPricing(product, variantId);

  if (stockVariantId) {
    const field = stockField ?? 'stock';
    const updated = await Product.findOneAndUpdate(
      {
        id: productId,
        variants: { $elemMatch: { id: stockVariantId, [field]: { $gte: qty } } },
      },
      { $inc: { [`variants.$.${field}`]: -qty } },
      { returnDocument: 'after' },
    ).lean();
    if (!updated) return false;
    await Product.updateOne({ id: productId }, { $set: { stock: computeTotalStock(updated) } });
    return true;
  }

  const updated = await Product.findOneAndUpdate(
    { id: productId, stock: { $gte: qty } },
    { $inc: { stock: -qty } },
  );
  return !!updated;
}

export function assertStockAvailable(
  product: ProductStockLike,
  qty: number,
  variantId?: string,
): void {
  const { stock } = resolveVariantPricing(product, variantId);
  if (stock < qty) {
    throw new Error(`Stock insuficiente para ${product.name}`);
  }
}

export function validateCartStock(
  products: ProductStockLike[],
  items: { productId: string; qty: number; variantId?: string; isSample?: boolean }[],
): void {
  const totals = new Map<string, number>();

  for (const item of items) {
    if (item.isSample) continue;
    const key = `${item.productId}::${item.variantId || ''}`;
    totals.set(key, (totals.get(key) || 0) + item.qty);
  }

  for (const [key, qty] of totals) {
    const [productId, variantId = ''] = key.split('::');
    const product = products.find((entry) => entry.id === productId);
    if (!product) throw new Error('Product not found');
    assertStockAvailable(product, qty, variantId || undefined);
  }
}
