import { verifyToken } from '@clerk/backend';
import { createMiddleware } from 'hono/factory';
import { clerk } from '../lib/clerk';
import { User } from '../db/models/User';
import type { AppEnv } from '../types/hono';
import { userRateLimit } from './rateLimit';
import { recordSecurityEvent } from '../lib/securityAudit';
import { getAuthorizedParties } from '../lib/appEnv';
import { getExternalAvatarUrl } from '../lib/clerkAvatar';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || process.env.CLERK_ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

/** `currentRole` guards 'owner' from ever being silently downgraded here: Clerk/ADMIN_EMAILS only
 * ever resolve to 'admin' or 'customer', and this function runs on every authenticated request
 * (see both call sites below) - without this guard, the owner's role would get overwritten back
 * to 'admin' on their very next request after being set (HU-222, bun run set-owner). */
function resolveRole(email?: string | null, metadataRole?: string | null, currentRole?: string | null) {
  if (currentRole === 'owner') return 'owner';
  if (email && ADMIN_EMAILS.includes(email.toLowerCase())) return 'admin';
  if (metadataRole === 'admin') return 'admin';
  return 'customer';
}

export const clerkAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (process.env.NODE_ENV === 'test') {
    c.set('user', {
      clerkId: c.req.header('x-test-clerk-id') || 'test-user',
      role: c.req.header('x-test-role') || 'customer',
      name: c.req.header('x-test-name') || 'Test User',
      email: c.req.header('x-test-email') || 'test@example.com',
    });
    await next();
    return;
  }

  const authHeader = c.req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties: getAuthorizedParties(),
    });

    if (!payload || payload.errors) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const clerkId = payload.sub;
    let user = await User.findOne({ clerkId }).lean();
    let createdUser = false;

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
            imageUrl: getExternalAvatarUrl(clerkUser) || clerkUser.imageUrl,
          },
          { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
        createdUser = true;
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
    const role = resolveRole(email, clerkUser.publicMetadata?.role as string | undefined, user.role);
    const nextName = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim();
    // Prefer the OAuth provider's own avatar URL over Clerk's img.clerk.com proxy - that proxy
    // domain isn't guaranteed to resolve on every network (#314).
    const imageUrl = getExternalAvatarUrl(clerkUser) || clerkUser.imageUrl;

    if (user.email !== email || user.role !== role || user.name !== nextName || user.imageUrl !== imageUrl) {
      await User.updateOne(
        { clerkId },
        { email, role, name: nextName, imageUrl }
      );
      user = { ...user, email, role, name: nextName, imageUrl };
    }

    c.set('user', {
      clerkId,
      role: user.role,
      name: user.name,
      email: user.email,
      imageUrl,
      _id: user._id,
    });

    const rateLimitedResponse = await userRateLimit(c, async () => undefined);
    if (rateLimitedResponse) return rateLimitedResponse;

    recordSecurityEvent(c, {
      actor: {
        clerkId,
        role: user.role,
        name: user.name,
        email: user.email,
        _id: user._id,
      },
      action: 'auth.login',
      metadata: { newUser: createdUser },
    });

    await next();
  } catch (error) {
    console.error('[AUTH] Token verification failed:', error);
    return c.json({ error: 'Invalid token' }, 401);
  }
});
