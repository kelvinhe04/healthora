import { Hono } from "hono";
import { clerkAuth } from "../middleware/clerkAuth";
import type { AppEnv, CartItem, CartRequestBody, CartResponseItem } from "../types/hono";
import { User } from "../db/models/User";
import { Product } from "../db/models/Product";

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
      return { product, qty: item.qty };
    })
    .filter(Boolean) as CartResponseItem[];
}

export const cartRouter = new Hono<AppEnv>()
  .use("*", clerkAuth)
  .get("/", async (c) => {
    return c.json(await buildCartResponse(c.get("user").clerkId));
  })
  .put("/", async (c) => {
    const body = await c.req.json<CartRequestBody>();
    const items = Array.isArray(body.items) ? body.items : [];

    const sanitizedItems: CartItem[] = items
      .map((item) => ({
        productId: item.productId,
        qty: Math.max(0, Math.floor(item.qty)),
      }))
      .filter((item) => item.qty > 0);

    const uniqueProductIds = [
      ...new Set(sanitizedItems.map((item) => item.productId)),
    ];
    const existingProducts = await Product.find({
      id: { $in: uniqueProductIds },
      active: true,
    })
      .select("id")
      .lean();
    const validIds = new Set(existingProducts.map((product) => product.id));
    const validItems: CartItem[] = sanitizedItems.filter((item) =>
      validIds.has(item.productId),
    );

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
