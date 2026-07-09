import { connectDB } from './connection';
import { Product } from './models/Product';
import { Review } from './models/Review';

/**
 * One-time backfill: Product.rating/reviews were set to made-up placeholder numbers by the
 * initial catalog seed (e.g. "2340 reviews") and were never reconciled with the real Review
 * documents inserted later by seed-reviews.ts. New reviews created through the app already
 * recompute these fields correctly (see POST /reviews) - this script just fixes the products
 * that predate that, so rating/reviews everywhere matches the real Review collection.
 */
async function main() {
  await connectDB();

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

  console.log(`✓ ${updated} de ${products.length} productos actualizados con su rating/reviews real.`);
  process.exit(0);
}

main().catch((error) => {
  console.error('[recompute-ratings] error:', error);
  process.exit(1);
});
