import type { Context } from 'hono';
import { Product } from '../db/models/Product';
import { validatePromotionForCart } from './promotions';
import { buildPaidLineItem, resolveVariantPricing } from './productVariants';

type PaidLineItem = ReturnType<typeof buildPaidLineItem>;
import { validateCartStock } from './inventory';
import { resolveShipping, type ResolvedShipping, type ShippingMethod } from './shipping';
import { computeItbms } from './tax';
import { getSettings } from '../db/models/Settings';
import { isSampleCellEligible } from './sampleEligibility';
import { User } from '../db/models/User';
import { computeRedeemablePoints, getLoyaltyRates } from './loyalty';

type CheckoutBody = {
  items: { productId: string; qty: number; variantId?: string }[];
  address: { name: string; phone: string; address?: string; city?: string; postal?: string };
  promoCode?: string;
  freeSampleId?: string;
  freeSampleVariantId?: string;
  usePoints?: boolean;
  shippingMethod: ShippingMethod;
};

type PricingUser = { clerkId: string };

export type CheckoutPricing = {
  address: { name: string; phone: string; address: string; city: string; postal: string };
  lineItems: PaidLineItem[];
  freeSampleProduct: { id: string; variantId?: string; label?: string } | null;
  subtotal: number;
  discountAmount: number;
  promoCodeApplied: string;
  loyaltyPointsRedeemed: number;
  loyaltyDiscountAmount: number;
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
  const { items, promoCode, freeSampleId, freeSampleVariantId, usePoints, shippingMethod } = body;
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

  // Eligibility (price cap + manual override) and stock are re-checked here, not just filtered
  // client-side in SamplePicker.tsx (issue #151) - otherwise a crafted freeSampleId/
  // freeSampleVariantId could get any product/variant for free regardless of price or what the
  // admin excluded.
  let freeSampleProduct: { id: string; variantId?: string; label?: string } | null = null;
  if (freeSampleId) {
    const sampleProduct = await Product.findOne({ id: freeSampleId, active: true }).lean();
    if (sampleProduct) {
      try {
        const settings = await getSettings();
        const resolved = resolveVariantPricing(sampleProduct, freeSampleVariantId);
        if (resolved.stock > 0 && isSampleCellEligible(sampleProduct, freeSampleVariantId, settings.sampleMaxPrice)) {
          freeSampleProduct = { id: sampleProduct.id, variantId: freeSampleVariantId, label: resolved.label };
        }
      } catch {
        // Invalid/manipulated freeSampleVariantId - fall back to no free sample instead of 500ing
        // the whole checkout over it.
      }
    }
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

  // Canje de puntos del Club (HU-060): todo-o-nada, capado a lo que queda del subtotal despues del
  // cupon - nunca deja el pedido en negativo ni se calcula en base a tax/shipping.
  let loyaltyPointsRedeemed = 0;
  let loyaltyDiscountAmount = 0;
  if (usePoints) {
    const [settings, dbUser] = await Promise.all([
      getSettings(),
      User.findOne({ clerkId: user.clerkId }).select('loyaltyPoints').lean(),
    ]);
    const { pointValueCents } = getLoyaltyRates(settings);
    const subtotalAfterCoupon = roundMoney(Math.max(0, subtotal - discountAmount));
    const redeemable = computeRedeemablePoints({
      availablePoints: dbUser?.loyaltyPoints ?? 0,
      maxDiscountCents: Math.round(subtotalAfterCoupon * 100),
      pointValueCents,
    });
    loyaltyPointsRedeemed = redeemable.pointsToRedeem;
    loyaltyDiscountAmount = roundMoney(redeemable.discountCents / 100);
  }

  const totalDiscount = roundMoney(discountAmount + loyaltyDiscountAmount);
  const discountedSubtotal = roundMoney(Math.max(0, subtotal - totalDiscount));
  const tax = computeItbms(lineItems, totalDiscount, subtotal);
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
      loyaltyPointsRedeemed,
      loyaltyDiscountAmount,
      discountedSubtotal,
      tax,
      shippingResolved,
      shipping,
      total,
    },
  };
}
