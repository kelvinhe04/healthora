import { expect, type Page, test } from '@playwright/test';

const testProduct = {
  _id: 'e2e-product-1',
  id: 'e2e-product-1',
  name: 'Omega E2E Completo',
  brand: 'Healthora Lab',
  category: 'Suplementos',
  need: 'Energia',
  price: 32,
  priceBefore: 40,
  tag: 'Nuevo',
  rating: 4.8,
  reviews: 24,
  short: 'Producto de prueba para validar el journey completo de compra.',
  benefits: ['Apoya energia diaria', 'Probado en checkout e2e'],
  usage: 'Tomar una capsula al dia.',
  ingredients: 'Omega 3, vitamina D.',
  warnings: 'No exceder la dosis recomendada.',
  stock: 9,
  color: '#E8ECE9',
  swatchColor: '#43614f',
  label: 'Omega\nE2E',
  images: [],
  active: true,
};

async function enableE2EAuth(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('healthora-e2e-auth', '1');
  });
}

async function mockApi(page: Page, checkoutStatus: 'ok' | 'error' = 'ok') {
  await page.route('https://checkout.stripe.test/**', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Stripe Checkout E2E</title><h1>Stripe Checkout E2E</h1>',
    });
  });

  await page.route('**/api/products**', async (route) => {
    const url = route.request().url();
    if (url.match(/\/api\/products\/count$/)) {
      await route.fulfill({ json: { count: 1 } });
      return;
    }

    if (url.match(/\/api\/products\/e2e-product-1$/)) {
      await route.fulfill({ json: testProduct });
      return;
    }

    await route.fulfill({ json: [testProduct] });
  });

  await page.route('**/api/categories**', async (route) => {
    await route.fulfill({
      json: [{ _id: 'cat-1', id: 'suplementos', label: 'Suplementos', sub: 'Energia diaria', color: '#E8ECE9' }],
    });
  });

  await page.route('**/api/reviews**', async (route) => {
    await route.fulfill({ json: [] });
  });

  await page.route('**/api/cart**', async (route) => {
    await route.fulfill({ json: [] });
  });

  await page.route('**/api/orders**', async (route) => {
    await route.fulfill({ json: [] });
  });

  await page.route('**/api/account/addresses**', async (route) => {
    await route.fulfill({ json: [] });
  });

  await page.route('**/api/checkout/session', async (route) => {
    if (checkoutStatus === 'error') {
      await route.fulfill({
        status: 400,
        json: { error: 'No se pudo crear la sesion de pago' },
      });
      return;
    }

    await route.fulfill({
      json: { url: 'https://checkout.stripe.test/session/e2e-ok' },
    });
  });
}

async function addProductAndGoToCheckout(page: Page) {
  await page.goto('/catalog');
  await expect(page.getByText('Omega E2E Completo').first()).toBeVisible({ timeout: 15_000 });
  await page.getByText('Omega E2E Completo').first().click();
  await expect(page).toHaveURL(/\/product\/e2e-product-1/);
  await page.getByRole('button', { name: /Comprar ahora con un clic/ }).click();
  await expect(page).toHaveURL(/\/checkout/);
}

async function fillAddress(page: Page) {
  await page.getByLabel(/Nombre completo/).fill('Maria E2E');
  await page.getByLabel(/Telefono|Teléfono/).fill('+507 6000 0000');
  await page.getByLabel(/Direccion|Dirección/).fill('Calle Healthora 123');
  await page.getByLabel(/Ciudad/).fill('Panama');
  await page.getByLabel(/Codigo postal|Código postal/).fill('0801');
}

test.describe('Checkout end-to-end (HU-072)', () => {
  test.beforeEach(async ({ page }) => {
    await enableE2EAuth(page);
  });

  test('camino feliz: agrega producto, completa checkout y redirige a Stripe', async ({ page }) => {
    await mockApi(page);
    await addProductAndGoToCheckout(page);

    await fillAddress(page);
    await page.getByRole('button', { name: /Continuar al pago/ }).click();
    await page.getByRole('button', { name: /Pagar/ }).click();

    await expect(page).toHaveURL('https://checkout.stripe.test/session/e2e-ok');
  });

  test('camino de error: bloquea checkout sin direccion completa', async ({ page }) => {
    await mockApi(page);
    await addProductAndGoToCheckout(page);

    await expect(page.getByRole('button', { name: /Continuar al pago/ })).toBeDisabled();
    await page.getByLabel(/Nombre completo/).fill('Maria E2E');
    await expect(page.getByRole('button', { name: /Continuar al pago/ })).toBeDisabled();
  });

  test('camino de error: muestra error si Stripe no crea la sesion', async ({ page }) => {
    await mockApi(page, 'error');
    await addProductAndGoToCheckout(page);

    await fillAddress(page);
    await page.getByRole('button', { name: /Continuar al pago/ }).click();
    await page.getByRole('button', { name: /Pagar/ }).click();

    await expect(page.getByRole('alert')).toContainText('No se pudo crear la sesion de pago');
  });
});
