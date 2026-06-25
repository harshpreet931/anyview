import { test, expect, type Page } from '@playwright/test';

/* ============================================================
 * Anyview — in-depth end-to-end tests against the real
 * playground (Vite dev server + the library source).
 * ============================================================ */

// Sample chips render in this order (apps/playground/src/samples/index.ts)
const SAMPLE_INDEX: Record<string, number> = {
  Markdown: 0,
  Text: 1,
  CSV: 2,
  HTML: 3,
  TypeScript: 4,
  JSON: 5,
  SVG: 6,
  PDF: 7,
  Jupyter: 8,
};

async function gotoApp(page: Page) {
  await page.goto('/');
  await expect(page.locator('.dv-root')).toBeVisible();
}

async function loadSample(page: Page, name: keyof typeof SAMPLE_INDEX | string) {
  const idx = SAMPLE_INDEX[name];
  await page.locator('.pg-sample-chip').nth(idx).click();
}

async function waitForCanvasRendered(page: Page) {
  const canvas = page.locator('.dv-page canvas').first();
  await canvas.waitFor({ state: 'attached' });
  await expect
    .poll(async () => canvas.evaluate((c: HTMLCanvasElement) => c.width), {
      timeout: 20_000,
    })
    .toBeGreaterThan(0);
  return canvas;
}

async function waitForReflowContent(page: Page) {
  const target = page.locator('.dv-reflow-target').first();
  await target.waitFor({ state: 'attached' });
  await expect
    .poll(async () => (await target.innerText()).trim().length, { timeout: 20_000 })
    .toBeGreaterThan(0);
  return target;
}

async function openSearch(page: Page, query: string) {
  await page.locator('button[aria-label="Toggle search"]').click();
  const input = page.locator('.dv-search-input');
  await expect(input).toBeVisible();
  await input.fill(query);
}

test.describe('rendering — every sample format', () => {
  for (const name of ['Markdown', 'Text', 'CSV', 'HTML', 'TypeScript', 'JSON', 'Jupyter']) {
    test(`renders ${name} (reflowable)`, async ({ page }) => {
      await gotoApp(page);
      await loadSample(page, name);
      const target = await waitForReflowContent(page);
      expect((await target.innerText()).length).toBeGreaterThan(10);
    });
  }

  test('renders SVG image to a canvas', async ({ page }) => {
    await gotoApp(page);
    await loadSample(page, 'SVG');
    await waitForCanvasRendered(page);
  });

  test('renders PDF to a canvas with 2 pages', async ({ page }) => {
    await gotoApp(page);
    await loadSample(page, 'PDF');
    await waitForCanvasRendered(page);
    await expect(page.locator('.dv-page-count')).toContainText('2');
  });

  test('PDF thumbnails render real page previews', async ({ page }) => {
    await gotoApp(page);
    await loadSample(page, 'PDF');
    await waitForCanvasRendered(page);

    const thumbs = page.locator('.dv-thumbnail-canvas');
    await expect(thumbs).toHaveCount(2);
    // A rendered portrait page is sized height > width; an unrendered canvas
    // keeps the 300×150 default (landscape), so this proves it actually drew.
    await expect
      .poll(() => thumbs.first().evaluate((c: HTMLCanvasElement) => (c.height > c.width ? 1 : 0)), {
        timeout: 15_000,
      })
      .toBe(1);
  });

  test('reflowable thumbnails render real document content', async ({ page }) => {
    await gotoApp(page);
    await loadSample(page, 'Markdown');
    await waitForReflowContent(page);

    const thumbDoc = page.locator('.dv-thumbnail-doc').first();
    await thumbDoc.waitFor({ state: 'attached' });
    await expect
      .poll(
        async () => (await thumbDoc.innerText().catch(() => '')).trim().length,
        { timeout: 15_000 },
      )
      .toBeGreaterThan(10);
  });
});

test.describe('PDF — text selection', () => {
  test('text layer exposes real, selectable text', async ({ page }) => {
    await gotoApp(page);
    await loadSample(page, 'PDF');
    await waitForCanvasRendered(page);

    // Text layer should populate with the page's words.
    await expect.poll(async () =>
      page.locator('.dv-text-layer span').count(), { timeout: 20_000 },
    ).toBeGreaterThan(0);

    const selected = await page.evaluate(() => {
      const layer = document.querySelector('.dv-text-layer');
      if (!layer) return '';
      const range = document.createRange();
      range.selectNodeContents(layer);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
      return sel.toString();
    });
    expect(selected.toLowerCase()).toContain('anyview');
  });
});

test.describe('PDF — search highlight + navigation', () => {
  test('finds, highlights, and navigates matches', async ({ page }) => {
    await gotoApp(page);
    await loadSample(page, 'PDF');
    await waitForCanvasRendered(page);

    await openSearch(page, 'anyview');
    // Match count appears (e.g. "1 of N")
    await expect(page.locator('.dv-search-count')).toContainText(/of/i, {
      timeout: 15_000,
    });
    // Positioned highlight boxes appear over the page.
    await expect(page.locator('.dv-search-highlight').first()).toBeAttached();
    await expect(page.locator('.dv-search-highlight-current')).toHaveCount(1);

    const before = await page.locator('.dv-search-count').innerText();
    await page.locator('button[aria-label="Next match"]').click();
    await expect(page.locator('.dv-search-count')).not.toHaveText(before);
  });

  test('reports "not found" for a missing term', async ({ page }) => {
    await gotoApp(page);
    await loadSample(page, 'PDF');
    await waitForCanvasRendered(page);
    await openSearch(page, 'zzzznotpresent');
    await expect(page.locator('.dv-search-count')).toContainText(/not found/i);
  });
});

