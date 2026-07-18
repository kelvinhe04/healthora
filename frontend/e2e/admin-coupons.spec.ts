import { expect, test } from '@playwright/test';
import { enableE2EAdmin, mockAdminBaseApi } from './helpers/adminAuth';

const testCoupon = {
  code: 'E2E10',
  label: 'Cupón E2E',
  discountType: 'percent',
  percentOff: 10,
  active: true,
  eligibleCategories: [],
};

test.describe('Panel admin: cupones (HU-049)', () => {
  test.beforeEach(async ({ page }) => {
    await enableE2EAdmin(page);
  });

  test('crea un cupón nuevo', async ({ page }) => {
    await mockAdminBaseApi(page, { coupons: [] });
    let createdBody: unknown;
    await page.route('**/api/admin/coupons', async (route) => {
      if (route.request().method() === 'POST') {
        createdBody = route.request().postDataJSON();
        await route.fulfill({ json: { ...testCoupon, ...(createdBody as object) } });
        return;
      }
      await route.fallback();
    });

    await page.goto('/admin?section=coupons');
    await expect(page.getByRole('button', { name: '+ Nuevo cupón' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '+ Nuevo cupón' }).click();

    await page.getByPlaceholder('Código (ej. SAVE10)').fill('E2E10');
    await page.getByPlaceholder('Etiqueta visible').fill('Cupón E2E');
    await page.getByPlaceholder('Porcentaje').fill('10');
    await page.getByRole('button', { name: 'Crear cupón' }).click();

    await expect.poll(() => createdBody).toMatchObject({ code: 'E2E10' });
  });

  test('elimina un cupón existente', async ({ page }) => {
    let deleted = false;
    await mockAdminBaseApi(page);
    await page.route('**/api/admin/coupons', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      await route.fulfill({ json: deleted ? [] : [testCoupon] });
    });
    await page.route('**/api/admin/coupons/E2E10', async (route) => {
      if (route.request().method() === 'DELETE') {
        deleted = true;
        await route.fulfill({ json: { ok: true, code: 'E2E10' } });
        return;
      }
      await route.fallback();
    });

    await page.goto('/admin?section=coupons');
    await expect(page.getByText('E2E10')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Eliminar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click();

    await expect(page.getByText('E2E10', { exact: true })).not.toBeVisible({ timeout: 10_000 });
  });
});
