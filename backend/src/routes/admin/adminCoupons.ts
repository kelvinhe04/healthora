import { Hono } from 'hono';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/requireAdmin';
import { auditAdminMutations } from '../../middleware/auditAdminAction';
import type { AppEnv } from '../../types/hono';
import { Coupon } from '../../db/models/Coupon';
import { createCoupon } from '../../lib/coupons';
import { moneyFromInput, optionalTextField, parseJson, parseParams, textField } from '../../lib/validation';

const couponCreateSchema = z
  .object({
    code: textField(40),
    label: textField(120),
    discountType: z.enum(['percent', 'fixed']),
    percentOff: moneyFromInput(1, 100).optional(),
    amountOff: moneyFromInput(0.01, 999999).optional(),
    eligibleCategories: z.array(textField(120)).max(30).optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    active: z.coerce.boolean().optional().default(true),
    maxUses: z.coerce.number().int().min(1).max(999999).nullable().optional(),
    firstPurchaseOnly: z.coerce.boolean().optional().default(false),
  })
  .refine((body) => body.discountType !== 'percent' || body.percentOff != null, {
    message: 'percentOff es obligatorio para descuentos porcentuales.',
    path: ['percentOff'],
  })
  .refine((body) => body.discountType !== 'fixed' || body.amountOff != null, {
    message: 'amountOff es obligatorio para descuentos fijos.',
    path: ['amountOff'],
  });

const couponPatchSchema = z
  .object({
    label: optionalTextField(120),
    discountType: z.enum(['percent', 'fixed']).optional(),
    percentOff: moneyFromInput(1, 100).optional(),
    amountOff: moneyFromInput(0.01, 999999).optional(),
    eligibleCategories: z.array(textField(120)).max(30).optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    active: z.coerce.boolean().optional(),
    maxUses: z.coerce.number().int().min(1).max(999999).nullable().optional(),
    firstPurchaseOnly: z.coerce.boolean().optional(),
  })
  .refine((body) => body.discountType !== 'percent' || body.percentOff != null, {
    message: 'percentOff es obligatorio para descuentos porcentuales.',
    path: ['percentOff'],
  })
  .refine((body) => body.discountType !== 'fixed' || body.amountOff != null, {
    message: 'amountOff es obligatorio para descuentos fijos.',
    path: ['amountOff'],
  });

const codeParamsSchema = z.object({ code: textField(40) });

export const adminCouponsRouter = new Hono<AppEnv>()
  .use('*', requireAdmin)
  .use('*', auditAdminMutations('coupons'))
  .get('/', async (c) => c.json(await Coupon.find().sort({ createdAt: -1 }).lean()))
  .post('/', async (c) => {
    const parsed = await parseJson(c, couponCreateSchema);
    if (!parsed.success) return parsed.response;
    try {
      const coupon = await createCoupon(parsed.data);
      return c.json(coupon, 201);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Error' }, 400);
    }
  })
  .patch('/:code', async (c) => {
    const paramsParsed = parseParams(c, codeParamsSchema);
    if (!paramsParsed.success) return paramsParsed.response;
    const bodyParsed = await parseJson(c, couponPatchSchema);
    if (!bodyParsed.success) return bodyParsed.response;

    const code = paramsParsed.data.code.trim().toUpperCase();
    const coupon = await Coupon.findOneAndUpdate({ code }, { $set: bodyParsed.data }, { returnDocument: 'after' }).lean();
    if (!coupon) return c.json({ error: 'Cupón no encontrado' }, 404);
    return c.json(coupon);
  })
  .delete('/:code', async (c) => {
    const paramsParsed = parseParams(c, codeParamsSchema);
    if (!paramsParsed.success) return paramsParsed.response;

    const code = paramsParsed.data.code.trim().toUpperCase();
    const coupon = await Coupon.findOne({ code }).lean();
    if (!coupon) return c.json({ error: 'Cupón no encontrado' }, 404);
    if ((coupon.usesCount ?? 0) > 0) {
      return c.json(
        { error: 'Este cupón ya fue usado en órdenes pasadas; desactívalo en lugar de eliminarlo.' },
        409,
      );
    }

    await Coupon.deleteOne({ code });
    return c.json({ ok: true, code });
  });
