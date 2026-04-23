import Elysia from 'elysia';
import { verifyToken } from '@clerk/backend';
import { clerk } from '../lib/clerk';
import { User } from '../db/models/User';

const AUTHORIZED_PARTIES = ['http://localhost:5173', 'http://localhost:5175', 'http://localhost:3001'];

export const clerkAuth = new Elysia({ name: 'clerk-auth' }).derive(
  { as: 'global' },
  async ({ headers, set }) => {
    const authHeader = headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('[AUTH] Missing or invalid authorization header:', authHeader);
      set.status = 401;
      throw new Error('Unauthorized');
    }
    const token = authHeader.slice(7);
    try {
      console.log('[AUTH] Verifying token with verifyToken...');
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
        authorizedParties: AUTHORIZED_PARTIES,
      });
      
      if (!payload || payload.errors) {
        console.log('[AUTH] Token verification failed:', payload?.errors);
        set.status = 401;
        throw new Error('Invalid token');
      }
      
      const clerkId = payload.sub;
      console.log('[AUTH] Token verified, clerkId:', clerkId);
      let user = await User.findOne({ clerkId });
      if (!user) {
        console.log('[AUTH] Creating new user for clerkId:', clerkId);
        const clerkUser = await clerk.users.getUser(clerkId);
        user = await User.create({
          clerkId,
          name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim(),
          email: clerkUser.emailAddresses[0]?.emailAddress,
          role: (clerkUser.publicMetadata?.role as string) || 'customer',
        });
      }
      return { user: { clerkId, role: user.role, name: user.name, email: user.email, _id: user._id } };
    } catch (err) {
      console.error('[AUTH] Token verification failed:', err);
      set.status = 401;
      throw new Error('Invalid token');
    }
  }
);
