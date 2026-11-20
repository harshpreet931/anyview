import { test, expect, type Page } from '@playwright/test';
import { openApp, openFile, pickSample, revealViewer, waitForCanvas, waitForReflow } from './helpers';

type PdfOptions = { pages: number; rotated?: [number, number]; chapters?: number; sections?: number };

function makePdf({ pages, rotated = [-1, -1], chapters = 0, sections = 0 }: PdfOptions): Buffer {
  const objs: string[] = [];
  const add = (s: string) => objs.push(s);
  const set = (id: number, s: string) => { objs[id - 1] = s; };

  const catalog = add('');
  const pagesId = add('');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds: number[] = [];
  for (let i = 0; i < pages; i++) {
    const text = `BT /F1 96 Tf 150 400 Td (${i + 1}) Tj ET`;
    const content = add(`<< /Length ${text.length} >>\nstream\n${text}\nendstream`);
    const rot = i >= rotated[0] && i <= rotated[1] ? ' /Rotate 90' : '';
    pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792]${rot} /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  set(pagesId, `<< /Type /Pages /Kids [${pageIds.map((p) => `${p} 0 R`).join(' ')}] /Count ${pages} >>`);

  let outlinesRef = '';
  if (chapters > 0) {
    const outlines = add('');
    const tops = Array.from({ length: chapters }, () => add(''));
    tops.forEach((id, t) => {
      const kids = Array.from({ length: sections }, () => add(''));
      kids.forEach((kid, c) => {
        const prev = c > 0 ? ` /Prev ${kids[c - 1]} 0 R` : '';
        const next = c < sections - 1 ? ` /Next ${kids[c + 1]} 0 R` : '';
        set(kid, `<< /Title (Section ${t + 1}.${c + 1}) /Parent ${id} 0 R${prev}${next} /Dest [${pageIds[(t + c) % pages]} 0 R /Fit] >>`);
      });
      const prev = t > 0 ? ` /Prev ${tops[t - 1]} 0 R` : '';
      const next = t < chapters - 1 ? ` /Next ${tops[t + 1]} 0 R` : '';
      const ch = sections ? ` /First ${kids[0]} 0 R /Last ${kids[sections - 1]} 0 R /Count ${sections}` : '';
      set(id, `<< /Title (Chapter ${t + 1}) /Parent ${outlines} 0 R${prev}${next}${ch} /Dest [${pageIds[t % pages]} 0 R /Fit] >>`);
    });
    set(outlines, `<< /Type /Outlines /First ${tops[0]} 0 R /Last ${tops[chapters - 1]} 0 R /Count ${chapters * (sections + 1)} >>`);
    outlinesRef = ` /Outlines ${outlines} 0 R`;
  }
  set(catalog, `<< /Type /Catalog /Pages ${pagesId} 0 R${outlinesRef} >>`);

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

async function openPdf(page: Page, options: PdfOptions) {
  await openFile(page, { name: 'big.pdf', mimeType: 'application/pdf', buffer: makePdf(options) });
  await expect(page.locator('.dv-page-count')).toContainText(String(options.pages), { timeout: 20_000 });
  await waitForCanvas(page);
}

const panel = (page: Page) => page.locator('.dv-sidebar [role="tabpanel"]');
const thumb = (page: Page, n: number) => panel(page).getByRole('button', { name: `Page ${n}`, exact: true });

function inPanel(page: Page, n: number) {
  return panel(page).evaluate((p, n) => {
    const el = p.querySelector(`[aria-label="Page ${n}"]`);
    if (!el) return false;
    const a = p.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    return b.top >= a.top - 1 && b.bottom <= a.bottom + 1;
  }, n);
}

function firstVisible(page: Page) {
  return panel(page).evaluate((p) => {
    const top = p.getBoundingClientRect().top;
    const items = [...p.querySelectorAll<HTMLElement>('.dv-thumbnail')]
      .filter((el) => el.getBoundingClientRect().bottom > top + 1)
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    return items[0]?.getAttribute('aria-label') ?? null;
  });
}

async function widenSidebar(page: Page) {
  await page.locator('.dv-sidebar-resizer').focus();
  await page.keyboard.press('End');
  await expect.poll(async () => (await page.locator('.dv-sidebar').boundingBox())!.width).toBe(400);
}

async function goTo(page: Page, n: number) {
  const input = page.locator('.dv-page-input');
  await input.fill(String(n));
  await input.press('Enter');
  await expect(input).toHaveValue(String(n));
}

test.describe('thumbnail sidebar on a long document', () => {
  test.setTimeout(90_000);

  test('mounts a constant number of thumbnails however far it scrolls', async ({ page }) => {
    await openPdf(page, { pages: 1000 });
    await expect(thumb(page, 1)).toBeVisible();
    expect(await page.locator('.dv-thumbnail').count()).toBeLessThan(40);

    for (const fraction of [0.25, 0.5, 0.75, 1]) {
      await panel(page).evaluate((p, f) => { p.scrollTop = (p.scrollHeight - p.clientHeight) * f; }, fraction);
      await page.waitForTimeout(200);
      expect(await page.locator('.dv-thumbnail').count()).toBeLessThan(40);
      expect(await page.locator('.dv-thumbnail-canvas').count()).toBeLessThan(40);
    }
    await expect(thumb(page, 1000)).toBeVisible();
    await expect.poll(() => thumb(page, 1000).locator('canvas').evaluate((c: HTMLCanvasElement) => c.width)).toBeGreaterThan(0);
  });

  test('keeps the current page thumbnail in view when the page changes', async ({ page }) => {
    await openPdf(page, { pages: 1000 });
    await goTo(page, 800);
    await expect.poll(() => inPanel(page, 800)).toBe(true);

    await page.locator('.dv-viewer-container').focus();
    await page.keyboard.press('End');
    await expect(page.locator('.dv-page-input')).toHaveValue('1000');
    await expect.poll(() => inPanel(page, 1000)).toBe(true);
  });

  test('centres the current page thumbnail when the sidebar opens', async ({ page }) => {
    await openPdf(page, { pages: 1000 });
    await goTo(page, 500);
    const toggle = page.getByRole('button', { name: 'Toggle sidebar' });
    await toggle.click();
    await expect(panel(page)).toHaveCount(0);
    await toggle.click();
    await expect.poll(() => inPanel(page, 500)).toBe(true);
    const offset = await panel(page).evaluate((p) => {
      const el = p.querySelector('[aria-label="Page 500"]')!.getBoundingClientRect();
      const box = p.getBoundingClientRect();
      return Math.abs(el.top + el.height / 2 - (box.top + box.height / 2));
    });
    expect(offset).toBeLessThan(40);
  });

  test('clicking a thumbnail does not scroll the sidebar', async ({ page }) => {
    await openPdf(page, { pages: 1000 });
    await revealViewer(page);
    await panel(page).evaluate((p) => { p.scrollTop = 2000; });
    await page.waitForTimeout(200);
    const { label, x, y } = await panel(page).evaluate((p) => {
      const bottom = p.getBoundingClientRect().bottom;
      const partly = [...p.querySelectorAll<HTMLElement>('.dv-thumbnail')].find((el) => {
        const r = el.getBoundingClientRect();
        return r.top < bottom - 20 && r.bottom > bottom;
      })!;
      const r = partly.getBoundingClientRect();
      return { label: partly.getAttribute('aria-label')!, x: r.left + 20, y: r.top + 10 };
    });
    const before = await panel(page).evaluate((p) => p.scrollTop);
    await page.mouse.click(x, y);
    await expect(page.locator('.dv-page-input')).toHaveValue(label.replace('Page ', ''));
    await page.waitForTimeout(300);
    expect(await panel(page).evaluate((p) => p.scrollTop)).toBe(before);
  });

  test('a page with an intrinsic /Rotate gets a landscape thumbnail', async ({ page }) => {
    await openPdf(page, { pages: 6, rotated: [2, 2] });
    const box = await thumb(page, 3).locator('.dv-thumbnail-image').boundingBox();
    expect(box!.width).toBeGreaterThan(box!.height);
    const upright = await thumb(page, 2).locator('.dv-thumbnail-image').boundingBox();
    expect(upright!.height).toBeGreaterThan(upright!.width);
  });

  test('re-renders sharper thumbnails after the sidebar is widened, keeping its place', async ({ page }) => {
    await openPdf(page, { pages: 1000 });
    await panel(page).evaluate((p) => { p.scrollTop = 5000; });
    await page.waitForTimeout(300);
    const anchor = await firstVisible(page);

    await widenSidebar(page);

    const canvas = thumb(page, Number(anchor!.replace('Page ', ''))).locator('canvas');
    await expect
      .poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.width / (c.getBoundingClientRect().width * devicePixelRatio)))
      .toBeGreaterThanOrEqual(0.99);
    expect(await firstVisible(page)).toBe(anchor);
  });

  test('the thumbnail list is one tab stop with arrow-key navigation', async ({ page }) => {
    await openPdf(page, { pages: 1000 });
    expect(await panel(page).locator('.dv-thumbnail[tabindex="0"]').count()).toBe(1);

    await thumb(page, 1).focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
    await expect(thumb(page, 4)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(thumb(page, 3)).toBeFocused();
    await page.keyboard.press('PageDown');
    const afterPageDown = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    expect(Number(afterPageDown!.replace('Page ', ''))).toBeGreaterThan(3);

    await page.keyboard.press('End');
    await expect(thumb(page, 1000)).toBeFocused();
    await expect.poll(() => inPanel(page, 1000)).toBe(true);
    expect(await page.locator('.dv-page-input').inputValue()).toBe('1');

    await panel(page).evaluate((p) => { p.scrollTop = 0; });
    await page.waitForTimeout(300);
    await expect(thumb(page, 1000)).toBeFocused();

    await page.keyboard.press('Home');
    await expect(thumb(page, 1)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.locator('.dv-page-input')).toHaveValue('2');
    expect(await panel(page).locator('.dv-thumbnail[tabindex="0"]').count()).toBe(1);
  });
});

