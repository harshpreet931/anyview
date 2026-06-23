import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) =>
  fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

// Assert the page canvas actually contains a rendered image — i.e. it has
// multiple distinct, non-transparent pixel values (a blank canvas has ≤1).
async function expectCanvasNotBlank(page: Page) {
  const canvas = page.locator('.dv-page canvas').first();
  await canvas.waitFor({ state: 'attached' });
  await expect
    .poll(
      () =>
        canvas.evaluate((c: HTMLCanvasElement) => {
          const ctx = c.getContext('2d');
          if (!ctx || !c.width || !c.height) return 0;
          let data: Uint8ClampedArray;
          try {
            data = ctx.getImageData(0, 0, c.width, c.height).data;
          } catch {
            return 0;
          }
          const colors = new Set<string>();
          for (let i = 0; i < data.length; i += 404) {
            colors.add(`${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`);
          }
          return colors.size;
        }),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(2);
}

test.describe('images — pixels actually reach the canvas', () => {
  test('SVG sample renders to the canvas', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.dv-root')).toBeVisible();
    await page.locator('.pg-sample-chip').nth(6).click(); // SVG
    await expectCanvasNotBlank(page);
  });

  test('uploaded PNG renders to the canvas', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.dv-root')).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles(fixture('sample.png'));
    await expectCanvasNotBlank(page);
  });
});
