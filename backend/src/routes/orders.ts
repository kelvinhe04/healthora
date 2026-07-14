import { Hono } from 'hono';
import { z } from 'zod';
import { clerkAuth } from '../middleware/clerkAuth';
import type { AppEnv } from '../types/hono';
import { Order } from '../db/models/Order';
import { Product } from '../db/models/Product';
import { normalizeOrder } from '../lib/orderStatus';
import { stripe } from '../lib/stripe';
import { createPaidOrder, orderMetadataSchema } from '../lib/orderFulfillment';
import {
  objectIdSchema,
  parseParams,
  parseQuery,
  textField,
} from '../lib/validation';
import { resolveVariantImage } from '../lib/productVariants';
import { notifyUser } from '../lib/realtime';
import { recalculateAfterPayment } from '../lib/bestsellers';

const ordersQuerySchema = z.object({
  stripeSessionId: textField(255).optional(),
  stripePaymentIntentId: textField(255).optional(),
});

const orderIdParamsSchema = z.object({
  id: objectIdSchema,
});

async function addItemImages(orders: Array<Record<string, unknown>>) {
  const ids = [...new Set(
    orders.flatMap(o => ((o.items as Array<{ productId: string }> | undefined) ?? []).map(i => i.productId))
  )];
  if (!ids.length) return orders;

  const prods = await Product.find({ id: { $in: ids } }).select('id imageUrl images variants').lean();
  const prodMap = new Map(prods.map((p) => [p.id, p]));

  return orders.map(o => ({
    ...o,
    items: ((o.items as Array<Record<string, unknown>> | undefined) ?? []).map(i => {
      const product = prodMap.get(i.productId as string);
      const variantId = i.variantId as string | undefined;
      return {
        ...i,
        imageUrl: (product ? resolveVariantImage(product, variantId) : '') || null,
      };
    }),
  }));
}

async function createOrderFromPaidSession(stripeSessionId: string, clerkId: string) {
  const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
  if ((session.payment_status !== 'paid' && session.status !== 'complete') || session.metadata?.customerId !== clerkId) {
    return null;
  }

  const parsedMetadata = orderMetadataSchema.safeParse(session.metadata || {});
  if (!parsedMetadata.success) return null;

  const existing = await Order.findOne({ stripeSessionId }).lean();
  if (existing) return normalizeOrder(existing);

  const createdOrder = await createPaidOrder({
    metadata: parsedMetadata.data,
    stripeSessionId,
    stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
    customerEmailFallback: typeof session.customer_email === 'string' ? session.customer_email : undefined,
  });

  return normalizeOrder(createdOrder.toObject());
}

async function createOrderFromPaidIntent(paymentIntentId: string, clerkId: string) {
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (paymentIntent.status !== 'succeeded' || paymentIntent.metadata?.customerId !== clerkId) {
    return null;
  }

  const parsedMetadata = orderMetadataSchema.safeParse(paymentIntent.metadata || {});
  if (!parsedMetadata.success) return null;

  const existing = await Order.findOne({ stripePaymentIntentId: paymentIntentId }).lean();
  if (existing) return normalizeOrder(existing);

  const createdOrder = await createPaidOrder({
    metadata: parsedMetadata.data,
    stripePaymentIntentId: paymentIntentId,
  });

  return normalizeOrder(createdOrder.toObject());
}

async function syncOrderPaymentFromStripe(order: Record<string, unknown>) {
  const normalizedOrder = normalizeOrder(order);

  if (!normalizedOrder.stripeSessionId || normalizedOrder.paymentStatus === 'paid') {
    return normalizedOrder;
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(String(normalizedOrder.stripeSessionId));

    if (session.payment_status === 'paid' || session.status === 'complete') {
      const updatedOrder = await Order.findByIdAndUpdate(
        normalizedOrder._id,
        {
          paymentStatus: 'paid',
          status: normalizedOrder.fulfillmentStatus === 'unfulfilled' ? 'paid' : normalizedOrder.status,
          stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
        },
        { returnDocument: 'after' }
      ).lean();

      if (updatedOrder?.customerId) {
        try {
          await notifyUser(updatedOrder.customerId, {
            type: 'order_paid',
            title: 'Pago confirmado',
            body: `Recibimos tu pago de $${(updatedOrder.total ?? 0).toFixed(2)}. Tu pedido está en preparación.`,
            link: '/orders',
            data: { orderId: updatedOrder._id.toString(), total: updatedOrder.total ?? 0 },
          });
        } catch (notifyError) {
          console.error('[ORDERS] order_paid (sync) notification failed:', notifyError);
        }
      }

      recalculateAfterPayment();

      return updatedOrder ? normalizeOrder(updatedOrder) : normalizedOrder;
    }
  } catch (error) {
    console.error('[ORDERS] Failed to sync payment from Stripe:', error);
  }

  return normalizedOrder;
}

