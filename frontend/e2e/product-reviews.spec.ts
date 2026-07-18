import { expect, test } from '@playwright/test';

const testProduct = {
  _id: 'e2e-reviews-product-1',
  id: 'e2e-reviews-product-1',
  name: 'Reviews E2E Producto',
  brand: 'Healthora Lab',
  category: 'Suplementos',
  need: 'Energia',
  price: 20,
  rating: 4,
  reviews: 3,
  short: 'Producto de prueba para reseñas.',
  benefits: ['Beneficio uno'],
  usage: 'Uso diario.',
  ingredients: 'Ingrediente A.',
  warnings: 'Ninguna.',
  stock: 5,
  color: '#E8ECE9',
  swatchColor: '#43614f',
  label: 'Reviews\nE2E',
  images: [],
  active: true,
};

const testReviews = [
  { _id: 'r1', productId: testProduct.id, userId: 'u1', userName: 'Ana', rating: 5, body: 'Excelente producto', helpfulVoters: [], status: 'published', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { _id: 'r2', productId: testProduct.id, userId: 'u2', userName: 'Luis', rating: 2, body: 'No cumplió lo esperado', helpfulVoters: [], status: 'published', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { _id: 'r3', productId: testProduct.id, userId: 'u3', userName: 'Sofia', rating: 5, body: 'Muy recomendado', helpfulVoters: [], status: 'published', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

async function mockApi(page: import('@playwright/test').Page) {
  await page.route('**/api/products/e2e-reviews-product-1', async (route) => {
    await route.fulfill({ json: testProduct });
  });
  await page.route('**/api/reviews?**', async (route) => {
    await route.fulfill({ json: testReviews });
  });
  await page.route('**/api/reviews/stats**', async (route) => {
    await route.fulfill({ json: { avgRating: 4, count: 3 } });
  });
}

test.describe('Reseñas de producto (HU-010, HU-196)', () => {
  test('filtra reseñas por cantidad de estrellas', async ({ page }) => {
    await mockApi(page);
    await page.goto('/product/e2e-reviews-product-1');

    await expect(page.getByText('Excelente producto')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('No cumplió lo esperado')).toBeVisible();

    // Fila de 5 estrellas = primera del grupo (dist itera 5,4,3,2,1) - sin aria-label propio,
    // solo expone "5" (estrella) + conteo como texto.
    await page.getByRole('group', { name: 'Filtrar reseñas por estrellas' }).getByRole('button').first().click();
    await expect(page.getByText('No cumplió lo esperado')).not.toBeVisible();
    await expect(page.getByText('Excelente producto')).toBeVisible();
  });

  test('pide iniciar sesión al intentar escribir una reseña sin cuenta', async ({ page }) => {
    await mockApi(page);
    await page.goto('/product/e2e-reviews-product-1');

    await expect(page.getByRole('button', { name: 'Escribir reseña' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Escribir reseña' }).click();

    await expect(page.getByText('¿Ya probaste este producto?')).toBeVisible();
  });
});
