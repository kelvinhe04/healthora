import { Schema, model } from 'mongoose';

const CouponSchema = new Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  label: { type: String, required: true },
  discountType: { type: String, enum: ['percent', 'fixed'], default: 'percent' },
  percentOff: { type: Number, min: 0, max: 100 },
  amountOff: { type: Number, min: 0 },
  eligibleCategories: [{ type: String }],
  expiresAt: { type: Date, default: null },
  active: { type: Boolean, default: true },
  maxUses: { type: Number, default: null },
  usesCount: { type: Number, default: 0 },
  firstPurchaseOnly: { type: Boolean, default: false },
});

export const Coupon = model('Coupon', CouponSchema);
