import { Hono } from 'hono';
import { z } from 'zod';
import { clerkAuth } from '../middleware/clerkAuth';
import type { AppEnv } from '../types/hono';
import { Product } from '../db/models/Product';
import { ProductSubscription, SUBSCRIPTION_INTERVAL_DAYS } from '../db/models/ProductSubscription';
import { stripe } from '../lib/stripe';
import { getOrCreateStripeCustomer } from '../lib/stripeCustomer';
import { buildPaidLineItem } from '../lib/productVariants';
import { resolveShipping } from '../lib/shipping';
import { computeItbms } from '../lib/tax';
import {
  intFromInput,
  objectIdSchema,
  optionalTextField,
  orderAddressSchema,
  parseJson,
  parseParams,
  productIdSchema,
  requireFullAddress,
  shippingMethodSchema,
} from '../lib/validation';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

const createSubscriptionSchema = z
  .object({
    productId: productIdSchema,
    variantId: optionalTextField(180),
    qty: intFromInput(1, 10),
    intervalDays: z
      .union(SUBSCRIPTION_INTERVAL_DAYS.map((n) => z.literal(n)) as [z.ZodLiteral<number>, ...z.ZodLiteral<number>[]]),
    address: orderAddressSchema,
    shippingMethod: shippingMethodSchema,
  })
  .superRefine((body, ctx) => {
    if (body.shippingMethod !== 'pickup') requireFullAddress(ctx, body.address);
  });

const idParamsSchema = z.object({ id: objectIdSchema });

export const subscriptionsRouter = new Hono<AppEnv>()
  .use('*', clerkAuth)
  .get('/', async (c) => {
    const subs = await ProductSubscription.find({ customerId: c.get('user').clerkId })
      .sort({ createdAt: -1 })
      .lean();
    return c.json(subs);
  })
  .post('/', async (c) => {
    const parsed = await parseJson(c, createSubscriptionSchema);
    if (!parsed.success) return parsed.response;

    const body = parsed.data;
    const user = c.get('user');

    const product = await Product.findOne({ id: body.productId, active: true }).lean();
    if (!product) return c.json({ error: 'Producto no encontrado' }, 404);

    let lineItem;
    try {
      lineItem = buildPaidLineItem(product, {
        productId: body.productId,
        qty: body.qty,
        variantId: body.variantId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Producto/variante inválido';
      return c.json({ error: message }, 400);
    }

    const subtotal = roundMoney(lineItem.price * lineItem.qty);
    const tax = computeItbms([lineItem], 0, subtotal);
    const shippingResolved = resolveShipping(body.shippingMethod, subtotal);
    const shipping = shippingResolved.cost;
    const total = roundMoney(subtotal + tax + shipping);

    const address = {
      name: body.address.name,
      phone: body.address.phone,
      address: body.address.address || '',
      city: body.address.city || '',
      postal: body.address.postal || '',
    };

    try {
      const origin = c.req.header('origin');
      const stripeCustomerId = await getOrCreateStripeCustomer(user.clerkId, user.email, user.name);

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        customer: stripeCustomerId,
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: Math.round(total * 100),
              recurring: { interval: 'day', interval_count: body.intervalDays },
              product_data: {
                name: `${lineItem.productName} — reposición cada ${body.intervalDays} días`,
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          customerId: user.clerkId,
          customerName: user.name || '',
          customerEmail: user.email || '',
          productId: lineItem.productId,
          productName: lineItem.productName,
          variantId: lineItem.variantId || '',
          variantLabel: lineItem.variantLabel || '',
          imageUrl: lineItem.imageUrl,
          category: lineItem.category,
          taxExempt: String(lineItem.taxExempt),
          qty: String(lineItem.qty),
          unitPrice: String(lineItem.price),
          subtotal: String(subtotal),
          tax: String(tax),
          shipping: String(shipping),
          total: String(total),
          intervalDays: String(body.intervalDays),
          shippingMethod: body.shippingMethod,
          shippingLabel: shippingResolved.label,
          shippingEta: shippingResolved.eta,
          address: JSON.stringify(address),
        },
        success_url: `${origin}/profile?subscribed=1`,
        cancel_url: `${origin}/product/${body.productId}`,
      });

      return c.json({ url: session.url });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stripe error';
      console.error('[SUBSCRIPTIONS] Stripe session creation failed:', message);
      return c.json({ error: 'Payment service unavailable', details: message }, 502);
    }
  })
  .post('/:id/pause', async (c) => {
    const parsedParams = parseParams(c, idParamsSchema);
    if (!parsedParams.success) return parsedParams.response;

    const sub = await ProductSubscription.findOne({
      _id: parsedParams.data.id,
      customerId: c.get('user').clerkId,
    });
    if (!sub) return c.json({ error: 'Suscripción no encontrada' }, 404);
    if (sub.status === 'canceled') return c.json({ error: 'Esta suscripción ya está cancelada' }, 400);

    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      pause_collection: { behavior: 'void' },
    });
    sub.status = 'paused';
    await sub.save();

    return c.json(sub);
  })
  .post('/:id/resume', async (c) => {
    const parsedParams = parseParams(c, idParamsSchema);
    if (!parsedParams.success) return parsedParams.response;

    const sub = await ProductSubscription.findOne({
      _id: parsedParams.data.id,
      customerId: c.get('user').clerkId,
    });
    if (!sub) return c.json({ error: 'Suscripción no encontrada' }, 404);
    if (sub.status === 'canceled') return c.json({ error: 'Esta suscripción ya está cancelada' }, 400);

    await stripe.subscriptions.update(sub.stripeSubscriptionId, { pause_collection: null });
    sub.status = 'active';
    await sub.save();

    return c.json(sub);
  })
  .delete('/:id', async (c) => {
    const parsedParams = parseParams(c, idParamsSchema);
    if (!parsedParams.success) return parsedParams.response;

    const sub = await ProductSubscription.findOne({
      _id: parsedParams.data.id,
      customerId: c.get('user').clerkId,
    });
    if (!sub) return c.json({ error: 'Suscripción no encontrada' }, 404);
    if (sub.status === 'canceled') return c.json(sub);

    await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
    sub.status = 'canceled';
    await sub.save();

    return c.json(sub);
  });
