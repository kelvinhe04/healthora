import { Schema, model } from 'mongoose';

const ReviewBanSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    bannedBy: { type: String, required: true },
  },
  { timestamps: true }
);

ReviewBanSchema.index({ productId: 1, userId: 1 }, { unique: true });

export const ReviewBan = model('ReviewBan', ReviewBanSchema);
