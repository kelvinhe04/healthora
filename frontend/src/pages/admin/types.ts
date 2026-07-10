import type {
  ErrorReport,
  FulfillmentStatus,
  OrderAddress,
  OrderLineItem,
  PaymentStatus,
  Product,
  ProductVariant,
} from '../../types';
import type { MatrixState } from './variantMatrix';
import { emptyMatrixState } from './variantMatrix';

export type VariantFormRow = {
  id: string;
  label: string;
  type: ProductVariant['type'];
  price: string;
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
  | "users"
  | "sales"
  | "earnings"
  | "performance"
  | "errors"
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
  lowStockProducts: Product[];
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
];

export const orderShippingMethodOptions: ("" | "delivery" | "pickup")[] = ["", "delivery", "pickup"];

export const orderShippingMethodLabels: Record<"" | "delivery" | "pickup", string> = {
  "": "Todos",
  delivery: "Envío a domicilio",
  pickup: "Retiro en tienda",
};

export const fulfillmentStatusSequence: FulfillmentStatus[] = [
  "unfulfilled",
  "processing",
  "shipped",
  "delivered",
];

// Retiro en tienda no pasa por "Enviada": se prepara y queda listo para retirar.
export const pickupFulfillmentStatusSequence: FulfillmentStatus[] = [
  "unfulfilled",
  "processing",
  "delivered",
];

export type ProductForm = {
  name: string;
  brand: string;
  category: string;
  short: string;
  price: string;
  priceBefore: string;
  tag: string;
  stock: string;
  active: boolean;
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
  tag: "",
  stock: "0",
  active: true,
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
  cancelled: "Cancelada",
};

/** "Entregada" no aplica a retiro en tienda: no se entrega nada, el cliente lo recoge. */
export function getFulfillmentStatusLabel(
  status: FulfillmentStatus | "",
  shippingMethod?: "delivery" | "pickup",
): string {
  if (status === "delivered" && shippingMethod === "pickup") return "Listo para retirar";
  return fulfillmentStatusLabels[status];
}
