import { expect, type Page, test } from '@playwright/test';

async function enableE2EAuth(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('healthora-e2e-auth', '1');
  });
}

async function mockApi(page: Page) {
  await page.route('**/api/subscriptions**', async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.route('**/api/account/payment-methods**', async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.route('**/api/account/notification-preferences**', async (route) => {
    await route.fulfill({ json: { orderUpdates: true, promotions: true, lowStockAlerts: false } });
  });
}

test.describe('Perfil de usuario (HU-057)', () => {
  test.beforeEach(async ({ page }) => {
    await enableE2EAuth(page);
  });

  test('muestra el perfil con los datos de la cuenta y sus secciones', async ({ page }) => {
    await mockApi(page);
    await page.goto('/profile');

    await expect(page.getByText('Usuario E2E')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('e2e@healthora.dev')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Editar nombre y foto' })).toBeVisible();
    await expect(page.getByText('Mis suscripciones')).toBeVisible();
    await expect(page.getByText('Métodos de pago')).toBeVisible();
  });
});