test.describe('reflowable thumbnails', () => {
  test('keep filling the thumbnail after the sidebar is resized', async ({ page }) => {
    await openApp(page);
    await pickSample(page, 'Markdown');
    await waitForReflow(page);
    const doc = page.locator('.dv-thumbnail-doc').first();
    await expect.poll(async () => (await doc.innerText().catch(() => '')).trim().length).toBeGreaterThan(10);

    await widenSidebar(page);

    const image = page.locator('.dv-thumbnail-image').first();
    await expect
      .poll(async () => {
        const a = await doc.boundingBox();
        const b = await image.boundingBox();
        return Math.abs(a!.width - b!.width);
      })
      .toBeLessThan(2);
  });
});

test.describe('outline on a long document', () => {
  test.setTimeout(90_000);

  test('is a windowed tree with one tab stop and the tree keyboard pattern', async ({ page }) => {
    await openPdf(page, { pages: 300, chapters: 1000, sections: 4 });
    await page.getByRole('tab', { name: 'Outline' }).click();
    const tree = panel(page).getByRole('tree');
    await expect(tree.getByRole('treeitem').first()).toBeVisible();
    expect(await tree.getByRole('treeitem').count()).toBeLessThan(80);
    expect(await tree.locator('[tabindex="0"]').count()).toBe(1);

    const chapter1 = tree.getByRole('treeitem', { name: 'Chapter 1', exact: true });
    await expect(chapter1).toHaveAttribute('aria-level', '1');
    await expect(chapter1).toHaveAttribute('aria-expanded', 'true');
    await expect(tree.getByRole('treeitem', { name: 'Section 1.1', exact: true })).toHaveAttribute('aria-level', '2');

    await chapter1.focus();
    await page.keyboard.press('ArrowDown');
    await expect(tree.getByRole('treeitem', { name: 'Section 1.1', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(chapter1).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(chapter1).toHaveAttribute('aria-expanded', 'false');
    await expect(tree.getByRole('treeitem', { name: 'Section 1.1', exact: true })).toHaveCount(0);
    await page.keyboard.press('ArrowDown');
    await expect(tree.getByRole('treeitem', { name: 'Chapter 2', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowRight');
    await expect(chapter1).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('End');
    await expect(tree.getByRole('treeitem', { name: 'Section 1000.4', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.dv-page-input')).toHaveValue(String(((999 + 3) % 300) + 1));
    expect(await tree.getByRole('treeitem').count()).toBeLessThan(80);
  });
});
