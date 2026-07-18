import { expect, test } from '@playwright/test';
import { enableE2EAdmin, mockAdminBaseApi } from './helpers/adminAuth';

test.describe('Panel admin: dashboard y navegación (HU-015)', () => {
  test.beforeEach(async ({ page }) => {
    await enableE2EAdmin(page);
  });

  test('muestra los KPIs del dashboard', async ({ page }) => {
    await mockAdminBaseApi(page, {
      dashboard: {
        kpis: { revenue: 9999, revenueDelta: 12, totalOrders: 42, monthOrders: 8, totalUsers: 5, lowStock: 3 },
        dailySales: [],
        recentOrders: [],
        lowStockCells: [],
      },
    });

    await page.goto('/admin');
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('$9,999').first()).toBeVisible({ timeout: 10_000 });
  });

  test('navega entre secciones desde el sidebar', async ({ page }) => {
    await mockAdminBaseApi(page, {
      products: [],
      orders: [],
    });

    await page.goto('/admin');
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Pedidos' }).click();
    await expect(page).toHaveURL(/section=orders/);

    await page.getByRole('button', { name: 'Productos' }).click();
    await expect(page).toHaveURL(/section=products/);
  });
});
