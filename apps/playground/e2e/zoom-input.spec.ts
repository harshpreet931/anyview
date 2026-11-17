import { test, expect, devices, type Page, type CDPSession } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const pdf = fileURLToPath(new URL('./fixtures/pages-12.pdf', import.meta.url));

async function openPdf(page: Page, zoom: string) {
  await page.goto('/');
  await page.locator('.dv-root').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.locator('input[type="file"]').first().setInputFiles(pdf);
  await page.waitForSelector('.dv-page canvas');
  await page.selectOption('select[aria-label="Zoom level"]', zoom);
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const el = document.querySelector('.dv-viewer-container')!;
    el.scrollTop = el.scrollHeight * 0.3;
  });
  await page.waitForTimeout(500);
}

const zoomOf = (page: Page) =>
  page.evaluate(() => {
    const p = document.querySelector<HTMLElement>('.dv-page[data-page-index="0"]') ?? document.querySelector<HTMLElement>('.dv-page')!;
    return p.getBoundingClientRect().width / 612;
  });

async function anchorAt(page: Page, x: number, y: number) {
  return page.evaluate(
    ([x, y]) => {
      const el = document.elementsFromPoint(x, y).map((n) => n.closest<HTMLElement>('.dv-page')).find(Boolean)!;
      const r = el.getBoundingClientRect();
      return { index: Number(el.dataset.pageIndex), u: (x - r.left) / r.width, v: (y - r.top) / r.height };
    },
    [x, y] as const,
  );
}

async function screenOf(page: Page, a: { index: number; u: number; v: number }) {
  return page.evaluate((a) => {
    const r = document.querySelector<HTMLElement>(`.dv-page[data-page-index="${a.index}"]`)!.getBoundingClientRect();
    return { x: r.left + r.width * a.u, y: r.top + r.height * a.v };
  }, a);
}

async function centre(page: Page) {
  const b = (await page.locator('.dv-viewer-container').boundingBox())!;
  return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
}

const pts = (list: number[][]) => list.map(([x, y], id) => ({ x, y, id, radiusX: 5, radiusY: 5, force: 1 }));

test.describe('touch pinch', () => {
  const { defaultBrowserType: _, ...pixel } = devices['Pixel 7'];
  test.use(pixel);

  async function pinch(
    cdp: CDPSession,
    page: Page,
    c: { x: number; y: number },
    opts: { from: number; to: number; panX?: number; panY?: number; preMove?: number },
  ) {
    const { from, to, panX = 0, panY = 0, preMove = 0 } = opts;
    const two = (d: number, ox: number, oy: number) => [
      [c.x - d / 2 + ox, c.y + oy],
      [c.x + d / 2 + ox, c.y + oy],
    ];
    if (preMove) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts([[c.x - from / 2, c.y]]) });
      for (let i = 1; i <= 4; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts([[c.x - from / 2, c.y - (preMove * i) / 4]]) });
        await page.waitForTimeout(16);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts([[c.x - from / 2, c.y - preMove], [c.x + from / 2, c.y]]) });
    } else {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(two(from, 0, 0)) });
    }
    for (let i = 1; i <= 20; i++) {
      const d = from + ((to - from) * i) / 20;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(two(d, (panX * i) / 20, (panY * i) / 20)) });
      await page.waitForTimeout(16);
    }
    return two(to, panX, panY);
  }

  test('a pinch still zooms when one finger moved before the other landed', async ({ page }) => {
    await openPdf(page, 'fit-width');
    const cdp = await page.context().newCDPSession(page);
    const z0 = await zoomOf(page);
    await pinch(cdp, page, await centre(page), { from: 60, to: 180, preMove: 30 });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(800);
    expect((await zoomOf(page)) / z0).toBeGreaterThan(2);
    expect(await page.evaluate(() => visualViewport!.scale)).toBe(1);
  });

  test('the page follows the fingers when they pan during a pinch', async ({ page }) => {
    await openPdf(page, 'fit-width');
    const cdp = await page.context().newCDPSession(page);
    const c = await centre(page);
    const a = await anchorAt(page, c.x, c.y);
    await pinch(cdp, page, c, { from: 60, to: 150, panX: 40, panY: 90 });
    const live = await screenOf(page, a);
    expect(Math.abs(live.x - (c.x + 40))).toBeLessThan(4);
    expect(Math.abs(live.y - (c.y + 90))).toBeLessThan(4);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(800);
    const after = await screenOf(page, a);
    expect(Math.abs(after.x - live.x)).toBeLessThan(4);
    expect(Math.abs(after.y - live.y)).toBeLessThan(4);
  });

  test('a second pinch on a page already wider than the screen still tracks the fingers', async ({ page }) => {
    await openPdf(page, '2');
    const cdp = await page.context().newCDPSession(page);
    await page.evaluate(() => {
      const el = document.querySelector('.dv-viewer-container')!;
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    });
    await page.waitForTimeout(200);
    const c = await centre(page);
    const a = await anchorAt(page, c.x, c.y);
    await pinch(cdp, page, c, { from: 60, to: 150 });
    const live = await screenOf(page, a);
    expect(Math.abs(live.x - c.x)).toBeLessThan(4);
    expect(Math.abs(live.y - c.y)).toBeLessThan(4);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(800);
    const after = await screenOf(page, a);
    expect(Math.abs(after.x - c.x)).toBeLessThan(4);
    expect(Math.abs(after.y - c.y)).toBeLessThan(4);
  });

  test('double-tap zooms in at the tap, and double-tap again fits the width', async ({ page }) => {
    await openPdf(page, 'fit-width');
    const cdp = await page.context().newCDPSession(page);
    const c = await centre(page);
    const a = await anchorAt(page, c.x, c.y);
    const z0 = await zoomOf(page);
    const tap = async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts([[c.x, c.y]]) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await tap();
    await page.waitForTimeout(80);
    await tap();
    await page.waitForTimeout(700);
    expect((await zoomOf(page)) / z0).toBeGreaterThan(1.8);
    const at = await screenOf(page, a);
    expect(Math.abs(at.x - c.x)).toBeLessThan(4);
    expect(Math.abs(at.y - c.y)).toBeLessThan(4);
    await tap();
    await page.waitForTimeout(80);
    await tap();
    await page.waitForTimeout(700);
    await expect(page.locator('select[aria-label="Zoom level"]')).toHaveValue('fit-width');
  });

  test('the finger left on the screen keeps scrolling after the pinch', async ({ page }) => {
    await openPdf(page, 'fit-width');
    const cdp = await page.context().newCDPSession(page);
    const end = await pinch(cdp, page, await centre(page), { from: 60, to: 140 });
    const one = end[0]!;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: pts([one]) });
    await page.waitForTimeout(100);
    const st0 = await page.evaluate(() => document.querySelector('.dv-viewer-container')!.scrollTop);
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts([[one[0]!, one[1]! - i * 15]]) });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(200);
    const st1 = await page.evaluate(() => document.querySelector('.dv-viewer-container')!.scrollTop);
    expect(st1 - st0).toBeGreaterThan(80);
  });
});

