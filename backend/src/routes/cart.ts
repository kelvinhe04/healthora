import { Hono } from 'hono';
import { z } from 'zod';
import { clerkAuth } from '../middleware/clerkAuth';
import type { AppEnv, CartItem, CartResponseItem } from '../types/hono';
import { User } from '../db/models/User';
import { Product } from '../db/models/Product';
import { cartItemSchema, parseJson } from '../lib/validation';
import { resolveVariantPricing } from '../lib/productVariants';

const cartSchema = z.object({
  items: z.array(cartItemSchema).max(100).default([]),
});

/** Drops a stale variantId (deleted variant, renamed combo) instead of failing the whole line -
 * the product itself is still a valid cart item, it just falls back to the base price/stock. */
function resolveValidVariantId(product: Parameters<typeof resolveVariantPricing>[0], variantId?: string): string | undefined {
  if (!variantId) return undefined;
  try {
    resolveVariantPricing(product, variantId);
    return variantId;
  } catch {
    return undefined;
  }
}

async function buildCartResponse(clerkId: string): Promise<CartResponseItem[]> {
  const user = await User.findOne({ clerkId }).lean();
  const cart = ((user?.cart ?? []) as CartItem[]).filter(
    (item) => item.qty > 0,
  );
  const productIds = cart.map((item) => item.productId);
  const products = await Product.find({
    id: { $in: productIds },
    active: true,
  }).lean();
  const productMap = new Map(products.map((product) => [product.id, product]));

  return cart
    .map((item) => {
      const product = productMap.get(item.productId);
      if (!product) return null;
      return { product, qty: item.qty, variantId: resolveValidVariantId(product, item.variantId) };
    })
    .filter(Boolean) as CartResponseItem[];
}

export const cartRouter = new Hono<AppEnv>()
  .use("*", clerkAuth)
  .get("/", async (c) => {
    return c.json(await buildCartResponse(c.get("user").clerkId));
  })
  .put('/', async (c) => {
    const parsed = await parseJson(c, cartSchema);
    if (!parsed.success) return parsed.response;

    const sanitizedItems = parsed.data.items;

    const uniqueProductIds = [
      ...new Set(sanitizedItems.map((item) => item.productId)),
    ];
    const existingProducts = await Product.find({
      id: { $in: uniqueProductIds },
      active: true,
    })
      .select("id name price stock category variants")
      .lean();
    const productMap = new Map(existingProducts.map((product) => [product.id, product]));
    const validItems: CartItem[] = sanitizedItems
      .filter((item) => productMap.has(item.productId))
      .map((item) => ({
        productId: item.productId,
        qty: item.qty,
        variantId: resolveValidVariantId(productMap.get(item.productId)!, item.variantId),
      }));

    const updatedUser = await User.findOneAndUpdate(
      { clerkId: c.get("user").clerkId },
      { $set: { cart: validItems } },
      { returnDocument: "after" },
    ).lean();

    if (!updatedUser) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json(await buildCartResponse(c.get("user").clerkId));
  });
