import { Hono } from 'hono';
import { z } from 'zod';
import { clerkAuth } from '../middleware/clerkAuth';
import type { AppEnv } from '../types/hono';
import { Product } from '../db/models/Product';
import { stripe } from '../lib/stripe';
import { getOrCreateStripeCustomer } from '../lib/stripeCustomer';
import { validatePromotionForCart } from '../lib/promotions';
import { cartItemSchema, optionalTextField, orderAddressSchema, parseJson, productIdSchema, requireFullAddress, shippingMethodSchema } from '../lib/validation';
import { buildPaidLineItem } from '../lib/productVariants';
import { validateCartStock } from '../lib/inventory';
import { resolveShipping } from '../lib/shipping';
import { computeItbms } from '../lib/tax';

type CheckoutBody = {
  items: { productId: string; qty: number; variantId?: string }[];
  address: { name: string; phone: string; address?: string; city?: string; postal?: string };
  promoCode?: string;
  freeSampleId?: string;
  shippingMethod: 'delivery' | 'pickup';
};

const checkoutSchema = z.object({
  items: z.array(cartItemSchema).min(1).max(100),
  address: orderAddressSchema,
  promoCode: optionalTextField(40).transform((code) => code?.toUpperCase()),
  freeSampleId: productIdSchema.optional(),
  shippingMethod: shippingMethodSchema,
}).superRefine((body, ctx) => {
  if (body.shippingMethod !== 'pickup') requireFullAddress(ctx, body.address);
});

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export const checkoutRouter = new Hono<AppEnv>()
  .use('*', clerkAuth)
  .post('/session', async (c) => {
    const parsed = await parseJson(c, checkoutSchema);
    if (!parsed.success) return parsed.response;

    const body = parsed.data as CheckoutBody;
    const { items, promoCode, freeSampleId, shippingMethod } = body;
    const address = {
      name: body.address.name,
      phone: body.address.phone,
      address: body.address.address || '',
      city: body.address.city || '',
      postal: body.address.postal || '',
    };
    const user = c.get('user');

    const productIds = [...new Set(items.map((i) => i.productId))];
    const products = await Product.find({ id: { $in: productIds }, active: true }).lean();
    if (products.length !== productIds.length) {
      return c.json({ error: 'One or more products not found' }, 400);
    }

    // Validate free sample product exists if provided
    let freeSampleProduct = null;
    if (freeSampleId) {
      freeSampleProduct = await Product.findOne({ id: freeSampleId, active: true }).lean();
    }

    let lineItems;
    try {
      validateCartStock(products, items);
      lineItems = items.map((item) => {
        const p = products.find((product) => product.id === item.productId);
        if (!p) throw new Error('Product not found');
        return buildPaidLineItem(p, item);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid cart item';
      return c.json({ error: message }, 400);
    }

    const subtotal = roundMoney(lineItems.reduce((s, i) => s + i.price * i.qty, 0));
    const promotion = promoCode
      ? await validatePromotionForCart(
          promoCode,
          items,
          { customerId: user.clerkId },
        )
      : null;

    if (promoCode && (!promotion || !promotion.valid)) {
      return c.json({ error: promotion && !promotion.valid ? promotion.error : 'Código inválido o sin productos elegibles' }, 400);
    }

    const discountAmount = promotion?.valid ? promotion.discountAmount : 0;
    const promoCodeApplied = promotion?.valid ? promotion.code : '';
    const discountedSubtotal = roundMoney(Math.max(0, subtotal - discountAmount));
    const tax = computeItbms(lineItems, discountAmount, subtotal);
    const shippingResolved = resolveShipping(shippingMethod, discountedSubtotal);
    const shipping = shippingResolved.cost;

    try {
      const origin = c.req.header('origin');
      // A Stripe Customer (not just an email) lets the hosted Checkout page show this customer's
      // saved cards (HU-059) and offer to save a new one, instead of always asking for a fresh
      // card number.
      const stripeCustomerId = await getOrCreateStripeCustomer(user.clerkId, user.email, user.name);
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        customer: stripeCustomerId,
        saved_payment_method_options: { payment_method_save: 'enabled' },
        line_items: [
          ...lineItems.map((i) => ({
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(i.price * 100),
            product_data: { name: i.productName },
          },
          quantity: i.qty,
          })),
          ...(shipping > 0 ? [{
            price_data: {
              currency: 'usd',
              unit_amount: Math.round(shipping * 100),
              product_data: { name: `Envío (${shippingResolved.label})` },
            },
            quantity: 1,
          }] : []),
          ...(tax > 0 ? [{
            price_data: {
              currency: 'usd',
              unit_amount: Math.round(tax * 100),
              product_data: { name: 'ITBMS' },
            },
            quantity: 1,
          }] : []),
        ],
        ...(discountAmount > 0 ? {
          discounts: [{
            coupon: await stripe.coupons.create({
              amount_off: Math.round(discountAmount * 100),
              currency: 'usd',
              name: promoCodeApplied,
              duration: 'once',
            }).then((coupon) => coupon.id),
          }],
        } : {}),
        metadata: {
          customerId: user.clerkId,
          customerName: user.name || '',
          customerEmail: user.email || '',
          cartItems: JSON.stringify([
            ...items,
            ...(freeSampleProduct ? [{ productId: freeSampleProduct.id, qty: 1, isSample: true }] : []),
          ]),
          address: JSON.stringify(address),
          discountCode: promoCodeApplied,
          discountAmount: String(discountAmount),
          discountedSubtotal: String(discountedSubtotal),
          tax: String(tax),
          shipping: String(shipping),
          shippingMethod,
          shippingLabel: shippingResolved.label,
          shippingEta: shippingResolved.eta,
        },
        success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/checkout`,
      });

      return c.json({ url: session.url });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stripe error';
      console.error('[CHECKOUT] Stripe session creation failed:', message);
      return c.json({ error: 'Payment service unavailable', details: message }, 502);
    }
  });
