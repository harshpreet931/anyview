import { test, expect, type Page } from '@playwright/test';
import { fixture, openFile, revealViewer, waitForCanvas, waitForReflow, waitForStable, waitForZoom } from './helpers';

type Size = { w: number; h: number };

function makePdf(sizes: Size[]): Buffer {
  const objs: string[] = ['', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const kids: number[] = [];
  sizes.forEach(({ w, h }, i) => {
    const stream = `BT /F1 48 Tf 40 ${h - 90} Td (Page ${i + 1}) Tj ET`;
    objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${objs.length} 0 R >>`);
    kids.push(objs.length);
  });
  objs[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  let body = '%PDF-1.4\n';
  const offsets = objs.map((o, i) => {
    const at = body.length;
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return at;
  });
  const xref = body.length;
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  body += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

const pages = (count: number, w = 612, h = 792): Size[] => Array.from({ length: count }, () => ({ w, h }));

async function openPdf(page: Page, name: string, sizes: Size[]) {
  await openFile(page, { name, mimeType: 'application/pdf', buffer: makePdf(sizes) });
  await expect(page.locator('.dv-page-count')).toContainText(String(sizes.length));
  await waitForCanvas(page);
  await revealViewer(page);
}

/** Calls a store action directly, for layouts the toolbar has no control for. */
async function store(page: Page, action: string, ...args: unknown[]) {
  await page.evaluate(
    ([action, args]) => {
      type Fiber = { return: Fiber | null; memoizedProps?: { value?: { getState?: () => Record<string, unknown> } } };
      const el = document.querySelector('.dv-viewer-container') as unknown as Record<string, Fiber>;
      let f: Fiber | null = el[Object.keys(el).find((k) => k.startsWith('__reactFiber$'))!]!;
      while (f && typeof f.memoizedProps?.value?.getState?.().goToPage !== 'function') f = f.return;
      const fn = f!.memoizedProps!.value!.getState!()[action as string] as (...a: unknown[]) => void;
      fn(...(args as unknown[]));
    },
    [action, args] as const,
  );
}

async function layout(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('.dv-viewer-container')!;
    const content = el.firstElementChild as HTMLElement;
    const v = el.getBoundingClientRect();
    const shown = [...el.querySelectorAll<HTMLElement>('.dv-page')].map((p) => {
      const r = p.getBoundingClientRect();
      return { index: Number(p.dataset.pageIndex), top: r.top - v.top, left: r.left - v.left, width: r.width, height: r.height };
    });
    return {
      scrollTop: el.scrollTop,
      scrollLeft: el.scrollLeft,
      viewport: el.clientHeight,
      height: content.getBoundingClientRect().height,
      width: content.getBoundingClientRect().width,
      pages: shown.sort((a, b) => a.index - b.index),
    };
  });
}

async function settled(page: Page) {
  await waitForZoom(page);
  await waitForStable(() => layout(page));
}

/** Scrolls through the first rows so the virtualizer measures them. */
async function visit(page: Page, rows: number) {
  await page.evaluate(async (rows) => {
    const el = document.querySelector<HTMLElement>('.dv-viewer-container')!;
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    for (let i = 0; i <= rows; i++) {
      const row = el.querySelector<HTMLElement>(`[data-index="${i}"]`);
      if (row) el.scrollTop = row.offsetTop + Number(new DOMMatrix(getComputedStyle(row).transform).f);
      await frame();
      await frame();
    }
    el.scrollTop = 0;
    await frame();
  }, rows);
  await settled(page);
}

async function goTo(page: Page, n: number) {
  const input = page.getByLabel('Page number');
  await input.fill(String(n));
  await input.press('Enter');
  await settled(page);
}

const pageInput = (page: Page) => page.getByLabel('Page number');

test.describe('page layout survives layout changes', () => {
  test('a rotation re-lays out every page, the visited ones too', async ({ page }) => {
    await openPdf(page, 'sixty.pdf', pages(60));
    await page.selectOption('select[aria-label="Zoom level"]', '1');
    await settled(page);
    await visit(page, 20);
    await goTo(page, 30);
    await page.getByRole('button', { name: 'Rotate clockwise' }).click();
    await settled(page);

    const after = await layout(page);
    expect(after.pages[0]!.height).toBe(612);
    expect(after.height).toBe(60 * (612 + 48));
    const p30 = after.pages.find((p) => p.index === 29)!;
    expect(Math.abs(p30.top - 24)).toBeLessThan(2);
  });

  test('a rotation in fit-width does not carry the old page sizes over', async ({ page }) => {
    await openPdf(page, 'sixty.pdf', pages(60));
    await page.selectOption('select[aria-label="Zoom level"]', 'fit-width');
    await settled(page);
    await visit(page, 12);
    await page.getByRole('button', { name: 'Rotate clockwise' }).click();
    await settled(page);

    const after = await layout(page);
    expect(after.height).toBe(60 * (after.pages[0]!.height + 48));
  });

  test('horizontal scrolling uses page widths and keeps a gap between pages', async ({ page }) => {
    await openPdf(page, 'forty.pdf', pages(40));
    await page.selectOption('select[aria-label="Zoom level"]', '1');
    await settled(page);
    await visit(page, 12);
    await store(page, 'setScrollMode', 'horizontal');
    await settled(page);

    const wide = await layout(page);
    expect(wide.width).toBe(40 * (612 + 48));
    const [a, b] = wide.pages;
    expect(b!.left - (a!.left + a!.width)).toBe(48);

    await store(page, 'setScrollMode', 'vertical');
    await settled(page);
    expect((await layout(page)).height).toBe(40 * (792 + 48));
  });

  test('a spread toggle re-lays out the rows', async ({ page }) => {
    await openPdf(page, 'forty.pdf', [...pages(20), ...pages(20, 612, 500)]);
    await page.selectOption('select[aria-label="Zoom level"]', 'fit-width');
    await settled(page);
    await visit(page, 12);
    await store(page, 'setSpreadMode', 'even');
    await settled(page);
    const spread = await layout(page);
    const letter = spread.pages[0]!.height;
    const short = Math.round((letter * 500) / 792);
    expect(Math.abs(spread.height - (10 * (letter + 48) + 10 * (short + 48)))).toBeLessThanOrEqual(10);
  });

  test('a new document does not inherit the old one\'s page sizes', async ({ page }) => {
    await openPdf(page, 'letter.pdf', pages(40));
    await page.selectOption('select[aria-label="Zoom level"]', 'fit-width');
    await settled(page);
    await visit(page, 20);
    await page.locator('.pg-upload-btn input[type="file"]').setInputFiles({
      name: 'tall.pdf',
      mimeType: 'application/pdf',
      buffer: makePdf(pages(40, 612, 1500)),
    });
    await expect(page.locator('.dv-page[data-page-index="0"]')).toHaveCSS('height', /^\d{4}/);
    await settled(page);

    const tall = await layout(page);
    expect(tall.height).toBe(40 * (tall.pages[0]!.height + 48));
    await goTo(page, 30);
    await goTo(page, 20);
    const p20 = (await layout(page)).pages.find((p) => p.index === 19)!;
    expect(Math.abs(p20.top - 24)).toBeLessThan(2);
    await expect(pageInput(page)).toHaveValue('20');
  });
});

test.describe('fractional zoom', () => {
  test('every row is the size it was estimated at, so a scrollbar drag reaches the end', async ({ page }) => {
    await openPdf(page, 'long.pdf', pages(300));
    await page.selectOption('select[aria-label="Zoom level"]', 'fit-width');
    await settled(page);

    const fit = await layout(page);
    expect(fit.height).toBe(300 * (fit.pages[0]!.height + 48));

    const result = await page.evaluate(async () => {
      const el = document.querySelector<HTMLElement>('.dv-viewer-container')!;
      const frame = () => new Promise((r) => requestAnimationFrame(r));
      let yanks = 0;
      for (let trial = 0; trial < 3; trial++) {
        el.scrollTop = 0;
        await new Promise((r) => setTimeout(r, 300));
        const max = el.scrollHeight - el.clientHeight;
        for (let i = 1; i <= 60; i++) {
          const want = (max * i) / 60;
          el.scrollTop = want;
          await frame();
          if (el.scrollTop < want - 1000) yanks++;
        }
      }
      await new Promise((r) => setTimeout(r, 500));
      return { yanks, atEnd: el.scrollHeight - el.clientHeight - el.scrollTop };
    });
    expect(result.yanks).toBe(0);
    expect(result.atEnd).toBeLessThan(2);
    await expect(pageInput(page)).toHaveValue('300');
  });
});

test.describe('navigation', () => {
  test('Next moves a whole spread in two-page mode', async ({ page }) => {
    await openFile(page, fixture('pages-12.pdf'));
    await waitForCanvas(page);
    await revealViewer(page);
    await page.selectOption('select[aria-label="Page layout"]', 'even');
    await settled(page);
    await page.getByRole('button', { name: 'Next page' }).click();
    await settled(page);
    await expect(pageInput(page)).toHaveValue('3');
    const shown = await layout(page);
    expect(Math.abs(shown.pages.find((p) => p.index === 2)!.top - 24)).toBeLessThan(2);
  });

  test('the page number moves on once the previous page has scrolled out of view', async ({ page }) => {
    await openPdf(page, 'twelve.pdf', pages(12));
    await page.selectOption('select[aria-label="Zoom level"]', '1');
    await settled(page);
    await goTo(page, 6);
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('.dv-viewer-container')!.scrollBy(0, -10);
    });
    await settled(page);
    await expect(pageInput(page)).toHaveValue('6');
  });

  test('going to a page near the end keeps that page number when the view cannot scroll further', async ({ page }) => {
    await openPdf(page, 'sixty.pdf', pages(60));
    await store(page, 'setZoom', 0.25);
    await settled(page);
    const { viewport, pages: shown } = await layout(page);
    const row = shown[0]!.height + 48;
    const target = Math.floor(60 - viewport / row) + 1;
    expect(target).toBeLessThan(59);
    await goTo(page, target + 1);
    await page.waitForTimeout(400);
    await expect(pageInput(page)).toHaveValue(String(target + 1));
  });

  test('entering the current page number again goes back to its top', async ({ page }) => {
    await openPdf(page, 'twelve.pdf', pages(12));
    await page.selectOption('select[aria-label="Zoom level"]', '1');
    await settled(page);
    await goTo(page, 5);
    await page.evaluate(() => document.querySelector<HTMLElement>('.dv-viewer-container')!.scrollBy(0, 300));
    await settled(page);
    await expect(pageInput(page)).toHaveValue('5');
    await goTo(page, 5);
    const p5 = (await layout(page)).pages.find((p) => p.index === 4)!;
    expect(Math.abs(p5.top - 24)).toBeLessThan(2);
  });

  test('outline links land on the heading in horizontal mode too', async ({ page }) => {
    const md = Array.from({ length: 40 }, (_, i) => `# Heading ${i + 1}\n\n${'Lorem ipsum dolor sit amet. '.repeat(40)}\n`).join('\n');
    await openFile(page, { name: 'outline.md', mimeType: 'text/markdown', buffer: Buffer.from(md) });
    await waitForReflow(page);
    await revealViewer(page);
    await page.getByRole('tab', { name: 'Outline' }).click();
    const link = (n: number) => page.locator('.dv-outline-item', { hasText: new RegExp(`^Heading ${n}$`) });
    const scrollTo = async (n: number) => {
      await link(n).click();
      await settled(page);
      return (await layout(page)).scrollTop;
    };

    const v8 = await scrollTo(8);
    const v10 = await scrollTo(10);
    expect(v10).toBeGreaterThan(v8);

    await store(page, 'setScrollMode', 'horizontal');
    await settled(page);
    expect(await scrollTo(8)).toBeCloseTo(v8, 0);
    expect(await scrollTo(10)).toBeCloseTo(v10, 0);
    expect(await scrollTo(8)).toBeCloseTo(v8, 0);
  });
});

