import { Coupon } from '../db/models/Coupon';

export type CreateCouponInput = {
  code: string;
  label: string;
  discountType: 'percent' | 'fixed';
  percentOff?: number;
  amountOff?: number;
  eligibleCategories?: string[];
  expiresAt?: Date | null;
  active?: boolean;
  maxUses?: number | null;
  firstPurchaseOnly?: boolean;
};

export async function createCoupon(input: CreateCouponInput) {
  const code = input.code.trim().toUpperCase();
  if (!code) throw new Error('El código es obligatorio.');

  const existing = await Coupon.findOne({ code }).lean();
  if (existing) throw new Error('Ya existe un cupón con ese código.');

  if (input.discountType === 'percent') {
    const pct = input.percentOff ?? 0;
    if (pct <= 0 || pct > 100) throw new Error('El porcentaje debe estar entre 1 y 100.');
  } else {
    const amt = input.amountOff ?? 0;
    if (amt <= 0) throw new Error('El monto fijo debe ser mayor a 0.');
  }

  const coupon = await Coupon.create({
    code,
    label: input.label.trim(),
    discountType: input.discountType,
    percentOff: input.discountType === 'percent' ? input.percentOff : undefined,
    amountOff: input.discountType === 'fixed' ? input.amountOff : undefined,
    eligibleCategories: input.eligibleCategories ?? [],
    expiresAt: input.expiresAt ?? null,
    active: input.active ?? true,
    maxUses: input.maxUses ?? null,
    firstPurchaseOnly: input.firstPurchaseOnly ?? false,
  });

  return coupon.toObject();
}
