import { Order } from '../db/models/Order';
import { Product } from '../db/models/Product';
import { User } from '../db/models/User';
import { normalizeOrder } from './orderStatus';
import { LOW_STOCK_THRESHOLD } from './realtime';
import { enumerateStockCells } from './lowStock';

const paidOrdersMatch = {
  $or: [
    { paymentStatus: 'paid' },
    { paymentStatus: { $exists: false }, status: { $in: ['paid', 'processing', 'shipped', 'delivered'] } },
  ],
};

const nonCancelledOrdersMatch = {
  $or: [
    { paymentStatus: { $ne: 'cancelled' } },
    { paymentStatus: { $exists: false }, status: { $ne: 'cancelled' } },
  ],
};

export async function getDashboardSummary() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [totalOrders, monthOrders, lastMonthOrders, totalUsers] = await Promise.all([
    Order.countDocuments(nonCancelledOrdersMatch),
    Order.find({ ...paidOrdersMatch, createdAt: { $gte: startOfMonth } }).lean(),
    Order.find({ ...paidOrdersMatch, createdAt: { $gte: startOfLastMonth, $lt: startOfMonth } }).lean(),
    User.countDocuments(),
  ]);

  const revenue = monthOrders.reduce((sum: number, order) => sum + ((order as { total?: number }).total || 0), 0);
  const lastRevenue = lastMonthOrders.reduce((sum: number, order) => sum + ((order as { total?: number }).total || 0), 0);
  const revenueDelta = lastRevenue ? Math.round(((revenue - lastRevenue) / lastRevenue) * 100) : 0;

  const thirtyDaysAgo = new Date(Date.now() - 29 * 864e5);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const dailySalesRaw = await Order.aggregate([
    { $match: { ...paidOrdersMatch, createdAt: { $gte: thirtyDaysAgo } } },
    { $group: { _id: { $dateToString: { format: '%m/%d', date: '$createdAt' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const dailySalesMap = new Map(dailySalesRaw.map((d) => [d._id, d]));
  const dailySales: { date: string; revenue: number; orders: number }[] = [];

  for (let i = 0; i < 30; i++) {
    const date = new Date(thirtyDaysAgo.getTime() + i * 864e5);
    const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    const found = dailySalesMap.get(dateStr);
    dailySales.push({
      date: dateStr,
      revenue: found ? found.revenue : 0,
      orders: found ? found.orders : 0,
    });
  }

  const recentOrders = (await Order.find().sort({ createdAt: -1 }).limit(5).lean()).map((order) => normalizeOrder(order));
  const activeProducts = await Product.find({ active: true }).lean();
  const allLowStockCells = activeProducts
    .flatMap((product) => {
      const threshold = product.lowStockThreshold ?? LOW_STOCK_THRESHOLD;
      return enumerateStockCells(product)
        .filter((cell) => cell.stock <= threshold)
        .map((cell) => ({ variantId: cell.variantId, variantLabel: cell.variantLabel, stock: cell.stock, product }));
    })
    .sort((a, b) => a.stock - b.stock);
  const lowStockCells = allLowStockCells.slice(0, 6);

  return {
    kpis: {
      revenue: Math.round(revenue * 100) / 100,
      revenueDelta,
      totalOrders,
      monthOrders: monthOrders.length,
      totalUsers,
      lowStock: allLowStockCells.length,
    },
    dailySales,
    recentOrders,
    lowStockCells,
  };
}
