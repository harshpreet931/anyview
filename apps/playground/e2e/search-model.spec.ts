import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { openFile, revealViewer, waitForReflow, waitForStable } from './helpers';

const XLSX = createRequire(new URL('../../../packages/viewer/package.json', import.meta.url))('xlsx');

const count = (page: Page) => page.locator('.dv-search-count');

async function search(page: Page, text: string) {
  await revealViewer(page);
  await page.locator('button[aria-label="Toggle search"]').click();
  await page.locator('.dv-search-input').fill(text);
}

function workbook(sheets: Record<string, unknown[][]>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

function twelveSheets(): Buffer {
  const sheets: Record<string, unknown[][]> = {};
  for (let s = 0; s < 12; s++) {
    const rows: unknown[][] = [['col a', 'col b']];
    for (let r = 0; r < 60; r++) rows.push([`s${s}r${r}`, s === 10 && r === 30 ? 'SHEETELEVENWORD' : `apple${s}`]);
    sheets[`Sheet${s + 1}`] = rows;
  }
  return workbook(sheets);
}

function csv(rows: number, special: Record<number, string> = {}): Buffer {
  const lines = ['id,name,value,note'];
  for (let i = 1; i <= rows; i++) lines.push(`${i},name${i},${i * 7},${special[i] ?? 'regular'}`);
  return Buffer.from(lines.join('\n'));
}

const openXlsx = (page: Page, buffer: Buffer) =>
  openFile(page, { name: 'book.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });

const openCsv = (page: Page, buffer: Buffer) => openFile(page, { name: 'data.csv', mimeType: 'text/csv', buffer });

/** The current match's highlighted text sits inside the viewer's visible area. */
function currentMatchInView(page: Page) {
  return page.evaluate(() => {
    const highlight = CSS.highlights.get('dv-search-current');
    const range = highlight ? (Array.from(highlight)[0] as Range | undefined) : undefined;
    if (!range) return false;
    const r = range.getBoundingClientRect();
    const c = document.querySelector('.dv-viewer-container')!.getBoundingClientRect();
    return r.height > 0 && r.top >= c.top && r.bottom <= c.bottom && r.left >= c.left && r.right <= c.right;
  });
}


test.describe('search covers the whole document', () => {
  test('XLSX counts matches on every sheet and reveals one on an unmounted sheet', async ({ page }) => {
    await openXlsx(page, twelveSheets());
    await waitForReflow(page);
    await search(page, 'apple');
    await expect(count(page)).toHaveText('1 of 719');

    await page.locator('.dv-search-input').fill('SHEETELEVENWORD');
    await expect(count(page)).toHaveText('1 of 1');
    await expect.poll(() => currentMatchInView(page)).toBe(true);
    const sheet = await page.evaluate(() => {
      const range = Array.from(CSS.highlights.get('dv-search-current')!)[0] as Range;
      return range.startContainer.parentElement!.closest('.dv-page')!.getAttribute('data-page-index');
    });
    expect(sheet).toBe('10');
  });

  test('XLSX scrolls freely while search is open', async ({ page }) => {
    await openXlsx(page, twelveSheets());
    await waitForReflow(page);
    await search(page, 'apple');
    await expect(count(page)).toHaveText('1 of 719');
    await page.locator('.dv-search-input').blur();
    await revealViewer(page);
    const container = page.locator('.dv-viewer-container');
    const box = (await container.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    let last = await container.evaluate((el) => el.scrollTop);
    for (let i = 0; i < 25; i++) {
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(80);
      const now = await container.evaluate((el) => el.scrollTop);
      expect(now).toBeGreaterThan(last);
      last = now;
    }
  });

  test('XLSX finds and shows a row past the render cap', async ({ page }) => {
    const rows: unknown[][] = [['id', 'v']];
    for (let r = 1; r <= 8_000; r++) rows.push([r, r === 7_000 ? 'ROW7KUNIQUE' : 'x']);
    await openXlsx(page, workbook({ Big: rows }));
    await waitForReflow(page);
    await search(page, 'ROW7KUNIQUE');
    await expect(count(page)).toHaveText('1 of 1');
    await expect.poll(() => currentMatchInView(page)).toBe(true);
  });

  test('CSV finds and shows a row past the first rendered rows', async ({ page }) => {
    await openCsv(page, csv(100_000, { 90_000: 'UNIQUEVAL90K' }));
    await waitForReflow(page);
    await search(page, 'UNIQUEVAL90K');
    await expect(count(page)).toHaveText('1 of 1');
    await expect.poll(() => currentMatchInView(page), { timeout: 20_000 }).toBe(true);
  });

  test('CSV matches stay inside one cell', async ({ page }) => {
    await openCsv(page, Buffer.from('a,b\nname200,1400\n'));
    await waitForReflow(page);
    await search(page, 'name2001');
    await expect(count(page)).toHaveText('Not found');
  });

  test('a capped match count says so', async ({ page }) => {
    await openFile(page, { name: 'hits.log', mimeType: 'text/plain', buffer: Buffer.from('hit\n'.repeat(12_000)) });
    await waitForReflow(page);
    await search(page, 'hit');
    await expect(count(page)).toHaveText('1 of 10,000+');
  });
});

test.describe('search reveals the match itself', () => {
  const log = () => {
    const lines = Array.from({ length: 40_000 }, (_, i) => `2026-11-20 INFO request ${i} handled status=200`);
    lines.splice(39_000, 0, 'FATAL NEEDLELINE_NEAR_END something broke', 'FATAL NEEDLELINE_NEAR_END again');
    return Buffer.from(lines.join('\n'));
  };

  test('a large log scrolls to the matched line, and Enter to the next one', async ({ page }) => {
    await openFile(page, { name: 'big.log', mimeType: 'text/plain', buffer: log() });
    await waitForReflow(page);
    await search(page, 'NEEDLELINE_NEAR_END');
    await expect(count(page)).toHaveText('1 of 2');
    await expect.poll(() => currentMatchInView(page)).toBe(true);
    const top = await page.locator('.dv-viewer-container').evaluate((el) => el.scrollTop);
    await page.locator('.dv-search-input').press('Enter');
    await expect(count(page)).toHaveText('2 of 2');
    await expect.poll(() => currentMatchInView(page)).toBe(true);
    expect(await page.locator('.dv-viewer-container').evaluate((el) => el.scrollTop)).toBeGreaterThan(top);
  });

  test('a large code file scrolls to the match', async ({ page }) => {
    const code = Array.from({ length: 12_000 }, (_, i) => `export const value${i} = ${i}; // filler`);
    code.splice(11_000, 0, 'export const NEEDLE_IN_CODE = true;');
    await openFile(page, { name: 'big.js', mimeType: 'text/javascript', buffer: Buffer.from(code.join('\n')) });
    await waitForReflow(page);
    await search(page, 'NEEDLE_IN_CODE');
    await expect(count(page)).toHaveText('1 of 1');
    await expect.poll(() => currentMatchInView(page)).toBe(true);
  });
});

test('CSV print holds every row and no controls', async ({ page }) => {
  await page.addInitScript(() => {
    const top = window.top as Window & { __printed?: string };
    window.print = () => {
      if (window !== top) top.__printed = document.body.innerText;
    };
  });
  await openCsv(page, csv(3_000));
  await waitForReflow(page);
  await revealViewer(page);
  await page.getByRole('button', { name: 'Print' }).click();
  await waitForStable(() => page.evaluate(() => (window as Window & { __printed?: string }).__printed ?? null));
  const printed = await page.evaluate(() => (window as Window & { __printed?: string }).__printed!);
  expect(printed).toContain('name3000');
  expect(printed).not.toContain('more rows');
});
