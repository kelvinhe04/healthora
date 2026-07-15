import { connectDB } from './connection';
import { Product } from './models/Product';

/**
 * One-off backfill for the new Product.sampleEligible flag (issue #151), for any database that
 * predates it and isn't getting re-seeded (seed.ts already sets it for fresh data). Mirrors the
 * old hardcoded cutoff it replaces (`price < 25` in SamplePicker.tsx) so existing catalogs keep
 * the exact same sample-eligible set on first run.
 *
 * Not safe to run again after an admin has manually excluded a sub-$25 product from the sample -
 * a rerun would flip it back to true. Meant to run exactly once per database, right after this
 * field ships.
 *
 * Usage: bun run backfill-sample-eligibility
 */
async function main() {
  await connectDB();
  const result = await Product.updateMany(
    { price: { $lt: 25 }, sampleEligible: { $ne: true } },
    { $set: { sampleEligible: true } },
  );
  console.log(`✓ ${result.modifiedCount} productos marcados como sampleEligible (price < 25).`);
  process.exit(0);
}

main().catch((error) => {
  console.error('[backfill-sample-eligibility] error:', error);
  process.exit(1);
});