export const ordersRouter = new Hono<AppEnv>()
  .use('*', clerkAuth)
  .get('/', async (c) => {
    const parsedQuery = parseQuery(c, ordersQuerySchema);
    if (!parsedQuery.success) return parsedQuery.response;

    const { stripeSessionId, stripePaymentIntentId } = parsedQuery.data;
    const clerkId = c.get('user').clerkId;

    if (stripeSessionId) {
      const order = await Order.findOne({ stripeSessionId, customerId: clerkId }).lean();
      if (order) {
        const synced = await syncOrderPaymentFromStripe(order);
        const [enriched] = await addItemImages([synced as unknown as Record<string, unknown>]);
        return c.json(enriched);
      }

      try {
        const createdOrder = await createOrderFromPaidSession(stripeSessionId, clerkId);
        if (!createdOrder) return c.json({ error: 'Not found' }, 404);
        const [enriched] = await addItemImages([createdOrder as unknown as Record<string, unknown>]);
        return c.json(enriched);
      } catch (error) {
        console.error('[ORDERS] Failed to create order from paid session:', error);
        return c.json({ error: 'Not found' }, 404);
      }
    }

    if (stripePaymentIntentId) {
      const order = await Order.findOne({ stripePaymentIntentId, customerId: clerkId }).lean();
      if (order) {
        const [enriched] = await addItemImages([normalizeOrder(order) as unknown as Record<string, unknown>]);
        return c.json(enriched);
      }

      try {
        const createdOrder = await createOrderFromPaidIntent(stripePaymentIntentId, clerkId);
        if (!createdOrder) return c.json({ error: 'Not found' }, 404);
        const [enriched] = await addItemImages([createdOrder as unknown as Record<string, unknown>]);
        return c.json(enriched);
      } catch (error) {
        console.error('[ORDERS] Failed to create order from paid intent:', error);
        return c.json({ error: 'Not found' }, 404);
      }
    }

    const orders = await Order.find({ customerId: clerkId }).sort({ createdAt: -1 }).lean();
    const normalized = orders.map((order) => normalizeOrder(order));
    return c.json(await addItemImages(normalized as unknown as Record<string, unknown>[]));
  })
  .get('/:id', async (c) => {
    const parsedParams = parseParams(c, orderIdParamsSchema);
    if (!parsedParams.success) return parsedParams.response;

    const order = await Order.findById(parsedParams.data.id).lean();
    if (!order || (order as { customerId?: string }).customerId !== c.get('user').clerkId) {
      return c.json({ error: 'Not found' }, 404);
    }
    const [enriched] = await addItemImages([normalizeOrder(order) as unknown as Record<string, unknown>]);
    return c.json(enriched);
  })
  .patch('/:id/cancel', async (c) => {
    const parsedParams = parseParams(c, orderIdParamsSchema);
    if (!parsedParams.success) return parsedParams.response;

    const clerkId = c.get('user').clerkId;
    const order = await Order.findById(parsedParams.data.id).lean() as Record<string, unknown> | null;
    if (!order || order.customerId !== clerkId) return c.json({ error: 'Not found' }, 404);

    if (!['unfulfilled', 'processing'].includes(order.fulfillmentStatus as string)) {
      return c.json({ error: 'El pedido ya no puede cancelarse en este estado' }, 400);
    }
    if (order.replacesOrderId) {
      return c.json({ error: 'No puedes cancelar un pedido de reemplazo de una devolución' }, 400);
    }

    const updated = await Order.findByIdAndUpdate(
      parsedParams.data.id,
      { fulfillmentStatus: 'cancelled', paymentStatus: 'cancelled', status: 'cancelled' },
      { returnDocument: 'after' }
    ).lean();

    if (!updated) return c.json({ error: 'Not found' }, 404);
    const [enriched] = await addItemImages([normalizeOrder(updated) as unknown as Record<string, unknown>]);
    return c.json(enriched);
  })
  .patch('/:id/address', async (c) => {
    const parsedParams = parseParams(c, orderIdParamsSchema);
    if (!parsedParams.success) return parsedParams.response;

    const clerkId = c.get('user').clerkId;
    const order = await Order.findById(parsedParams.data.id).lean() as Record<string, unknown> | null;
    if (!order || order.customerId !== clerkId) return c.json({ error: 'Not found' }, 404);

    if (order.fulfillmentStatus !== 'unfulfilled') {
      return c.json({ error: 'Solo puedes editar la dirección antes de que el pedido sea procesado' }, 400);
    }

    const parsedBody = await parseJson(c, orderAddressSchema);
    if (!parsedBody.success) return parsedBody.response;
    const body = parsedBody.data;
    const { name, phone, address, city, postal } = body;
    const isPickup = order.shippingMethod === 'pickup';
    if (!name?.trim() || !phone?.trim() || (!isPickup && (!address?.trim() || !city?.trim() || !postal?.trim()))) {
      return c.json({ error: 'Todos los campos requeridos deben completarse' }, 400);
    }

    const updated = await Order.findByIdAndUpdate(
      parsedParams.data.id,
      { address: { name: name.trim(), phone: phone.trim(), address: address?.trim() || '', city: city?.trim() || '', postal: postal?.trim() || '' } },
      { returnDocument: 'after' }
    ).lean();

    if (!updated) return c.json({ error: 'Not found' }, 404);
    const [enriched] = await addItemImages([normalizeOrder(updated) as unknown as Record<string, unknown>]);
    return c.json(enriched);
  });
