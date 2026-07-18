import { expect, test } from '@playwright/test';
import { enableE2EAdmin, mockAdminBaseApi } from './helpers/adminAuth';

const testReturn = {
  _id: 'admin-e2e-return-1',
  orderId: 'admin-e2e-order-1',
  customerId: 'admin-e2e-user-1',
  customerName: 'Maria E2E',
  customerEmail: 'maria@e2e.dev',
  reason: 'Producto llegó dañado',
  reasonCategory: 'damaged',
  items: [{ productId: 'p1', productName: 'Omega Admin E2E', qty: 1 }],
  refundAmount: 32,
  status: 'requested',
  returnMethod: 'courier_pickup',
  desiredResolution: 'refund',
  photos: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

test.describe('Panel admin: devoluciones (HU-041)', () => {
  test.beforeEach(async ({ page }) => {
    await enableE2EAdmin(page);
  });

  test('lista devoluciones pendientes', async ({ page }) => {
    await mockAdminBaseApi(page, { returns: [testReturn] });

    await page.goto('/admin?section=returns');
    await expect(page.getByText('Maria E2E')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Producto llegó dañado')).toBeVisible();
  });

  test('aprueba una devolución solicitada', async ({ page }) => {
    await mockAdminBaseApi(page, { returns: [testReturn] });
    let patchedBody: unknown;
    await page.route('**/api/admin/returns/admin-e2e-return-1/status', async (route) => {
      patchedBody = route.request().postDataJSON();
      await route.fulfill({ json: { ...testReturn, status: 'approved' } });
    });

    await page.goto('/admin?section=returns');
    await expect(page.getByText('Maria E2E')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Aprobar' }).click();

    await expect.poll(() => patchedBody).toMatchObject({ status: 'approved' });
  });
});
