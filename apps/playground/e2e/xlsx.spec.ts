import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { openApp, openFile, revealViewer, waitForReflow, waitForZoom } from './helpers';

const XLSX = createRequire(new URL('../../../packages/viewer/package.json', import.meta.url))('xlsx');

const ROW = 28;

function report(): Buffer {
  const rows: unknown[][] = [['Quarterly revenue report'], ['Region', 'Product', 'Units', 'Price', 'Revenue', 'Notes']];
  for (let r = 3; r <= 3_000; r++) rows.push([`R${r}`, `prod-${r}`, r * 3, r % 17, r * 7, `note ${r}`]);
  rows[99]![1] = 'Mid merge';
  rows[299]![0] = 'Tall merge';
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!merges'] = ['A1:F1', 'B100:D100', 'A300:A2300'].map((ref) => XLSX.utils.decode_range(ref));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Report');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

async function open(page: Page, buffer: Buffer) {
  await openFile(page, { name: 'book.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
  await waitForReflow(page);
  await page.selectOption('select[aria-label="Zoom level"]', '1');
  await waitForZoom(page);
  await revealViewer(page);
}

/** Scrolls the viewer so sheet row `row` (counted from 0) is near the top of the view. */
async function scrollToRow(page: Page, row: number) {
  await page.evaluate(
    ([row, height]) => {
      const scroller = document.querySelector('.dv-viewer-container')!;
      const spacer = scroller.querySelector('.dv-rows')!;
      scroller.scrollTop += spacer.getBoundingClientRect().top - scroller.getBoundingClientRect().top + row * height;
    },
    [row, ROW],
  );
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

const box = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const { left, right, top, bottom } = el.getBoundingClientRect();
    return { left, right, top, bottom };
  });

test.describe('Excel', () => {
  test('a merged cell spans the columns and rows it covers, as one cell', async ({ page }) => {
    await open(page, report());
    const title = await box(page, '.dv-grid-merge:has-text("Quarterly revenue report")');
    const a2 = await box(page, 'tr[data-dv-unit="1"] [data-dv-cell="0"]');
    const f2 = await box(page, 'tr[data-dv-unit="1"] [data-dv-cell="5"]');
    expect(title.left).toBeCloseTo(a2.left, 0);
    expect(title.right).toBeCloseTo(f2.right, 0);
    expect(title.bottom).toBeCloseTo(a2.top, 0);

    await scrollToRow(page, 1_500);
    const tall = await box(page, '.dv-grid-merge[data-dv-unit="299"]');
    const view = await box(page, '.dv-viewer-container');
    const b = await box(page, 'tr[data-dv-unit="1500"] [data-dv-cell="1"]');
    expect(tall.top).toBeLessThan(view.top);
    expect(tall.bottom).toBeGreaterThan(view.bottom);
    expect(tall.right).toBeCloseTo(b.left, 0);
    await expect(page.locator('tr[data-dv-unit="1500"] [data-dv-cell="0"]')).toHaveCount(0);

    await page.locator('button[aria-label="Toggle search"]').click();
    await page.locator('.dv-search-input').fill('tall merge');
    await expect(page.locator('.dv-search-count')).toHaveText('1 of 1');
    await expect
      .poll(() =>
        page.evaluate(() => {
          const range = Array.from(CSS.highlights.get('dv-search-current') ?? [])[0] as Range | undefined;
          const r = range?.getBoundingClientRect();
          const c = document.querySelector('.dv-viewer-container')!.getBoundingClientRect();
          return !!r && !!range?.startContainer.parentElement?.closest('.dv-grid-merge') && r.top >= c.top && r.bottom <= c.bottom;
        }),
      )
      .toBe(true);
  });

  test('a big workbook is read off the main thread', async ({ page }) => {
    const rows: unknown[][] = [Array.from({ length: 20 }, (_, c) => `Col${c}`)];
    for (let r = 1; r <= 30_000; r++) rows.push(Array.from({ length: 20 }, (_, c) => (c % 2 ? `r${r}c${c}` : r * c)));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Big');
    // From a file: a file handed over as a buffer is decoded in the page in one long task of its own.
    const file = test.info().outputPath('big.xlsx');
    XLSX.writeFile(wb, file, { compression: true });

    await page.addInitScript(() => {
      const tasks: number[] = ((window as unknown as { longTasks: number[] }).longTasks = []);
      new PerformanceObserver((list) => list.getEntries().forEach((e) => tasks.push(e.duration))).observe({ type: 'longtask' });
    });
    await openApp(page);
    await page.evaluate(() => ((window as unknown as { longTasks: number[] }).longTasks.length = 0));
    await page.locator('.pg-upload-btn input[type="file"]').setInputFiles(file);
    await expect(page.locator('tr[data-dv-unit="1"] [data-dv-cell="1"]')).toHaveText('r1c1', { timeout: 30_000 });
    const longest = await page.evaluate(() => Math.max(0, ...(window as unknown as { longTasks: number[] }).longTasks));
    expect(longest).toBeLessThan(250);
  });
});
