import Elysia from 'elysia';
import { clerkAuth } from './clerkAuth';

export const requireAdmin = new Elysia({ name: 'require-admin' })
  .use(clerkAuth)
  .derive({ as: 'global' }, ({ user, set }) => {
    if (user.role !== 'admin') {
      set.status = 403;
      throw new Error('Forbidden');
    }
    return {};
  });
