import { Hono } from 'hono';
import { z } from 'zod';
import { clerkAuth } from '../middleware/clerkAuth';
import type { AppEnv } from '../types/hono';
import { stripe } from '../lib/stripe';
import { getOrCreateStripeCustomer } from '../lib/stripeCustomer';
import { cartItemSchema, optionalTextField, orderAddressSchema, parseJson, productIdSchema, requireFullAddress, shippingMethodSchema } from '../lib/validation';
import { computeCheckoutPricing } from '../lib/checkoutPricing';

type CheckoutBody = {
  items: { productId: string; qty: number; variantId?: string }[];
  address: { name: string; phone: string; address?: string; city?: string; postal?: string };
  promoCode?: string;
  freeSampleId?: string;
  freeSampleVariantId?: string;
  usePoints?: boolean;
  shippingMethod: 'delivery' | 'pickup';
};

const checkoutSchema = z.object({
  items: z.array(cartItemSchema).min(1).max(100),
  address: orderAddressSchema,
  promoCode: optionalTextField(40).transform((code) => code?.toUpperCase()),
  freeSampleId: productIdSchema.optional(),
  freeSampleVariantId: optionalTextField(180),
  usePoints: z.coerce.boolean().optional(),
  shippingMethod: shippingMethodSchema,
}).superRefine((body, ctx) => {
  if (body.shippingMethod !== 'pickup') requireFullAddress(ctx, body.address);
});

export const checkoutRouter = new Hono<AppEnv>()
  .use('*', clerkAuth)
  .post('/session', async (c) => {
    const parsed = await parseJson(c, checkoutSchema);
    if (!parsed.success) return parsed.response;

    const body = parsed.data as CheckoutBody;
    const user = c.get('user');

    const pricing = await computeCheckoutPricing(c, body, user);
    if (!pricing.success) return pricing.response;
    const { address, lineItems, freeSampleProduct, discountAmount, promoCodeApplied, loyaltyPointsRedeemed, loyaltyDiscountAmount, discountedSubtotal, tax, shippingResolved, shipping } = pricing.data;
    const { items, shippingMethod } = body;
    const totalDiscountCents = Math.round((discountAmount + loyaltyDiscountAmount) * 100);

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
        ...(totalDiscountCents > 0 ? {
          discounts: [{
            coupon: await stripe.coupons.create({
              amount_off: totalDiscountCents,
              currency: 'usd',
              name: [promoCodeApplied, loyaltyDiscountAmount > 0 ? 'Puntos Club Healthora' : ''].filter(Boolean).join(' + ') || 'Descuento',
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
            ...(freeSampleProduct ? [{ productId: freeSampleProduct.id, qty: 1, isSample: true, variantId: freeSampleProduct.variantId }] : []),
          ]),
          address: JSON.stringify(address),
          discountCode: promoCodeApplied,
          discountAmount: String(discountAmount),
          loyaltyPointsRedeemed: String(loyaltyPointsRedeemed),
          loyaltyDiscountAmount: String(loyaltyDiscountAmount),
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
  })
  .post('/payment-intent', async (c) => {
    const parsed = await parseJson(c, checkoutSchema);
    if (!parsed.success) return parsed.response;

    const body = parsed.data as CheckoutBody;
    const user = c.get('user');

    const pricing = await computeCheckoutPricing(c, body, user);
    if (!pricing.success) return pricing.response;
    const { address, freeSampleProduct, discountAmount, promoCodeApplied, loyaltyPointsRedeemed, loyaltyDiscountAmount, discountedSubtotal, tax, shippingResolved, shipping, total } = pricing.data;
    const { items, shippingMethod } = body;

    try {
      const stripeCustomerId = await getOrCreateStripeCustomer(user.clerkId, user.email, user.name);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(total * 100),
        currency: 'usd',
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        metadata: {
          source: 'elements',
          customerId: user.clerkId,
          customerName: user.name || '',
          customerEmail: user.email || '',
          cartItems: JSON.stringify([
            ...items,
            ...(freeSampleProduct ? [{ productId: freeSampleProduct.id, qty: 1, isSample: true, variantId: freeSampleProduct.variantId }] : []),
          ]),
          address: JSON.stringify(address),
          discountCode: promoCodeApplied,
          discountAmount: String(discountAmount),
          loyaltyPointsRedeemed: String(loyaltyPointsRedeemed),
          loyaltyDiscountAmount: String(loyaltyDiscountAmount),
          discountedSubtotal: String(discountedSubtotal),
          tax: String(tax),
          shipping: String(shipping),
          shippingMethod,
          shippingLabel: shippingResolved.label,
          shippingEta: shippingResolved.eta,
        },
      });

      return c.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stripe error';
      console.error('[CHECKOUT] PaymentIntent creation failed:', message);
      return c.json({ error: 'Payment service unavailable', details: message }, 502);
    }
  });