test.describe('zoom limits and extras', () => {
  test('pinching past the maximum stretches a little, then springs back', async ({ page }) => {
    await openPdf(page, '5');
    const c = await centre(page);
    const live = await page.evaluate(
      ([x, y]) => {
        const el = document.querySelector('.dv-viewer-container')!;
        for (let i = 0; i < 20; i++) {
          el.dispatchEvent(new WheelEvent('wheel', { deltaY: -5, ctrlKey: true, clientX: x, clientY: y, bubbles: true, cancelable: true }));
        }
        return new DOMMatrix(getComputedStyle(el.firstElementChild!).transform).a;
      },
      [c.x, c.y] as const,
    );
    expect(live).toBeGreaterThan(1.1);
    expect(live).toBeLessThan(1.5);
    await page.waitForTimeout(800);
    await expect(page.locator('select[aria-label="Zoom level"]')).toHaveValue('5');
    const settled = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.dv-viewer-container')!.firstElementChild!).transform).a);
    expect(settled).toBe(1);
  });
});

test.describe('trackpad and Safari pinch', () => {
  test('a trackpad pinch follows the native rate: deltaY of -100·ln 2 doubles the zoom', async ({ page }) => {
    await openPdf(page, '1');
    const c = await centre(page);
    const z0 = await zoomOf(page);
    await page.evaluate(
      ([x, y]) => {
        const el = document.querySelector('.dv-viewer-container')!;
        const step = (-100 * Math.LN2) / 20;
        for (let i = 0; i < 20; i++) {
          el.dispatchEvent(new WheelEvent('wheel', { deltaY: step, ctrlKey: true, clientX: x, clientY: y, bubbles: true, cancelable: true }));
        }
      },
      [c.x, c.y] as const,
    );
    await page.waitForTimeout(800);
    expect((await zoomOf(page)) / z0).toBeCloseTo(2, 1);
  });

  test('a mouse wheel notch zooms one step, not a runaway jump', async ({ page }) => {
    await openPdf(page, '1');
    const c = await centre(page);
    const z0 = await zoomOf(page);
    await page.evaluate(
      ([x, y]) => {
        const el = document.querySelector('.dv-viewer-container')!;
        el.dispatchEvent(new WheelEvent('wheel', { deltaY: -1, deltaMode: 1, ctrlKey: true, clientX: x, clientY: y, bubbles: true, cancelable: true }));
      },
      [c.x, c.y] as const,
    );
    await page.waitForTimeout(800);
    const r = (await zoomOf(page)) / z0;
    expect(r).toBeGreaterThan(1.05);
    expect(r).toBeLessThan(1.3);
  });

  test('Safari gesture events pinch the document instead of the page', async ({ page }) => {
    await openPdf(page, '1');
    const c = await centre(page);
    const z0 = await zoomOf(page);
    const prevented = await page.evaluate(
      ([x, y]) => {
        const el = document.querySelector('.dv-viewer-container')!;
        const fire = (type: string, scale: number) => {
          const e = new UIEvent(type, { bubbles: true, cancelable: true });
          Object.defineProperties(e, { scale: { value: scale }, clientX: { value: x }, clientY: { value: y } });
          el.dispatchEvent(e);
          return e.defaultPrevented;
        };
        const out = [fire('gesturestart', 1)];
        for (let i = 1; i <= 10; i++) out.push(fire('gesturechange', 1 + i * 0.05));
        out.push(fire('gestureend', 1.5));
        return out.every(Boolean);
      },
      [c.x, c.y] as const,
    );
    await page.waitForTimeout(800);
    expect(prevented).toBe(true);
    expect((await zoomOf(page)) / z0).toBeCloseTo(1.5, 1);
  });
});
