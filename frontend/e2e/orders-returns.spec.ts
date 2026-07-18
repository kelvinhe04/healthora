import { expect, type Page, test } from '@playwright/test';

const deliveredOrder = {
  _id: 'e2e-order-returnable-1',
  customerId: 'e2e-user',
  customerName: 'Usuario E2E',
  customerEmail: 'e2e@healthora.dev',
  items: [{ productId: 'p1', productName: 'Omega Returns E2E', qty: 1, price: 32 }],
  subtotal: 32,
  tax: 2.24,
  shipping: 0,
  shippingMethod: 'delivery',
  total: 34.24,
  status: 'delivered',
  paymentStatus: 'paid',
  fulfillmentStatus: 'delivered',
  stripeSessionId: 'sess_e2e_1',
  address: { name: 'Usuario E2E', phone: '+507 6000 0000', address: 'Calle 1', city: 'Panama', postal: '0801' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

async function enableE2EAuth(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('healthora-e2e-auth', '1');
  });
}

const createdReturn = {
  _id: 'e2e-return-1',
  orderId: deliveredOrder._id,
  customerId: 'e2e-user',
  reason: 'Llegó defectuoso',
  reasonCategory: 'defective',
  items: [{ productId: 'p1', productName: 'Omega Returns E2E', qty: 1 }],
  refundAmount: 34.24,
  status: 'requested',
  returnMethod: 'courier_pickup',
  desiredResolution: 'refund',
  photos: ['https://example.test/fake-photo.jpg'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

async function mockApi(page: Page) {
  let created = false;
  await page.route('**/api/orders**', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({ json: [deliveredOrder] });
  });
  await page.route('**/api/returns/upload', async (route) => {
    await route.fulfill({ json: { url: 'https://example.test/fake-photo.jpg' } });
  });
  await page.route('**/api/returns', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: created ? [createdReturn] : [] });
      return;
    }
    if (route.request().method() === 'POST') {
      created = true;
      await route.fulfill({ json: createdReturn });
      return;
    }
    await route.fallback();
  });
}

test.describe('Historial de pedidos y devoluciones (HU-041)', () => {
  test.beforeEach(async ({ page }) => {
    await enableE2EAuth(page);
  });

  test('lista los pedidos del cliente', async ({ page }) => {
    await mockApi(page);
    await page.goto('/orders');
    await expect(page.getByText('Omega Returns E2E').first()).toBeVisible({ timeout: 15_000 });
  });

  test('solicita una devolución sobre un pedido entregado', async ({ page }) => {
    await mockApi(page);
    await page.goto('/orders');
    await expect(page.getByText('Omega Returns E2E').first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Solicitar devolución' }).click();
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'No funciona / defectuoso' }).click();
    await page.getByPlaceholder('Cuéntanos qué pasó…').fill('Llegó defectuoso, no enciende.');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'evidencia.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    });

    await page.getByRole('button', { name: 'Enviar solicitud' }).click();
    await expect(page.getByText('Devolución Solicitada').first()).toBeVisible({ timeout: 10_000 });
  });
});
