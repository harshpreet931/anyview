import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const docx = fileURLToPath(new URL('./fixtures/sample.docx', import.meta.url));
const xlsx = fileURLToPath(new URL('./fixtures/sample.xlsx', import.meta.url));

async function open(page: Page, file: string) {
  await page.goto('/');
  await page.locator('.dv-root').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.locator('input[type="file"]').first().setInputFiles(file);
  const target = page.locator('.dv-reflow-target').first();
  await expect.poll(async () => (await target.innerText()).trim().length, { timeout: 20_000 }).toBeGreaterThan(0);
  await page.selectOption('select[aria-label="Zoom level"]', '1');
  await page.waitForTimeout(500);
}

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

for (const [label, file] of [['DOCX', docx], ['XLSX', xlsx]] as const) {
  test(`${label} zoom scales the page as a whole instead of rebuilding and rewrapping it`, async ({ page }) => {
    await open(page, file);
    const before = await markAndMeasure(page);
    await page.selectOption('select[aria-label="Zoom level"]', '2');
    await page.waitForTimeout(600);
    const after = await sameNodeAndSize(page);
    expect(after.kept).toBe(true);
    expect(after.w / before.w).toBeCloseTo(2, 1);
    expect(after.h / before.h).toBeCloseTo(2, 1);
  });
}

test('zooming a big table does not lay it out again', async ({ page }) => {
  await page.goto('/');
  await page.locator('.dv-root').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  const csv = ['id,name,city,amount,status,owner,notes,date']
    .concat(Array.from({ length: 2000 }, (_, i) => `${i},Item ${i},City ${i % 40},${i * 3},open,User ${i % 9},Row note ${i},2026-01-${(i % 28) + 1}`))
    .join('\n');
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'big.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.locator('.dv-reflow-target').first()).toContainText('Item 1999');
  await page.selectOption('select[aria-label="Zoom level"]', '1');
  await page.waitForTimeout(800);
  const before = await page.evaluate(() => {
    const t = document.querySelector<HTMLElement>('.dv-reflow-target')!;
    return { w: t.offsetWidth, h: t.offsetHeight };
  });
  const longest = await page.evaluate(async () => {
    let max = 0;
    const po = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) max = Math.max(max, e.duration);
    });
    po.observe({ type: 'long-animation-frame', buffered: false });
    const sel = document.querySelector<HTMLSelectElement>('select[aria-label="Zoom level"]')!;
    sel.value = '1.5';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 800));
    po.disconnect();
    return max;
  });
  const after = await page.evaluate(() => {
    const t = document.querySelector<HTMLElement>('.dv-reflow-target')!;
    return { w: t.offsetWidth, h: t.offsetHeight, shown: t.getBoundingClientRect().width };
  });
  expect(after.w).toBe(before.w);
  expect(after.h).toBe(before.h);
  expect(after.shown / before.w).toBeCloseTo(1.5, 1);
  expect(longest).toBeLessThan(80);
});

test('Fit page on a long flowing document fits the width, not the whole document height', async ({ page }) => {
  await page.goto('/');
  await page.locator('.dv-root').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  const md = Array.from({ length: 300 }, (_, i) => `Paragraph ${i} of a long note that keeps going.`).join('\n\n');
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'long.md', mimeType: 'text/markdown', buffer: Buffer.from(md) });
  await expect(page.locator('.dv-reflow-target').first()).toContainText('Paragraph 0');
  await page.selectOption('select[aria-label="Zoom level"]', 'fit-page');
  await page.waitForTimeout(500);
  const ratio = await page.evaluate(() => {
    const c = document.querySelector('.dv-viewer-container')!;
    return document.querySelector('.dv-page')!.getBoundingClientRect().width / c.clientWidth;
  });
  expect(ratio).toBeGreaterThan(0.85);
});

test('zooming a long flowing document keeps the paragraph under the cursor in place', async ({ page }) => {
  await page.goto('/');
  await page.locator('.dv-root').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  const md = Array.from({ length: 300 }, (_, i) => `Paragraph ${i} of a long note that keeps going.`).join('\n\n');
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'long.md', mimeType: 'text/markdown', buffer: Buffer.from(md) });
  await expect(page.locator('.dv-reflow-target').first()).toContainText('Paragraph 0');
  await page.selectOption('select[aria-label="Zoom level"]', '1');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const el = document.querySelector('.dv-viewer-container')!;
    el.scrollTop = el.scrollHeight * 0.4;
  });
  await page.waitForTimeout(300);
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
  await page.waitForTimeout(900);
  const afterY = await page.evaluate((text) => {
    const p = [...document.querySelectorAll('.dv-reflow-target p')].find((n) => n.textContent === text)!;
    const r = p.getBoundingClientRect();
    return { top: r.top, h: r.height };
  }, before.text);
  expect(Math.abs(afterY.top + afterY.h * before.v - y)).toBeLessThan(6);
});
