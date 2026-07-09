import { connectDB } from './connection';
import { recomputeAllProductRatings } from '../lib/productRatings';

/**
 * One-off backfill for databases seeded before seed-reviews.ts started keeping
 * Product.rating/reviews in sync automatically. Safe to run again any time - it's a no-op for
 * products that already match their real Review data.
 */
async function main() {
  await connectDB();
  const { updated, total } = await recomputeAllProductRatings();
  console.log(`✓ ${updated} de ${total} productos actualizados con su rating/reviews real.`);
  process.exit(0);
}

main().catch((error) => {
  console.error('[recompute-ratings] error:', error);
  process.exit(1);
});
