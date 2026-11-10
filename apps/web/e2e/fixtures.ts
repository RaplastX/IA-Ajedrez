import { test as base, expect, type Page } from '@playwright/test';

/** Sin aviso de cookies y con idioma fijo para que los tests sean deterministas. */
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'ia-ajedrez:settings',
        JSON.stringify({
          state: {
            analyticsConsent: 'denied',
            language: 'es',
            boardTheme: 'green',
            showCoordinates: true,
            token: null,
            user: null,
          },
          version: 1,
        }),
      );
    });
    await use(page);
  },
});

export { expect };

export async function move(page: Page, uci: string) {
  await page.locator(`[data-square="${uci.slice(0, 2)}"]`).click();
  await page.locator(`[data-square="${uci.slice(2, 4)}"]`).click();
  if (uci.length === 5) await page.getByRole('dialog').getByRole('button').first().click();
}