test.describe('PDF — annotations', () => {
  async function pageBox(page: Page) {
    const box = await page.locator('.dv-page').first().boundingBox();
    if (!box) throw new Error('no page box');
    return box;
  }

  test('highlight tool draws a highlight annotation', async ({ page }) => {
    await gotoApp(page);
    await loadSample(page, 'PDF');
    await waitForCanvasRendered(page);

    await page.locator('button[aria-label="Highlight"]').click();
    const box = await pageBox(page);
    await page.mouse.move(box.x + 60, box.y + 80);
    await page.mouse.down();
    await page.mouse.move(box.x + 220, box.y + 120, { steps: 8 });
    await page.mouse.up();

    await expect(page.locator('.dv-annotation-layer .dv-annotation')).toHaveCount(1);
  });

  test('ink tool draws a freehand annotation', async ({ page }) => {
    await gotoApp(page);
    await loadSample(page, 'PDF');
    await waitForCanvasRendered(page);

    await page.locator('button[aria-label="Draw"]').click();
    const box = await pageBox(page);
    await page.mouse.move(box.x + 60, box.y + 200);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 240, { steps: 5 });
    await page.mouse.move(box.x + 180, box.y + 200, { steps: 5 });
    await page.mouse.up();

    await expect(page.locator('.dv-annotation-layer .dv-annotation')).toHaveCount(1);
  });

  test('sticky-note tool places a note', async ({ page }) => {
    await gotoApp(page);
    await loadSample(page, 'PDF');
    await waitForCanvasRendered(page);

    page.once('dialog', (d) => d.accept('A test note'));
    await page.locator('button[aria-label="Note"]').click();
    const box = await pageBox(page);
    await page.mouse.click(box.x + 150, box.y + 150);

    await expect(page.locator('.dv-annotation-layer .dv-annotation')).toHaveCount(1);
  });
});

test.describe('PDF — viewport controls', () => {
  test('zoom in enlarges the page', async ({ page }) => {
    await gotoApp(page);
    await loadSample(page, 'PDF');
    await waitForCanvasRendered(page);

    const widthOf = async () =>
      (await page.locator('.dv-page').first().boundingBox())!.width;
    const before = await widthOf();
    await page.locator('button[aria-label="Zoom in"]').click();
    await page.locator('button[aria-label="Zoom in"]').click();
    await expect.poll(widthOf).toBeGreaterThan(before);
  });

  test('rotation changes page orientation', async ({ page }) => {
    await gotoApp(page);
    await loadSample(page, 'PDF');
    await waitForCanvasRendered(page);

    const dims = async () => {
      const b = (await page.locator('.dv-page').first().boundingBox())!;
      return { w: b.width, h: b.height };
    };
    const before = await dims();
    await page.locator('button[aria-label="Rotate clockwise"]').click();
    await expect
      .poll(async () => (await dims()).w)
      .not.toBe(before.w);
  });

  test('page navigation moves to page 2', async ({ page }) => {
    await gotoApp(page);
    await loadSample(page, 'PDF');
    await waitForCanvasRendered(page);

    await page.locator('button[aria-label="Next page"]').click();
    await expect(page.locator('.dv-page-input')).toHaveValue('2');
  });

  test('keyboard navigation (ArrowRight) advances the page', async ({ page }) => {
    await gotoApp(page);
    await loadSample(page, 'PDF');
    await waitForCanvasRendered(page);

    // Shortcuts are scoped to focus inside the viewer.
    await page.locator('.dv-viewer-container').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.dv-page-input')).toHaveValue('2');
  });
});

test.describe('reflowable — DOM search', () => {
  test('Markdown search highlights via the Custom Highlight API', async ({ page }) => {
    await gotoApp(page);
    await loadSample(page, 'Markdown');
    await waitForReflowContent(page);

    await openSearch(page, 'anyview');
    await expect(page.locator('.dv-search-count')).toContainText(/of/i, {
      timeout: 15_000,
    });

    const hasHighlights = await page.evaluate(() => {
      const reg = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
      return !!reg && reg.has('dv-search');
    });
    expect(hasHighlights).toBe(true);
  });
});

test.describe('chrome — theme & sidebar', () => {
  test('theme switch applies the theme class', async ({ page }) => {
    await gotoApp(page);
    await loadSample(page, 'Markdown');
    await waitForReflowContent(page);

    await page.locator('.pg-theme-select').selectOption('dark');
    await expect(page.locator('.dv-root.dv-theme-dark')).toBeVisible();
  });

  test('sidebar toggle flips aria-expanded', async ({ page }) => {
    await gotoApp(page);
    await loadSample(page, 'PDF');
    await waitForCanvasRendered(page);

    const toggle = page.locator('button[aria-label="Toggle sidebar"]');
    const before = await toggle.getAttribute('aria-expanded');
    await toggle.click();
    await expect(toggle).not.toHaveAttribute('aria-expanded', before ?? '');
  });
});
