import { Hono } from 'hono';
import { z } from 'zod';
import { clerkAuth } from '../middleware/clerkAuth';
import type { AppEnv } from '../types/hono';
import { Product } from '../db/models/Product';
import { Order } from '../db/models/Order';
import { stripe } from '../lib/stripe';
import { getPromotion } from '../lib/promotions';
import { addressSchema, cartItemSchema, optionalTextField, parseJson, productIdSchema, shippingMethodSchema } from '../lib/validation';
import { buildPaidLineItem } from '../lib/productVariants';
import { validateCartStock } from '../lib/inventory';
import { resolveShipping } from '../lib/shipping';

type CheckoutBody = {
  items: { productId: string; qty: number; variantId?: string }[];
  address: { name: string; phone: string; address: string; city: string; postal: string };
  promoCode?: string;
  freeSampleId?: string;
  shippingMethod: 'delivery' | 'pickup';
};

const checkoutSchema = z.object({
  items: z.array(cartItemSchema).min(1).max(100),
  address: addressSchema,
  promoCode: optionalTextField(40).transform((code) => code?.toUpperCase()),
  freeSampleId: productIdSchema.optional(),
  shippingMethod: shippingMethodSchema,
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
    const { items, address, promoCode, freeSampleId, shippingMethod } = body;
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
      ? getPromotion(promoCode, lineItems.map((item) => ({ product: { category: products.find((product) => product.id === item.productId)?.category || '', price: item.price }, qty: item.qty })))
      : null;

    if (promoCode && !promotion) {
      return c.json({ error: 'Código inválido o sin productos elegibles' }, 400);
    }

    if (promotion?.code === 'BIENVENIDA') {
      const previousPaidOrder = await Order.findOne({
        customerId: user.clerkId,
        $or: [{ paymentStatus: 'paid' }, { status: 'paid' }],
      }).select('_id').lean();

      if (previousPaidOrder) {
        return c.json({ error: 'BIENVENIDA solo aplica en tu primera compra.' }, 400);
      }
    }

    const discountAmount = promotion?.discountAmount ?? 0;
    const discountedSubtotal = roundMoney(Math.max(0, subtotal - discountAmount));
    const tax = roundMoney(discountedSubtotal * 0.07);
    const shippingResolved = resolveShipping(shippingMethod, discountedSubtotal);
    const shipping = shippingResolved.cost;

    try {
      const origin = c.req.header('origin');
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: user.email,
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
              product_data: { name: 'Impuestos' },
            },
            quantity: 1,
          }] : []),
        ],
        ...(discountAmount > 0 ? {
          discounts: [{
            coupon: await stripe.coupons.create({
              amount_off: Math.round(discountAmount * 100),
              currency: 'usd',
              name: promotion?.code,
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
          discountCode: promotion?.code || '',
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
