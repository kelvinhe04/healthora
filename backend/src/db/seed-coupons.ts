import { Coupon } from './models/Coupon';

const DEFAULT_COUPONS = [
  {
    code: 'BIENVENIDA',
    label: '15% nuevos clientes',
    discountType: 'percent' as const,
    percentOff: 15,
    eligibleCategories: [],
    expiresAt: null,
    active: true,
    firstPurchaseOnly: true,
  },
  {
    code: 'PIEL25',
    label: '25% rutina skincare',
    discountType: 'percent' as const,
    percentOff: 25,
    eligibleCategories: ['Salud de la piel', 'Hidratantes'],
    expiresAt: new Date('2026-12-31T23:59:59Z'),
    active: true,
    firstPurchaseOnly: false,
  },
];

export async function seedCoupons(): Promise<void> {
  for (const coupon of DEFAULT_COUPONS) {
    await Coupon.updateOne({ code: coupon.code }, { $set: coupon }, { upsert: true });
  }
}
