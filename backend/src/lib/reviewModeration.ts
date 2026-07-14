import { Review } from '../db/models/Review';
import { ReviewBan } from '../db/models/ReviewBan';
import { recomputeProductRating } from './productRatings';

export type BanReviewAuthorResult =
  | { ok: true; productId: string; userName: string }
  | { ok: false; error: string };

export async function banReviewAuthor(reviewId: string, bannedBy: string): Promise<BanReviewAuthorResult> {
  const review = await Review.findById(reviewId).lean();
  if (!review) return { ok: false, error: 'Reseña no encontrada' };

  await ReviewBan.findOneAndUpdate(
    { productId: review.productId, userId: review.userId },
    { userName: review.userName, bannedBy },
    { upsert: true },
  );
  await Review.findByIdAndDelete(review._id);
  await recomputeProductRating(review.productId);

  return { ok: true, productId: review.productId, userName: review.userName };
}
