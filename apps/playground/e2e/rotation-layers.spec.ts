import { test, expect, type Page, type Locator } from '@playwright/test';

async function openPdf(page: Page) {
  await page.goto('/');
  await page.locator('.pg-sample-chip', { hasText: /^PDF$/ }).click();
  await page.waitForSelector('.dv-page canvas');
  await page.getByLabel('Zoom level').selectOption('1');
  await page.locator('.dv-root').evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.waitForTimeout(500);
}

const span = (page: Page, text: RegExp) => page.locator('.dv-text-layer span').filter({ hasText: text }).first();

async function overlap(a: Locator, b: Locator) {
  await expect.poll(async () => {
    const ra = await a.boundingBox();
    const rb = await b.boundingBox();
    if (!ra || !rb) return 0;
    const w = Math.min(ra.x + ra.width, rb.x + rb.width) - Math.max(ra.x, rb.x);
    const h = Math.min(ra.y + ra.height, rb.y + rb.height) - Math.max(ra.y, rb.y);
    return w > 0 && h > 0 ? (w * h) / (rb.width * rb.height) : 0;
  }, { timeout: 8000 }).toBeGreaterThan(0.5);
}

async function rotate(page: Page) {
  await page.getByRole('button', { name: 'Rotate clockwise' }).click();
  await page.waitForTimeout(800);
}

test.describe('rotation keeps overlays on their text', () => {
  test('an annotation follows the page when it is rotated', async ({ page }) => {
    await openPdf(page);
    const line = span(page, /Native rendering/);
    const b = (await line.boundingBox())!;
    await page.getByRole('radio', { name: 'Highlight' }).click();
    await page.mouse.move(b.x, b.y);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width, b.y + b.height, { steps: 6 });
    await page.mouse.up();
    await page.getByRole('radio', { name: 'Highlight' }).click();
    const ann = page.locator('.dv-annotation-layer g.dv-annotation').first();
    await overlap(ann, line);
    await rotate(page);
    await overlap(ann, span(page, /Native rendering/));
  });

  test('an annotation drawn on a rotated page lines up after rotating back', async ({ page }) => {
    await openPdf(page);
    await rotate(page);
    const line = span(page, /Native rendering/);
    const b = (await line.boundingBox())!;
    await page.getByRole('radio', { name: 'Highlight' }).click();
    await page.mouse.move(b.x, b.y);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width, b.y + b.height, { steps: 6 });
    await page.mouse.up();
    await page.getByRole('radio', { name: 'Highlight' }).click();
    for (let i = 0; i < 3; i++) await rotate(page);
    await overlap(page.locator('.dv-annotation-layer g.dv-annotation').first(), span(page, /Native rendering/));
  });

  test('search highlights follow rotation', async ({ page }) => {
    await openPdf(page);
    await page.getByRole('button', { name: 'Toggle search' }).click();
    await page.locator('.dv-search-input').fill('Native rendering');
    await expect(page.locator('.dv-search-count')).toContainText(/1 of/);
    await rotate(page);
    await overlap(page.locator('.dv-search-highlight-current'), span(page, /Native rendering/));
  });
});
