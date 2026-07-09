import { Product } from '../db/models/Product';
import { Review } from '../db/models/Review';

/**
 * Recomputes rating/reviews on every Product from the real Review collection (grouped by
 * productId, one query). Products with no reviews are reset to 0/0. Used both by the reviews
 * seed script (so a fresh seed never drifts from the real data) and by the one-off
 * recompute-ratings CLI script (for backfilling a database seeded before this existed).
 */
export async function recomputeAllProductRatings(): Promise<{ updated: number; total: number }> {
  const summary = await Review.aggregate([
    { $group: { _id: '$productId', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const byProductId = new Map(
    summary.map((entry) => [entry._id as string, { rating: Math.round(entry.avgRating * 10) / 10, reviews: entry.count }]),
  );

  const products = await Product.find().select('id rating reviews').lean();
  let updated = 0;

  for (const product of products) {
    const real = byProductId.get(product.id) ?? { rating: 0, reviews: 0 };
    if (product.rating === real.rating && product.reviews === real.reviews) continue;
    await Product.updateOne({ _id: product._id }, { rating: real.rating, reviews: real.reviews });
    updated++;
  }

  return { updated, total: products.length };
}
