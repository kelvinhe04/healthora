import { Hono } from 'hono';
import { z } from 'zod';
import { clerkAuth } from '../middleware/clerkAuth';
import type { AppEnv } from '../types/hono';
import { Product } from '../db/models/Product';
import { ProductSubscription, MIN_SUBSCRIPTION_INTERVAL_DAYS, MAX_SUBSCRIPTION_INTERVAL_DAYS } from '../db/models/ProductSubscription';
import { stripe } from '../lib/stripe';
import { getOrCreateStripeCustomer } from '../lib/stripeCustomer';
import { activateSubscription } from '../lib/subscriptions';
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
  textField,
} from '../lib/validation';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

const createSubscriptionSchema = z
  .object({
    productId: productIdSchema,
    variantId: optionalTextField(180),
    qty: intFromInput(1, 10),
    intervalDays: intFromInput(MIN_SUBSCRIPTION_INTERVAL_DAYS, MAX_SUBSCRIPTION_INTERVAL_DAYS),
    address: orderAddressSchema,
    shippingMethod: shippingMethodSchema,
  })
  .superRefine((body, ctx) => {
    if (body.shippingMethod !== 'pickup') requireFullAddress(ctx, body.address);
  });

const idParamsSchema = z.object({ id: objectIdSchema });

const confirmSubscriptionSchema = z.object({ subscriptionId: textField(255) });

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

    // One active/paused reposición automática per producto+variante por cliente - sin esto nada
    // impedía suscribirse dos veces a la misma combinación desde el modal (cada clic en
    // "Suscribirme" crea una Stripe Subscription nueva e independiente).
    const variantFilter = body.variantId
      ? { variantId: body.variantId }
      : { $or: [{ variantId: { $exists: false } }, { variantId: null }, { variantId: '' }] };
    const existingSubscription = await ProductSubscription.findOne({
      customerId: user.clerkId,
      productId: body.productId,
      status: { $in: ['active', 'paused'] },
      ...variantFilter,
    }).lean();
    if (existingSubscription) {
      return c.json({ error: 'Ya tienes una reposición automática activa para este producto. Puedes gestionarla desde tu perfil.' }, 400);
    }

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
      const stripeCustomerId = await getOrCreateStripeCustomer(user.clerkId, user.email, user.name);

      // Unlike Checkout Session line items, a Subscription's price_data can't take an inline
      // product_data - it needs a real Product id (recurring prices are reused every billing
      // cycle, so Stripe requires a persistent Product behind them). One throwaway Product per
      // subscription is fine here since the price itself is already a locked-in snapshot.
      const product = await stripe.products.create({
        name: `${lineItem.productName} — reposición cada ${body.intervalDays} días`,
      });

      // default_incomplete + expanding the first invoice's confirmation_secret lets the frontend
      // confirm the charge with stripe.confirmCardPayment (SubscribeModal.tsx) without ever
      // leaving the page - same embedded pattern as /checkout/payment-intent, just for a
      // recurring price instead of a one-time amount. The subscription itself only becomes
      // "active" (and the local ProductSubscription + first order get created) once that confirms
      // and Stripe fires invoice.payment_succeeded (billing_reason=subscription_create) - see
      // webhooks.ts.
      const subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: Math.round(total * 100),
              recurring: { interval: 'day', interval_count: body.intervalDays },
              product: product.id,
            },
          },
        ],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.confirmation_secret'],
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
      });

      const confirmationSecret = subscription.latest_invoice?.confirmation_secret;
      if (!confirmationSecret?.client_secret) {
        console.error('[SUBSCRIPTIONS] Subscription created without an expanded confirmation_secret:', subscription.id);
        return c.json({ error: 'No se pudo iniciar el cobro de la suscripción' }, 502);
      }

      return c.json({ clientSecret: confirmationSecret.client_secret, subscriptionId: subscription.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stripe error';
      console.error('[SUBSCRIPTIONS] Stripe subscription creation failed:', message);
      return c.json({ error: 'Payment service unavailable', details: message }, 502);
    }
  })
  // Client-side fallback right after stripe.confirmCardPayment succeeds (SubscribeModal.tsx) -
  // invoice.payment_succeeded normally activates the subscription (webhooks.ts), but that
  // webhook never reaches a plain `bun run dev` backend without Stripe CLI forwarding, so without
  // this the subscription would be paid for in Stripe yet invisible in "Mis suscripciones".
  // Idempotent (activateSubscription no-ops if the webhook already created it) and ownership is
  // checked against the Stripe subscription's own metadata, not trusted from the client.
  .post('/confirm', async (c) => {
    const parsed = await parseJson(c, confirmSubscriptionSchema);
    if (!parsed.success) return parsed.response;
    const user = c.get('user');

    try {
      const stripeSubscription = await stripe.subscriptions.retrieve(parsed.data.subscriptionId);
      if (stripeSubscription.metadata?.customerId !== user.clerkId) {
        return c.json({ error: 'Suscripción no encontrada' }, 404);
      }
      if (stripeSubscription.status !== 'active' && stripeSubscription.status !== 'trialing') {
        return c.json({ error: 'El pago aún no se ha confirmado' }, 409);
      }

      const sub = await activateSubscription(stripeSubscription);
      if (!sub) return c.json({ error: 'No se pudo activar la suscripción' }, 502);

      return c.json(sub);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stripe error';
      console.error('[SUBSCRIPTIONS] Confirm failed:', message);
      return c.json({ error: 'No se pudo confirmar la suscripción', details: message }, 502);
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
