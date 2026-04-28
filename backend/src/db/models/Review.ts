import { Schema, model } from 'mongoose';

const ReviewSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: String,
    body: { type: String, required: true },
    userAvatar: String,
    helpfulVoters: { type: [String], default: [] },
  },
  { timestamps: true }
);

ReviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

export const Review = model('Review', ReviewSchema);
