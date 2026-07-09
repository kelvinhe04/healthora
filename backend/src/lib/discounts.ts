export interface DiscountableProduct {
  price: number;
  priceBefore?: number | null;
  discountStartsAt?: Date | string | null;
  discountEndsAt?: Date | string | null;
}

export function isDiscountActive(product: DiscountableProduct, now: Date = new Date()): boolean {
  if (product.priceBefore == null) return false;
  if (product.discountStartsAt && now < new Date(product.discountStartsAt)) return false;
  if (product.discountEndsAt && now > new Date(product.discountEndsAt)) return false;
  return true;
}

export function getEffectivePrice(product: DiscountableProduct, now: Date = new Date()): number {
  return isDiscountActive(product, now) ? product.price : (product.priceBefore ?? product.price);
}

/**
 * Returns the product as it should be displayed/charged right now: outside its discount's
 * validity window, the configured price/priceBefore are hidden so the product behaves as if
 * never discounted (no strikethrough shown, original price charged) without needing a
 * background job to revert the stored fields when the window closes.
 */
export function withEffectiveDiscount<T extends DiscountableProduct>(product: T, now: Date = new Date()): T {
  if (product.priceBefore == null || isDiscountActive(product, now)) return product;
  return { ...product, price: product.priceBefore, priceBefore: undefined };
}
