import { expect, test } from '@playwright/test';
import { enableE2EAdmin, mockAdminBaseApi } from './helpers/adminAuth';

const testReview = {
  _id: 'admin-e2e-review-1',
  productId: 'admin-e2e-product-1',
  productName: 'Omega Admin E2E',
  userId: 'user-1',
  userName: 'Maria E2E',
  rating: 1,
  body: 'Comentario de prueba e2e',
  helpfulVoters: [],
  status: 'published',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

test.describe('Panel admin: moderación de reseñas (HU-056, HU-194)', () => {
  test.beforeEach(async ({ page }) => {
    await enableE2EAdmin(page);
  });

  test('lista reseñas y oculta una', async ({ page }) => {
    await mockAdminBaseApi(page, { reviews: { items: [testReview], total: 1, page: 1, limit: 20 } });
    let patchedBody: unknown;
    await page.route('**/api/admin/reviews/admin-e2e-review-1', async (route) => {
      if (route.request().method() === 'PATCH') {
        patchedBody = route.request().postDataJSON();
        await route.fulfill({ json: { ...testReview, status: 'hidden' } });
        return;
      }
      await route.fallback();
    });

    await page.goto('/admin?section=reviews');
    await expect(page.getByText('Comentario de prueba e2e')).toBeVisible({ timeout: 15_000 });

    await page.getByTitle('Ocultar').click();

    await expect.poll(() => patchedBody).toMatchObject({ status: 'hidden' });
  });

  test('banea al autor de una reseña', async ({ page }) => {
    await mockAdminBaseApi(page, { reviews: { items: [testReview], total: 1, page: 1, limit: 20 } });
    let banCalled = false;
    await page.route('**/api/admin/reviews/admin-e2e-review-1/ban', async (route) => {
      banCalled = true;
      await route.fulfill({ json: { success: true } });
    });

    await page.goto('/admin?section=reviews');
    await expect(page.getByText('Comentario de prueba e2e')).toBeVisible({ timeout: 15_000 });

    await page.getByTitle(/Banear autor/).click();
    await page.getByRole('button', { name: 'Banear' }).click();

    await expect.poll(() => banCalled).toBe(true);
  });
});
