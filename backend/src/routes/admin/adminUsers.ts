import Elysia from 'elysia';
import { requireAdmin } from '../../middleware/requireAdmin';
import { User } from '../../db/models/User';
import { Order } from '../../db/models/Order';

export const adminUsersRouter = new Elysia({ prefix: '/admin/users' })
  .use(requireAdmin)
  .get('/', async () => {
    const users = await User.find().sort({ createdAt: -1 }).lean();
    const enriched = await Promise.all(
      users.map(async (u) => {
        const orders = await Order.find({ customerId: u.clerkId, status: { $ne: 'cancelled' } }).lean();
        const ltv = orders.reduce((s, o) => s + ((o as { total?: number }).total || 0), 0);
        return { ...u, orderCount: orders.length, ltv: Math.round(ltv * 100) / 100 };
      })
    );
    return enriched;
  });
