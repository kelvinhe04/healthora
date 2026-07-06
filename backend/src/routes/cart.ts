import { Hono } from 'hono';
import { z } from 'zod';
import { clerkAuth } from '../middleware/clerkAuth';
import type { AppEnv } from '../types/hono';
import { User } from '../db/models/User';
import { Product } from '../db/models/Product';
import { cartItemSchema, parseJson } from '../lib/validation';

const cartSchema = z.object({
  items: z.array(cartItemSchema).max(100).default([]),
});

async function buildCartResponse(clerkId: string) {
  const user = await User.findOne({ clerkId }).lean();
  const cart = (user?.cart || []).filter((item) => item.qty > 0);
  const productIds = cart.map((item) => item.productId);
  const products = await Product.find({ id: { $in: productIds }, active: true }).lean();
  const productMap = new Map(products.map((product) => [product.id, product]));

  return cart
    .map((item) => {
      const product = productMap.get(item.productId);
      if (!product) return null;
      return { product, qty: item.qty };
    })
    .filter(Boolean);
}

export const cartRouter = new Hono<AppEnv>()
  .use('*', clerkAuth)
  .get('/', async (c) => {
    return c.json(await buildCartResponse(c.get('user').clerkId));
  })
  .put('/', async (c) => {
    const parsed = await parseJson(c, cartSchema);
    if (!parsed.success) return parsed.response;

    const sanitizedItems = parsed.data.items;

    const uniqueProductIds = [...new Set(sanitizedItems.map((item) => item.productId))];
    const existingProducts = await Product.find({ id: { $in: uniqueProductIds }, active: true }).select('id').lean();
    const validIds = new Set(existingProducts.map((product) => product.id));
    const validItems = sanitizedItems.filter((item) => validIds.has(item.productId));

    const updatedUser = await User.findOneAndUpdate(
      { clerkId: c.get('user').clerkId },
      { $set: { cart: validItems } },
      { returnDocument: 'after' }
    ).lean();

    if (!updatedUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json(await buildCartResponse(c.get('user').clerkId));
  });
