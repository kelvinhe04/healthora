import { Hono } from 'hono';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/requireAdmin';
import { auditAdminMutations } from '../../middleware/auditAdminAction';
import type { AppEnv } from '../../types/hono';
import { Order } from '../../db/models/Order';
import { sendOrderStatusUpdateEmail } from '../../lib/email';
import { shouldSendEmail } from '../../lib/notificationPreferences';
import { combineOrderStatus, normalizeOrder, type FulfillmentStatus } from '../../lib/orderStatus';
import { notifyUser } from '../../lib/realtime';
import { generateTrackingNumber } from '../../lib/tracking';
import { buildOrdersXlsx } from '../../lib/ordersXlsx';
import { objectIdSchema, optionalTextField, parseJson, parseParams, parseQuery } from '../../lib/validation';

const paymentStatusSchema = z.enum(['pending_payment', 'paid', 'cancelled', 'refunded']);
const fulfillmentStatusSchema = z.enum(['unfulfilled', 'processing', 'shipped', 'delivered', 'picked_up', 'cancelled']);

const orderTrackingSchema = z.object({
  carrier: optionalTextField(60),
  trackingNumber: optionalTextField(120),
}).refine((body) => body.carrier !== undefined || body.trackingNumber !== undefined, {
  message: 'Debe enviar carrier o numero de tracking',
});

const adminOrdersQuerySchema = z.object({
  paymentStatus: paymentStatusSchema.optional(),
  fulfillmentStatus: fulfillmentStatusSchema.optional(),
});

const csvExportQuerySchema = adminOrdersQuerySchema.extend({
  lang: z.enum(['es', 'en']).optional(),
});

const adminOrderStatusSchema = z.object({
  paymentStatus: paymentStatusSchema.optional(),
  fulfillmentStatus: fulfillmentStatusSchema.optional(),
}).refine((body) => body.paymentStatus || body.fulfillmentStatus, {
  message: 'Debe enviar al menos un estado',
});

const orderIdParamsSchema = z.object({
  id: objectIdSchema,
});

/** Customer-facing copy for the real-time notification pushed on each fulfillment transition. */
const fulfillmentLabels: Record<FulfillmentStatus, { title: string; body: string }> = {
  unfulfilled: { title: 'Pedido recibido', body: 'Tu pedido fue registrado y está pendiente de preparación.' },
  processing: { title: 'Pedido en preparación', body: 'Estamos preparando tu pedido para el envío.' },
  shipped: { title: 'Pedido enviado', body: 'Tu pedido va en camino. Te avisaremos cuando sea entregado.' },
  delivered: { title: 'Pedido entregado', body: 'Tu pedido fue entregado. ¡Gracias por comprar en Healthora!' },
  // Only reachable for pickup orders in practice (see pickupFulfillmentStatusSequence).
  picked_up: { title: 'Confirmamos tu retiro', body: 'Confirmamos que retiraste tu pedido en tienda. ¡Gracias por comprar en Healthora!' },
  cancelled: { title: 'Pedido cancelado', body: 'Tu pedido fue cancelado. Si tienes dudas, contáctanos.' },
};

/** Retiro en tienda no se "entrega": queda listo para que el cliente pase a recogerlo. */
const pickupFulfillmentLabelOverrides: Partial<Record<FulfillmentStatus, { title: string; body: string }>> = {
  delivered: { title: 'Pedido listo para retirar', body: 'Tu pedido ya está listo. Puedes pasar a recogerlo en nuestra tienda.' },
};

function getFulfillmentPushLabel(fulfillmentStatus: FulfillmentStatus, shippingMethod?: string) {
  if (shippingMethod === 'pickup') return pickupFulfillmentLabelOverrides[fulfillmentStatus] || fulfillmentLabels[fulfillmentStatus];
  return fulfillmentLabels[fulfillmentStatus];
}

