import { Order } from '../db/models/Order';

/** How many months of retention/LTV curve to compute per cohort (offset 0..MAX_OFFSET). */
const MAX_OFFSET = 11;

export type CohortRetentionCell = {
  offset: number;
  activeCustomers: number;
  percent: number;
  revenue: number;
};

export type CohortLtvCell = {
  offset: number;
  value: number;
};

export type CohortRow = {
  cohortMonth: string;
  customers: number;
  retention: CohortRetentionCell[];
  cumulativeLtv: CohortLtvCell[];
};

export type CohortReport = {
  from: string | null;
  to: string | null;
  maxOffset: number;
  cohorts: CohortRow[];
  overall: {
    totalCustomers: number;
    averageOrdersPerCustomer: number;
    averageRevenuePerCustomer: number;
    averageOrderValue: number;
  };
  generatedAt: string;
};

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthsBetween(fromMonth: string, toMonth: string): number {
  const [fy, fm] = fromMonth.split('-').map(Number);
  const [ty, tm] = toMonth.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

function addMonths(monthStr: string, offset: number): string {
  const [y, m] = monthStr.split('-').map(Number);
  const total = y * 12 + (m - 1) + offset;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

type CustomerOrders = {
  cohortMonth: string;
  ordersByMonth: Map<string, { count: number; revenue: number }>;
};

export type RawCustomerOrders = {
  customerId: string;
  orders: { date: Date; total: number }[];
};

/**
 * Groups paying customers by the calendar month of their first paid order (the cohort), then
 * tracks, for each month offset since that cohort started, what fraction of the cohort placed
 * another paid order (retention) and the cumulative revenue per starting customer (LTV curve).
 * Computed in JS from a per-customer order list rather than a single Mongo aggregation — the
 * order volume here is small enough (a demo/prototype store) that a date-diff bucket pipeline
 * would add real complexity for no practical performance gain. Pure/sync so it's unit-testable
 * without a database (see cohortAnalytics.test.ts); `getCohortReport` is the thin Mongo-backed
 * wrapper actual routes/tools call.
 */
export function buildCohortReport(
  rawCustomers: RawCustomerOrders[],
  opts: { from?: Date; to?: Date; now?: Date } = {},
): CohortReport {
  const nowMonth = monthKey(opts.now ?? new Date());
  const fromMonth = opts.from ? monthKey(opts.from) : null;
  const toMonth = opts.to ? monthKey(opts.to) : null;

  const perCustomer: CustomerOrders[] = [];
  for (const row of rawCustomers) {
    const orders = row.orders
      .filter((o) => o.date)
      .map((o) => ({ date: new Date(o.date), total: o.total ?? 0 }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    if (orders.length === 0) continue;

    const cohortMonth = monthKey(orders[0].date);
    if (fromMonth && cohortMonth < fromMonth) continue;
    if (toMonth && cohortMonth > toMonth) continue;

    const ordersByMonth = new Map<string, { count: number; revenue: number }>();
    for (const order of orders) {
      const month = monthKey(order.date);
      const entry = ordersByMonth.get(month) ?? { count: 0, revenue: 0 };
      entry.count += 1;
      entry.revenue += order.total;
      ordersByMonth.set(month, entry);
    }

    perCustomer.push({ cohortMonth, ordersByMonth });
  }

  const cohortGroups = new Map<string, CustomerOrders[]>();
  for (const customer of perCustomer) {
    const list = cohortGroups.get(customer.cohortMonth) ?? [];
    list.push(customer);
    cohortGroups.set(customer.cohortMonth, list);
  }

  const cohorts: CohortRow[] = [...cohortGroups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([cohortMonth, customers]) => {
      const cohortSize = customers.length;
      const maxAvailableOffset = Math.min(MAX_OFFSET, monthsBetween(cohortMonth, nowMonth));

      const retention: CohortRetentionCell[] = [];
      const cumulativeLtv: CohortLtvCell[] = [];
      let cumulativeRevenue = 0;

      for (let offset = 0; offset <= maxAvailableOffset; offset += 1) {
        const targetMonth = addMonths(cohortMonth, offset);
        let activeCustomers = 0;
        let revenue = 0;
        for (const customer of customers) {
          const entry = customer.ordersByMonth.get(targetMonth);
          if (entry) {
            activeCustomers += 1;
            revenue += entry.revenue;
          }
        }
        cumulativeRevenue += revenue;
        retention.push({
          offset,
          activeCustomers,
          percent: cohortSize > 0 ? Math.round((activeCustomers / cohortSize) * 1000) / 10 : 0,
          revenue: roundMoney(revenue),
        });
        cumulativeLtv.push({ offset, value: roundMoney(cumulativeRevenue / cohortSize) });
      }

      return { cohortMonth, customers: cohortSize, retention, cumulativeLtv };
    });

  const totalCustomers = perCustomer.length;
  let totalOrders = 0;
  let totalRevenue = 0;
  for (const customer of perCustomer) {
    for (const entry of customer.ordersByMonth.values()) {
      totalOrders += entry.count;
      totalRevenue += entry.revenue;
    }
  }

  return {
    from: opts.from ? opts.from.toISOString().slice(0, 10) : null,
    to: opts.to ? opts.to.toISOString().slice(0, 10) : null,
    maxOffset: MAX_OFFSET,
    cohorts,
    overall: {
      totalCustomers,
      averageOrdersPerCustomer: totalCustomers > 0 ? roundMoney(totalOrders / totalCustomers) : 0,
      averageRevenuePerCustomer: totalCustomers > 0 ? roundMoney(totalRevenue / totalCustomers) : 0,
      averageOrderValue: totalOrders > 0 ? roundMoney(totalRevenue / totalOrders) : 0,
    },
    generatedAt: (opts.now ?? new Date()).toISOString(),
  };
}

export async function getCohortReport(opts: { from?: Date; to?: Date } = {}): Promise<CohortReport> {
  const rows = await Order.aggregate<{ _id: string; orders: { date: Date; total: number }[] }>([
    { $match: { paymentStatus: 'paid' } },
    {
      $group: {
        _id: '$customerId',
        orders: { $push: { date: '$createdAt', total: '$total' } },
      },
    },
  ]);

  return buildCohortReport(
    rows.map((row) => ({ customerId: row._id, orders: row.orders })),
    opts,
  );
}
