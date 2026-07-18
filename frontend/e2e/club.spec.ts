import { expect, test } from '@playwright/test';

// HU-060 - Club Healthora / puntos de lealtad (contenido público, sin sesión)
test.describe('Club Healthora (HU-060)', () => {
  test('muestra los beneficios del club y el llamado a la acción', async ({ page }) => {
    await page.goto('/club');

    await expect(page.getByText('Club Healthora').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Comenzar ahora' })).toBeVisible();

    await page.getByRole('button', { name: 'Comenzar ahora' }).click();
    await expect(page).toHaveURL(/\/catalog/);
  });
});
