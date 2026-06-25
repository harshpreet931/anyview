import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) =>
  fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

async function openPdf(page: Page) {
  await page.goto('/');
  await expect(page.locator('.dv-root')).toBeVisible();
  await page.locator('.pg-sample-chip', { hasText: 'PDF' }).first().click();
  await page.waitForSelector('.dv-page canvas');
}
const pageWidth = (page: Page) =>
  page.locator('.dv-page').first().evaluate((el) => el.getBoundingClientRect().width);

test.describe('zoom — fit modes', () => {
  test('fit-width sizes the page to the available width', async ({ page }) => {
    await openPdf(page);
    await page.selectOption('select[aria-label="Zoom level"]', 'fit-width');
    await page.waitForTimeout(300);
    const { pw, avail } = await page.evaluate(() => {
      const c = document.querySelector('.dv-viewer-container')!;
      const p = document.querySelector('.dv-page')!;
      return { pw: p.getBoundingClientRect().width, avail: c.clientWidth - 48 };
    });
    expect(Math.abs(pw - avail)).toBeLessThan(12);
  });

  test('fit-page fits the whole page in the viewport', async ({ page }) => {
    await openPdf(page);
    await page.selectOption('select[aria-label="Zoom level"]', 'fit-page');
    await page.waitForTimeout(300);
    const ok = await page.evaluate(() => {
      const c = document.querySelector('.dv-viewer-container')!;
      const p = document.querySelector('.dv-page')!.getBoundingClientRect();
      return p.width <= c.clientWidth + 2 && p.height <= c.clientHeight + 2;
    });
    expect(ok).toBe(true);
  });
});

test.describe('zoom — gestures', () => {
  test('Ctrl+wheel zooms the page in', async ({ page }) => {
    await openPdf(page);
    await page.selectOption('select[aria-label="Zoom level"]', 'actual');
    await page.waitForTimeout(300);
    const before = await pageWidth(page);
    await page.evaluate(() => {
      const el = document.querySelector('.dv-viewer-container')!;
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new WheelEvent('wheel', { deltaY: -240, ctrlKey: true, clientX: r.left + r.width / 2, clientY: r.top + 100, bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(300);
    expect(await pageWidth(page)).toBeGreaterThan(before * 1.1);
  });

  test('marquee zoom magnifies a dragged region', async ({ page }) => {
    await openPdf(page);
    await page.selectOption('select[aria-label="Zoom level"]', 'fit-page');
    await page.waitForTimeout(300);
    const before = await pageWidth(page);
    await page.locator('button[aria-label="Marquee zoom"]').click();
    await expect(page.locator('.dv-viewer-container[data-marquee]')).toHaveCount(1);
    const box = (await page.locator('.dv-viewer-container').boundingBox())!;
    await page.mouse.move(box.x + 250, box.y + 120);
    await page.mouse.down();
    await page.mouse.move(box.x + 350, box.y + 200);
    await page.mouse.move(box.x + 430, box.y + 290);
    await page.mouse.up();
    await page.waitForTimeout(400);
    expect(await pageWidth(page)).toBeGreaterThan(before * 1.8);
    await expect(page.locator('.dv-viewer-container[data-marquee]')).toHaveCount(0);
  });
});

test.describe('layout — two-page spread', () => {
  test('two-up renders pages side by side', async ({ page }) => {
    await openPdf(page);
    await page.selectOption('select[aria-label="Zoom level"]', 'actual');
    await page.selectOption('select[aria-label="Page layout"]', 'even');
    await page.waitForTimeout(400);
    const sideBySide = await page.evaluate(() => {
      const ps = [...document.querySelectorAll('.dv-page')].slice(0, 2).map((p) => p.getBoundingClientRect());
      return ps.length >= 2 && Math.abs(ps[0]!.top - ps[1]!.top) < 8 && ps[1]!.left > ps[0]!.left + ps[0]!.width - 4;
    });
    expect(sideBySide).toBe(true);
  });
});

test.describe('empty state — open files', () => {
  test('dropping a file opens it', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.dv-empty-dropzone')).toBeVisible();
    await page.evaluate(() => {
      const dz = document.querySelector('.dv-empty-dropzone')!;
      const dt = new DataTransfer();
      dt.items.add(new File(['# Dropped File\n\nhi'], 'd.md', { type: 'text/markdown' }));
      dz.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    });
    await expect(page.locator('.dv-reflow-target')).toContainText('Dropped File');
  });

  test('click-to-browse opens a file', async ({ page }) => {
    await page.goto('/');
    await page.locator('.dv-empty-dropzone input[type="file"]').setInputFiles(fixture('sample.ipynb'));
    await expect(page.locator('.dv-reflow-target')).toContainText('Notebook Fixture');
  });
});

test.describe('format — Jupyter notebook', () => {
  test('renders markdown, code, and outputs', async ({ page }) => {
    await page.goto('/');
    await page.locator('.pg-upload-btn input[type="file"]').setInputFiles(fixture('sample.ipynb'));
    const root = page.locator('.dv-reflow-target');
    await expect(root.locator('.dv-ipynb-md h1')).toHaveText('Notebook Fixture');
    await expect(root).toContainText('sum = 10');
    await expect(root).toContainText('array([0, 1, 2, 3, 4])');
    await expect(root.locator('.dv-ipynb-error')).toBeVisible();
  });
});

test.describe('annotations — shapes & free-text', () => {
  test('draws rectangle, line, and free-text', async ({ page }) => {
    page.on('dialog', (d) => d.accept('Note text'));
    await openPdf(page);
    await page.selectOption('select[aria-label="Zoom level"]', 'fit-page');
    await page.waitForTimeout(300);
    const box = (await page.locator('.dv-page').first().boundingBox())!;
    const drag = async (label: string, x1: number, y1: number, x2: number, y2: number) => {
      await page.locator(`button[aria-label="${label}"]`).click();
      await page.mouse.move(box.x + x1, box.y + y1);
      await page.mouse.down();
      await page.mouse.move(box.x + (x1 + x2) / 2, box.y + (y1 + y2) / 2);
      await page.mouse.move(box.x + x2, box.y + y2);
      await page.mouse.up();
      await page.waitForTimeout(120);
    };
    await drag('Rectangle', 40, 60, 200, 150);
    await drag('Line', 40, 230, 240, 330);
    await page.locator('button[aria-label="Text"]').click();
    await page.mouse.click(box.x + 80, box.y + 420);
    await page.waitForTimeout(200);
    await expect(page.locator('g.dv-annotation')).toHaveCount(3);
    await expect(page.locator('.dv-annotation-layer text')).toHaveText('Note text');
  });
});
