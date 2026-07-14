import type { Context } from 'hono';
import { Product } from '../db/models/Product';
import { validatePromotionForCart } from './promotions';
import { buildPaidLineItem } from './productVariants';

type PaidLineItem = ReturnType<typeof buildPaidLineItem>;
import { validateCartStock } from './inventory';
import { resolveShipping, type ResolvedShipping, type ShippingMethod } from './shipping';
import { computeItbms } from './tax';

type CheckoutBody = {
  items: { productId: string; qty: number; variantId?: string }[];
  address: { name: string; phone: string; address?: string; city?: string; postal?: string };
  promoCode?: string;
  freeSampleId?: string;
  shippingMethod: ShippingMethod;
};

type PricingUser = { clerkId: string };

export type CheckoutPricing = {
  address: { name: string; phone: string; address: string; city: string; postal: string };
  lineItems: PaidLineItem[];
  freeSampleProduct: { id: string } | null;
  subtotal: number;
  discountAmount: number;
  promoCodeApplied: string;
  discountedSubtotal: number;
  tax: number;
  shippingResolved: ResolvedShipping;
  shipping: number;
  total: number;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Shared by /checkout/session (hosted Checkout) and /checkout/payment-intent (embedded Elements) -
 * both need the exact same subtotal/discount/tax/shipping/total math. Duplicating this risked the
 * two checkouts silently charging different totals for the same cart.
 */
export async function computeCheckoutPricing(
  c: Context,
  body: CheckoutBody,
  user: PricingUser,
): Promise<{ success: true; data: CheckoutPricing } | { success: false; response: Response }> {
  const { items, promoCode, freeSampleId, shippingMethod } = body;
  const address = {
    name: body.address.name,
    phone: body.address.phone,
    address: body.address.address || '',
    city: body.address.city || '',
    postal: body.address.postal || '',
  };

  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await Product.find({ id: { $in: productIds }, active: true }).lean();
  if (products.length !== productIds.length) {
    return { success: false, response: c.json({ error: 'One or more products not found' }, 400) };
  }

  let freeSampleProduct: { id: string } | null = null;
  if (freeSampleId) {
    freeSampleProduct = await Product.findOne({ id: freeSampleId, active: true }).select('id').lean();
  }

  let lineItems: PaidLineItem[];
  try {
    validateCartStock(products, items);
    lineItems = items.map((item) => {
      const p = products.find((product) => product.id === item.productId);
      if (!p) throw new Error('Product not found');
      return buildPaidLineItem(p, item);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid cart item';
    return { success: false, response: c.json({ error: message }, 400) };
  }

  const subtotal = roundMoney(lineItems.reduce((s, i) => s + i.price * i.qty, 0));
  const promotion = promoCode
    ? await validatePromotionForCart(promoCode, items, { customerId: user.clerkId })
    : null;

  if (promoCode && (!promotion || !promotion.valid)) {
    return {
      success: false,
      response: c.json({ error: promotion && !promotion.valid ? promotion.error : 'Código inválido o sin productos elegibles' }, 400),
    };
  }

  const discountAmount = promotion?.valid ? promotion.discountAmount : 0;
  const promoCodeApplied = promotion?.valid ? promotion.code : '';
  const discountedSubtotal = roundMoney(Math.max(0, subtotal - discountAmount));
  const tax = computeItbms(lineItems, discountAmount, subtotal);
  const shippingResolved = resolveShipping(shippingMethod, discountedSubtotal);
  const shipping = shippingResolved.cost;
  const total = roundMoney(discountedSubtotal + tax + shipping);

  return {
    success: true,
    data: {
      address,
      lineItems,
      freeSampleProduct,
      subtotal,
      discountAmount,
      promoCodeApplied,
      discountedSubtotal,
      tax,
      shippingResolved,
      shipping,
      total,
    },
  };
}
