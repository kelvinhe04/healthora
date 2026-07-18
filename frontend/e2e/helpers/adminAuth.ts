import type { Page } from '@playwright/test';

export async function enableE2EAdmin(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('healthora-e2e-auth', '1');
    window.localStorage.setItem('healthora-e2e-admin', '1');
  });
}

const defaultDashboard = {
  kpis: {
    revenue: 4820,
    revenueDelta: 8,
    totalOrders: 12,
    monthOrders: 5,
    totalUsers: 3,
    lowStock: 1,
  },
  dailySales: [],
  recentOrders: [],
  lowStockCells: [],
};

export type AdminMockData = {
  dashboard?: unknown;
  products?: unknown[];
  productsCount?: number;
  categories?: unknown[];
  coupons?: unknown[];
  users?: unknown[];
  orders?: unknown[];
  returns?: unknown[];
  returnsCount?: number;
  reviewsCount?: number;
  reviews?: { items: unknown[]; total: number; page: number; limit: number };
};

/** Mocks the API calls fired unconditionally on every /admin page (sidebar counts, dashboard,
 * cross-section prefetches) — without this, any admin e2e test hangs on those requests
 * regardless of which section it targets. */
export async function mockAdminBaseApi(page: Page, data: AdminMockData = {}) {
  await page.route('**/api/admin/access', async (route) => {
    await route.fulfill({ json: { allowed: true, role: 'admin', name: 'Admin E2E', email: 'admin@healthora.dev' } });
  });

  await page.route('**/api/admin/dashboard', async (route) => {
    await route.fulfill({ json: data.dashboard ?? defaultDashboard });
  });

  await page.route('**/api/admin/products/count', async (route) => {
    await route.fulfill({ json: { count: data.productsCount ?? data.products?.length ?? 0 } });
  });

  await page.route('**/api/admin/products', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({ json: data.products ?? [] });
  });

  await page.route('**/api/admin/categories', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({ json: data.categories ?? [] });
  });

  await page.route('**/api/admin/coupons', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({ json: data.coupons ?? [] });
  });

  await page.route('**/api/admin/users', async (route) => {
    await route.fulfill({ json: data.users ?? [] });
  });

  await page.route('**/api/admin/returns/count', async (route) => {
    await route.fulfill({ json: { count: data.returnsCount ?? data.returns?.length ?? 0 } });
  });

  await page.route('**/api/admin/returns', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({ json: data.returns ?? [] });
  });

  await page.route('**/api/admin/reviews/count', async (route) => {
    await route.fulfill({ json: { count: data.reviewsCount ?? 0 } });
  });

  await page.route('**/api/admin/reviews?**', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({ json: data.reviews ?? { items: [], total: 0, page: 1, limit: 20 } });
  });

  await page.route('**/api/admin/reviews', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({ json: data.reviews ?? { items: [], total: 0, page: 1, limit: 20 } });
  });

  await page.route('**/api/admin/reviews/bans', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({ json: [] });
  });

  await page.route('**/api/admin/orders', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({ json: data.orders ?? [] });
  });

  await page.route('**/api/notifications**', async (route) => {
    await route.fulfill({ json: [] });
  });

  await page.route('**/api/reviews/summary**', async (route) => {
    await route.fulfill({ json: {} });
  });
}
