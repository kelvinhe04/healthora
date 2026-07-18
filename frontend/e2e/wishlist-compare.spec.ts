import { expect, test } from '@playwright/test';

// HU-044 - Wishlist
test.describe('Wishlist (HU-044)', () => {
  test('agrega un producto a la wishlist desde el catálogo y aparece en /wishlist', async ({ page }) => {
    await page.goto('/catalog');
    const firstCard = page.locator('[id^="product-card-card-"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    // Los botones overlay (wishlist/comparar) solo son interactivos con la tarjeta en :hover
    // (pointer-events: none el resto del tiempo) - hay que pasar el mouse antes de poder clickear.
    await firstCard.hover();
    const wishlistButton = page.getByRole('button', { name: 'Agregar a wishlist' }).first();
    await wishlistButton.click();
    await expect(page.getByRole('button', { name: 'Quitar de wishlist' }).first()).toBeVisible();

    await page.goto('/wishlist');
    await expect(page.getByText(/Guardados · 1/)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('img[alt]').first()).toBeVisible();
  });

  test('muestra el estado vacío sin productos en la wishlist', async ({ page }) => {
    await page.goto('/wishlist');
    await expect(page.getByText('Aún no guardaste productos. Toca el corazón en cualquier tarjeta.')).toBeVisible({ timeout: 15_000 });
  });
});

// HU-045 (parcial) - Comparador de productos
test.describe('Comparador de productos', () => {
  test('agrega productos al comparador desde el catálogo', async ({ page }) => {
    await page.goto('/catalog');
    const cards = page.locator('[id^="product-card-card-"]');
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
    const compareButtons = page.getByRole('button', { name: 'Agregar a comparación' });

    await cards.nth(0).scrollIntoViewIfNeeded();
    await cards.nth(0).hover();
    await compareButtons.nth(0).click();

    await cards.nth(1).scrollIntoViewIfNeeded();
    await cards.nth(1).hover();
    await expect(compareButtons.nth(1)).toBeVisible();
    await compareButtons.nth(1).click({ force: true });

    await page.goto('/compare');
    await expect(page.locator('img[alt]').first()).toBeVisible({ timeout: 15_000 });
  });
});
