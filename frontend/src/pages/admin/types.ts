import type {
  ErrorReport,
  FulfillmentStatus,
  OrderAddress,
  OrderLineItem,
  OrderReturn,
  PaymentStatus,
  Product,
  ProductVariant,
} from '../../types';
import type { MatrixState } from './variantMatrix';
import { emptyMatrixState } from './variantMatrix';

/** Espejo del default del backend (backend/src/lib/realtime.ts, LOW_STOCK_THRESHOLD) para mostrar
 * el placeholder correcto cuando un producto no tiene umbral propio. El backend sigue siendo la
 * fuente de verdad real (variable de entorno) - esto es solo para la UI. */
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export function effectiveLowStockThreshold(product: Pick<Product, 'lowStockThreshold'>): number {
  return product.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
}

export type VariantFormRow = {
  id: string;
  label: string;
  type: ProductVariant['type'];
  price: string;
  priceBefore: string;
  discountStartsAt: string;
  discountEndsAt: string;
  /** Whether priceBefore came from the bulk "Descuento por categoría" tool (vs. hand-set here).
   * No checkbox for this - carried through so an unrelated re-save doesn't silently wipe it. */
  categoryDiscount: boolean;
  /** Snapshot the category discount tool uses to restore a hand-set discount it discounted on top
   * of. Opaque here - no editor for it, just carried through untouched. */
  categoryDiscountRestore?: ProductVariant['categoryDiscountRestore'];
  stock: string;
  sku: string;
  color: string;
  images: string[];
  isDefault: boolean;
};

export const VARIANT_TYPE_OPTIONS: { value: ProductVariant['type']; label: string }[] = [
  { value: 'flavor', label: 'Sabor' },
  { value: 'scent', label: 'Aroma' },
  { value: 'size', label: 'Tamaño' },
  { value: 'color', label: 'Color' },
  { value: 'weight', label: 'Peso' },
  { value: 'count', label: 'Conteo' },
];

export const emptyVariantRow = (): VariantFormRow => ({
  id: '',
  label: '',
  type: 'count',
  price: '0',
  priceBefore: '',
  discountStartsAt: '',
  discountEndsAt: '',
  categoryDiscount: false,
  stock: '0',
  sku: '',
  color: '',
  images: [],
  isDefault: false,
});

export type AdminPage =
  | "dashboard"
  | "orders"
  | "products"
  | "categories"
  | "users"
  | "sales"
  | "earnings"
  | "performance"
  | "errors"
  | "returns"
  | "reviews";
export interface AdminAppProps {
  onGoToStore: () => void;
}
export type AdminAccess = {
  allowed: boolean;
  role: string;
  name?: string;
  email?: string;
};
export type DashboardData = {
  kpis: {
    revenue: number;
    revenueDelta: number;
    totalOrders: number;
    monthOrders: number;
    totalUsers: number;
    lowStock: number;
  };
  dailySales: { revenue: number; date: string }[];
  recentOrders: AdminOrder[];
  /** Una entrada por celda de stock critica (producto sin variantes, variante simple, o combo
   * sabor/color x tamaño) - no por producto, para no esconder un combo critico detras del total
   * sano del producto (#153). `variantLabel` es null para un producto sin variantes. */
  lowStockCells: { variantId: string | null; variantLabel: string | null; stock: number; product: Product }[];
};
export type AdminOrder = {
  _id: string;
  customerName?: string;
  customerEmail?: string;
  items?: OrderLineItem[];
  total?: number;
  status?: string;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  shippingMethod?: "delivery" | "pickup";
  shippingLabel?: string;
  shippingEta?: string;
  address?: OrderAddress;
  createdAt?: string;
  replacesOrderId?: string;
};
export type AdminUser = {
  _id: string;
  name?: string;
  email?: string;
  role?: "customer" | "admin";
  orderCount?: number;
  ltv?: number;
  createdAt?: string;
  imageUrl?: string;
};
export type SalesData = {
  summary?: {
    totalOrders: number;
    totalRevenue: number;
    avgOrderValue: number;
    totalUnits: number;
  };
  daily?: { revenue: number; date: string; orders: number; units: number }[];
  revenueByCategory?: { _id: string; revenue: number; units: number }[];
  byCategory?: {
    productId: string;
    name: string;
    brand: string;
    category: string;
    revenue: number;
    units: number;
  }[];
  topProducts?: { _id: string; revenue: number; units: number }[];
  topCategories?: { _id: string; units: number; revenue: number }[];
  topBrands?: { _id: string; units: number; revenue: number }[];
};
export type EarningsData = {
  monthly?: { month: string; revenue: number; orders: number }[];
  summary?: {
    gross: number;
    tax: number;
    shipping: number;
    fees: number;
    net: number;
    orders: number;
  };
};

export type PerformanceData = {
  summary: {
    totalRequests: number;
    throughputPerMinute: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    errorRate: number;
    slowRequests: number;
  };
  alerts: {
    slowThresholdMs: number;
    p95ThresholdMs: number;
    errorRateThresholdPercent: number;
    p95Breached: boolean;
    errorRateBreached: boolean;
  };
  endpoints: {
    endpoint: string;
    requests: number;
    throughputPerMinute: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    maxLatencyMs: number;
    errorRate: number;
    slowRequests: number;
  }[];
  recent: {
    _id: string;
    method: string;
    route: string;
    statusCode: number;
    latencyMs: number;
    slow: boolean;
    error: boolean;
    createdAt: string;
  }[];
  window: {
    from: string;
    to: string;
    minutes: number;
  };
};

