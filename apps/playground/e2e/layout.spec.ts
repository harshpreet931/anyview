import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { fixture, openFile, revealViewer, waitForReflow, waitForStable } from './helpers';

const XLSX = createRequire(new URL('../../../packages/viewer/package.json', import.meta.url))('xlsx');

function sheets(count: number, rows = 60): Buffer {
  const wb = XLSX.utils.book_new();
  for (let s = 0; s < count; s++) {
    const data: unknown[][] = [['col a', 'col b']];
    for (let r = 0; r < rows; r++) data.push([`s${s}r${r}`, s === 10 && r === 30 ? 'FARSHEETWORD' : `value ${s}`]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), `Sheet${s + 1}`);
  }
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

async function openXlsx(page: Page, buffer: Buffer) {
  await openFile(page, { name: 'book.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
  await waitForReflow(page);
  await revealViewer(page);
}

/** Where page `index` sits relative to the top of the viewer, or null when it is not mounted. */
const pageTop = (page: Page, index: number) =>
  page.evaluate((index) => {
    const el = document.querySelector<HTMLElement>(`.dv-page[data-page-index="${index}"]`);
    if (!el) return null;
    return Math.round(el.getBoundingClientRect().top - document.querySelector('.dv-viewer-container')!.getBoundingClientRect().top);
  }, index);

async function goTo(page: Page, n: number) {
  const input = page.getByLabel('Page number');
  await input.fill(String(n));
  await input.press('Enter');
}

test.describe('jumps to flowing pages', () => {
  test('a page-number jump lands on the sheet even after the sheets above it are measured', async ({ page }) => {
    await openXlsx(page, sheets(12));
    await goTo(page, 11);
    await waitForStable(() => pageTop(page, 10));
    expect(await pageTop(page, 10)).toBe(24);

    await goTo(page, 5);
    await waitForStable(() => pageTop(page, 4));
    expect(await pageTop(page, 4)).toBe(24);

    await goTo(page, 9);
    await waitForStable(() => pageTop(page, 8));
    expect(await pageTop(page, 8)).toBe(24);
  });

  test('an outline jump to the last sheet lands on it', async ({ page }) => {
    await openXlsx(page, sheets(12));
    await page.getByRole('tab', { name: 'Outline' }).click();
    await page.getByRole('treeitem', { name: 'Sheet12' }).click();
    await waitForStable(() => pageTop(page, 11));
    expect(await pageTop(page, 11)).toBe(24);
  });

  test('scrolling up over sheets that render as they appear keeps the view still', async ({ page }) => {
    await openXlsx(page, sheets(12));
    await goTo(page, 11);
    await waitForStable(() => pageTop(page, 10));
    for (const by of [300, 1000, 1000]) {
      const top = (await pageTop(page, 10))!;
      await page.locator('.dv-viewer-container').evaluate((el, by) => el.scrollBy(0, -by), by);
      await waitForStable(() => pageTop(page, 10));
      expect(await pageTop(page, 10)).toBe(top + by);
    }
  });

  test('a search match on a far sheet stays centred once the sheets above it are measured', async ({ page }) => {
    await openXlsx(page, sheets(12));
    await page.locator('button[aria-label="Toggle search"]').click();
    await page.locator('.dv-search-input').fill('FARSHEETWORD');
    await expect(page.locator('.dv-search-count')).toHaveText('1 of 1');
    const offCentre = () =>
      page.evaluate(() => {
        const range = Array.from(CSS.highlights.get('dv-search-current') ?? [])[0] as Range | undefined;
        if (!range) return null;
        const r = range.getBoundingClientRect();
        const c = document.querySelector('.dv-viewer-container')!.getBoundingClientRect();
        return Math.round(r.top + r.height / 2 - (c.top + c.height / 2));
      });
    await waitForStable(offCentre);
    // The sheet was revealed while its 6 px entrance animation ran.
    expect(Math.abs((await offCentre())!)).toBeLessThan(10);
  });
});

const pageBoxes = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.dv-page')].map((p) => {
      const content = p.querySelector('.dv-reflow-target')!.getBoundingClientRect();
      const box = p.getBoundingClientRect();
      return { width: box.width, height: box.height, content: content.height };
    }),
  );

test.describe('flowing page height', () => {
  for (const [name, mimeType, body] of [
    ['note.md', 'text/markdown', '# Meeting notes\n\nA short note.\n'],
    ['note.txt', 'text/plain', 'hello\nthree short\nlines\n'],
    ['rows.csv', 'text/csv', 'name,qty\napples,3\npears,5\n'],
  ]) {
    test(`a short ${name.split('.')[1]} document is a sheet of paper`, async ({ page }) => {
      await openFile(page, { name, mimeType, buffer: Buffer.from(body) });
      await waitForReflow(page);
      await waitForStable(() => pageBoxes(page));
      const [box] = await pageBoxes(page);
      expect(Math.abs(box!.height - box!.width * Math.SQRT2)).toBeLessThan(2);
    });
  }

  test('a long document has no blank paper under it', async ({ page }) => {
    const md = Array.from({ length: 150 }, (_, i) => `Paragraph ${i + 1} of a long note.`).join('\n\n');
    await openFile(page, { name: 'long.md', mimeType: 'text/markdown', buffer: Buffer.from(md) });
    await waitForReflow(page);
    await waitForStable(() => pageBoxes(page));
    const [box] = await pageBoxes(page);
    expect(box!.content).toBeGreaterThan(box!.width * Math.SQRT2);
    expect(Math.abs(box!.height - box!.content)).toBeLessThan(2);
  });

  test('a slide keeps its own shape', async ({ page }) => {
    await openFile(page, fixture('sample.pptx'));
    await waitForReflow(page);
    await waitForStable(() => pageBoxes(page));
    const [box] = await pageBoxes(page);
    expect(box!.height).toBeLessThan(box!.width);
  });

  test('thumbnails of flowing documents are a sheet of paper, however long the document', async ({ page }) => {
    const csv = ['id,name', ...Array.from({ length: 5000 }, (_, i) => `${i},name${i}`)].join('\n');
    await openFile(page, { name: 'rows.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await waitForReflow(page);
    const box = (await page.locator('.dv-thumbnail-image').first().boundingBox())!;
    expect(Math.abs(box.height - box.width * Math.SQRT2)).toBeLessThan(2);
  });
});
