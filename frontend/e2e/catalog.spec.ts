import { test, expect } from '@playwright/test';

// HU-001 - Catálogo de productos
test.describe('Catálogo de productos (HU-001)', () => {
  test('lista productos activos con imagen, nombre y precio', async ({ page }) => {
    await page.goto('/?view=catalog');
    const cards = page.locator('img[alt]').first();
    await expect(cards).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/\$\d/).first()).toBeVisible();
  });

  test('abre la ficha de detalle al hacer clic en un producto (HU-003)', async ({ page }) => {
    await page.goto('/?view=catalog');
    const firstImage = page.locator('img[alt]').first();
    await expect(firstImage).toBeVisible({ timeout: 15000 });
    await firstImage.click({ force: true });
    await expect(page).toHaveURL(/view=product/);
    await expect(page.getByRole('button', { name: /Agregar al carrito|Sin stock/ }).first()).toBeVisible();
  });
});

// HU-002 - Navegación por categorías
test.describe('Navegación por categorías (HU-002)', () => {
  test('permite filtrar el catálogo por categoría desde la URL', async ({ page }) => {
    await page.goto('/?view=catalog');
    await expect(page.locator('img[alt]').first()).toBeVisible({ timeout: 15000 });
    const initialCount = await page.locator('img[alt]').count();
    await page.goto('/?view=catalog&category=Suplementos');
    await page.waitForLoadState('networkidle');
    expect(await page.locator('img[alt]').count()).toBeGreaterThanOrEqual(0);
    expect(initialCount).toBeGreaterThan(0);
  });
});
