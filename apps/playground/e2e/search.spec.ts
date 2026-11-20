import { test, expect, type Page } from '@playwright/test';
import { openApp, openFile, pickSample, revealViewer, waitForStable, waitForStableLayout, waitForZoom } from './helpers';

const content = (page: Page) => page.locator('.dv-viewer-container > div').first();

async function openPdfSearch(page: Page, query: string) {
  await openApp(page);
  await pickSample(page, 'PDF');
  await page.waitForSelector('.dv-page canvas');
  await revealViewer(page);
  await page.locator('button[aria-label="Toggle search"]').click();
  const input = page.locator('.dv-search-input');
  await expect(input).toBeFocused();
  await input.fill(query);
  await expect(page.locator('.dv-search-count')).toContainText(/1 of \d/, { timeout: 15_000 });
  return input;
}

test.describe('search keyboard and scrolling', () => {
  test('Enter and Shift+Enter step through matches', async ({ page }) => {
    const input = await openPdfSearch(page, 'format');
    await input.press('Enter');
    await expect(page.locator('.dv-search-count')).toContainText(/^2 of/);
    await input.press('Shift+Enter');
    await expect(page.locator('.dv-search-count')).toContainText(/^1 of/);
  });

  test('moving between matches never scrolls the host page', async ({ page }) => {
    await openPdfSearch(page, 'format');
    await page.evaluate(() => {
      const top = document.querySelector('.dv-root')!.getBoundingClientRect().top + scrollY;
      scrollTo(0, top - innerHeight / 2);
    });
    await waitForStable(() => page.evaluate(() => scrollY));
    const before = await page.evaluate(() => scrollY);
    const count = page.locator('.dv-search-count');
    for (let i = 0; i < 2; i++) {
      const was = await count.innerText();
      await page.evaluate(() =>
        document.querySelector<HTMLButtonElement>('button[aria-label="Next match"]')!.click(),
      );
      await expect(count).not.toHaveText(was);
      await waitForStableLayout(content(page));
    }
    expect(await page.evaluate(() => scrollY)).toBe(before);
  });

  test('Escape closes search and keeps focus inside the viewer', async ({ page }) => {
    const input = await openPdfSearch(page, 'format');
    await input.press('Escape');
    await expect(page.locator('.dv-search-input')).toHaveCount(0);
    expect(await page.evaluate(() => !!document.activeElement?.closest('.dv-root'))).toBe(true);
    const toggle = page.locator('button[aria-label="Toggle sidebar"]');
    const was = await toggle.getAttribute('aria-expanded');
    await page.keyboard.press('s');
    await expect(toggle).not.toHaveAttribute('aria-expanded', was ?? '');
  });

  test('zooming with search open does not snap back to the match', async ({ page }) => {
    await openPdfSearch(page, 'format');
    const container = page.locator('.dv-viewer-container');
    await container.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await waitForStableLayout(content(page));
    await page.locator('button[aria-label="Zoom in"]').click();
    await waitForZoom(page);
    const visible = await page.evaluate(() => {
      const c = document.querySelector('.dv-viewer-container')!.getBoundingClientRect();
      const m = document.querySelector('.dv-search-highlight-current')?.getBoundingClientRect();
      return !!m && m.bottom > c.top && m.top < c.bottom;
    });
    expect(visible).toBe(false);
  });
});

function pdfWithLine(line: string) {
  const stream = `BT\n/F1 16 Tf\n72 700 Td\n(${line}) Tj\nET`;
  return Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${stream.length} >>
stream
${stream}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
trailer
<< /Size 6 /Root 1 0 R >>
startxref
0
%%EOF`);
}

test.describe('PDF search highlights', () => {
  test('highlights only the matched characters and counts every match in a run', async ({ page }) => {
    await openFile(page, {
      name: 'runs.pdf',
      mimeType: 'application/pdf',
      buffer: pdfWithLine('Wide WWMM and slim iiil ones, then Revenue rose, so revenue led'),
    });
    await page.waitForSelector('.dv-page canvas');
    await page.locator('.dv-text-layer span').filter({ hasText: 'Wide WWMM' }).waitFor();
    await page.getByLabel('Zoom level').selectOption('1.5');
    await waitForZoom(page);
    await page.locator('button[aria-label="Toggle search"]').click();
    const input = page.locator('.dv-search-input');
    await input.fill('revenue');
    await expect(page.locator('.dv-search-count')).toContainText(/^1 of 2/);
    await expect(page.locator('.dv-search-highlight')).toHaveCount(2);

    const offBy = async () =>
      page.evaluate(() => {
        const span = [...document.querySelectorAll('.dv-text-layer span')].find((s) =>
          s.textContent!.startsWith('Wide WWMM'),
        )!;
        const text = span.firstChild!;
        const str = text.textContent!;
        const starts = [str.indexOf('Revenue'), str.lastIndexOf('revenue')];
        const boxes = [...document.querySelectorAll('.dv-search-highlight')].map((h) => h.getBoundingClientRect());
        return starts.map((start, i) => {
          const range = document.createRange();
          range.setStart(text, start);
          range.setEnd(text, start + 'revenue'.length);
          const want = range.getBoundingClientRect();
          const got = boxes[i]!;
          return Math.max(
            Math.abs(got.left - want.left),
            Math.abs(got.right - want.right),
            Math.abs(got.top - want.top),
            Math.abs(got.bottom - want.bottom),
          );
        });
      });
    await expect.poll(async () => Math.max(...(await offBy())), { timeout: 5_000 }).toBeLessThan(1.5);

    const edges = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('.dv-page canvas')!;
      const c = canvas.getBoundingClientRect();
      const k = canvas.width / c.width;
      const ctx = canvas.getContext('2d')!;
      return [...document.querySelectorAll('.dv-search-highlight')].map((el) => {
        const h = el.getBoundingClientRect();
        const x0 = Math.round((h.left - 20 - c.left) * k);
        const width = Math.round((h.width + 40) * k);
        const height = Math.round(h.height * k);
        const d = ctx.getImageData(x0, Math.round((h.top - c.top) * k), width, height).data;
        const inked = (x: number) => {
          for (let y = 0; y < height; y++) if (d[(y * width + x) * 4]! < 160) return true;
          return false;
        };
        const gap = Math.round(4 * k);
        const walk = (from: number, step: number) => {
          let last = from;
          let blank = 0;
          for (let x = from; x >= 0 && x < width && blank < gap; x += step) {
            if (inked(x)) {
              last = x;
              blank = 0;
            } else blank++;
          }
          return last;
        };
        const mid = Math.round(width / 2);
        const inkLeft = (x0 + walk(mid, -1)) / k + c.left;
        const inkRight = (x0 + walk(mid, 1) + 1) / k + c.left;
        return Math.max(Math.abs(inkLeft - h.left), Math.abs(inkRight - h.right));
      });
    });
    expect(edges).toHaveLength(2);
    for (const off of edges) expect(off).toBeLessThan(2.5);

    await input.press('Enter');
    await expect(page.locator('.dv-search-count')).toContainText(/^2 of 2/);
    await expect(page.locator('.dv-search-highlight-current')).toHaveCount(1);
    const [first, current] = await page.evaluate(() => [
      document.querySelectorAll('.dv-search-highlight')[0]!.getBoundingClientRect().left,
      document.querySelector('.dv-search-highlight-current')!.getBoundingClientRect().left,
    ]);
    expect(current).toBeGreaterThan(first);
  });
});
