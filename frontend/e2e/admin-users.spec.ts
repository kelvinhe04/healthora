import { expect, test } from '@playwright/test';
import { enableE2EAdmin, mockAdminBaseApi } from './helpers/adminAuth';

const testUser = {
  _id: 'admin-e2e-user-1',
  name: 'Maria Cliente',
  email: 'maria.cliente@e2e.dev',
  role: 'customer',
  orderCount: 3,
  ltv: 120,
  createdAt: new Date().toISOString(),
};

test.describe('Panel admin: clientes y roles (HU-017)', () => {
  test.beforeEach(async ({ page }) => {
    await enableE2EAdmin(page);
  });

  test('busca un cliente por nombre', async ({ page }) => {
    await mockAdminBaseApi(page, { users: [testUser] });

    await page.goto('/admin?section=users');
    await expect(page.getByText('Maria Cliente')).toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder(/[Bb]uscar/).fill('no-existe-xyz');
    await expect(page.getByText('Maria Cliente')).not.toBeVisible();

    await page.getByPlaceholder(/[Bb]uscar/).fill('Maria');
    await expect(page.getByText('Maria Cliente')).toBeVisible();
  });

  test('promueve un cliente a admin', async ({ page }) => {
    await mockAdminBaseApi(page, { users: [testUser] });
    let patchedBody: unknown;
    await page.route('**/api/admin/users/admin-e2e-user-1/role', async (route) => {
      patchedBody = route.request().postDataJSON();
      await route.fulfill({ json: { ...testUser, role: 'admin' } });
    });

    await page.goto('/admin?section=users');
    await expect(page.getByText('Maria Cliente')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Hacer admin' }).click();
    await page.getByRole('button', { name: 'Confirmar' }).click();

    await expect.poll(() => patchedBody).toMatchObject({ role: 'admin' });
  });
});
