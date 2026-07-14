import { Order } from '../db/models/Order';
import { normalizeOrder } from './orderStatus';

type ExportFilters = {
  paymentStatus?: string;
  fulfillmentStatus?: string;
  limit?: number;
};

function escapeCsv(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export async function buildOrdersCsv(filters: ExportFilters = {}): Promise<string> {
  const filter: Record<string, unknown> = {};
  if (filters.paymentStatus) filter.paymentStatus = filters.paymentStatus;
  if (filters.fulfillmentStatus) filter.fulfillmentStatus = filters.fulfillmentStatus;

  const limit = Math.min(filters.limit ?? 500, 2000);
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(limit).lean();

  const header = [
    'orderId',
    'createdAt',
    'customerName',
    'customerEmail',
    'total',
    'paymentStatus',
    'fulfillmentStatus',
    'status',
    'shippingMethod',
    'itemCount',
    'itemsSummary',
  ].join(',');

  const rows = orders.map((order) => {
    const normalized = normalizeOrder(order);
    const itemsSummary = (order.items ?? [])
      .map((i) => `${i.productName ?? i.productId} x${i.qty}`)
      .join('; ');
    return [
      escapeCsv(order._id),
      escapeCsv(normalized.createdAt),
      escapeCsv(order.customerName),
      escapeCsv(order.customerEmail),
      escapeCsv(order.total),
      escapeCsv(normalized.paymentStatus),
      escapeCsv(normalized.fulfillmentStatus),
      escapeCsv(normalized.status),
      escapeCsv(order.shippingMethod),
      escapeCsv((order.items ?? []).length),
      escapeCsv(itemsSummary),
    ].join(',');
  });

  return [header, ...rows].join('\n');
}
