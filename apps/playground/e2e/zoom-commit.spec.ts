import { test, expect, type Page } from '@playwright/test';
import { fixture, openFile, revealViewer, waitForStableLayout, waitForZoom } from './helpers';

const CLICK_GAP_MS = 150;
const SCROLL_DURING_SPRING_MS = 220;

const content = (page: Page) => page.locator('.dv-viewer-container > div').first();

async function zoomTo(page: Page, zoom: string) {
  await page.selectOption('select[aria-label="Zoom level"]', zoom);
  await waitForZoom(page);
}

async function openPdf(page: Page) {
  await openFile(page, fixture('pages-12.pdf'));
  await revealViewer(page);
  await expect(page.getByLabel('Page number')).toBeVisible();
  await page.waitForSelector('.dv-page canvas');
  await zoomTo(page, '0.5');
}

async function goToPage(page: Page, n: number) {
  const input = page.getByLabel('Page number');
  await input.fill(String(n));
  await input.press('Enter');
  await expect(input).toHaveValue(String(n));
  await waitForStableLayout(content(page));
}

const contentScale = (page: Page) =>
  content(page).evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);

const contentWillChange = (page: Page) => content(page).evaluate((el) => getComputedStyle(el).willChange);

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
    await waitForZoom(page);
    const after = await whereIs(page, before.index, before.u, before.v);
    expect(after).not.toBeNull();
    expect(Math.abs(after!.x - before.x)).toBeLessThan(4);
    expect(Math.abs(after!.y - before.y)).toBeLessThan(4);
  });

  test('zooming out keeps the point under the cursor too', async ({ page }) => {
    await openPdf(page);
    await zoomTo(page, '2');
    await goToPage(page, 9);
    const before = await pointAt(page, 0.55, 0.6);
    await wheelAt(page, before.x, before.y, 60, 4);
    await waitForZoom(page);
    const after = await whereIs(page, before.index, before.u, before.v);
    expect(after).not.toBeNull();
    expect(Math.abs(after!.y - before.y)).toBeLessThan(4);
  });

  test('the canvas always fills its page box, even before the sharp render lands', async ({ page }) => {
    await openPdf(page);
    await goToPage(page, 3);
    const p = await pointAt(page, 0.5, 0.5);
    await page.evaluate(() => {
      const w = window as unknown as { __mismatch: number; __watched: boolean };
      w.__mismatch = 0;
      w.__watched = false;
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
        else w.__watched = true;
      };
      requestAnimationFrame(tick);
    });
    await wheelAt(page, p.x, p.y, -80, 15);
    await page.waitForFunction(() => (window as unknown as { __watched: boolean }).__watched);
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
        await page.waitForTimeout(CLICK_GAP_MS);
      }
      await waitForZoom(page);
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
      return out;
    });
    expect(scales[0]).toBeLessThan(0.99);
    await expect.poll(() => contentScale(page), { timeout: 1000 }).toBe(1);
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
    await waitForZoom(page);
    const drawOrder = () => page.evaluate(() => {
      const c = document.querySelector('.dv-viewer-container')!.getBoundingClientRect();
      const visible = [...document.querySelectorAll<HTMLElement>('.dv-page')]
        .filter((n) => {
          const r = n.getBoundingClientRect();
          return r.bottom > c.top && r.top < c.bottom;
        })
        .map((n) => Number(n.dataset.pageIndex));
      return { order: (window as unknown as { __order: number[] }).__order, visible };
    });
    await expect.poll(async () => {
      const { order, visible } = await drawOrder();
      return order.length - visible.length;
    }, { timeout: 2500 }).toBeGreaterThan(0);
    const { order, visible } = await drawOrder();
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
    expect(await contentWillChange(page)).toBe('transform');
    await expect.poll(() => contentWillChange(page), { timeout: 1500 }).toBe('auto');
  });

  test('choosing a fit mode animates like the zoom buttons', async ({ page }) => {
    await openPdf(page);
    const first = await page.evaluate(async () => {
      const content = document.querySelector<HTMLElement>('.dv-viewer-container > div')!;
      const sel = document.querySelector<HTMLSelectElement>('select[aria-label="Zoom level"]')!;
      sel.value = 'fit-width';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));
      return new DOMMatrix(getComputedStyle(content).transform).a;
    });
    expect(first).toBeLessThan(0.95);
    await expect.poll(() => contentScale(page), { timeout: 1000 }).toBe(1);
  });

  for (const [label, dy, n] of [['in', -4, 12], ['out', 4, 8]] as const) {
    test(`two-page spread: pinch ${label} on the right page lets go without a jump`, async ({ page }) => {
      await openPdf(page);
      await page.selectOption('select[aria-label="Page layout"]', 'even');
      await waitForZoom(page);
      await goToPage(page, 7);
      const target = await page.evaluate(() => {
        const c = document.querySelector('.dv-viewer-container')!.getBoundingClientRect();
        const y = Math.round(c.top + c.height / 2);
        const right = [...document.querySelectorAll<HTMLElement>('.dv-page')]
          .map((p) => ({ p, r: p.getBoundingClientRect() }))
          .filter(({ r }) => r.top < y && r.bottom > y)
          .sort((a, b) => b.r.left - a.r.left)[0]!;
        return { x: Math.round(right.r.left + right.r.width * 0.3), y };
      });
      const a = await pointAt(page, (target.x - (await page.locator('.dv-viewer-container').boundingBox())!.x) / (await page.locator('.dv-viewer-container').boundingBox())!.width, 0.5);
      await wheelAt(page, a.x, a.y, dy, n);
      const live = await whereIs(page, a.index, a.u, a.v);
      await waitForZoom(page);
      const after = await whereIs(page, a.index, a.u, a.v);
      expect(Math.abs(after!.x - live!.x)).toBeLessThan(3);
      expect(Math.abs(after!.y - live!.y)).toBeLessThan(3);
    });
  }

  test('scrolling straight after a zoom still updates the page number', async ({ page }) => {
    await openPdf(page);
    await goToPage(page, 2);
    const p = await pointAt(page, 0.5, 0.5);
    await wheelAt(page, p.x, p.y, -3, 6);
    await page.waitForTimeout(SCROLL_DURING_SPRING_MS);
    await page.evaluate(async () => {
      const el = document.querySelector('.dv-viewer-container')!;
      for (let i = 0; i < 40; i++) {
        el.scrollTop += 60;
        await new Promise((r) => requestAnimationFrame(r));
        await new Promise((r) => requestAnimationFrame(r));
      }
    });
    await waitForStableLayout(content(page));
    const top = await page.evaluate(() => {
      const c = document.querySelector('.dv-viewer-container')!.getBoundingClientRect();
      const hit = document
        .elementsFromPoint(c.left + c.width / 2, c.top + 5)
        .map((n) => n.closest<HTMLElement>('.dv-page'))
        .find(Boolean);
      return hit ? Number(hit.dataset.pageIndex) + 1 : -1;
    });
    await expect(page.getByLabel('Page number')).toHaveValue(String(top));
  });
});
