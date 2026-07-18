import { expect, test } from '@playwright/test';
import { enableE2EAdmin, mockAdminBaseApi } from './helpers/adminAuth';

const testProduct = {
  _id: 'admin-e2e-product-1',
  id: 'admin-e2e-product-1',
  name: 'Omega Admin E2E',
  brand: 'Healthora Lab',
  category: 'Suplementos',
  need: 'Energia',
  price: 32,
  rating: 4.8,
  reviews: 24,
  short: 'Producto de prueba para el panel admin.',
  stock: 9,
  color: '#E8ECE9',
  swatchColor: '#43614f',
  label: 'Omega\nAdmin',
  images: [],
  active: true,
};

test.describe('Panel admin: catálogo de productos (HU-016)', () => {
  test.beforeEach(async ({ page }) => {
    await enableE2EAdmin(page);
  });

  test('lista productos y filtra por búsqueda', async ({ page }) => {
    await mockAdminBaseApi(page, { products: [testProduct] });

    await page.goto('/admin?section=products');
    await expect(page.getByText('Omega Admin E2E')).toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder('Buscar por nombre o marca…').fill('no-existe-xyz');
    await expect(page.getByText('Omega Admin E2E')).not.toBeVisible();

    await page.getByPlaceholder('Buscar por nombre o marca…').fill('Omega');
    await expect(page.getByText('Omega Admin E2E')).toBeVisible();
  });

  test('elimina un producto tras confirmar', async ({ page }) => {
    await mockAdminBaseApi(page, { products: [testProduct] });
    await page.route('**/api/admin/products/admin-e2e-product-1', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({ json: { ok: true } });
        return;
      }
      await route.fallback();
    });

    await page.goto('/admin?section=products');
    await expect(page.getByText('Omega Admin E2E')).toBeVisible({ timeout: 15_000 });

    await page.getByTitle('Eliminar producto').click();
    await page.getByRole('button', { name: 'Sí, eliminar' }).click();

    await expect(page.getByText('Producto eliminado').first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Panel admin: categorías (HU-048)', () => {
  test.beforeEach(async ({ page }) => {
    await enableE2EAdmin(page);
  });

  test('crea una categoría nueva', async ({ page }) => {
    await mockAdminBaseApi(page, { categories: [] });
    await page.route('**/api/admin/categories', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        await route.fulfill({
          json: { created: true, category: { _id: 'cat-new', ...body }, productsReassigned: 0 },
        });
        return;
      }
      await route.fallback();
    });

    await page.goto('/admin?section=categories');
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });

    const addButton = page.getByRole('button', { name: 'Nueva categoría' });
    await expect(addButton).toBeVisible({ timeout: 10_000 });
    await addButton.click();
    await expect(page.getByRole('button', { name: 'Cancelar' })).toBeVisible();
  });
});
