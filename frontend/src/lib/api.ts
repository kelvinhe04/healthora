import type {
  Product,
  Category,
  Order,
  OrderAddress,
  ProductFilters,
  SavedAddress,
  Review,
  AdminReview,
  ReviewStatus,
  ErrorReport,
  AppNotification,
  NotificationInbox,
} from "../types";
import type { CartItem } from "../types";

const BASE = "/api";

async function request<T>(
  path: string,
  opts?: RequestInit,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    // Product/catalog routes send a long Cache-Control (max-age up to 120s) for CDN/browser
    // caching on repeat visits. 'no-cache' still lets the browser do a conditional revalidation
    // (If-None-Match) instead of blindly trusting max-age - otherwise an admin edit doesn't show
    // up in an already-open tab until that window expires, even after cache invalidation.
    cache: "no-cache",
    ...opts,
    headers: { ...headers, ...opts?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const details = Array.isArray(err.details)
      ? err.details.map((d: { field: string; message: string }) => `${d.field}: ${d.message}`).join("; ")
      : undefined;
    throw new Error(details ? `${err.error} — ${details}` : err.error || `HTTP ${res.status}`);
  }
  if (res.status === 204 || res.headers.get("content-length") === "0")
    return null as T;
  return res.json();
}

function filtersToQuery(f: ProductFilters): string {
  const p = new URLSearchParams();
  if (f.category) p.set("category", f.category);
  if (f.need) p.set("need", f.need);
  if (f.brand) p.set("brand", f.brand);
  if (f.priceMax) p.set("priceMax", String(f.priceMax));
  if (f.sort) p.set("sort", f.sort);
  if (f.inStock) p.set("inStock", "1");
  if (f.search) p.set("search", f.search);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const api = {
  products: {
    list: (filters: ProductFilters = {}) =>
      request<Product[]>(`/products${filtersToQuery(filters)}`),
    get: (id: string) => request<Product>(`/products/${id}`),
    count: () => request<{ count: number }>("/products/count"),
  },
  categories: {
    list: () => request<Category[]>("/categories"),
  },
  orders: {
    list: (token: string) => request<Order[]>("/orders", undefined, token),
    get: (id: string, token: string) =>
      request<Order>(`/orders/${id}`, undefined, token),
    bySession: (sessionId: string, token: string) =>
      request<Order>(`/orders?stripeSessionId=${sessionId}`, undefined, token),
    cancel: (id: string, token: string) =>
      request<Order>(`/orders/${id}/cancel`, { method: "PATCH" }, token),
    updateAddress: (id: string, address: OrderAddress, token: string) =>
      request<Order>(
        `/orders/${id}/address`,
        { method: "PATCH", body: JSON.stringify(address) },
        token,
      ),
  },
  account: {
    addresses: {
      list: (token: string) =>
        request<SavedAddress[]>("/account/addresses", undefined, token),
      save: (addresses: SavedAddress[], token: string) =>
        request<SavedAddress[]>(
          "/account/addresses",
          { method: "PUT", body: JSON.stringify({ addresses }) },
          token,
        ),
    },
  },
  cart: {
    get: (token: string) => request<CartItem[]>("/cart", undefined, token),
    save: (items: { productId: string; qty: number }[], token: string) =>
      request<CartItem[]>(
        "/cart",
        { method: "PUT", body: JSON.stringify({ items }) },
        token,
      ),
  },
  checkout: {
    createSession: (
      body: {
        items: { productId: string; qty: number; variantId?: string }[];
        address: object;
        promoCode?: string;
        freeSampleId?: string;
      },
      token: string,
    ) =>
      request<{ url: string }>(
        "/checkout/session",
        { method: "POST", body: JSON.stringify(body) },
        token,
      ),
  },
  reviews: {
    stats: () =>
      request<{ total: number; avgRating: number }>("/reviews/stats"),
    summary: () =>
      request<Record<string, { avgRating: number; count: number }>>("/reviews/summary"),
    list: (productId: string) =>
      request<Review[]>(`/reviews?productId=${encodeURIComponent(productId)}`),
    create: (
      data: { productId: string; rating: number; title?: string; body: string },
      token: string,
    ) =>
      request<Review>(
        "/reviews",
        { method: "POST", body: JSON.stringify(data) },
        token,
      ),
    helpful: (id: string, token: string) =>
      request<Review>(`/reviews/${id}/helpful`, { method: "PATCH" }, token),
  },
  newsletter: {
    subscribe: (email: string) =>
      request<{ success: boolean; message: string }>("/newsletter/subscribe", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
  },
  notifications: {
    list: (token: string, limit?: number) =>
      request<NotificationInbox>(
        `/notifications${limit ? `?limit=${limit}` : ""}`,
        undefined,
        token,
      ),
    markRead: (id: string, token: string) =>
      request<AppNotification>(
        `/notifications/${id}/read`,
        { method: "PATCH" },
        token,
      ),
    markAllRead: (token: string) =>
      request<{ updated: number }>(
        "/notifications/read-all",
        { method: "POST" },
        token,
      ),
    dismiss: (id: string, token: string) =>
      request<{ success: boolean }>(
        `/notifications/${id}`,
        { method: "DELETE" },
        token,
      ),
    clearAll: (token: string) =>
      request<{ cleared: number }>(
        "/notifications",
        { method: "DELETE" },
        token,
      ),
  },
  admin: {
    access: (token: string) =>
      request<{
        allowed: boolean;
        role: string;
        name?: string;
        email?: string;
      }>("/admin/access", undefined, token),
    dashboard: (token: string) =>
      request<unknown>("/admin/dashboard", undefined, token),
    orders: (token: string, fulfillmentStatus?: string) =>
      request<unknown>(
        `/admin/orders${fulfillmentStatus ? `?fulfillmentStatus=${fulfillmentStatus}` : ""}`,
        undefined,
        token,
      ),
    patchOrderStatuses: (
      id: string,
      body: { paymentStatus?: string; fulfillmentStatus?: string },
      token: string,
    ) =>
      request<unknown>(
        `/admin/orders/${id}/statuses`,
        { method: "PATCH", body: JSON.stringify(body) },
        token,
      ),
    products: {
      list: (token: string) =>
        request<Product[]>("/admin/products", undefined, token),
      count: (token: string) =>
        request<{ count: number }>("/admin/products/count", undefined, token),
      create: (data: Partial<Product>, token: string) =>
        request<Product>(
          "/admin/products",
          { method: "POST", body: JSON.stringify(data) },
          token,
        ),
      update: (id: string, data: Partial<Product>, token: string) =>
        request<Product>(
          `/admin/products/${id}`,
          { method: "PUT", body: JSON.stringify(data) },
          token,
        ),
      remove: (id: string, token: string) =>
        request<unknown>(`/admin/products/${id}`, { method: "DELETE" }, token),
      removeAll: (token: string) =>
        request<{ deletedCount: number; categoriesCount: number }>(
          "/admin/products",
          { method: "DELETE" },
          token,
        ),
    },
    reviews: {
      list: (token: string, status?: ReviewStatus, page = 1) => {
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        if (page > 1) params.set("page", String(page));
        const query = params.toString();
        return request<{ items: AdminReview[]; total: number; page: number; limit: number }>(
          `/admin/reviews${query ? `?${query}` : ""}`,
          undefined,
          token,
        );
      },
      updateStatus: (id: string, status: ReviewStatus, token: string) =>
        request<AdminReview>(
          `/admin/reviews/${id}`,
          { method: "PATCH", body: JSON.stringify({ status }) },
          token,
        ),
      remove: (id: string, token: string) =>
        request<{ success: boolean }>(
          `/admin/reviews/${id}`,
          { method: "DELETE" },
          token,
        ),
    },
    users: (token: string) =>
      request<unknown>("/admin/users", undefined, token),
    updateUserRole: (id: string, role: "customer" | "admin", token: string) =>
      request<unknown>(
        `/admin/users/${id}/role`,
        { method: "PATCH", body: JSON.stringify({ role }) },
        token,
      ),
    sales: (token: string) =>
      request<unknown>("/admin/sales", undefined, token),
    earnings: (token: string) =>
      request<unknown>("/admin/earnings", undefined, token),
    performance: (token: string, minutes?: number) =>
      request<unknown>(
        `/admin/performance${minutes ? `?minutes=${minutes}` : ""}`,
        undefined,
        token,
      ),
    errorReports: (token: string, source?: "backend" | "frontend") =>
      request<{ items: ErrorReport[]; total: number; page: number; limit: number }>(
        `/admin/error-reports${source ? `?source=${source}` : ""}`,
        undefined,
        token,
      ),
  },
};
