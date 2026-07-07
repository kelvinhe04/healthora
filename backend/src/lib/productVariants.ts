type ProductVariant = {
  id: string;
  label: string;
  type: string;
  price: number;
  stock: number;
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

const PRIMARY_VARIANT_TYPES = ['scent', 'flavor'];

export type ResolvedVariantPricing = {
  price: number;
  stock: number;
  label?: string;
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
    return {
      price: primary.price + size.price,
      stock: size.stock ?? primary.stock ?? product.stock,
      label: `${primary.label} · ${size.label}`,
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
  };
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
    imageUrl: primaryImage,
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
