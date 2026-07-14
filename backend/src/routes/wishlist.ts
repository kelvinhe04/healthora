import { Hono } from 'hono';
import { z } from 'zod';
import { clerkAuth } from '../middleware/clerkAuth';
import type { AppEnv } from '../types/hono';
import { getWishlistForClerkId, setWishlistForClerkId } from '../lib/wishlist';
import { parseJson, productIdSchema } from '../lib/validation';

const wishlistSchema = z.object({
  productIds: z.array(productIdSchema).max(200).default([]),
});

export const wishlistRouter = new Hono<AppEnv>()
  .use('*', clerkAuth)
  .get('/', async (c) => {
    const productIds = await getWishlistForClerkId(c.get('user').clerkId);
    return c.json({ productIds });
  })
  .put('/', async (c) => {
    const parsed = await parseJson(c, wishlistSchema);
    if (!parsed.success) return parsed.response;

    const productIds = await setWishlistForClerkId(c.get('user').clerkId, parsed.data.productIds);
    return c.json({ productIds });
  });
