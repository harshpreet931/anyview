import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { openFile, revealViewer, waitForReflow, waitForZoom } from './helpers';

const XLSX = createRequire(new URL('../../../packages/viewer/package.json', import.meta.url))('xlsx');

const CHROME_MAX_HEIGHT = 33_554_432;

function csv(rows: number, special: Record<number, string> = {}): Buffer {
  const lines = ['id,name,value,note'];
  for (let i = 1; i <= rows; i++) lines.push(`${i},name${i},${i * 7},${special[i] ?? 'regular'}`);
  return Buffer.from(lines.join('\n'));
}

/** A log whose lines are short, or up to 200 characters long when `wide`. */
function log(lines: number, special: Record<number, string> = {}, wide = false): Buffer {
  const out: string[] = [];
  for (let i = 0; i < lines; i++) {
    out.push(special[i] ?? (wide ? `2026-11-20T10:00:00Z INFO [worker-${i % 16}] request id=${i} status=200 ${'x'.repeat(i % 140)}` : `INFO id=${i}`));
  }
  return Buffer.from(out.join('\n'));
}

async function open(page: Page, name: string, mimeType: string, buffer: Buffer) {
  await openFile(page, { name, mimeType, buffer });
  await waitForReflow(page);
  await revealViewer(page);
  await frames(page);
}

const frames = (page: Page) =>
  page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function zoomTo(page: Page, zoom: string) {
  await page.selectOption('select[aria-label="Zoom level"]', zoom);
  await waitForZoom(page);
  await frames(page);
}

/** Scrolls the viewer to a fraction of its range, as dragging the scrollbar would. */
async function scrollTo(page: Page, fraction: number) {
  await page.evaluate((fraction) => {
    const view = document.querySelector<HTMLElement>('.dv-viewer-container')!;
    view.scrollTop = (view.scrollHeight - view.clientHeight) * fraction;
  }, fraction);
  await frames(page);
}

/** The units of the rows or lines on screen, in order. */
const visibleUnits = (page: Page) =>
  page.evaluate(() => {
    const view = document.querySelector('.dv-viewer-container')!.getBoundingClientRect();
    return Array.from(document.querySelectorAll('.dv-viewer-container .dv-rows-layer [data-dv-unit]'))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > view.top + 1 && r.top < view.bottom - 1;
      })
      .map((el) => Number(el.getAttribute('data-dv-unit')));
  });

const elementCount = (page: Page) => page.evaluate(() => document.querySelector('.dv-viewer-container')!.getElementsByTagName('*').length);
const scrollHeight = (page: Page) => page.evaluate(() => document.querySelector('.dv-viewer-container')!.scrollHeight);

function currentMatchInView(page: Page) {
  return page.evaluate(() => {
    const highlight = CSS.highlights.get('dv-search-current');
    const range = highlight ? (Array.from(highlight)[0] as Range | undefined) : undefined;
    if (!range) return false;
    const r = range.getBoundingClientRect();
    const c = document.querySelector('.dv-viewer-container')!.getBoundingClientRect();
    return r.height > 0 && r.top >= c.top && r.bottom <= c.bottom;
  });
}

async function search(page: Page, text: string) {
  await page.locator('button[aria-label="Toggle search"]').click();
  await page.locator('.dv-search-input').fill(text);
}

