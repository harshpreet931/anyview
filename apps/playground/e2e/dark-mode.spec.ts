import { test, expect } from '@playwright/test';
import { openApp, pickSample, waitForReflow } from './helpers';

test.use({ colorScheme: 'dark' });

function luminance(rgb: string): number {
  const [r, g, b] = (rgb.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  return 0.299 * (r ?? 0) + 0.587 * (g ?? 0) + 0.114 * (b ?? 0);
}

test.describe('dark mode - a document page stays readable paper', () => {
  for (const name of ['Markdown', 'CSV', 'TypeScript'] as const) {
    test(`${name} renders dark ink on a light page`, async ({ page }) => {
      await openApp(page);
      await pickSample(page, name);
      await waitForReflow(page);

      const { textColor, pageBg } = await page.evaluate(() => ({
        textColor: getComputedStyle(document.querySelector('.dv-reflow-target')!).color,
        pageBg: getComputedStyle(document.querySelector('.dv-page')!).backgroundColor,
      }));

      expect(luminance(pageBg)).toBeGreaterThan(200);
      expect(luminance(textColor)).toBeLessThan(130);
    });
  }
});
