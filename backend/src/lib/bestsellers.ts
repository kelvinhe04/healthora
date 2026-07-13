import { Order } from '../db/models/Order';
import { Product } from '../db/models/Product';

const BESTSELLER_TAG = 'Más vendido';
export const TOP_N = 8;

export async function recalculateBestsellers(): Promise<void> {
  // Aggregate total units sold per product from paid orders
  const top = await Order.aggregate<{ _id: string; totalSold: number }>([
    { $match: { paymentStatus: 'paid' } },
    { $unwind: '$items' },
    { $group: { _id: '$items.productId', totalSold: { $sum: '$items.qty' } } },
    { $sort: { totalSold: -1 } },
    { $limit: TOP_N },
  ]);

  const bestsellerIds = top.map((r) => r._id);

  // Clear old bestseller tags, then set new ones
  await Product.updateMany({ tag: BESTSELLER_TAG }, { $set: { tag: '' } });

  if (bestsellerIds.length > 0) {
    await Product.updateMany(
      { id: { $in: bestsellerIds } },
      { $set: { tag: BESTSELLER_TAG } },
    );
  }

  console.log(
    `[bestsellers] Top ${bestsellerIds.length} updated:`,
    bestsellerIds,
  );
}

const NEW_TAG = 'Nuevo';
export const NEW_TOP_N = 8;

export async function recalculateNew(): Promise<void> {
  // Always tag the NEW_TOP_N most recently added products, regardless of date
  const recent = await Product.find({ active: true })
    .sort({ createdAt: -1 })
    .limit(NEW_TOP_N)
    .select('id')
    .lean();

  const recentIds = recent.map((p: any) => p.id);

  // Clear old "Nuevo" tags, then set new ones
  await Product.updateMany({ tag: NEW_TAG }, { $set: { tag: '' } });

  if (recentIds.length > 0) {
    await Product.updateMany(
      { id: { $in: recentIds } },
      { $set: { tag: NEW_TAG } },
    );
  }

  console.log(`[new-products] Tagged ${recentIds.length} products as Nuevo:`, recentIds);
}

const PURCHASES_WINDOW_DAYS = 30;

export async function recalculatePurchasesLastMonth(): Promise<void> {
  const since = new Date(Date.now() - PURCHASES_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Units sold per product from paid orders in the last 30 days (rolling window, unlike
  // recalculateBestsellers's all-time total).
  const counts = await Order.aggregate<{ _id: string; totalSold: number }>([
    { $match: { paymentStatus: 'paid', createdAt: { $gte: since } } },
    { $unwind: '$items' },
    { $group: { _id: '$items.productId', totalSold: { $sum: '$items.qty' } } },
  ]);

  await Product.updateMany({}, { $set: { purchasesLastMonth: 0 } });

  if (counts.length > 0) {
    await Product.bulkWrite(
      counts.map((c) => ({
        updateOne: {
          filter: { id: c._id },
          update: { $set: { purchasesLastMonth: c.totalSold } },
        },
      })),
    );
  }

  console.log(`[purchases-last-month] Updated ${counts.length} products`);
}
