import { Order } from '../db/models/Order';
import { normalizeOrder } from './orderStatus';

export type ExportFilters = {
  paymentStatus?: string;
  fulfillmentStatus?: string;
  limit?: number;
  lang?: 'es' | 'en';
};

export type OrderExportRow = {
  orderId: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  total: number;
  paymentStatus: string;
  fulfillmentStatus: string;
  status: string;
  shippingMethod: string;
  itemCount: number;
  itemsSummary: string;
};

export const EXPORT_COLUMN_KEYS = [
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
] as const;

export const EXPORT_HEADERS: Record<'es' | 'en', string[]> = {
  es: [
    'idPedido',
    'fechaCreacion',
    'cliente',
    'emailCliente',
    'total',
    'estadoPago',
    'estadoEnvio',
    'estado',
    'metodoEnvio',
    'cantidadItems',
    'resumenItems',
  ],
  en: [
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
  ],
};

export function resolveExportLang(lang: ExportFilters['lang']): 'es' | 'en' {
  return lang === 'es' ? 'es' : 'en';
}

// Los valores crudos (paymentStatus, fulfillmentStatus, status, shippingMethod) son codigos
// internos en ingles (ver PaymentStatus/FulfillmentStatus/LegacyOrderStatus en orderStatus.ts).
// El admin ya los traduce en la UI (OrdersSection); el export debe hacer lo mismo o el archivo
// queda con encabezados en espanol pero el contenido de las celdas en ingles.
const PAYMENT_STATUS_LABELS: Record<'es' | 'en', Record<string, string>> = {
  es: { pending_payment: 'Pendiente de pago', paid: 'Pagado', cancelled: 'Cancelado', refunded: 'Reembolsado' },
  en: { pending_payment: 'Pending payment', paid: 'Paid', cancelled: 'Cancelled', refunded: 'Refunded' },
};

const FULFILLMENT_STATUS_LABELS: Record<'es' | 'en', Record<string, string>> = {
  es: {
    unfulfilled: 'Sin surtir',
    processing: 'Preparando',
    shipped: 'Enviado',
    delivered: 'Entregado',
    picked_up: 'Retirado',
    cancelled: 'Cancelado',
  },
  en: {
    unfulfilled: 'Unfulfilled',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    picked_up: 'Picked up',
    cancelled: 'Cancelled',
  },
};

const ORDER_STATUS_LABELS: Record<'es' | 'en', Record<string, string>> = {
  es: {
    pending_payment: 'Pendiente de pago',
    paid: 'Pagado',
    processing: 'Preparando',
    shipped: 'Enviado',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
    refunded: 'Reembolsado',
  },
  en: {
    pending_payment: 'Pending payment',
    paid: 'Paid',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
  },
};

const SHIPPING_METHOD_LABELS: Record<'es' | 'en', Record<string, string>> = {
  es: { delivery: 'Envío a domicilio', pickup: 'Retiro en tienda' },
  en: { delivery: 'Delivery', pickup: 'Pickup' },
};

function translateRow(row: OrderExportRow, lang: 'es' | 'en'): OrderExportRow {
  return {
    ...row,
    paymentStatus: PAYMENT_STATUS_LABELS[lang][row.paymentStatus] ?? row.paymentStatus,
    fulfillmentStatus: FULFILLMENT_STATUS_LABELS[lang][row.fulfillmentStatus] ?? row.fulfillmentStatus,
    status: ORDER_STATUS_LABELS[lang][row.status] ?? row.status,
    shippingMethod: SHIPPING_METHOD_LABELS[lang][row.shippingMethod] ?? row.shippingMethod,
  };
}

export async function fetchOrderExportRows(filters: ExportFilters = {}): Promise<OrderExportRow[]> {
  const filter: Record<string, unknown> = {};
  if (filters.paymentStatus) filter.paymentStatus = filters.paymentStatus;
  if (filters.fulfillmentStatus) filter.fulfillmentStatus = filters.fulfillmentStatus;

  const limit = Math.min(filters.limit ?? 500, 2000);
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
  const lang = resolveExportLang(filters.lang);

  return orders.map((order) => {
    const normalized = normalizeOrder(order);
    const itemsSummary = (order.items ?? [])
      .map((i) => `${i.productName ?? i.productId} x${i.qty}`)
      .join('; ');
    return translateRow(
      {
        orderId: String(order._id),
        createdAt: String(normalized.createdAt),
        customerName: order.customerName ?? '',
        customerEmail: order.customerEmail ?? '',
        total: order.total ?? 0,
        paymentStatus: normalized.paymentStatus ?? '',
        fulfillmentStatus: normalized.fulfillmentStatus ?? '',
        status: normalized.status ?? '',
        shippingMethod: order.shippingMethod ?? '',
        itemCount: (order.items ?? []).length,
        itemsSummary,
      },
      lang,
    );
  });
}
