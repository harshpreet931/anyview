import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const pdf = fileURLToPath(new URL('./fixtures/pages-12.pdf', import.meta.url));

async function openPdf(page: Page) {
  await page.goto('/');
  await page.locator('.dv-root').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.locator('input[type="file"]').first().setInputFiles(pdf);
  await expect(page.getByLabel('Page number')).toBeVisible();
  await page.waitForSelector('.dv-page canvas');
  await page.selectOption('select[aria-label="Zoom level"]', '0.5');
  await page.waitForTimeout(400);
}

async function goToPage(page: Page, n: number) {
  const input = page.getByLabel('Page number');
  await input.fill(String(n));
  await input.press('Enter');
  await page.waitForTimeout(500);
}

async function pointAt(page: Page, fx: number, fy: number) {
  return page.evaluate(
    ([fx, fy]) => {
      const c = document.querySelector('.dv-viewer-container')!.getBoundingClientRect();
      const x = Math.round(c.left + c.width * fx);
      const y = Math.round(c.top + c.height * fy);
      const el = document
        .elementsFromPoint(x, y)
        .map((n) => n.closest<HTMLElement>('.dv-page'))
        .find(Boolean)!;
      const r = el.getBoundingClientRect();
      return { x, y, index: Number(el.dataset.pageIndex), u: (x - r.left) / r.width, v: (y - r.top) / r.height };
    },
    [fx, fy] as const,
  );
}

