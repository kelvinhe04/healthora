import { Product } from '../db/models/Product';
import { resolveVariantPricing, type ResolvedVariantPricing } from './productVariants';

type ProductStockLike = Parameters<typeof resolveVariantPricing>[0];

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
    );
    return !!updated;
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
