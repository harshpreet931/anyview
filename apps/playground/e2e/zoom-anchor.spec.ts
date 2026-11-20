import { test, expect, type Page } from '@playwright/test';
import { fixture, openFile, revealViewer, waitForZoom } from './helpers';

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
  await waitForZoom(page);
}

test.describe('zoom gestures keep the reader on the same page', () => {
  for (const [label, dy] of [['in', -120], ['out', 120]] as const) {
    test(`Ctrl+wheel zoom ${label} from page 4`, async ({ page }) => {
      await openFile(page, fixture('pages-12.pdf'));
      await revealViewer(page);
      await expect(page.getByLabel('Page number')).toBeVisible();
      await page.waitForSelector('.dv-page canvas');
      await page.selectOption('select[aria-label="Zoom level"]', 'fit-width');
      await waitForZoom(page);
      const input = page.getByLabel('Page number');
      await input.fill('4');
      await input.press('Enter');
      await expect.poll(() => pageAtCentre(page)).toBe(3);

      await wheelZoom(page, dy);
      await expect.poll(() => pageAtCentre(page), { timeout: 3000 }).toBe(3);
    });
  }
});
