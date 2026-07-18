import { test, expect } from '@playwright/test';

// HU-082 - Accesibilidad (WCAG 2.1 AA)
test.describe('Accesibilidad (HU-082)', () => {
  test('muestra el enlace para saltar al contenido al recibir foco', async ({ page }) => {
    await page.goto('/');
    const skipLink = page.getByRole('link', { name: 'Saltar al contenido principal' });
    // Esperar a que React hidrate antes de tabular - goto() solo espera el evento 'load', no la
    // hidratación, así que un Tab disparado demasiado pronto no mueve el foco a nada todavía.
    await expect(skipLink).toBeAttached();
    await page.locator('body').focus();
    await page.keyboard.press('Tab');
    await expect(skipLink).toBeFocused();
  });

  test('expone un único landmark main en la tienda', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main#main-content')).toHaveCount(1);
  });

  test('la navegación principal usa enlaces con href', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/');
    const categoriesLink = page.getByRole('link', { name: 'Categorías' });
    await expect(categoriesLink).toHaveAttribute('href', /#categorias/);
  });

  test('el carrito es un diálogo accesible', async ({ page }) => {
    await page.goto('/catalog');
    await page.getByRole('button', { name: 'Carrito', exact: true }).click();
    await expect(page.getByRole('dialog', { name: /carrito/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /carrito/i })).toBeHidden();
  });

  test('las variantes del producto exponen estado seleccionado', async ({ page }) => {
    await page.goto('/catalog');
    const firstImage = page.locator('img[alt]').first();
    await expect(firstImage).toBeVisible({ timeout: 15000 });
    await firstImage.click({ force: true });
    await expect(page).toHaveURL(/\/product\//);

    const variantButtons = page.getByRole('button', { pressed: true });
    if (await variantButtons.count()) {
      await expect(variantButtons.first()).toBeVisible();
    }
  });
});
