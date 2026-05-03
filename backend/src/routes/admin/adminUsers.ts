import { Hono } from 'hono';
import { requireAdmin } from '../../middleware/requireAdmin';
import type { AppEnv } from '../../types/hono';
import { User } from '../../db/models/User';
import { Order } from '../../db/models/Order';
import { clerk } from '../../lib/clerk';

export const adminUsersRouter = new Hono<AppEnv>()
  .use('*', requireAdmin)
  .get('/', async (c) => {
    const users = await User.find().sort({ createdAt: -1 }).lean();
    
    let clerkUsers: any[] = [];
    try {
      const response = await clerk.users.getUserList({ limit: 500 });
      clerkUsers = Array.isArray(response) ? response : (response.data || []);
    } catch (error) {
      console.error('[ADMIN] Failed to fetch Clerk users:', error);
    }
    const clerkUserMap = new Map(clerkUsers.map(u => [u.id, u]));

    const enriched = await Promise.all(
      users.map(async (user) => {
        const orders = await Order.find({
          customerId: user.clerkId,
          $or: [
            { paymentStatus: { $ne: 'cancelled' } },
            { paymentStatus: { $exists: false }, status: { $ne: 'cancelled' } },
          ],
        }).lean();
        const ltv = orders.reduce((sum, order) => sum + ((order as { total?: number }).total || 0), 0);
        
        const cUser = clerkUserMap.get(user.clerkId);
        
        return { 
          ...user, 
          orderCount: orders.length, 
          ltv: Math.round(ltv * 100) / 100,
          imageUrl: cUser?.imageUrl 
        };
      })
    );

    return c.json(enriched);
  })
  .patch('/:id/role', async (c) => {
    const body = await c.req.json<{ role?: 'customer' | 'admin' }>();
    if (body.role !== 'customer' && body.role !== 'admin') {
      return c.json({ error: 'Invalid role' }, 400);
    }

    const user = await User.findById(c.req.param('id'));
    if (!user) return c.json({ error: 'Not found' }, 404);

    user.role = body.role;
    await user.save();

    try {
      const clerkUser = await clerk.users.getUser(user.clerkId);
      await clerk.users.updateUserMetadata(user.clerkId, {
        publicMetadata: { ...clerkUser.publicMetadata, role: body.role },
      });
    } catch (error) {
      console.error('[ADMIN] Failed to sync Clerk role:', error);
    }

    return c.json({ ok: true });
  })
  .delete('/:id', async (c) => {
    const user = await User.findById(c.req.param('id'));
    if (!user) return c.json({ error: 'Not found' }, 404);

    await User.findByIdAndDelete(user._id);

    return c.json({ ok: true });
  });
