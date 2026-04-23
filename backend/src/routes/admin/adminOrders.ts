import Elysia, { t } from 'elysia';
import { requireAdmin } from '../../middleware/requireAdmin';
import { Order } from '../../db/models/Order';

export const adminOrdersRouter = new Elysia({ prefix: '/admin/orders' })
  .use(requireAdmin)
  .get('/', async ({ query }) => {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    return Order.find(filter).sort({ createdAt: -1 }).lean();
  }, { query: t.Object({ status: t.Optional(t.String()) }) })
  .patch('/:id/status', async ({ params, body, set }) => {
    const o = await Order.findByIdAndUpdate(params.id, { status: body.status }, { new: true }).lean();
    if (!o) { set.status = 404; return { error: 'Not found' }; }
    return o;
  }, { body: t.Object({ status: t.String() }) });
