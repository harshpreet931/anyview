import { test, expect, type Locator, type Page } from '@playwright/test';
import { fixture, pickSample, sampleChip, settleAnimations, waitForStable, waitForStableLayout } from './helpers';

const touch = { isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

async function openSample(page: Page, name: string) {
  await page.goto('/');
  await pickSample(page, name);
  const firstPage = page.locator('.pg-canvas .dv-page').first();
  await expect(firstPage).toBeVisible({ timeout: 20_000 });
  await settle(page, firstPage);
  await scrollToTop(page, page.locator('.pg-canvas'));
}

async function scrollToTop(page: Page, locator: Locator) {
  await expect
    .poll(() =>
      locator.evaluate((el) => {
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'instant' });
        return Math.abs(el.getBoundingClientRect().top);
      }),
    )
    .toBeLessThanOrEqual(1);
}

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error('element has no box');
  return b;
}

async function expectInsideViewport(page: Page, locator: Locator, margin = 0) {
  const { width } = page.viewportSize()!;
  const { left, right } = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left + window.scrollX, right: r.right + window.scrollX };
  });
  expect(left).toBeGreaterThanOrEqual(margin);
  expect(right).toBeLessThanOrEqual(width - margin);
}

async function settle(page: Page, target: Locator) {
  await settleAnimations(page);
  await waitForStableLayout(target);
}

const toolbar = (page: Page) => page.locator('.pg-canvas .dv-toolbar');

async function expectHitTarget(locator: Locator) {
  const hit = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!at && (at === el || el.contains(at));
  });
  expect(hit).toBe(true);
}

async function textLines(locator: Locator) {
  return locator.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const tops = [...range.getClientRects()].filter((r) => r.width > 0).map((r) => r.top).sort((a, b) => a - b);
    return tops.filter((t, i) => i === 0 || t - tops[i - 1]! > 8).length;
  });
}

async function pageNumber(page: Page) {
  return page.locator('.pg-canvas .dv-page-input').inputValue();
}

async function scrollViewerToEnd(page: Page) {
  await page.locator('.pg-canvas .dv-viewer-container').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
}

test.describe('fold phone, 280px', () => {
  test.use({ viewport: { width: 280, height: 653 }, ...touch });

  test('the More options button stays on screen and its menu fits the viewport', async ({ page }) => {
    await openSample(page, 'PDF');
    const more = page.locator('.pg-canvas').getByRole('button', { name: 'More options' });
    await expect(more).toBeVisible();
    await settle(page, more);
    await expectInsideViewport(page, more);
    await expectHitTarget(more);

    await more.click();
    const menu = page.locator('.pg-canvas .dv-toolbar-overflow[data-open="true"]');
    await expect(menu).toBeVisible();
    await expectInsideViewport(page, menu, 8);
    for (const button of await menu.getByRole('button').all()) {
      await expectInsideViewport(page, button, 8);
    }
  });

  test('the toolbar never clips its last control on the examples page', async ({ page }) => {
    await page.goto('/examples/');
    const review = page.locator('#contract-review');
    const more = review.getByRole('button', { name: 'More options' });
    await scrollToTop(page, review);
    await expect(more).toBeVisible({ timeout: 20_000 });
    await settle(page, more);
    await expectInsideViewport(page, more);
    const card = await box(review.locator('.dv-root'));
    const b = await box(more);
    expect(b.x + b.width).toBeLessThanOrEqual(card.x + card.width);
  });

  test('the hero call-to-action row fits without wrapping or overflowing', async ({ page }) => {
    await page.goto('/');
    const row = page.locator('.pg-cta-row');
    await settle(page, row);
    const rowBox = await box(row);
    for (const child of await row.locator(':scope > *:visible').all()) {
      const b = await box(child);
      expect(b.x).toBeGreaterThanOrEqual(rowBox.x - 0.5);
      expect(b.x + b.width).toBeLessThanOrEqual(rowBox.x + rowBox.width + 0.5);
      expect(await child.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    }
    expect(await textLines(page.locator('.pg-btn-black'))).toBe(1);
    expect(await textLines(page.locator('.pg-npm code'))).toBe(1);
  });

  test('the page count does not wrap', async ({ page }) => {
    await openSample(page, 'PDF');
    expect(await textLines(page.locator('.pg-canvas .dv-page-count'))).toBe(1);
  });

  test('the search field keeps a usable width', async ({ page }) => {
    await openSample(page, 'PDF');
    await page.locator('.pg-canvas').getByRole('button', { name: 'Toggle search' }).click();
    const input = page.locator('.pg-canvas .dv-search-input');
    await expect(input).toBeVisible();
    expect((await box(input)).width).toBeGreaterThanOrEqual(100);
  });
});

test.describe('page never scrolls sideways', () => {
  for (const width of [280, 320, 375, 393]) {
    test.describe(`${width}px`, () => {
      test.use({ viewport: { width, height: 740 }, ...touch });

      test(`no horizontal overflow at ${width}px`, async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('.dv-root')).toBeVisible();
        await settleAnimations(page);
        const scrollWidth = () => page.evaluate(() => document.scrollingElement!.scrollWidth);
        await waitForStable(scrollWidth);
        const overflow = await scrollWidth();
        expect(overflow).toBeLessThanOrEqual(width);
      });
    });
  }
});

