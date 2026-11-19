import { test, expect, type Page } from '@playwright/test';

test.use({ colorScheme: 'dark' });

function luminance(rgb: string): number {
  const [r, g, b] = (rgb.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  return 0.299 * (r ?? 0) + 0.587 * (g ?? 0) + 0.114 * (b ?? 0);
}

async function loadReflowable(page: Page, label: string) {
  await page.goto('/');
  await expect(page.locator('.dv-root')).toBeVisible();
  await page.getByRole('group', { name: 'Sample documents' }).getByRole('button', { name: label, exact: true }).click();
  const target = page.locator('.dv-reflow-target').first();
  await target.waitFor({ state: 'attached' });
  await expect
    .poll(async () => (await target.innerText()).trim().length, { timeout: 20_000 })
    .toBeGreaterThan(0);
}

test.describe('dark mode - a document page stays readable paper', () => {
  for (const name of ['Markdown', 'CSV', 'TypeScript'] as const) {
    test(`${name} renders dark ink on a light page`, async ({ page }) => {
      await loadReflowable(page, name);

      const { textLum, pageLum } = await page.evaluate(() => {
        const text = document.querySelector('.dv-reflow-target') as HTMLElement;
        const pageEl = document.querySelector('.dv-page') as HTMLElement;
        return {
          textColor: getComputedStyle(text).color,
          pageBg: getComputedStyle(pageEl).backgroundColor,
          textLum: getComputedStyle(text).color,
          pageLum: getComputedStyle(pageEl).backgroundColor,
        };
      });

      expect(luminance(pageLum)).toBeGreaterThan(200);
      expect(luminance(textLum)).toBeLessThan(130);
    });
  }
});
