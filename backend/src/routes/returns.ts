import { Hono } from 'hono';
import { z } from 'zod';
import { clerkAuth } from '../middleware/clerkAuth';
import type { AppEnv } from '../types/hono';
import { Order } from '../db/models/Order';
import { Return } from '../db/models/Return';
import { objectIdSchema, parseJson, productIdSchema, textField } from '../lib/validation';
import { isWithinReturnWindow, refundIncludesShipping, resolvePendingRefunds } from '../lib/returns';
import { saveImageFile } from '../lib/imageStorage';
import { enqueueEmailJob } from '../lib/jobQueue';
import { notifyAdmins } from '../lib/realtime';
import { computeItbms } from '../lib/tax';

const returnItemSchema = z.object({
  productId: productIdSchema,
  qty: z.coerce.number().int().min(1).max(999),
});

const createReturnSchema = z.object({
  orderId: objectIdSchema,
  reason: textField(1000),
  reasonCategory: z.enum(['damaged', 'wrong_item', 'defective', 'changed_mind', 'other']),
  items: z.array(returnItemSchema).min(1).max(100),
  desiredResolution: z.enum(['refund', 'replacement']).default('refund'),
  photos: z.array(z.string().url()).min(1).max(4),
});

export const returnsRouter = new Hono<AppEnv>()
  .use('*', clerkAuth)
  .get('/', async (c) => {
    const user = c.get('user');
    await resolvePendingRefunds();
    const returns = await Return.find({ customerId: user.clerkId }).sort({ createdAt: -1 }).lean();
    return c.json(returns);
  })
  .post('/upload', async (c) => {
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) {
      return c.json({ error: 'Se espera un archivo en el campo "file"' }, 400);
    }

    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const url = await saveImageFile(buffer, file.type, 'returns');
      return c.json({ url }, 201);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Error al subir imagen' }, 400);
    }
  })
  .post('/', async (c) => {
    const user = c.get('user');
    const parsed = await parseJson(c, createReturnSchema);
    if (!parsed.success) return parsed.response;

    const { orderId, reason, reasonCategory, items, desiredResolution, photos } = parsed.data;
    const order = await Order.findOne({ _id: orderId, customerId: user.clerkId }).lean();
    if (!order) return c.json({ error: 'Orden no encontrada' }, 404);
    if (order.paymentStatus !== 'paid') {
      return c.json({ error: 'Solo se pueden devolver órdenes pagadas' }, 400);
    }
    // Mirrors the frontend's `eligible` check in Orders.tsx - a return only makes sense once the
    // customer actually has the product in hand. For pickup orders `delivered` only means "ready
    // at the store" - the customer doesn't have it until `picked_up`.
    const hasProductInHand = order.shippingMethod === 'pickup'
      ? order.fulfillmentStatus === 'picked_up'
      : order.fulfillmentStatus === 'delivered';
    if (!hasProductInHand) {
      return c.json({ error: 'Solo se pueden devolver órdenes entregadas' }, 400);
    }
    if (!isWithinReturnWindow(order)) {
      return c.json({ error: 'La ventana para solicitar una devolución de este pedido ya venció' }, 400);
    }
    // Un pedido de reemplazo (creado por otra devolución) ya es gratis y forma parte del flujo de
    // esa devolución - no se puede pedir otra devolución sobre él.
    if (order.replacesOrderId) {
      return c.json({ error: 'Este pedido es un reemplazo y no admite una devolución' }, 400);
    }

    // A plain rejection (decided sight-unseen at `requested`) doesn't block trying again - the
    // customer can amend and resubmit. A rejection *after* physical review (`rejectedAfterReview`)
    // means the store already has the disputed item and found it didn't match the claim - that one
    // stays blocking so the customer can't just resubmit the same claim; only an admin manually
    // reopening the return (PATCH /admin/returns) gets past it.
    const existing = await Return.findOne({
      orderId,
      $or: [{ status: { $ne: 'rejected' } }, { rejectedAfterReview: true }],
    }).lean();
    if (existing) {
      return c.json({ error: 'Ya existe una solicitud de devolución para esta orden' }, 409);
    }

    const orderItems = order.items as Array<{ productId: string; productName: string; qty: number; price: number; taxExempt?: boolean }>;
    let refundAmount = 0;
    let resolvedItems: { productId: string; productName: string; qty: number }[];
    const returnedLineItems: { price: number; qty: number; taxExempt?: boolean }[] = [];
    try {
      resolvedItems = items.map((item) => {
        const orderItem = orderItems.find((oi) => oi.productId === item.productId);
        if (!orderItem) throw new Error(`El producto ${item.productId} no pertenece a esta orden`);
        if (item.qty > orderItem.qty) throw new Error(`Cantidad invalida para ${orderItem.productName}`);
        refundAmount += orderItem.price * item.qty;
        returnedLineItems.push({ price: orderItem.price, qty: item.qty, taxExempt: orderItem.taxExempt });
        return { productId: item.productId, productName: orderItem.productName, qty: item.qty };
      });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Items invalidos' }, 400);
    }

    // Only a refund actually returns money via Stripe - a replacement is already shipped at no
    // extra charge (see createReplacementOrder), so the ITBMS/shipping the customer originally
    // paid is irrelevant there (nothing is being refunded to prorate it out of).
    if (desiredResolution === 'refund') {
      // The customer paid ITBMS on this item as part of the order total; since the sale is being
      // reversed, that tax has to come back too, not just the item's list price. Prorated the same
      // way the original order computed it (same discount ratio, exempt items excluded).
      refundAmount += computeItbms(returnedLineItems, order.discountAmount ?? 0, order.subtotal ?? 0);

      if (refundIncludesShipping(reasonCategory)) {
        refundAmount += order.shipping ?? 0;
      }
    }

    // Mirrors the outbound trip: a pickup order never got shipped to the customer, so the return
    // can't go back via courier either - it's a drop-off at the store. Everything else (including
    // legacy orders predating shippingMethod) was shipped, so a courier picks it up.
    const returnMethod = order.shippingMethod === 'pickup' ? 'store_dropoff' : 'courier_pickup';

    const returnDoc = await Return.create({
      orderId,
      customerId: user.clerkId,
      customerName: user.name,
      customerEmail: user.email,
      reason,
      reasonCategory,
      items: resolvedItems,
      refundAmount: Math.round(refundAmount * 100) / 100,
      status: 'requested',
      returnMethod,
      desiredResolution,
      photos,
      pickupAddress: returnMethod === 'courier_pickup' ? order.address : undefined,
    });

    enqueueEmailJob('return_status', {
      customerName: user.name || 'cliente',
      customerEmail: user.email || '',
      orderId: String(orderId),
      status: 'requested',
      refundAmount: returnDoc.refundAmount,
      returnMethod,
    }).catch((err) => console.error('[RETURNS] Failed to queue requested email:', err));

    // Real-time alert to admins (HU-061), mirroring new_review. Best-effort - a notification
    // failure must not fail the return request itself.
    try {
      await notifyAdmins({
        type: 'return_requested',
        title: 'Nueva solicitud de devolución',
        body: `${user.name || 'Un cliente'} solicitó devolver ${resolvedItems.length} artículo${resolvedItems.length === 1 ? '' : 's'} del pedido #${String(orderId).slice(-8).toUpperCase()} por $${returnDoc.refundAmount.toFixed(2)} — pide ${desiredResolution === 'replacement' ? 'que le reenvíen el producto correcto' : 'reembolso'}.`,
        link: '/admin?section=returns',
        data: { returnId: returnDoc._id.toString(), orderId: String(orderId), refundAmount: returnDoc.refundAmount },
      });
    } catch (notifyError) {
      console.error('[RETURNS] Failed to push return_requested notification:', notifyError);
    }

    return c.json(returnDoc.toObject(), 201);
  });
