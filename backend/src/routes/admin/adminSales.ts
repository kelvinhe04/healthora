import { Hono } from "hono";
import { requireAdmin } from "../../middleware/requireAdmin";
import { Order } from "../../db/models/Order";
import { Product } from "../../db/models/Product";

function buildRollingDays(totalDays) {
  const today = new Date();
  const endExclusive = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));
  const start = new Date(endExclusive);
  start.setUTCDate(start.getUTCDate() - totalDays);

  const days = [];
  for (let i = 0; i < totalDays; i += 1) {
    const current = new Date(start);
    current.setUTCDate(start.getUTCDate() + i);
    days.push({
      date: current.toISOString().slice(0, 10),
      revenue: 0,
      orders: 0,
      units: 0,
    });
  }

  return { start, endExclusive, days };
}

const adminSalesRouter = new Hono()
  .use("*", requireAdmin)
  .get("/", async (c) => {
    const rollingDays = buildRollingDays(30);

    const summary = await Order.aggregate([
      { $match: { paymentStatus: "paid" } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$total" },
          avgOrderValue: { $avg: "$total" },
          totalUnits: { $sum: { $sum: "$items.qty" } },
        },
      },
    ]);

    const daily = await Order.aggregate([
      {
        $match: {
          paymentStatus: "paid",
          createdAt: {
            $gte: rollingDays.start,
            $lt: rollingDays.endExclusive,
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "UTC",
            },
          },
          revenue: { $sum: "$total" },
          orders: { $sum: 1 },
          units: { $sum: { $sum: "$items.qty" } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const revenueByCategory = await Order.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "id",
          as: "prod",
        },
      },
      { $unwind: "$prod" },
      {
        $group: {
          _id: "$prod.category",
          revenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } },
          units: { $sum: "$items.qty" },
        },
      },
      { $sort: { revenue: -1 } },
      { $project: { date: "$_id", value: "$revenue", _id: 0 } },
    ]);

    const topProducts = await Order.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          units: { $sum: "$items.qty" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]);

    const topProductNames = await Order.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productName",
          units: { $sum: "$items.qty" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]);

    const topCategories = await Order.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "id",
          as: "prod",
        },
      },
      { $unwind: "$prod" },
      {
        $group: {
          _id: "$prod.category",
          units: { $sum: "$items.qty" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } },
        },
      },
      { $sort: { units: -1 } },
      { $limit: 5 },
    ]);

    const topBrands = await Order.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "id",
          as: "prod",
        },
      },
      { $unwind: "$prod" },
      {
        $group: {
          _id: "$prod.brand",
          units: { $sum: "$items.qty" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } },
        },
      },
      { $sort: { units: -1 } },
      { $limit: 5 },
    ]);

    const ids = topProducts.map(function (i) {
      return i._id;
    });
    const products = await Product.find({ id: { $in: ids } })
      .select("id name brand category")
      .lean();
    const map = new Map(
      products.map(function (p) {
        return [p.id, p];
      }),
    );

    const dailyMap = new Map(
      daily.map(function (entry) {
        return [entry._id, entry];
      }),
    );

    const dailySeries = rollingDays.days.map(function (day) {
      const entry = dailyMap.get(day.date);
      return entry
        ? {
            date: day.date,
            revenue: entry.revenue,
            orders: entry.orders,
            units: entry.units,
          }
        : day;
    });

    const byCategory = topProducts.map(function (item) {
      const p = map.get(item._id);
      return {
        productId: item._id,
        name: p ? p.name : "Unknown",
        brand: p ? p.brand : "Unknown",
        category: p ? p.category : "None",
        revenue: item.revenue,
        units: item.units,
      };
    });

    return c.json({
      summary: summary[0] || {
        totalOrders: 0,
        totalRevenue: 0,
        avgOrderValue: 0,
        totalUnits: 0,
      },
      daily: dailySeries,
      revenueByCategory,
      byCategory,
      topProducts: topProductNames,
      topCategories,
      topBrands,
    });
  });

export { adminSalesRouter };
