import { Hono } from 'hono';
import { z } from 'zod';
import { Return } from '../../db/models/Return';
import { Order } from '../../db/models/Order';
import { requireAdmin } from '../../middleware/requireAdmin';
import type { AppEnv } from '../../types/hono';
import { objectIdSchema, parseJson, parseParams, parseQuery } from '../../lib/validation';
import { sendReturnStatusEmail, RETURN_STATUS_COPY } from '../../lib/email';
import { stripe } from '../../lib/stripe';
import { notifyUser } from '../../lib/realtime';

const returnStatusSchema = z.enum(['requested', 'approved', 'in_transit', 'refunded', 'rejected']);

const listQuerySchema = z.object({
  status: returnStatusSchema.optional(),
});

const idParamsSchema = z.object({ id: objectIdSchema });

const updateStatusSchema = z.object({ status: returnStatusSchema });

export const adminReturnsRouter = new Hono<AppEnv>()
  .use('*', requireAdmin)
  .get('/', async (c) => {
    const parsed = parseQuery(c, listQuerySchema);
    if (!parsed.success) return parsed.response;

    const filter = parsed.data.status ? { status: parsed.data.status } : {};
    const returns = await Return.find(filter).sort({ createdAt: -1 }).lean();
    return c.json(returns);
  })
  .patch('/:id/status', async (c) => {
    const paramsParsed = parseParams(c, idParamsSchema);
    if (!paramsParsed.success) return paramsParsed.response;

    const bodyParsed = await parseJson(c, updateStatusSchema);
    if (!bodyParsed.success) return bodyParsed.response;

    const returnDoc = await Return.findById(paramsParsed.data.id);
    if (!returnDoc) return c.json({ error: 'Devolución no encontrada' }, 404);

    const nextStatus = bodyParsed.data.status;

    if (nextStatus === 'refunded' && returnDoc.status !== 'refunded') {
      const order = await Order.findById(returnDoc.orderId).lean();
      if (!order?.stripePaymentIntentId) {
        return c.json({ error: 'La orden no tiene un pago de Stripe asociado' }, 400);
      }

      try {
        const refund = await stripe.refunds.create({
          payment_intent: order.stripePaymentIntentId,
          amount: Math.round(returnDoc.refundAmount * 100),
        });
        returnDoc.stripeRefundId = refund.id;
      } catch (error) {
        console.error('[ADMIN_RETURNS] Stripe refund failed:', error);
        return c.json({ error: 'No se pudo procesar el reembolso en Stripe' }, 502);
      }

      await Order.updateOne({ _id: returnDoc.orderId }, { paymentStatus: 'refunded', status: 'refunded' });
    }

    returnDoc.status = nextStatus;
    await returnDoc.save();

    sendReturnStatusEmail({
      customerName: returnDoc.customerName || 'cliente',
      customerEmail: returnDoc.customerEmail || '',
      orderId: String(returnDoc.orderId),
      status: nextStatus,
      refundAmount: returnDoc.refundAmount,
    }).catch((err) => console.error('[ADMIN_RETURNS] Failed to send status email:', err));

    // Real-time push to the customer (HU-061), mirroring the status email and the fulfillment
    // notification in adminOrders.ts. Best-effort - a notification failure must not fail the
    // status update itself.
    if (returnDoc.customerId) {
      try {
        const copy = RETURN_STATUS_COPY[nextStatus];
        await notifyUser(returnDoc.customerId, {
          type: 'return_status',
          title: copy.label,
          body: copy.message,
          link: '/orders',
          data: { returnId: returnDoc._id.toString(), orderId: String(returnDoc.orderId), status: nextStatus },
        });
      } catch (notifyError) {
        console.error('[ADMIN_RETURNS] Failed to push return_status notification:', notifyError);
      }
    }

    return c.json(returnDoc.toObject());
  });