test.describe('row lists', () => {
  test('a 300,000-row CSV renders only the rows in view, under a header that stays, and reaches its last row at every zoom', async ({ page }) => {
    await open(page, 'big.csv', 'text/csv', csv(300_000));
    expect(await elementCount(page)).toBeLessThan(1_500);
    expect(await page.locator('.dv-csv-more, .dv-reflow-target button').count()).toBe(0);
    const widths = () => page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('.dv-grid-head th'), (th) => th.offsetWidth));
    const before = await widths();

    await scrollTo(page, 0.5);
    const middle = await visibleUnits(page);
    expect(middle[0]).toBeGreaterThan(1_000);
    const firstRow = page.locator(`.dv-rows-layer tr[data-dv-unit="${middle[1]}"]`);
    await expect(firstRow.locator('th')).toHaveText(String(middle[1]));
    await expect(firstRow.locator('[data-dv-cell="1"]')).toHaveText(`name${middle[1]}`);
    const header = await page.evaluate(() => {
      const view = document.querySelector('.dv-viewer-container')!.getBoundingClientRect();
      const head = document.querySelector('.dv-grid-head')!.getBoundingClientRect();
      return head.top - view.top;
    });
    expect(Math.abs(header)).toBeLessThan(2);
    expect(await widths()).toEqual(before);
    expect(await elementCount(page)).toBeLessThan(1_500);

    for (const zoom of ['1', '5']) {
      await zoomTo(page, zoom);
      await scrollTo(page, 1);
      expect(await visibleUnits(page), `zoom ${zoom}`).toContain(300_000);
      expect(await scrollHeight(page)).toBeLessThan(CHROME_MAX_HEIGHT);
    }
    await expect(page.locator('.dv-rows-layer tr[data-dv-unit="300000"] [data-dv-cell="1"]')).toHaveText('name300000');
  });

  test('a log keeps each line on one row, however long', async ({ page }) => {
    await open(page, 'wide.log', 'text/plain', log(20_000, {}, true));
    const unwrapped = () =>
      page.evaluate(() => {
        const lines = Array.from(document.querySelectorAll<HTMLElement>('.dv-rows-layer .dv-line'));
        const page = document.querySelector('.dv-page')!.getBoundingClientRect();
        const zoom = page.width / document.querySelector<HTMLElement>('.dv-reflow-target')!.offsetWidth;
        return lines.every((line) => {
          const text = document.createRange();
          text.selectNodeContents(line);
          const r = text.getBoundingClientRect();
          return Math.abs(line.getBoundingClientRect().height - 20 * zoom) < 0.5 && r.right <= page.right + 0.5;
        });
      });
    await scrollTo(page, 0.3);
    expect(await unwrapped()).toBe(true);
  });

  test('a 400,000-line log renders only the lines in view and reaches its last line at the highest zoom', async ({ page }) => {
    await open(page, 'big.log', 'text/plain', log(400_000, { 399_999: 'THE LAST LINE' }));
    expect(await elementCount(page)).toBeLessThan(400);
    for (const zoom of ['1', '5']) {
      await zoomTo(page, zoom);
      await scrollTo(page, 1);
      expect(await visibleUnits(page), `zoom ${zoom}`).toContain(399_999);
      expect(await scrollHeight(page)).toBeLessThan(CHROME_MAX_HEIGHT);
    }
    await expect(page.locator('.dv-line[data-dv-unit="399999"]')).toHaveText('THE LAST LINE');
  });

  test('wheel scrolling moves a compressed list by as much as the wheel does', async ({ page }) => {
    await open(page, 'big.log', 'text/plain', log(400_000));
    await scrollTo(page, 0.5);
    const box = (await page.locator('.dv-viewer-container').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const topOf = (unit: number) =>
      page.evaluate((unit) => document.querySelector(`.dv-line[data-dv-unit="${unit}"]`)?.getBoundingClientRect().top ?? null, unit);
    const unit = (await visibleUnits(page))[10]!;
    const before = (await topOf(unit))!;
    await page.mouse.wheel(0, 200);
    await expect.poll(() => topOf(unit)).toBeCloseTo(before - 200, -1);
    await page.waitForTimeout(400);
    expect(await topOf(unit)).toBeCloseTo(before - 200, -1);
  });

  test('dragging the scrollbar spans a compressed list, and the wheel scrolls 1:1 after the drag', async ({ page }) => {
    await open(page, 'big.log', 'text/plain', log(400_000, { 399_999: 'THE LAST LINE' }));
    // Headless Chromium draws overlay scrollbars, so the drag is the scroller's own pointer events and scroll steps.
    const drag = (from: number, to: number) =>
      page.evaluate(
        async ([from, to]) => {
          const view = document.querySelector<HTMLElement>('.dv-viewer-container')!;
          const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
          const range = view.scrollHeight - view.clientHeight;
          view.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
          for (let top = range * from; top < range * to; top += 200) {
            view.scrollTop = top;
            await frame();
          }
          view.scrollTop = range * to;
          await frame();
          window.dispatchEvent(new PointerEvent('pointerup'));
        },
        [from, to],
      );
    await scrollTo(page, 0.495);
    await drag(0.495, 0.5);
    const dragged = await visibleUnits(page);
    await scrollTo(page, 0.2);
    await scrollTo(page, 0.5);
    expect(await visibleUnits(page)).toEqual(dragged);
    await scrollTo(page, 0.998);
    await drag(0.998, 1);
    expect(await visibleUnits(page)).toContain(399_999);

    await scrollTo(page, 0.5);
    const box = (await page.locator('.dv-viewer-container').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const unit = (await visibleUnits(page))[10]!;
    const topOf = () => page.evaluate((unit) => document.querySelector(`.dv-line[data-dv-unit="${unit}"]`)?.getBoundingClientRect().top ?? null, unit);
    const before = (await topOf())!;
    await page.mouse.wheel(0, 200);
    await expect.poll(topOf).toBeCloseTo(before - 200, -1);
  });

  test('a 20,000-row sheet has no row cap, letters its columns and numbers its rows', async ({ page }) => {
    const wb = XLSX.utils.book_new();
    const rows: unknown[][] = [['id', 'value']];
    for (let r = 1; r <= 20_000; r++) rows.push([r, `v${r}`]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Big');
    await open(page, 'big.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })));
    await expect(page.locator('.dv-grid-head th')).toHaveText(['', 'A', 'B']);
    expect(await page.locator('.dv-sheet-truncated').count()).toBe(0);
    await scrollTo(page, 1);
    await expect.poll(() => visibleUnits(page)).toContain(20_000);
    const last = page.locator('.dv-rows-layer tr[data-dv-unit="20000"]');
    await expect(last.locator('th')).toHaveText('20001');
    await expect(last.locator('[data-dv-cell="1"]')).toHaveText('v20000');
  });

  test('a 100,000-line code file is highlighted where it is shown, far past the old size limit', async ({ page }) => {
    const code = Array.from({ length: 100_000 }, (_, i) => `export const value${i}: number = ${i}; // line ${i}`).join('\n');
    await open(page, 'big.ts', 'text/typescript', Buffer.from(code));
    await expect(page.locator('.dv-reflow-target .shiki')).toHaveCount(1);
    expect(await page.locator('.dv-line[data-dv-unit="0"] span[style]').count()).toBeGreaterThan(3);
    await scrollTo(page, 0.9);
    const unit = (await visibleUnits(page))[3]!;
    expect(unit).toBeGreaterThan(80_000);
    await expect.poll(() => page.locator(`.dv-line[data-dv-unit="${unit}"] span[style]`).count(), { timeout: 20_000 }).toBeGreaterThan(3);
    expect(await elementCount(page)).toBeLessThan(2_000);
  });

  test('zooming a compressed list keeps the rows in view', async ({ page }) => {
    await open(page, 'big.csv', 'text/csv', csv(300_000));
    await zoomTo(page, '1');
    await scrollTo(page, 0.6);
    const before = await visibleUnits(page);
    await zoomTo(page, '2');
    const after = await visibleUnits(page);
    expect(after.filter((u) => before.includes(u)).length).toBeGreaterThan(0);
  });
});

test.describe('search in row lists', () => {
  test('reveals matches deep in a compressed CSV, one after the other', async ({ page }) => {
    await open(page, 'big.csv', 'text/csv', csv(300_000, { 250_000: 'DEEPNEEDLE', 280_000: 'DEEPNEEDLE' }));
    await search(page, 'DEEPNEEDLE');
    await expect(page.locator('.dv-search-count')).toHaveText('1 of 2');
    await expect.poll(() => currentMatchInView(page)).toBe(true);
    expect(await visibleUnits(page)).toContain(250_000);
    await page.locator('.dv-search-input').press('Enter');
    await expect(page.locator('.dv-search-count')).toHaveText('2 of 2');
    await expect.poll(() => currentMatchInView(page)).toBe(true);
    expect(await visibleUnits(page)).toContain(280_000);
  });

  test('reveals a line near the end of a big log at the highest zoom', async ({ page }) => {
    await open(page, 'big.log', 'text/plain', log(400_000, { 398_765: 'ERROR LOGNEEDLE at the end' }));
    await zoomTo(page, '5');
    await search(page, 'LOGNEEDLE');
    await expect(page.locator('.dv-search-count')).toHaveText('1 of 1');
    await expect.poll(() => currentMatchInView(page)).toBe(true);
  });

  test('paints the matches in rows that scroll into view', async ({ page }) => {
    await open(page, 'data.csv', 'text/csv', csv(5_000));
    await search(page, 'regular');
    await expect(page.locator('.dv-search-count')).toHaveText('1 of 5000');
    const paintedUnits = () =>
      page.evaluate(() =>
        Array.from(CSS.highlights.get('dv-search') ?? [], (r) => Number((r as Range).startContainer.parentElement!.closest('[data-dv-unit]')!.getAttribute('data-dv-unit'))),
      );
    await expect.poll(async () => (await paintedUnits()).length).toBeGreaterThan(10);
    expect(Math.max(...(await paintedUnits()))).toBeLessThan(200);
    await page.locator('.dv-search-input').blur();
    await scrollTo(page, 1);
    await expect.poll(async () => (await paintedUnits()).includes(5_000)).toBe(true);
  });
});

test('selecting rows copies their cells, without the row numbers', async ({ page }) => {
  await open(page, 'pairs.csv', 'text/csv', Buffer.from(['left,right', ...Array.from({ length: 50 }, (_, i) => `L${i + 1},R${i + 1}`)].join('\n')));
  const copied = await page.evaluate(() => {
    const from = document.querySelector('.dv-rows-layer tr[data-dv-unit="2"] [data-dv-cell="0"]')!;
    const to = document.querySelector('.dv-rows-layer tr[data-dv-unit="4"] [data-dv-cell="1"]')!;
    const range = document.createRange();
    range.setStart(from.firstChild!, 0);
    range.setEnd(to.firstChild!, to.textContent!.length);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
    return getSelection()!.toString();
  });
  expect(copied).toContain('L2');
  expect(copied).toContain('R4');
  expect(copied).not.toMatch(/(^|\s)3\s/);
});

test('a CSV thumbnail previews only its first screen of rows, with no controls', async ({ page }) => {
  await open(page, 'small.csv', 'text/csv', csv(20_000));
  await expect(page.locator('.dv-thumbnail-list .dv-thumbnail-doc tr').first()).toBeAttached();
  expect(await page.locator('.dv-thumbnail-list .dv-thumbnail-doc tr').count()).toBeLessThan(60);
  expect(await page.locator('.dv-thumbnail-list .dv-thumbnail-doc button').count()).toBe(0);
});