test.describe('flowing pages', () => {
  test('a CSV page is as tall as its table, with no blank paper under it', async ({ page }) => {
    const csv = ['id,name,value', ...Array.from({ length: 400 }, (_, i) => `${i},name${i},${i * 7}`)].join('\n');
    await openFile(page, { name: 'rows.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    const target = await waitForReflow(page);
    await revealViewer(page);
    await settled(page);
    const [pageBox, contentBox] = await Promise.all([
      page.locator('.dv-page').first().boundingBox(),
      target.boundingBox(),
    ]);
    expect(Math.abs(pageBox!.height - contentBox!.height)).toBeLessThan(2);
  });
});

test.describe('annotations', () => {
  test('an open text editor survives its page scrolling out of view', async ({ page }) => {
    await openPdf(page, 'sixty.pdf', pages(60));
    await settled(page);
    await page.getByRole('radio', { name: 'Text' }).click();
    const box = (await page.locator('.dv-page').first().boundingBox())!;
    await page.mouse.click(box.x + 100, box.y + 100);
    const editor = page.getByRole('textbox', { name: 'Text' });
    await expect(editor).toBeFocused();
    await page.keyboard.type('draft note text');
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('.dv-viewer-container')!.scrollTop = 20_000;
    });
    await settled(page);
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('.dv-viewer-container')!.scrollTop = 0;
    });
    await settled(page);
    await expect(editor).toHaveValue('draft note text');
  });
});