async function whereIs(page: Page, index: number, u: number, v: number) {
  return page.evaluate(
    ([index, u, v]) => {
      const el = document.querySelector<HTMLElement>(`.dv-page[data-page-index="${index}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width * u, y: r.top + r.height * v };
    },
    [index, u, v] as const,
  );
}

async function wheelAt(page: Page, x: number, y: number, deltaY: number, count: number) {
  await page.evaluate(
    ([x, y, dy, n]) => {
      const el = document.querySelector('.dv-viewer-container')!;
      for (let i = 0; i < n; i++) {
        el.dispatchEvent(
          new WheelEvent('wheel', { deltaY: dy, ctrlKey: true, clientX: x, clientY: y, bubbles: true, cancelable: true }),
        );
      }
    },
    [x, y, deltaY, count] as const,
  );
}

test.describe('committing a zoom', () => {
  test('the point under the cursor stays put deep in the document', async ({ page }) => {
    await openPdf(page);
    await goToPage(page, 10);
    const before = await pointAt(page, 0.45, 0.4);
    await wheelAt(page, before.x, before.y, -60, 20);
    await page.waitForTimeout(900);
    const after = await whereIs(page, before.index, before.u, before.v);
    expect(after).not.toBeNull();
    expect(Math.abs(after!.x - before.x)).toBeLessThan(4);
    expect(Math.abs(after!.y - before.y)).toBeLessThan(4);
  });

  test('zooming out keeps the point under the cursor too', async ({ page }) => {
    await openPdf(page);
    await page.selectOption('select[aria-label="Zoom level"]', '2');
    await page.waitForTimeout(400);
    await goToPage(page, 9);
    const before = await pointAt(page, 0.55, 0.6);
    await wheelAt(page, before.x, before.y, 60, 4);
    await page.waitForTimeout(900);
    const after = await whereIs(page, before.index, before.u, before.v);
    expect(after).not.toBeNull();
    expect(Math.abs(after!.y - before.y)).toBeLessThan(4);
  });

  test('the canvas always fills its page box, even before the sharp render lands', async ({ page }) => {
    await openPdf(page);
    await goToPage(page, 3);
    const p = await pointAt(page, 0.5, 0.5);
    await page.evaluate(() => {
      const w = window as unknown as { __mismatch: number };
      w.__mismatch = 0;
      const t0 = performance.now();
      const tick = () => {
        for (const pg of document.querySelectorAll<HTMLElement>('.dv-page')) {
          const cv = pg.querySelector('canvas');
          if (!cv) continue;
          const a = pg.getBoundingClientRect();
          const b = cv.getBoundingClientRect();
          w.__mismatch = Math.max(w.__mismatch, Math.abs(a.width - b.width), Math.abs(a.height - b.height));
        }
        if (performance.now() - t0 < 1500) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await wheelAt(page, p.x, p.y, -80, 15);
    await page.waitForTimeout(1600);
    const mismatch = await page.evaluate(() => (window as unknown as { __mismatch: number }).__mismatch);
    expect(mismatch).toBeLessThan(1.5);
  });

  for (const button of ['Zoom in', 'Zoom out'] as const) {
    test(`${button} from the toolbar keeps the reading position`, async ({ page }) => {
      await openPdf(page);
      await goToPage(page, 8);
      const before = await pointAt(page, 0.5, 0.5);
      for (let i = 0; i < 3; i++) {
        await page.getByRole('button', { name: button, exact: true }).dispatchEvent('click');
        await page.waitForTimeout(150);
      }
      await page.waitForTimeout(600);
      const after = await whereIs(page, before.index, before.u, before.v);
      expect(after).not.toBeNull();
      expect(Math.abs(after!.x - before.x)).toBeLessThan(4);
      expect(Math.abs(after!.y - before.y)).toBeLessThan(4);
    });
  }

  test('toolbar zoom animates from the old size instead of snapping', async ({ page }) => {
    await openPdf(page);
    await goToPage(page, 4);
    const scales = await page.evaluate(async () => {
      const content = document.querySelector<HTMLElement>('.dv-viewer-container > div')!;
      document.querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]')!.click();
      const out: number[] = [];
      for (let i = 0; i < 4; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        out.push(new DOMMatrix(getComputedStyle(content).transform).a);
      }
      await new Promise((r) => setTimeout(r, 400));
      out.push(new DOMMatrix(getComputedStyle(content).transform).a);
      return out;
    });
    expect(scales[0]).toBeLessThan(0.99);
    expect(scales[scales.length - 1]).toBe(1);
  });

  test('with reduced motion the toolbar zoom is instant', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openPdf(page);
    const scale = await page.evaluate(async () => {
      const content = document.querySelector<HTMLElement>('.dv-viewer-container > div')!;
      document.querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]')!.click();
      await new Promise((r) => requestAnimationFrame(r));
      return new DOMMatrix(getComputedStyle(content).transform).a;
    });
    expect(scale).toBe(1);
  });

  test('Ctrl+0 goes back to the default fit', async ({ page }) => {
    await openPdf(page);
    await page.locator('.dv-viewer-container').focus();
    await page.keyboard.press('Control+0');
    await expect(page.locator('select[aria-label="Zoom level"]')).toHaveValue('fit-page');
  });

  test('after a zoom the pages on screen sharpen before the ones just off screen', async ({ page }) => {
    await openPdf(page);
    await goToPage(page, 6);
    await page.evaluate(() => {
      const w = window as unknown as { __order: number[] };
      w.__order = [];
      const orig = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
        const pg = this.canvas.closest<HTMLElement>('.dv-page');
        if (pg) w.__order.push(Number(pg.dataset.pageIndex));
        return (orig as (...a: unknown[]) => void).apply(this, args);
      } as typeof orig;
    });
    const p = await pointAt(page, 0.5, 0.5);
    await wheelAt(page, p.x, p.y, -3, 10);
    await page.waitForTimeout(1500);
    const { order, visible } = await page.evaluate(() => {
      const c = document.querySelector('.dv-viewer-container')!.getBoundingClientRect();
      const visible = [...document.querySelectorAll<HTMLElement>('.dv-page')]
        .filter((n) => {
          const r = n.getBoundingClientRect();
          return r.bottom > c.top && r.top < c.bottom;
        })
        .map((n) => Number(n.dataset.pageIndex));
      return { order: (window as unknown as { __order: number[] }).__order, visible };
    });
    expect(order.length).toBeGreaterThan(visible.length);
    expect(order.slice(0, visible.length).sort()).toEqual([...visible].sort());
  });

  test('only the content is promoted to its own layer, and only while zooming', async ({ page }) => {
    await openPdf(page);
    const p = await pointAt(page, 0.5, 0.5);
    const idle = await page.evaluate(() => ({
      page: getComputedStyle(document.querySelector('.dv-page')!).willChange,
      content: getComputedStyle(document.querySelector('.dv-viewer-container > div')!).willChange,
    }));
    expect(idle).toEqual({ page: 'auto', content: 'auto' });
    await wheelAt(page, p.x, p.y, -3, 5);
    const live = await page.evaluate(() => getComputedStyle(document.querySelector('.dv-viewer-container > div')!).willChange);
    expect(live).toBe('transform');
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => getComputedStyle(document.querySelector('.dv-viewer-container > div')!).willChange);
    expect(after).toBe('auto');
  });
});
