import { Hono } from 'hono';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/requireAdmin';
import type { AppEnv } from '../../types/hono';
import { Order } from '../../db/models/Order';
import { sendOrderStatusUpdateEmail } from '../../lib/email';
import { combineOrderStatus, normalizeOrder } from '../../lib/orderStatus';
import { objectIdSchema, parseJson, parseParams, parseQuery } from '../../lib/validation';

const paymentStatusSchema = z.enum(['pending_payment', 'paid', 'cancelled', 'refunded']);
const fulfillmentStatusSchema = z.enum(['unfulfilled', 'processing', 'shipped', 'delivered', 'cancelled']);

const adminOrdersQuerySchema = z.object({
  paymentStatus: paymentStatusSchema.optional(),
  fulfillmentStatus: fulfillmentStatusSchema.optional(),
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

export const adminOrdersRouter = new Hono<AppEnv>()
  .use('*', requireAdmin)
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

    const order = await Order.findByIdAndUpdate(
      parsedParams.data.id,
      { paymentStatus, fulfillmentStatus, status },
      { returnDocument: 'after' }
    ).lean();

    if (!order) return c.json({ error: 'Not found' }, 404);

    if (normalizedCurrent.fulfillmentStatus !== fulfillmentStatus && order.customerEmail) {
      try {
        await sendOrderStatusUpdateEmail({
          customerName: order.customerName || 'cliente',
          customerEmail: order.customerEmail,
          orderId: order._id.toString(),
          fulfillmentStatus,
          items: order.items || [],
          total: order.total || 0,
          address: order.address,
        });
      } catch (emailError) {
        console.error('[ADMIN_ORDERS] Failed to send status update email:', emailError);
      }
    }

    return c.json(normalizeOrder(order));
  });
