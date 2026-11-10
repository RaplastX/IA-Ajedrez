import { expect, test } from './fixtures';

test('todas las secciones cargan sin errores y sin desbordar en horizontal', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const path of [
    '/',
    '/play',
    '/tactics',
    '/analysis',
    '/openings',
    '/endgames',
    '/lessons',
    '/progress',
    '/achievements',
    '/settings',
  ]) {
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow, path).toBe(false);
  }
  expect(errors).toEqual([]);
});

test('cambia el idioma a inglés', async ({ page }) => {
  await page.goto('/settings');
  await page.getByTestId('language-select').selectOption('en');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByRole('link', { name: 'Tactics' }).first().click();
  await expect(page.getByRole('heading', { name: 'Tactics' })).toBeVisible();
});
