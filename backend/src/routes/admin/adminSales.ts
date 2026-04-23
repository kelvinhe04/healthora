import Elysia from 'elysia';
import { requireAdmin } from '../../middleware/requireAdmin';
import { Order } from '../../db/models/Order';

export const adminSalesRouter = new Elysia({ prefix: '/admin/sales' })
  .use(requireAdmin)
  .get('/', async () => {
    const paidStatuses = ['paid', 'processing', 'shipped', 'delivered'];

    const [daily, byCategory, topProducts] = await Promise.all([
      Order.aggregate([
        { $match: { status: { $in: paidStatuses }, createdAt: { $gte: new Date(Date.now() - 30 * 864e5) } } },
        { $group: { _id: { $dateToString: { format: '%m/%d', date: '$createdAt' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { date: '$_id', revenue: 1, orders: 1, _id: 0 } },
      ]),
      Order.aggregate([
        { $match: { status: { $in: paidStatuses } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.productId', revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } }, units: { $sum: '$items.qty' } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]),
      Order.aggregate([
        { $match: { status: { $in: paidStatuses } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.productName', revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } }, units: { $sum: '$items.qty' } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]),
    ]);

    return { daily, byCategory, topProducts };
  });
