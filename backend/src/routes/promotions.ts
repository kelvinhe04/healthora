import { Hono } from 'hono';
import { z } from 'zod';
import { clerkAuth } from '../middleware/clerkAuth';
import type { AppEnv } from '../types/hono';
import { Coupon } from '../db/models/Coupon';
import { Product } from '../db/models/Product';
import { buildPromotionLineItems, validatePromotionForCart } from '../lib/promotions';
import { cartItemSchema, optionalTextField, parseJson } from '../lib/validation';

const validateSchema = z.object({
  code: optionalTextField(40).transform((code) => code?.toUpperCase() ?? ''),
  items: z.array(cartItemSchema).min(1).max(100),
});

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export const promotionsRouter = new Hono<AppEnv>()
  .use('*', clerkAuth)
  .get('/active', async (c) => {
    const now = new Date();
    const coupons = await Coupon.find({
      active: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      $expr: { $or: [{ $eq: ['$maxUses', null] }, { $lt: ['$usesCount', '$maxUses'] }] },
    })
      .select('code label discountType percentOff amountOff eligibleCategories expiresAt firstPurchaseOnly')
      .sort({ createdAt: -1 })
      .lean();
    return c.json(coupons);
  })
  .post('/validate', async (c) => {
    const parsed = await parseJson(c, validateSchema);
    if (!parsed.success) return parsed.response;

    const user = c.get('user');
    const { code, items } = parsed.data;
    const result = await validatePromotionForCart(code, items, { customerId: user.clerkId });

    if (!result.valid) {
      return c.json({ valid: false, error: result.error, reason: result.reason }, 400);
    }

    const productIds = [...new Set(items.map((i) => i.productId))];
    const products = await Product.find({ id: { $in: productIds }, active: true }).lean();
    const lineItems = buildPromotionLineItems(products, items);
    const cartSubtotal = roundMoney(
      lineItems.reduce((sum, item) => sum + item.product.price * item.qty, 0),
    );

    return c.json({
      valid: true,
      code: result.code,
      label: result.label,
      discountAmount: result.discountAmount,
      subtotal: cartSubtotal,
      discountedSubtotal: roundMoney(Math.max(0, cartSubtotal - result.discountAmount)),
    });
  });
