import type { FulfillmentStatus, OrderAddress, OrderLineItem, PaymentStatus, Product } from '../../types';

export type AdminPage =
  | "dashboard"
  | "orders"
  | "products"
  | "users"
  | "sales"
  | "earnings";
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

export const fulfillmentStatusOptions: (FulfillmentStatus | "")[] = [
  "",
  "unfulfilled",
  "processing",
  "shipped",
  "delivered",
];

export const fulfillmentStatusSequence: FulfillmentStatus[] = [
  "unfulfilled",
  "processing",
  "shipped",
  "delivered",
];

export type ProductForm = {
  name: string;
  brand: string;
  category: string;
  need: string;
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
};

export const emptyForm: ProductForm = {
  name: "",
  brand: "",
  category: "",
  need: "",
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
};

export const fulfillmentStatusLabels: Record<FulfillmentStatus | "", string> = {
  "": "Todos",
  unfulfilled: "Pendiente",
  processing: "Preparando",
  shipped: "Enviada",
  delivered: "Entregada",
  cancelled: "Cancelada",
};
