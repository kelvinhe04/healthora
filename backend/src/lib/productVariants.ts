type ProductVariant = {
  id: string;
  label: string;
  type: string;
  price: number;
  stock: number;
  imageUrl?: string;
  images?: string[];
  imagesBySize?: Record<string, string[]>;
  stockBySize?: Record<string, number>;
  availableFor?: string[];
};

type ProductLike = {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  imageUrl?: string;
  images?: Array<{ url: string; isPrimary?: boolean }>;
  variants?: ProductVariant[];
};

// Mirrors frontend/src/lib/productVariants.ts - any non-size type can be the primary dimension
// of a sabor/color x tamaño matrix, not just scent/flavor.
const PRIMARY_VARIANT_TYPES = ['scent', 'flavor', 'color', 'weight', 'count'];

export type ResolvedVariantPricing = {
  price: number;
  stock: number;
  label?: string;
  /** Variant document id whose stock should be decremented; omit for product-level stock. */
  stockVariantId?: string;
  /** Dot-path within the stockVariantId's variant subdocument to decrement; defaults to 'stock'. */
  stockField?: string;
};

export function resolveVariantPricing(product: ProductLike, variantId?: string): ResolvedVariantPricing {
  if (!variantId?.trim() || !product.variants?.length) {
    return { price: product.price, stock: product.stock };
  }

  if (variantId.includes(':')) {
    const [primaryId, sizeId] = variantId.split(':');
    const primary = product.variants.find((v) => v.id === primaryId);
    const size = product.variants.find((v) => v.id === sizeId);
    if (!primary || !size) {
      throw new Error(`Variante invalida para ${product.name}`);
    }
    const stockOverride = primary.stockBySize?.[size.id];
    const stock = stockOverride ?? size.stock ?? primary.stock ?? product.stock;
    const stockVariantId =
      stockOverride != null
        ? primary.id
        : size.stock != null
          ? size.id
          : primary.stock != null
            ? primary.id
            : undefined;
    const stockField = stockOverride != null ? `stockBySize.${size.id}` : undefined;
    return {
      price: primary.price + size.price,
      stock,
      label: `${primary.label} · ${size.label}`,
      stockVariantId,
      stockField,
    };
  }

  const variant = product.variants.find((v) => v.id === variantId);
  if (!variant) {
    throw new Error(`Variante invalida para ${product.name}`);
  }

  return {
    price: variant.price,
    stock: variant.stock ?? product.stock,
    label: variant.label,
    stockVariantId: variant.stock != null ? variant.id : undefined,
  };
}

/** Resolves the correct photo for a purchased combo, falling back to the product's own primary image. */
export function resolveVariantImage(product: ProductLike, variantId?: string): string {
  const fallback =
    product.images?.find((img) => img.isPrimary)?.url ||
    product.images?.[0]?.url ||
    product.imageUrl ||
    '';

  if (!variantId?.trim() || !product.variants?.length) return fallback;

  if (variantId.includes(':')) {
    const [primaryId, sizeId] = variantId.split(':');
    const primary = product.variants.find((v) => v.id === primaryId);
    const size = product.variants.find((v) => v.id === sizeId);
    if (!primary || !size) return fallback;
    const bySize = primary.imagesBySize?.[size.id];
    return bySize?.[0] || primary.images?.[0] || primary.imageUrl || size.images?.[0] || size.imageUrl || fallback;
  }

  const variant = product.variants.find((v) => v.id === variantId);
  if (!variant) return fallback;
  return variant.images?.[0] || variant.imageUrl || fallback;
}

export function buildPaidLineItem(
  product: ProductLike,
  item: { productId: string; qty: number; variantId?: string; isSample?: boolean },
) {
  const primaryImage =
    product.images?.find((img) => img.isPrimary)?.url ||
    product.images?.[0]?.url ||
    product.imageUrl ||
    '';

  if (item.isSample) {
    return {
      productId: product.id,
      productName: product.name,
      qty: item.qty,
      price: 0,
      imageUrl: primaryImage,
      category: product.category,
      isSample: true,
    };
  }

  const resolved = resolveVariantPricing(product, item.variantId);
  if (resolved.stock < item.qty) {
    throw new Error(`Stock insuficiente para ${product.name}`);
  }

  return {
    productId: product.id,
    productName: resolved.label ? `${product.name} · ${resolved.label}` : product.name,
    qty: item.qty,
    price: resolved.price,
    imageUrl: resolveVariantImage(product, item.variantId),
    category: product.category,
    isSample: false,
    variantId: item.variantId,
    variantLabel: resolved.label,
  };
}

export function hasTwoDimensions(variants?: ProductVariant[]): boolean {
  if (!variants?.length) return false;
  return variants.some((v) => PRIMARY_VARIANT_TYPES.includes(v.type)) && variants.some((v) => v.type === 'size');
}

/** Mirrors frontend/src/lib/productVariants.ts getTotalStock. Sum of stock across every
 * purchasable option: every simple variant, or every active sabor×tamaño combo in matrix mode
 * (using each combo's `stockBySize` override when set, falling back to the tamaño's own stock).
 * Computed live from `variants` rather than trusting the persisted `product.stock` - that field
 * is a denormalized cache written at save time and goes stale as soon as combo stock changes. */
export function getTotalStock(product: Pick<ProductLike, 'stock' | 'variants'>): number {
  const variants = product.variants;
  if (!variants?.length) return product.stock;
  const sizes = variants.filter((v) => v.type === 'size');
  const primaries = variants.filter((v) => PRIMARY_VARIANT_TYPES.includes(v.type));
  if (!sizes.length || !primaries.length) return variants.reduce((sum, v) => sum + (v.stock || 0), 0);
  let total = 0;
  for (const p of primaries) {
    const availableSizes = sizes.filter((s) => !s.availableFor || s.availableFor.includes(p.id));
    for (const s of availableSizes) {
      total += p.stockBySize?.[s.id] ?? s.stock ?? 0;
    }
  }
  return total;
}