export type ErrorReportsData = {
  items: ErrorReport[];
  total: number;
  page: number;
  limit: number;
};

export const fulfillmentStatusOptions: (FulfillmentStatus | "")[] = [
  "",
  "unfulfilled",
  "processing",
  "shipped",
  "delivered",
  "picked_up",
];

export const orderShippingMethodOptions: ("" | "delivery" | "pickup")[] = ["", "delivery", "pickup"];

export const orderShippingMethodLabels: Record<"" | "delivery" | "pickup", string> = {
  "": "Todos",
  delivery: "Envío a domicilio",
  pickup: "Retiro en tienda",
};

// Coarser than the exact pill shown in the Pago column (which distinguishes the return's
// fine-grained sub-status like "Aprobada"/"En tránsito", or "Reemplazo en camino" vs "Reemplazo en
// tienda") - that level of detail belongs to Devoluciones' own filter. Here an admin just wants to
// slice Pedidos by what happened to the order, so every in-flight return status (requested through
// refund_pending, whichever resolution the customer asked for) collapses into one "en curso"
// bucket, and "replaced" only applies once a replacement return is actually resolved.
export type OrderPaymentBucket = "" | PaymentStatus | "return_pending" | "replaced" | "no_charge";

export const orderPaymentStatusOptions: OrderPaymentBucket[] = [
  "",
  "paid",
  "pending_payment",
  "cancelled",
  "refunded",
  "return_pending",
  "replaced",
  "no_charge",
];

export const orderPaymentStatusLabels: Record<OrderPaymentBucket, string> = {
  "": "Todos",
  paid: "Pagado",
  pending_payment: "Pendiente",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  return_pending: "Devolución en curso",
  replaced: "Reemplazo",
  no_charge: "Sin costo",
};

/** Same precedence as the Pago column's own pill logic (OrdersSection.tsx#paymentPillLabels). */
export function getOrderPaymentBucket(order: AdminOrder, ret?: OrderReturn): OrderPaymentBucket {
  if (order.replacesOrderId) return "no_charge";
  if (ret && ret.status !== "rejected") {
    if (ret.status === "refunded") return "refunded";
    if (ret.status === "replaced") return "replaced";
    return "return_pending";
  }
  return order.paymentStatus ?? "pending_payment";
}

export const fulfillmentStatusSequence: FulfillmentStatus[] = [
  "unfulfilled",
  "processing",
  "shipped",
  "delivered",
];

// Retiro en tienda no pasa por "Enviada": se prepara, queda listo para retirar y termina cuando
// el cliente efectivamente lo retira ("delivered" != "picked_up" aquí - ver Order.ts).
export const pickupFulfillmentStatusSequence: FulfillmentStatus[] = [
  "unfulfilled",
  "processing",
  "delivered",
  "picked_up",
];

export type ProductForm = {
  name: string;
  brand: string;
  category: string;
  short: string;
  price: string;
  priceBefore: string;
  discountStartsAt: string;
  discountEndsAt: string;
  tag: string;
  stock: string;
  active: boolean;
  /** Vacio = usa el default global del backend. */
  lowStockThreshold: string;
  benefits: string;
  usage: string;
  ingredients: string;
  warnings: string;
  extraTabs: { id: string; label: string; content: string }[];
  imageUrl: string;
  image2: string;
  image3: string;
  image4: string;
  color: string;
  swatchColor: string;
  label: string;
  variantsMode: 'simple' | 'matrix';
  variantsSimple: VariantFormRow[];
  variantsMatrix: MatrixState;
};

export const emptyForm: ProductForm = {
  name: "",
  brand: "",
  category: "",
  short: "",
  price: "0",
  priceBefore: "",
  discountStartsAt: "",
  discountEndsAt: "",
  tag: "",
  stock: "0",
  active: true,
  lowStockThreshold: "",
  benefits: "",
  usage: "",
  ingredients: "",
  warnings: "",
  extraTabs: [],
  imageUrl: "",
  image2: "",
  image3: "",
  image4: "",
  color: "oklch(0.92 0.1 140)",
  swatchColor: "oklch(0.6 0.15 140)",
  label: "",
  variantsMode: "simple",
  variantsSimple: [],
  variantsMatrix: emptyMatrixState(),
};

export const fulfillmentStatusLabels: Record<FulfillmentStatus | "", string> = {
  "": "Todos",
  unfulfilled: "Pendiente",
  processing: "Preparando",
  shipped: "Enviada",
  delivered: "Entregada",
  picked_up: "Retirado",
  cancelled: "Cancelada",
};

/** "Entregada" no aplica a retiro en tienda: no se entrega nada, el cliente lo recoge - "delivered"
 * ahi es "listo para retirar", "picked_up" es cuando ya lo recogio. */
export function getFulfillmentStatusLabel(
  status: FulfillmentStatus | "",
  shippingMethod?: "delivery" | "pickup",
): string {
  if (status === "delivered" && shippingMethod === "pickup") return "Listo para retirar";
  return fulfillmentStatusLabels[status];
}
