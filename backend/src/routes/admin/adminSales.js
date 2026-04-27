import { Hono } from 'hono';
import { requireAdmin } from '../../middleware/requireAdmin';
import { Order } from '../../db/models/Order';
import { Product } from '../../db/models/Product';

const adminSalesRouter = new Hono()
  .use('*', requireAdmin)
  .get('/', async (c) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const summary = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$total' },
        avgOrderValue: { $avg: '$total' },
        totalUnits: { $sum: { $sum: '$items.qty' } },
      }},
    ]);

    const daily = await Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: thirtyDaysAgo } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$total' },
        orders: { $sum: 1 },
        units: { $sum: { $sum: '$items.qty' } },
      }},
      { $sort: { _id: 1 } },
    ]);

    const revenueByCategory = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $unwind: '$items' },
      { $lookup: { from: 'products', localField: 'items.productId', foreignField: 'id', as: 'prod' } },
      { $unwind: '$prod' },
      { $group: {
        _id: '$prod.category',
        revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
        units: { $sum: '$items.qty' },
      }},
      { $sort: { revenue: -1 } },
      { $project: { date: '$_id', value: '$revenue', _id: 0 } },
    ]);

    const topProducts = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $unwind: '$items' },
      { $group: { _id: '$items.productId', units: { $sum: '$items.qty' }, revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]);

    const topProductNames = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $unwind: '$items' },
      { $group: { _id: '$items.productName', units: { $sum: '$items.qty' }, revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]);

    const topCategories = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $unwind: '$items' },
      { $lookup: { from: 'products', localField: 'items.productId', foreignField: 'id', as: 'prod' } },
      { $unwind: '$prod' },
      { $group: { _id: '$prod.category', units: { $sum: '$items.qty' }, revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } } } },
      { $sort: { units: -1 } },
      { $limit: 5 },
    ]);

    const topBrands = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $unwind: '$items' },
      { $lookup: { from: 'products', localField: 'items.productId', foreignField: 'id', as: 'prod' } },
      { $unwind: '$prod' },
      { $group: { _id: '$prod.brand', units: { $sum: '$items.qty' }, revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } } } },
      { $sort: { units: -1 } },
      { $limit: 5 },
    ]);

    const ids = topProducts.map(function(i) { return i._id; });
    const products = await Product.find({ id: { $in: ids } }).select('id name brand category').lean();
    const map = new Map(products.map(function(p) { return [p.id, p]; }));
    
    const byCategory = topProducts.map(function(item) {
      const p = map.get(item._id);
      return { productId: item._id, name: p ? p.name : 'Unknown', brand: p ? p.brand : 'Unknown', category: p ? p.category : 'None', revenue: item.revenue, units: item.units };
    });

    return c.json({
      summary: summary[0] || { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0, totalUnits: 0 },
      daily,
      revenueByCategory,
      byCategory,
      topProducts: topProductNames,
      topCategories,
      topBrands,
    });
  });

export { adminSalesRouter };