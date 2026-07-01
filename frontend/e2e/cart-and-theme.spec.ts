import { test, expect } from '@playwright/test';

// HU-004 - Carrito persistente + HU-005 - Selector de variantes (parcial)
test.describe('Carrito (HU-004, HU-005)', () => {
  test('agregar un producto al carrito actualiza el contador', async ({ page }) => {
    await page.goto('/?view=catalog');
    const firstImage = page.locator('img[alt]').first();
    await expect(firstImage).toBeVisible({ timeout: 15000 });
    await firstImage.click({ force: true });
    await expect(page).toHaveURL(/view=product/);

    const addButton = page.getByRole('button', { name: /Agregar al carrito/ }).first();
    await expect(addButton).toBeVisible();
    await addButton.click();

    const cartButton = page.getByRole('button', { name: 'Carrito' });
    await expect(cartButton.locator('span')).toHaveText(/[1-9]/);
  });
});

// HU-026 - Modo oscuro
test.describe('Modo oscuro (HU-026)', () => {
  test('alterna entre tema claro y oscuro', async ({ page }) => {
    await page.goto('/?view=landing');
    const toggle = page.getByRole('button', { name: /Activar modo (oscuro|claro)/ });
    await expect(toggle).toBeVisible();
    const initialLabel = await toggle.getAttribute('aria-label');
    await toggle.click();
    await expect(toggle).not.toHaveAttribute('aria-label', initialLabel ?? '');
  });
});

// HU-011 - Suscripción al newsletter
test.describe('Newsletter (HU-011)', () => {
  test('permite ingresar un correo en el formulario de suscripción', async ({ page }) => {
    await page.goto('/?view=landing');
    const emailInput = page.getByPlaceholder('tu@email.com');
    await emailInput.scrollIntoViewIfNeeded();
    await expect(emailInput).toBeVisible();
    await emailInput.fill('test-e2e@healthora.dev');
    await expect(emailInput).toHaveValue('test-e2e@healthora.dev');
  });
});
