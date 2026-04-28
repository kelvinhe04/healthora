import type { Product, Category, Order, ProductFilters, SavedAddress, Review } from '../types';
import type { CartItem } from '../types';

const BASE = '/api';

async function request<T>(path: string, opts?: RequestInit, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { ...headers, ...opts?.headers } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') return null as T;
  return res.json();
}

function filtersToQuery(f: ProductFilters): string {
  const p = new URLSearchParams();
  if (f.category) p.set('category', f.category);
  if (f.need) p.set('need', f.need);
  if (f.brand) p.set('brand', f.brand);
  if (f.priceMax) p.set('priceMax', String(f.priceMax));
  if (f.sort) p.set('sort', f.sort);
  if (f.inStock) p.set('inStock', '1');
  if (f.search) p.set('search', f.search);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const api = {
  products: {
    list: (filters: ProductFilters = {}) =>
      request<Product[]>(`/products${filtersToQuery(filters)}`),
    get: (id: string) => request<Product>(`/products/${id}`),
  },
  categories: {
    list: () => request<Category[]>('/categories'),
  },
  orders: {
    list: (token: string) => request<Order[]>('/orders', undefined, token),
    get: (id: string, token: string) => request<Order>(`/orders/${id}`, undefined, token),
    bySession: (sessionId: string, token: string) =>
      request<Order>(`/orders?stripeSessionId=${sessionId}`, undefined, token),
  },
  account: {
    addresses: {
      list: (token: string) => request<SavedAddress[]>('/account/addresses', undefined, token),
      save: (addresses: SavedAddress[], token: string) =>
        request<SavedAddress[]>('/account/addresses', { method: 'PUT', body: JSON.stringify({ addresses }) }, token),
    },
  },
  cart: {
    get: (token: string) => request<CartItem[]>('/cart', undefined, token),
    save: (items: { productId: string; qty: number }[], token: string) =>
      request<CartItem[]>('/cart', { method: 'PUT', body: JSON.stringify({ items }) }, token),
  },
  checkout: {
    createSession: (
      body: { items: { productId: string; qty: number }[]; address: object },
      token: string
    ) => request<{ url: string }>('/checkout/session', { method: 'POST', body: JSON.stringify(body) }, token),
  },
  reviews: {
    list: (productId: string) => request<Review[]>(`/reviews?productId=${encodeURIComponent(productId)}`),
    create: (
      data: { productId: string; rating: number; title?: string; body: string },
      token: string
    ) => request<Review>('/reviews', { method: 'POST', body: JSON.stringify(data) }, token),
    helpful: (id: string, token: string) => request<Review>(`/reviews/${id}/helpful`, { method: 'PATCH' }, token),
  },
  admin: {
    access: (token: string) => request<{ allowed: boolean; role: string; name?: string; email?: string }>('/admin/access', undefined, token),
    dashboard: (token: string) => request<unknown>('/admin/dashboard', undefined, token),
    orders: (token: string, fulfillmentStatus?: string) =>
      request<unknown>(`/admin/orders${fulfillmentStatus ? `?fulfillmentStatus=${fulfillmentStatus}` : ''}`, undefined, token),
    patchOrderStatuses: (id: string, body: { paymentStatus?: string; fulfillmentStatus?: string }, token: string) =>
      request<unknown>(`/admin/orders/${id}/statuses`, { method: 'PATCH', body: JSON.stringify(body) }, token),
    products: {
      list: (token: string) => request<Product[]>('/admin/products', undefined, token),
      create: (data: Partial<Product>, token: string) =>
        request<Product>('/admin/products', { method: 'POST', body: JSON.stringify(data) }, token),
      update: (id: string, data: Partial<Product>, token: string) =>
        request<Product>(`/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }, token),
      remove: (id: string, token: string) =>
        request<unknown>(`/admin/products/${id}`, { method: 'DELETE' }, token),
    },
    users: (token: string) => request<unknown>('/admin/users', undefined, token),
    updateUserRole: (id: string, role: 'customer' | 'admin', token: string) =>
      request<unknown>(`/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }, token),
    sales: (token: string) => request<unknown>('/admin/sales', undefined, token),
    earnings: (token: string) => request<unknown>('/admin/earnings', undefined, token),
  },
};
