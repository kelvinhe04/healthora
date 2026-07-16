import { Hono } from 'hono';
import { z } from 'zod';
import { Return } from '../../db/models/Return';
import { requireAdmin } from '../../middleware/requireAdmin';
import { auditAdminMutations } from '../../middleware/auditAdminAction';
import type { AppEnv } from '../../types/hono';
import { objectIdSchema, parseJson, parseParams, parseQuery } from '../../lib/validation';
import { sendReturnStatusEmail, getReturnedToCustomerCopy, capitalizeSentence } from '../../lib/email';
import { shouldSendEmail } from '../../lib/notificationPreferences';
import { notifyUser } from '../../lib/realtime';
import { resolvePendingRefunds, updateReturnStatus } from '../../lib/returns';

const returnStatusSchema = z.enum(['requested', 'approved', 'in_transit', 'in_review', 'refund_pending', 'refunded', 'replaced', 'rejected']);

const listQuerySchema = z.object({
  status: returnStatusSchema.optional(),
});

const idParamsSchema = z.object({ id: objectIdSchema });

// `refund_pending` is server-internal (set while waiting on Stripe's refund.updated webhook, see
// lib/returns.ts#confirmReturnRefund) - the admin never targets it directly via this endpoint.
const adminSettableStatusSchema = z.enum(['requested', 'approved', 'in_transit', 'in_review', 'refunded', 'replaced', 'rejected']);

const updateStatusSchema = z.object({ status: adminSettableStatusSchema });

export const adminReturnsRouter = new Hono<AppEnv>()
  .use('*', requireAdmin)
  .use('*', auditAdminMutations('returns'))
  .get('/count', async (c) => c.json({ count: await Return.countDocuments() }))
  .get('/', async (c) => {
    const parsed = parseQuery(c, listQuerySchema);
    if (!parsed.success) return parsed.response;

    await resolvePendingRefunds();
    const filter = parsed.data.status ? { status: parsed.data.status } : {};
    const returns = await Return.find(filter).sort({ createdAt: -1 }).lean();
    return c.json(returns);
  })
  .patch('/:id/status', async (c) => {
    const paramsParsed = parseParams(c, idParamsSchema);
    if (!paramsParsed.success) return paramsParsed.response;

    const bodyParsed = await parseJson(c, updateStatusSchema);
    if (!bodyParsed.success) return bodyParsed.response;

    const result = await updateReturnStatus(paramsParsed.data.id, bodyParsed.data.status);
    if (!result.ok) return c.json({ error: result.error }, result.status);
    return c.json(result.return);
  })
  // Only applies to a return rejected *after* physical review (see `rejectedAfterReview`) - the
  // store is holding a product that isn't going to be refunded or replaced, so it has to go back
  // to the customer. This never touches `status` (stays `rejected`), it's a side marker for that
  // reverse handoff - courier delivery for courier_pickup returns, in-store pickup otherwise.
  .patch('/:id/return-to-customer', async (c) => {
    const paramsParsed = parseParams(c, idParamsSchema);
    if (!paramsParsed.success) return paramsParsed.response;

    const returnDoc = await Return.findById(paramsParsed.data.id);
    if (!returnDoc) return c.json({ error: 'Devolución no encontrada' }, 404);

    if (returnDoc.status !== 'rejected' || !returnDoc.rejectedAfterReview) {
      return c.json({ error: 'Solo aplica a devoluciones rechazadas después de revisión' }, 400);
    }
    if (returnDoc.returnedToCustomerAt) {
      return c.json({ error: 'Ya se marcó como devuelto al cliente' }, 400);
    }

    returnDoc.returnedToCustomerAt = new Date();
    await returnDoc.save();

    const copy = getReturnedToCustomerCopy(returnDoc.returnMethod);

    if (await shouldSendEmail(returnDoc.customerId, 'orderUpdates')) {
      sendReturnStatusEmail({
        customerName: returnDoc.customerName || 'cliente',
        customerEmail: returnDoc.customerEmail || '',
        orderId: String(returnDoc.orderId),
        status: 'rejected',
        refundAmount: returnDoc.refundAmount,
        returnMethod: returnDoc.returnMethod as 'courier_pickup' | 'store_dropoff' | undefined,
        copyOverride: copy,
      }).catch((err) => console.error('[ADMIN_RETURNS] Failed to send returned-to-customer email:', err));
    }

    if (returnDoc.customerId) {
      try {
        await notifyUser(returnDoc.customerId, {
          type: 'return_status',
          title: copy.label,
          body: capitalizeSentence(copy.message),
          link: '/orders',
          data: { returnId: returnDoc._id.toString(), orderId: String(returnDoc.orderId), status: 'rejected' },
        });
      } catch (notifyError) {
        console.error('[ADMIN_RETURNS] Failed to push returned-to-customer notification:', notifyError);
      }
    }

    return c.json(returnDoc.toObject());
  });
