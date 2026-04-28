import { verifyToken } from '@clerk/backend';
import { createMiddleware } from 'hono/factory';
import { clerk } from '../lib/clerk';
import { User } from '../db/models/User';
import type { AppEnv } from '../types/hono';

const AUTHORIZED_PARTIES = ['http://localhost:5173', 'http://localhost:5175', 'http://localhost:3001'];
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || process.env.CLERK_ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function resolveRole(email?: string | null, metadataRole?: string | null) {
  if (email && ADMIN_EMAILS.includes(email.toLowerCase())) return 'admin';
  if (metadataRole === 'admin') return 'admin';
  return 'customer';
}

export const clerkAuth = createMiddleware<AppEnv>(async (c, next) => {
  const authHeader = c.req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties: AUTHORIZED_PARTIES,
    });

    if (!payload || payload.errors) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const clerkId = payload.sub;
    let user = await User.findOne({ clerkId }).lean();

    if (!user) {
      try {
        const clerkUser = await clerk.users.getUser(clerkId);
        const email = clerkUser.emailAddresses[0]?.emailAddress;
        const role = resolveRole(email, clerkUser.publicMetadata?.role as string | undefined);

        user = await User.findOneAndUpdate(
          { clerkId },
          {
            clerkId,
            name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim(),
            email,
            role,
          },
          { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
      } catch (createError: unknown) {
        console.error('[AUTH] User upsert error:', createError);
        user = await User.findOne({ clerkId }).lean();
      }
    }

    if (!user) {
      return c.json({ error: 'User not found' }, 401);
    }

    const clerkUser = await clerk.users.getUser(clerkId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    const role = resolveRole(email, clerkUser.publicMetadata?.role as string | undefined);
    const nextName = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim();

    if (user.email !== email || user.role !== role || user.name !== nextName) {
      await User.updateOne(
        { clerkId },
        { email, role, name: nextName }
      );
      user = { ...user, email, role, name: nextName };
    }

    c.set('user', {
      clerkId,
      role: user.role,
      name: user.name,
      email: user.email,
      imageUrl: clerkUser.imageUrl,
      _id: user._id,
    });

    await next();
  } catch (error) {
    console.error('[AUTH] Token verification failed:', error);
    return c.json({ error: 'Invalid token' }, 401);
  }
});
