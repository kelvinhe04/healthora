import Elysia, { t } from 'elysia';
import { clerkAuth } from '../middleware/clerkAuth';
import { Order } from '../db/models/Order';

export const ordersRouter = new Elysia({ prefix: '/orders' })
  .use(clerkAuth)
  .get('/', async ({ user, query }) => {
    if (query.stripeSessionId) {
      const o = await Order.findOne({ stripeSessionId: query.stripeSessionId, customerId: user.clerkId }).lean();
      return o || { error: 'Not found' };
    }
    return Order.find({ customerId: user.clerkId }).sort({ createdAt: -1 }).lean();
  }, {
    query: t.Object({ stripeSessionId: t.Optional(t.String()) }),
  })
  .get('/:id', async ({ user, params, set }) => {
    const o = await Order.findById(params.id).lean();
    if (!o || (o as { customerId?: string }).customerId !== user.clerkId) {
      set.status = 404; return { error: 'Not found' };
    }
    return o;
  });
