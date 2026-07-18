import { expect, test } from '@playwright/test';
import { enableE2EAdmin, mockAdminBaseApi } from './helpers/adminAuth';

const testOrder = {
  _id: 'admin-e2e-order-1',
  customerName: 'Maria E2E',
  customerEmail: 'maria@e2e.dev',
  items: [{ productName: 'Omega Admin E2E', qty: 1 }],
  total: 32,
  paymentStatus: 'paid',
  fulfillmentStatus: 'unfulfilled',
  shippingMethod: 'delivery',
  createdAt: new Date().toISOString(),
};

test.describe('Panel admin: pedidos (HU-018)', () => {
  test.beforeEach(async ({ page }) => {
    await enableE2EAdmin(page);
  });

  test('lista pedidos y filtra por búsqueda', async ({ page }) => {
    await mockAdminBaseApi(page, { orders: [testOrder] });

    await page.goto('/admin?section=orders');
    await expect(page.getByText('Maria E2E')).toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder('Buscar por ID, cliente, email o producto…').fill('no-existe-xyz');
    await expect(page.getByText('Maria E2E')).not.toBeVisible();

    await page.getByPlaceholder('Buscar por ID, cliente, email o producto…').fill('Maria');
    await expect(page.getByText('Maria E2E')).toBeVisible();
  });

  test('avanza el estado de envío de un pedido', async ({ page }) => {
    await mockAdminBaseApi(page, { orders: [testOrder] });
    let patchedBody: unknown;
    await page.route('**/api/admin/orders/admin-e2e-order-1/statuses', async (route) => {
      patchedBody = route.request().postDataJSON();
      await route.fulfill({ json: { ...testOrder, fulfillmentStatus: 'processing' } });
    });

    await page.goto('/admin?section=orders');
    await expect(page.getByText('Maria E2E')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Preparando' }).click();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await page.getByRole('button', { name: 'Guardar cambio' }).click();

    await expect.poll(() => patchedBody).toMatchObject({ fulfillmentStatus: 'processing' });
  });
});
