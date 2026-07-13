import { Coupon } from '../db/models/Coupon';
import { Order } from '../db/models/Order';
import { Product } from '../db/models/Product';
import { resolveVariantPricing } from './productVariants';

export type PromotionLineItem = {
  product: { category: string; price: number };
  qty: number;
};

export type PromotionResult = {
  code: string;
  label: string;
  discountAmount: number;
};

export type PromotionValidation =
  | (PromotionResult & { valid: true })
  | { valid: false; error: string; reason: 'not_found' | 'expired' | 'inactive' | 'no_eligible_items' | 'first_purchase_only' | 'max_uses' };

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizePromotionCode(code: string): string {
  return code.trim().toUpperCase();
}

export function buildPromotionLineItems(
  products: Array<{
    id: string;
    category: string;
    price: number;
    stock: number;
    variants?: Parameters<typeof resolveVariantPricing>[0]['variants'];
  }>,
  items: { productId: string; qty: number; variantId?: string }[],
): PromotionLineItem[] {
  return items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product) throw new Error(`Producto "${item.productId}" no encontrado`);
    const pricing = resolveVariantPricing(product, item.variantId);
    return {
      product: { category: product.category, price: pricing.price },
      qty: item.qty,
    };
  });
}

function computeDiscountAmount(
  coupon: {
    discountType: string;
    percentOff?: number | null;
    amountOff?: number | null;
    eligibleCategories?: string[] | null;
  },
  items: PromotionLineItem[],
): number {
  const categories = coupon.eligibleCategories?.filter(Boolean) ?? [];
  const eligibleSubtotal = items.reduce((sum, item) => {
    const isEligible = categories.length === 0 || categories.includes(item.product.category);
    return isEligible ? sum + item.product.price * item.qty : sum;
  }, 0);

  if (eligibleSubtotal <= 0) return 0;

  if (coupon.discountType === 'fixed') {
    return roundMoney(Math.min(eligibleSubtotal, coupon.amountOff ?? 0));
  }

  return roundMoney(eligibleSubtotal * ((coupon.percentOff ?? 0) / 100));
}

export async function validatePromotion(
  code: string,
  items: PromotionLineItem[],
  options?: { customerId?: string },
): Promise<PromotionValidation> {
  const normalizedCode = normalizePromotionCode(code);
  if (!normalizedCode) {
    return { valid: false, error: 'Ingresa un código de descuento.', reason: 'not_found' };
  }

  const coupon = await Coupon.findOne({ code: normalizedCode }).lean();
  if (!coupon) {
    return { valid: false, error: 'Código inválido.', reason: 'not_found' };
  }

  if (coupon.active === false) {
    return { valid: false, error: 'Este cupón ya no está activo.', reason: 'inactive' };
  }

  if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt)) {
    return { valid: false, error: 'Este cupón expiró.', reason: 'expired' };
  }

  if (coupon.maxUses != null && coupon.usesCount >= coupon.maxUses) {
    return { valid: false, error: 'Este cupón alcanzó su límite de usos.', reason: 'max_uses' };
  }

  if (coupon.firstPurchaseOnly && options?.customerId) {
    const previousPaidOrder = await Order.findOne({
      customerId: options.customerId,
      $or: [{ paymentStatus: 'paid' }, { status: 'paid' }],
    })
      .select('_id')
      .lean();
    if (previousPaidOrder) {
      return {
        valid: false,
        error: `${normalizedCode} solo aplica en tu primera compra.`,
        reason: 'first_purchase_only',
      };
    }
  }

  const discountAmount = computeDiscountAmount(coupon, items);
  if (discountAmount <= 0) {
    return {
      valid: false,
      error: 'Código sin productos elegibles en tu carrito.',
      reason: 'no_eligible_items',
    };
  }

  return {
    valid: true,
    code: normalizedCode,
    label: coupon.label,
    discountAmount,
  };
}

/** Loads products and validates a cart + promo code end-to-end. */
export async function validatePromotionForCart(
  code: string,
  cartItems: { productId: string; qty: number; variantId?: string }[],
  options?: { customerId?: string },
): Promise<PromotionValidation> {
  const productIds = [...new Set(cartItems.map((i) => i.productId))];
  const products = await Product.find({ id: { $in: productIds }, active: true }).lean();
  if (products.length !== productIds.length) {
    return { valid: false, error: 'Uno o más productos del carrito no están disponibles.', reason: 'not_found' };
  }

  const lineItems = buildPromotionLineItems(products, cartItems);
  return validatePromotion(code, lineItems, options);
}

export async function recordCouponRedemption(code: string): Promise<void> {
  const normalizedCode = normalizePromotionCode(code);
  if (!normalizedCode) return;
  await Coupon.updateOne({ code: normalizedCode }, { $inc: { usesCount: 1 } });
}
