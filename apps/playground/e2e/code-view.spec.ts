import { test, expect, type Page } from '@playwright/test';
import { openFile, waitForZoom } from './helpers';

const LONG = "export const registry = createRegistry({ adapters: ['pdf', 'docx', 'xlsx', 'pptx', 'csv', 'md', 'code', 'html', 'all'] });";

async function openCode(page: Page, zoom: string) {
  await openFile(page, {
    name: 'wide.ts',
    mimeType: 'text/typescript',
    buffer: Buffer.from(`import { createRegistry } from 'anyview';\n\n${LONG}\n\tconst tabbed = 1;\n`),
  });
  await page.locator('.dv-reflow-target .shiki').waitFor();
  await page.getByLabel('Zoom level').selectOption(zoom);
  await waitForZoom(page);
}

test.describe('code view', () => {
  test('sizes the page to the longest line so it scrolls with the viewer like a wide PDF page, never clipping', async ({ page }) => {
    for (const zoom of ['1', 'fit-width']) {
      await openCode(page, zoom);
      const fit = await page.evaluate((long) => {
        const pre = document.querySelector<HTMLElement>('.dv-reflow-target pre')!;
        const line = [...pre.querySelectorAll('.line')].find((l) => l.textContent === long)!;
        const range = document.createRange();
        range.selectNodeContents(line);
        const text = range.getBoundingClientRect();
        const box = pre.getBoundingClientRect();
        const pageBox = pre.closest('.dv-page')!.getBoundingClientRect();
        return {
          overflow: pre.scrollWidth - pre.clientWidth,
          textRight: text.right,
          preRight: box.right,
          pageRight: pageBox.right,
        };
      }, LONG);
      expect(fit.overflow, zoom).toBeLessThanOrEqual(0);
      expect(fit.textRight, zoom).toBeLessThanOrEqual(fit.preRight);
      expect(fit.preRight, zoom).toBeLessThanOrEqual(fit.pageRight + 0.5);
    }
  });

  test('scrolls a code block sideways rather than spilling out of the page', async ({ page }) => {
    await openCode(page, '1');
    const overflowX = await page.locator('.dv-reflow-target pre').evaluate((el) => getComputedStyle(el).overflowX);
    expect(overflowX).toBe('auto');
  });

  test('renders in the viewer monospace stack, not the browser Courier fallback', async ({ page }) => {
    await openCode(page, '1');
    const family = await page.locator('.dv-reflow-target pre').evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family).toContain('ui-monospace');
    expect(family).toContain('SF Mono');
    expect(family).not.toMatch(/^monospace$/);
  });
});