test.describe('phone, 375px', () => {
  test.use({ viewport: { width: 375, height: 667 }, ...touch });

  test('typing a page number reaches the last page and stays there', async ({ page }) => {
    await openSample(page, 'PDF');
    const input = page.locator('.pg-canvas .dv-page-input');
    await input.fill('2');
    await input.press('Enter');
    await waitForStableLayout(page.locator('.pg-canvas .dv-viewer-container > div').first());
    expect(await pageNumber(page)).toBe('2');
  });

  test('scrolling to the end shows the last page number', async ({ page }) => {
    await openSample(page, 'PDF');
    await scrollViewerToEnd(page);
    await expect.poll(() => pageNumber(page)).toBe('2');
  });

  test('scrolling to the end of a 12-page PDF shows page 12', async ({ page }) => {
    await page.goto('/');
    await page.locator('.pg-upload-btn input[type="file"]').setInputFiles(fixture('pages-12.pdf'));
    await expect(page.locator('.pg-canvas .dv-page-count')).toContainText('12', { timeout: 20_000 });
    await scrollViewerToEnd(page);
    await expect.poll(() => pageNumber(page)).toBe('12');
    await page.locator('.pg-canvas .dv-viewer-container').evaluate((el) => {
      el.scrollTop = 0;
    });
    await expect.poll(() => pageNumber(page)).toBe('1');
  });

  test('text inputs are at least 16px so iOS does not zoom on focus', async ({ page }) => {
    await openSample(page, 'PDF');
    await page.locator('.pg-canvas').getByRole('button', { name: 'Toggle search' }).click();
    for (const selector of ['.dv-page-input', '.dv-search-input']) {
      const size = await page
        .locator(`.pg-canvas ${selector}`)
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(size, selector).toBeGreaterThanOrEqual(16);
    }
  });

  test('viewer controls are at least 40px tall on touch screens', async ({ page }) => {
    await openSample(page, 'PDF');
    await settle(page, toolbar(page));
    const controls = toolbar(page).locator('.dv-button:visible, .dv-page-input:visible, .dv-zoom-select:visible');
    expect(await controls.count()).toBeGreaterThan(2);
    for (const control of await controls.all()) {
      const b = await box(control);
      expect(b.height).toBeGreaterThanOrEqual(40);
      expect(b.width).toBeGreaterThanOrEqual(40);
    }
    expect(await toolbar(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  });

  test('site controls are at least 40px tall on touch screens', async ({ page }) => {
    await page.goto('/');
    const samples = page.getByRole('group', { name: 'Sample documents' });
    await settle(page, samples);
    expect((await box(page.getByRole('combobox', { name: 'Viewer theme' }))).height).toBeGreaterThanOrEqual(40);
    for (const chip of await samples.getByRole('button').all()) {
      expect((await box(chip)).height).toBeGreaterThanOrEqual(40);
    }
  });

  test('examples page tabs are at least 40px tall on touch screens', async ({ page }) => {
    await page.goto('/examples/');
    await settle(page, page.getByRole('tab').last());
    for (const tab of await page.getByRole('tab').all()) {
      expect((await box(tab)).height).toBeGreaterThanOrEqual(40);
    }
  });

  test('the active last sample tab is not hidden under the edge fade', async ({ page }) => {
    await page.goto('/');
    const chip = sampleChip(page, 'Text');
    await chip.click();
    const track = page.getByRole('group', { name: 'Sample documents' });
    let last = -1;
    await expect
      .poll(async () => {
        const now = await track.evaluate((el) => el.scrollLeft);
        const settled = now === last;
        last = now;
        return settled;
      })
      .toBe(true);
    const fade = await track.evaluate((el) => (el.dataset.fadeEnd === 'true' ? 40 : 0));
    const t = await box(track);
    const c = await box(chip);
    expect(c.x + c.width).toBeLessThanOrEqual(t.x + t.width - fade);
  });

  test('tapping outside the thumbnail drawer closes it', async ({ page }) => {
    await openSample(page, 'PDF');
    const toggle = page.locator('.pg-canvas').getByRole('button', { name: 'Toggle sidebar' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const sidebar = await box(page.locator('.pg-canvas .dv-sidebar'));
    const viewer = await box(page.locator('.pg-canvas .dv-viewer-container'));
    await page.touchscreen.tap(
      (sidebar.x + sidebar.width + viewer.x + viewer.width) / 2,
      viewer.y + viewer.height / 2,
    );
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('empty viewer', () => {
  test.use({ viewport: { width: 375, height: 667 }, ...touch });

  test('shows no page numbers until a document loads', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('.pg-canvas .dv-page-input');
    await expect(input).toBeDisabled();
    await expect(input).toHaveValue('');
    await expect(page.locator('.pg-canvas .dv-page-count')).not.toContainText('0');
  });
});

test.describe('landscape phone, 852x393', () => {
  test.use({ viewport: { width: 852, height: 393 }, ...touch });

  test('the viewer fits the viewport height', async ({ page }) => {
    await page.goto('/');
    const canvas = await box(page.locator('.pg-canvas'));
    expect(canvas.height).toBeLessThanOrEqual(393);
  });

  test('overflowing sample tabs get an edge fade', async ({ page }) => {
    await page.goto('/');
    const track = page.getByRole('group', { name: 'Sample documents' });
    const overflows = await track.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(overflows).toBe(true);
    const mask = await track.evaluate((el) => {
      const s = getComputedStyle(el);
      return s.maskImage || s.webkitMaskImage;
    });
    expect(mask).not.toBe('none');
  });
});

test.describe('tablet, 768px', () => {
  test.use({ viewport: { width: 768, height: 1024 }, ...touch });

  test('overflowing sample tabs get an edge fade', async ({ page }) => {
    await page.goto('/');
    const track = page.getByRole('group', { name: 'Sample documents' });
    expect(await track.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    const mask = await track.evaluate((el) => {
      const s = getComputedStyle(el);
      return s.maskImage || s.webkitMaskImage;
    });
    expect(mask).not.toBe('none');
  });

  test('scrolling to the end of the PDF sample shows page 2', async ({ page }) => {
    await openSample(page, 'PDF');
    await scrollViewerToEnd(page);
    await expect.poll(() => pageNumber(page)).toBe('2');
  });

  test('the See examples link is at least 40px tall on touch screens', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('.pg-cta-row').getByRole('link', { name: 'See examples' });
    await settle(page, link);
    expect((await box(link)).height).toBeGreaterThanOrEqual(40);
  });
});

const FORMAT = { PDF: 'pdf', Word: 'docx', Markdown: 'markdown', PowerPoint: 'pptx' } as const;

for (const [width, samples] of [
  [440, ['PDF']],
  [560, ['PDF']],
  [653, ['Word', 'Markdown']],
  [700, ['Markdown']],
  [853, ['PowerPoint']],
  [1180, ['PDF']],
] as const) {
  test.describe(`touch toolbar at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, ...touch });

    test('the larger touch controls never overflow the toolbar', async ({ page }) => {
      await page.goto('/');
      for (const name of samples) {
        await pickSample(page, name);
        const firstPage = page.locator(`.pg-canvas .dv-page[data-format="${FORMAT[name]}"]`).first();
        await expect(firstPage).toBeVisible({ timeout: 20_000 });
        await settle(page, firstPage);
        expect(await toolbar(page).evaluate((el) => el.scrollWidth <= el.clientWidth), name).toBe(true);
      }
    });
  });
}

test.describe('desktop tabs', () => {
  test('tabs that fit get no edge fade', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const track = page.getByRole('group', { name: 'Sample documents' });
    expect(await track.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(false);
    const mask = await track.evaluate((el) => {
      const s = getComputedStyle(el);
      return s.maskImage || s.webkitMaskImage;
    });
    expect(mask).toBe('none');
  });
});
