import { Hono } from 'hono';
import { z } from 'zod';
import { clerkAuth } from '../middleware/clerkAuth';
import type { AppEnv } from '../types/hono';
import { Order } from '../db/models/Order';
import { Product } from '../db/models/Product';
import { normalizeOrder } from '../lib/orderStatus';
import { stripe } from '../lib/stripe';
import { sendOrderConfirmationEmail } from '../lib/email';
import {
  cartItemSchema,
  emailField,
  moneyFromInput,
  objectIdSchema,
  optionalTextField,
  orderAddressSchema,
  parseJson,
  parseParams,
  parseQuery,
  requireFullAddress,
  shippingMethodSchema,
  textField,
} from '../lib/validation';
import { buildPaidLineItem, resolveVariantImage } from '../lib/productVariants';
import { decrementStock } from '../lib/inventory';
import { notifyAdmins, notifyUser } from '../lib/realtime';
import { scanAndNotifyLowStock } from '../lib/lowStock';
import { recalculateAfterPayment } from '../lib/bestsellers';

const ordersQuerySchema = z.object({
  stripeSessionId: textField(255).optional(),
});

const orderIdParamsSchema = z.object({
  id: objectIdSchema,
});

const paidSessionCartItemSchema = cartItemSchema.extend({
  isSample: z.coerce.boolean().optional(),
});

const paidSessionMetadataSchema = z.object({
  customerId: textField(180),
  customerName: optionalTextField(160),
  customerEmail: emailField().optional(),
  cartItems: textField(20000),
  address: textField(5000),
  discountCode: optionalTextField(80),
  discountAmount: moneyFromInput().default(0),
  tax: moneyFromInput().default(0),
  shipping: moneyFromInput().default(0),
  shippingMethod: shippingMethodSchema.optional(),
  shippingLabel: optionalTextField(160),
  shippingEta: optionalTextField(80),
});

function parseSessionJsonMetadata<T>(value: string, schema: z.ZodType<T>) {
  try {
    return schema.safeParse(JSON.parse(value));
  } catch {
    return schema.safeParse(null);
  }
}

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

type CheckoutAddress = {
  name: string;
  phone: string;
  address: string;
  city: string;
  postal: string;
};

type CheckoutCartItem = {
  productId: string;
  qty: number;
  variantId?: string;
  isSample?: boolean;
};

async function createOrderFromPaidSession(stripeSessionId: string, clerkId: string) {
  const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
  if ((session.payment_status !== 'paid' && session.status !== 'complete') || session.metadata?.customerId !== clerkId) {
    return null;
  }

  const parsedMetadata = paidSessionMetadataSchema.safeParse(session.metadata || {});
  if (!parsedMetadata.success) return null;

  const metadata = parsedMetadata.data;
  const parsedCartItems = parseSessionJsonMetadata(metadata.cartItems, z.array(paidSessionCartItemSchema).min(1).max(100));
  const parsedAddress = parseSessionJsonMetadata(metadata.address, orderAddressSchema);
  if (!parsedCartItems.success || !parsedAddress.success) return null;

  const cartItems = parsedCartItems.data as CheckoutCartItem[];
  const parsedAddressData = parsedAddress.data as { name: string; phone: string; address?: string; city?: string; postal?: string };
  const address: CheckoutAddress = {
    name: parsedAddressData.name,
    phone: parsedAddressData.phone,
    address: parsedAddressData.address || '',
    city: parsedAddressData.city || '',
    postal: parsedAddressData.postal || '',
  };
  const productIds = [...new Set(cartItems.map((item) => item.productId))];
  const products = await Product.find({ id: { $in: productIds }, active: true }).lean();
  if (products.length !== productIds.length) return null;

  const lineItems = cartItems.map((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    if (!product) throw new Error(`Product not found for ${item.productId}`);
    return buildPaidLineItem(product, item);
  });

  const subtotal = lineItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discountCode = metadata.discountCode || undefined;
  const discountAmount = metadata.discountAmount;
  const tax = metadata.tax;
  const shipping = metadata.shipping;
  const total = Math.round((subtotal - discountAmount + tax + shipping) * 100) / 100;

  const existing = await Order.findOne({ stripeSessionId }).lean();
  if (existing) return normalizeOrder(existing);

  const createdOrder = await Order.create({
    customerId: metadata.customerId,
    customerName: metadata.customerName,
    customerEmail: metadata.customerEmail,
    items: lineItems,
    subtotal,
    discountCode,
    discountAmount,
    tax,
    shipping,
    shippingMethod: metadata.shippingMethod,
    shippingLabel: metadata.shippingLabel,
    shippingEta: metadata.shippingEta,
    total,
    paymentStatus: 'paid',
    fulfillmentStatus: 'unfulfilled',
    status: 'paid',
    stripeSessionId,
    stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
    address,
  });

  for (const item of lineItems) {
    if (!item.isSample) {
      const ok = await decrementStock(item.productId, item.qty, item.variantId);
      if (!ok) {
        console.error('[ORDERS] Stock decrement failed for', item.productId, item.variantId);
      }
    }
  }

  const customerEmail = metadata.customerEmail || session.customer_email;
  if (customerEmail) {
    try {
      await sendOrderConfirmationEmail({
        customerName: metadata.customerName || 'cliente',
        customerEmail: customerEmail,
        orderId: createdOrder._id.toString(),
        items: lineItems,
        subtotal,
        discountCode,
        discountAmount,
        tax,
        shipping,
        shippingLabel: metadata.shippingLabel,
        shippingEta: metadata.shippingEta,
        shippingMethod: metadata.shippingMethod,
        total,
        address,
        createdAt: createdOrder.createdAt,
      });
      console.log('[ORDERS] Confirmation email sent to:', customerEmail);
    } catch (emailError) {
      console.error('[ORDERS] Failed to send confirmation email:', emailError);
    }
  }

  // Real-time notifications (HU-061). This is the path that actually creates the order in local
  // dev today (see webhooks.ts's constructEventAsync fix - the fallback here used to be the only
  // one that ever ran), so it needs the same hooks the webhook has. Best-effort, independent
  // try/catches so a notification failure never breaks order confirmation.
  try {
    await notifyUser(metadata.customerId, {
      type: 'order_paid',
      title: 'Pago confirmado',
      body: `Recibimos tu pago de $${total.toFixed(2)}. Tu pedido está en preparación.`,
      link: '/orders',
      data: { orderId: createdOrder._id.toString(), total },
    });
  } catch (notifyError) {
    console.error('[ORDERS] order_paid notification failed:', notifyError);
  }

  try {
    await notifyAdmins({
      type: 'new_order',
      title: 'Nuevo pedido',
      body: `${metadata.customerName || 'Un cliente'} hizo un pedido de $${total.toFixed(2)} (#${createdOrder._id.toString().slice(-8).toUpperCase()}).`,
      link: '/admin?section=orders',
      data: { orderId: createdOrder._id.toString(), total },
    });
  } catch (notifyError) {
    console.error('[ORDERS] new_order admin notification failed:', notifyError);
  }

  try {
    const soldProductIds = [...new Set(lineItems.filter((i) => !i.isSample).map((i) => i.productId))];
    const soldProducts = await Product.find({ id: { $in: soldProductIds } }).lean();
    for (const product of soldProducts) {
      await scanAndNotifyLowStock(product);
    }
  } catch (notifyError) {
    console.error('[ORDERS] low_stock notification failed:', notifyError);
  }

  recalculateAfterPayment();

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

    const stripeSessionId = parsedQuery.data.stripeSessionId;
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