export const adminOrdersRouter = new Hono<AppEnv>()
  .use('*', requireAdmin)
  .use('*', auditAdminMutations('orders'))
  .get('/', async (c) => {
    const parsedQuery = parseQuery(c, adminOrdersQuerySchema);
    if (!parsedQuery.success) return parsedQuery.response;

    const query = parsedQuery.data;
    const filter: Record<string, unknown> = {};

    if (query.paymentStatus) {
      filter.$or = [
        { paymentStatus: query.paymentStatus },
        {
          paymentStatus: { $exists: false },
          status: query.paymentStatus === 'paid'
            ? { $in: ['paid', 'processing', 'shipped', 'delivered'] }
            : query.paymentStatus,
        },
      ];
    }

    if (query.fulfillmentStatus) {
      filter.$and = [
        ...(Array.isArray(filter.$and) ? filter.$and : []),
        {
          $or: [
            { fulfillmentStatus: query.fulfillmentStatus },
            {
              fulfillmentStatus: { $exists: false },
              status: query.fulfillmentStatus === 'unfulfilled'
                ? { $in: ['pending_payment', 'paid'] }
                : query.fulfillmentStatus,
            },
          ],
        },
      ];
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();
    return c.json(orders.map((order) => normalizeOrder(order)));
  })
  .get('/export.xlsx', async (c) => {
    const parsedQuery = parseQuery(c, csvExportQuerySchema);
    if (!parsedQuery.success) return parsedQuery.response;

    const limitRaw = c.req.query('limit');
    const limit = limitRaw ? Number(limitRaw) : undefined;
    const lang = parsedQuery.data.lang === 'es' ? 'es' : 'en';
    const xlsx = await buildOrdersXlsx({
      paymentStatus: parsedQuery.data.paymentStatus,
      fulfillmentStatus: parsedQuery.data.fulfillmentStatus,
      limit: Number.isFinite(limit) ? limit : undefined,
      lang,
    });
    const filenamePrefix = lang === 'es' ? 'pedidos' : 'orders';
    const dateSuffix = new Date().toISOString().slice(0, 10);
    return new Response(new Uint8Array(xlsx), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filenamePrefix}-${dateSuffix}.xlsx"`,
      },
    });
  })
  .patch('/:id/statuses', async (c) => {
    const parsedParams = parseParams(c, orderIdParamsSchema);
    if (!parsedParams.success) return parsedParams.response;

    const parsedBody = await parseJson(c, adminOrderStatusSchema);
    if (!parsedBody.success) return parsedBody.response;

    const body = parsedBody.data;
    const currentOrder = await Order.findById(parsedParams.data.id).lean();
    const normalizedCurrent = currentOrder ? normalizeOrder(currentOrder) : null;
    if (!normalizedCurrent?._id) {
      return c.json({ error: 'Not found' }, 404);
    }

    const paymentStatus = (body.paymentStatus || normalizedCurrent.paymentStatus) as typeof normalizedCurrent.paymentStatus;
    const fulfillmentStatus = (body.fulfillmentStatus || normalizedCurrent.fulfillmentStatus) as typeof normalizedCurrent.fulfillmentStatus;
    const status = combineOrderStatus(paymentStatus, fulfillmentStatus);

    const update: Record<string, unknown> = { paymentStatus, fulfillmentStatus, status };

    // Simulacion: no hay integracion real con couriers todavia (ver seguimiento HU-042), asi que
    // al pasar a "enviado" sin courier/numero ya asignados se genera un numero de guia propio.
    const shouldAutoAssignTracking =
      fulfillmentStatus === 'shipped' &&
      normalizedCurrent.shippingMethod !== 'pickup' &&
      !normalizedCurrent.carrier &&
      !normalizedCurrent.trackingNumber;
    if (shouldAutoAssignTracking) {
      update.carrier = 'propia';
      update.trackingNumber = generateTrackingNumber();
    }

    const order = await Order.findByIdAndUpdate(
      parsedParams.data.id,
      update,
      { returnDocument: 'after' }
    ).lean();

    if (!order) return c.json({ error: 'Not found' }, 404);

    if (normalizedCurrent.fulfillmentStatus !== fulfillmentStatus) {
      if (order.customerEmail && (await shouldSendEmail(order.customerId, 'orderUpdates'))) {
        // Not awaited: SMTP can take several seconds to respond (and, e.g., Gmail's daily
        // send-limit rejection is itself a slow round-trip) - the admin shouldn't have to wait on
        // it to see "Guardado". Errors are still caught and logged, just asynchronously.
        sendOrderStatusUpdateEmail({
          customerName: order.customerName || 'cliente',
          customerEmail: order.customerEmail,
          orderId: order._id.toString(),
          fulfillmentStatus,
          items: order.items || [],
          total: order.total || 0,
          address: order.address,
          shippingMethod: order.shippingMethod,
          carrier: order.carrier,
          trackingNumber: order.trackingNumber,
        }).catch((emailError) => {
          console.error('[ADMIN_ORDERS] Failed to send status update email:', emailError);
        });
      }

      // Real-time push to the customer (HU-061), mirroring the status email.
      if (order.customerId) {
        try {
          const pushLabel = getFulfillmentPushLabel(fulfillmentStatus, order.shippingMethod);
          await notifyUser(order.customerId, {
            type: fulfillmentStatus === 'shipped' ? 'order_shipped' : 'order_status',
            title: pushLabel.title,
            body: pushLabel.body,
            link: '/orders',
            data: { orderId: order._id.toString(), fulfillmentStatus },
          });
        } catch (notifyError) {
          console.error('[ADMIN_ORDERS] Failed to push status notification:', notifyError);
        }
      }
    }

    return c.json(normalizeOrder(order));
  })
  .patch('/:id/tracking', async (c) => {
    const parsedParams = parseParams(c, orderIdParamsSchema);
    if (!parsedParams.success) return parsedParams.response;

    const parsedBody = await parseJson(c, orderTrackingSchema);
    if (!parsedBody.success) return parsedBody.response;

    const update: Record<string, string> = {};
    if (parsedBody.data.carrier !== undefined) update.carrier = parsedBody.data.carrier;
    if (parsedBody.data.trackingNumber !== undefined) update.trackingNumber = parsedBody.data.trackingNumber;

    const order = await Order.findByIdAndUpdate(parsedParams.data.id, update, { returnDocument: 'after' }).lean();
    if (!order) return c.json({ error: 'Not found' }, 404);

    return c.json(normalizeOrder(order));
  });
