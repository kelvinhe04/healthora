import { Hono } from 'hono';
import { requireAdmin } from '../../middleware/requireAdmin';
import type { AppEnv } from '../../types/hono';
import { Order } from '../../db/models/Order';

export const adminEarningsRouter = new Hono<AppEnv>()
  .use('*', requireAdmin)
  .get('/', async (c) => {
    const paidOrdersMatch = {
      $or: [
        { paymentStatus: 'paid' },
        { paymentStatus: { $exists: false }, status: { $in: ['paid', 'processing', 'shipped', 'delivered'] } },
      ],
    };
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [monthly, summary] = await Promise.all([
      Order.aggregate([
        { $match: { ...paidOrdersMatch, createdAt: { $gte: sixMonthsAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { month: '$_id', revenue: 1, orders: 1, _id: 0 } },
      ]),
      Order.aggregate([
        { $match: paidOrdersMatch },
        { $group: { _id: null, gross: { $sum: '$total' }, tax: { $sum: '$tax' }, shipping: { $sum: '$shipping' }, count: { $sum: 1 } } },
      ]),
    ]);

    const s = summary[0] || { gross: 0, tax: 0, shipping: 0, count: 0 };
    const fees = Math.round(s.gross * 0.029 * 100) / 100;
    const net = Math.round((s.gross - s.tax - fees) * 100) / 100;

    return c.json({
      monthly,
      summary: { gross: s.gross, tax: s.tax, shipping: s.shipping, fees, net, orders: s.count },
    });
  });
