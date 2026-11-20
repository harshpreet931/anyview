import { test, expect, type Page } from '@playwright/test';
import { fixture, openFile, revealViewer, waitForReflow, waitForStableLayout, waitForZoom } from './helpers';

type Upload = Parameters<typeof openFile>[1];

async function open(page: Page, file: Upload) {
  await openFile(page, file);
  await revealViewer(page);
}

async function zoomTo(page: Page, zoom: string) {
  await page.selectOption('select[aria-label="Zoom level"]', zoom);
  await waitForZoom(page);
}

const longFlowingNote = {
  name: 'long.md',
  mimeType: 'text/markdown',
  buffer: Buffer.from(Array.from({ length: 300 }, (_, i) => `Paragraph ${i} of a long note that keeps going.`).join('\n\n')),
};

async function markAndMeasure(page: Page) {
  return page.evaluate(() => {
    const target = document.querySelector<HTMLElement>('.dv-reflow-target')!;
    const first = target.querySelector<HTMLElement>('p, td, li, h1, h2, h3, span')!;
    (first as unknown as { __mark: boolean }).__mark = true;
    const r = first.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
}

async function sameNodeAndSize(page: Page) {
  return page.evaluate(() => {
    const target = document.querySelector<HTMLElement>('.dv-reflow-target')!;
    const first = target.querySelector<HTMLElement>('p, td, li, h1, h2, h3, span')!;
    const r = first.getBoundingClientRect();
    return { kept: (first as unknown as { __mark?: boolean }).__mark === true, w: r.width, h: r.height };
  });
}

for (const [label, file] of [['DOCX', 'sample.docx'], ['XLSX', 'sample.xlsx']] as const) {
  test(`${label} zoom scales the page as a whole instead of rebuilding and rewrapping it`, async ({ page }) => {
    await open(page, fixture(file));
    await waitForReflow(page);
    await zoomTo(page, '1');
    const before = await markAndMeasure(page);
    await zoomTo(page, '2');
    const after = await sameNodeAndSize(page);
    expect(after.kept).toBe(true);
    expect(after.w / before.w).toBeCloseTo(2, 1);
    expect(after.h / before.h).toBeCloseTo(2, 1);
  });
}

const ZOOM_WINDOW_MS = 800;

test('zooming a big table does not lay it out again', async ({ page }) => {
  const csv = ['id,name,city,amount,status,owner,notes,date']
    .concat(Array.from({ length: 2000 }, (_, i) => `${i},Item ${i},City ${i % 40},${i * 3},open,User ${i % 9},Row note ${i},2026-01-${(i % 28) + 1}`))
    .join('\n');
  await open(page, { name: 'big.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.locator('.dv-reflow-target').first()).toContainText('Item 0');
  await zoomTo(page, '1');
  const before = await page.evaluate(() => {
    const t = document.querySelector<HTMLElement>('.dv-reflow-target')!;
    return { w: t.offsetWidth, h: t.offsetHeight };
  });
  const longestPerZoom: number[] = [];
  for (const zoom of ['1.5', '1', '1.5', '1', '1.5']) {
    longestPerZoom.push(
      await page.evaluate(async ([zoom, windowMs]) => {
        let longest = 0;
        const observer = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) longest = Math.max(longest, e.duration);
        });
        observer.observe({ type: 'long-animation-frame', buffered: false });
        const select = document.querySelector<HTMLSelectElement>('select[aria-label="Zoom level"]')!;
        select.value = zoom;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise((r) => setTimeout(r, windowMs));
        observer.disconnect();
        return longest;
      }, [zoom, ZOOM_WINDOW_MS] as const),
    );
  }
  const secondSlowest = [...longestPerZoom].sort((a, b) => b - a)[1]!;
  const after = await page.evaluate(() => {
    const t = document.querySelector<HTMLElement>('.dv-reflow-target')!;
    return { w: t.offsetWidth, h: t.offsetHeight, shown: t.getBoundingClientRect().width };
  });
  expect(after.w).toBe(before.w);
  expect(after.h).toBe(before.h);
  expect(after.shown / before.w).toBeCloseTo(1.5, 1);
  expect(secondSlowest, `longest frame per zoom: ${longestPerZoom.join(', ')} ms`).toBeLessThan(80);
});

test('Fit page on a long flowing document fits the width, not the whole document height', async ({ page }) => {
  await open(page, longFlowingNote);
  await expect(page.locator('.dv-reflow-target').first()).toContainText('Paragraph 0');
  await zoomTo(page, 'fit-page');
  const ratio = await page.evaluate(() => {
    const c = document.querySelector('.dv-viewer-container')!;
    return document.querySelector('.dv-page')!.getBoundingClientRect().width / c.clientWidth;
  });
  expect(ratio).toBeGreaterThan(0.85);
});

test('zooming a long flowing document keeps the paragraph under the cursor in place', async ({ page }) => {
  await open(page, longFlowingNote);
  await expect(page.locator('.dv-reflow-target').first()).toContainText('Paragraph 0');
  await zoomTo(page, '1');
  await page.evaluate(() => {
    const el = document.querySelector('.dv-viewer-container')!;
    el.scrollTop = el.scrollHeight * 0.4;
  });
  await waitForStableLayout(page.locator('.dv-viewer-container > div').first());
  const box = (await page.locator('.dv-viewer-container').boundingBox())!;
  const x = Math.round(box.x + box.width * 0.4);
  const y = Math.round(box.y + box.height * 0.5);
  const before = await page.evaluate(
    ([x, y]) => {
      const ps = [...document.querySelectorAll('.dv-reflow-target p')];
      const dist = (n: Element) => {
        const r = n.getBoundingClientRect();
        return y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      };
      const p = ps.reduce((a, b) => (dist(b) < dist(a) ? b : a));
      const r = p.getBoundingClientRect();
      void x;
      return { text: p.textContent, v: (y - r.top) / r.height };
    },
    [x, y] as const,
  );
  await page.evaluate(
    ([x, y]) => {
      const el = document.querySelector('.dv-viewer-container')!;
      for (let i = 0; i < 20; i++) {
        el.dispatchEvent(new WheelEvent('wheel', { deltaY: -4, ctrlKey: true, clientX: x, clientY: y, bubbles: true, cancelable: true }));
      }
    },
    [x, y] as const,
  );
  await waitForZoom(page);
  const afterY = await page.evaluate((text) => {
    const p = [...document.querySelectorAll('.dv-reflow-target p')].find((n) => n.textContent === text)!;
    const r = p.getBoundingClientRect();
    return { top: r.top, h: r.height };
  }, before.text);
  expect(Math.abs(afterY.top + afterY.h * before.v - y)).toBeLessThan(6);
});
