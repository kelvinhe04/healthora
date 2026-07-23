import { Hono } from 'hono';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/requireAdmin';
import { requireOwner } from '../../middleware/requireOwner';
import type { AppEnv } from '../../types/hono';
import { User } from '../../db/models/User';
import { Order } from '../../db/models/Order';
import { clerk } from '../../lib/clerk';
import { objectIdSchema, parseJson, parseParams } from '../../lib/validation';
import { recordSecurityEvent } from '../../lib/securityAudit';
import { getExternalAvatarUrl } from '../../lib/clerkAvatar';

const userIdParamsSchema = z.object({
  id: objectIdSchema,
});

const rolePayloadSchema = z.object({
  role: z.enum(['customer', 'admin']),
});

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
          imageUrl: cUser?.imageUrl,
          // Secondary source if img.clerk.com fails to load client-side (#314) - see UsersSection.tsx.
          imageUrlFallback: getExternalAvatarUrl(cUser),
        };
      })
    );

    // Historical/seed orders don't all belong to a real registered account - group whatever's
    // left by customerId so those "walk-in" customers still show up here instead of only the
    // handful who actually signed up (this is a customer *directory* for the whole store, not
    // just an account manager).
    const registeredClerkIds = new Set(users.map((u) => u.clerkId));
    const orderOnlyCustomers = await Order.aggregate([
      {
        $match: {
          customerId: { $nin: Array.from(registeredClerkIds) },
          $or: [
            { paymentStatus: { $ne: 'cancelled' } },
            { paymentStatus: { $exists: false }, status: { $ne: 'cancelled' } },
          ],
        },
      },
      {
        $group: {
          _id: '$customerId',
          name: { $first: '$customerName' },
          email: { $first: '$customerEmail' },
          orderCount: { $sum: 1 },
          ltv: { $sum: '$total' },
          createdAt: { $min: '$createdAt' },
        },
      },
    ]);

    const synthesized = orderOnlyCustomers.map((group) => ({
      _id: group._id,
      clerkId: group._id,
      name: group.name,
      email: group.email,
      role: 'customer' as const,
      orderCount: group.orderCount,
      ltv: Math.round((group.ltv || 0) * 100) / 100,
      createdAt: group.createdAt,
      imageUrl: undefined,
    }));

    const combined = [...enriched, ...synthesized].sort(
      (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
    );

    return c.json(combined);
  })
  .patch('/:id/role', requireOwner, async (c) => {
    const parsedParams = parseParams(c, userIdParamsSchema);
    if (!parsedParams.success) return parsedParams.response;

    const parsedBody = await parseJson(c, rolePayloadSchema);
    if (!parsedBody.success) return parsedBody.response;

    const user = await User.findById(parsedParams.data.id);
    if (!user) return c.json({ error: 'Not found' }, 404);

    // Defensa en profundidad: el owner no puede ser degradado por nadie, ni siquiera por si mismo
    // vía esta ruta (aunque requireOwner ya garantiza que solo el owner llega hasta aca).
    if (user.role === 'owner') {
      return c.json({ error: 'No se puede cambiar el rol del owner' }, 403);
    }

    const previousRole = user.role;
    user.role = parsedBody.data.role;
    await user.save();

    try {
      const clerkUser = await clerk.users.getUser(user.clerkId);
      await clerk.users.updateUserMetadata(user.clerkId, {
        publicMetadata: { ...clerkUser.publicMetadata, role: parsedBody.data.role },
      });
    } catch (error) {
      console.error('[ADMIN] Failed to sync Clerk role:', error);
    }

    recordSecurityEvent(c, {
      actor: c.get('user'),
      action: 'user.role_changed',
      resource: `PATCH /admin/users/${parsedParams.data.id}/role`,
      target: {
        clerkId: user.clerkId,
        userId: user._id,
        email: user.email,
      },
      metadata: {
        previousRole,
        nextRole: parsedBody.data.role,
      },
    });

    return c.json({ ok: true });
  })
  .delete('/:id', async (c) => {
    const parsedParams = parseParams(c, userIdParamsSchema);
    if (!parsedParams.success) return parsedParams.response;

    const user = await User.findById(parsedParams.data.id);
    if (!user) return c.json({ error: 'Not found' }, 404);

    if (user.role === 'owner') {
      return c.json({ error: 'No se puede eliminar al owner' }, 403);
    }

    await User.findByIdAndDelete(user._id);

    return c.json({ ok: true });
  });
