import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('./fixtures/pages-12.pdf', import.meta.url));

async function pageAtCentre(page: Page) {
  return page.evaluate(() => {
    const c = document.querySelector('.dv-viewer-container')!.getBoundingClientRect();
    const hit = document
      .elementsFromPoint(c.left + c.width / 2, c.top + c.height / 2)
      .map((n) => n.closest<HTMLElement>('.dv-page'))
      .find(Boolean);
    return hit ? Number(hit.dataset.pageIndex) : -1;
  });
}

async function wheelZoom(page: Page, deltaY: number) {
  await page.evaluate((dy) => {
    const el = document.querySelector('.dv-viewer-container')!;
    const r = el.getBoundingClientRect();
    for (let i = 0; i < 3; i++) {
      el.dispatchEvent(
        new WheelEvent('wheel', { deltaY: dy, ctrlKey: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true }),
      );
    }
  }, deltaY);
  await page.waitForTimeout(700);
}

test.describe('zoom gestures keep the reader on the same page', () => {
  for (const [label, dy] of [['in', -120], ['out', 120]] as const) {
    test(`Ctrl+wheel zoom ${label} from page 4`, async ({ page }) => {
      await page.goto('/');
      await page.locator('.dv-root').evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await page.locator('input[type="file"]').first().setInputFiles(fixture);
      await expect(page.getByLabel('Page number')).toBeVisible();
      await page.waitForSelector('.dv-page canvas');
      await page.selectOption('select[aria-label="Zoom level"]', 'fit-width');
      await page.waitForTimeout(400);
      const input = page.getByLabel('Page number');
      await input.fill('4');
      await input.press('Enter');
      await expect.poll(() => pageAtCentre(page)).toBe(3);

      await wheelZoom(page, dy);
      await expect.poll(() => pageAtCentre(page), { timeout: 3000 }).toBe(3);
    });
  }
});
