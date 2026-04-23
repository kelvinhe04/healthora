import Elysia from 'elysia';
import { requireAdmin } from '../../middleware/requireAdmin';
import { Order } from '../../db/models/Order';
import { Product } from '../../db/models/Product';
import { User } from '../../db/models/User';

export const adminDashboardRouter = new Elysia({ prefix: '/admin/dashboard' })
  .use(requireAdmin)
  .get('/', async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [totalOrders, monthOrders, lastMonthOrders, totalUsers, lowStockProducts] = await Promise.all([
      Order.countDocuments({ status: { $ne: 'cancelled' } }),
      Order.find({ status: { $in: ['paid', 'processing', 'shipped', 'delivered'] }, createdAt: { $gte: startOfMonth } }).lean(),
      Order.find({ status: { $in: ['paid', 'processing', 'shipped', 'delivered'] }, createdAt: { $gte: startOfLastMonth, $lt: startOfMonth } }).lean(),
      User.countDocuments(),
      Product.find({ stock: { $lte: 5, $gt: 0 } }).lean(),
    ]);

    const revenue = monthOrders.reduce((s: number, o) => s + ((o as { total?: number }).total || 0), 0);
    const lastRevenue = lastMonthOrders.reduce((s: number, o) => s + ((o as { total?: number }).total || 0), 0);
    const revenueDelta = lastRevenue ? Math.round(((revenue - lastRevenue) / lastRevenue) * 100) : 0;

    // 30-day daily sales
    const dailySales = await Order.aggregate([
      { $match: { status: { $in: ['paid', 'processing', 'shipped', 'delivered'] }, createdAt: { $gte: new Date(Date.now() - 30 * 864e5) } } },
      { $group: { _id: { $dateToString: { format: '%m/%d', date: '$createdAt' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', revenue: 1, orders: 1, _id: 0 } },
    ]);

    const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(5).lean();

    return {
      kpis: {
        revenue: Math.round(revenue * 100) / 100,
        revenueDelta,
        totalOrders,
        monthOrders: monthOrders.length,
        totalUsers,
        lowStock: lowStockProducts.length,
      },
      dailySales,
      recentOrders,
    };
  });
