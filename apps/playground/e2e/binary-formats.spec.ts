import { test, expect, type Page } from '@playwright/test';
import { fixture, openFile, waitForReflow, waitForStable } from './helpers';

test.describe('binary formats - native (no iframe) rendering', () => {
  test('DOCX renders real text via mammoth', async ({ page }) => {
    await openFile(page, fixture('sample.docx'));
    const target = await waitForReflow(page);
    await expect(target).toContainText('Hello DOCX from Anyview');
    await expect(target).toContainText('quick brown fox');
  });

  test('DOCX is searchable (DOM highlight)', async ({ page }) => {
    await openFile(page, fixture('sample.docx'));
    await waitForReflow(page);
    await page.locator('button[aria-label="Toggle search"]').click();
    await page.locator('.dv-search-input').fill('fox');
    await expect(page.locator('.dv-search-count')).toContainText(/of/i, {
      timeout: 15_000,
    });
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const reg = (CSS as unknown as { highlights?: Map<string, unknown> })
              .highlights;
            return !!reg && reg.has('dv-search');
          }),
        { timeout: 10_000 },
      )
      .toBe(true);
  });

  test('XLSX renders a spreadsheet via SheetJS', async ({ page }) => {
    await openFile(page, fixture('sample.xlsx'));
    const target = await waitForReflow(page);
    await expect(target).toContainText('Alice');
    await expect(target).toContainText('Engineer');
    await expect(target).toContainText('Carol');
  });

  test('PPTX renders slides via JSZip + XML', async ({ page }) => {
    await openFile(page, fixture('sample.pptx'));
    const target = await waitForReflow(page);
    await expect(target).toContainText('Anyview Presentation');
    await expect(page.locator('.dv-page-count')).toContainText('2');
  });
});

test.describe('PDF - intrinsic /Rotate composes with interactive rotation', () => {
  type Size = { w: number; h: number };
  const UNPAINTED: Size = { w: 300, h: 150 };

  async function paintedSize(page: Page, index: number, unlike: Size = UNPAINTED) {
    const canvas = page.locator(`.dv-page[data-page-index="${index}"] canvas`);
    const read = async (): Promise<Size | null> =>
      (await canvas.count()) ? canvas.evaluate((c: HTMLCanvasElement) => ({ w: c.width, h: c.height })) : null;
    await waitForStable(async () => {
      const size = await read();
      return size && (size.w !== unlike.w || size.h !== unlike.h) ? size : null;
    });
    return (await read())!;
  }

  test('intrinsic /Rotate 90 renders sideways by default (UI rotation 0)', async ({ page }) => {
    await openFile(page, fixture('rotated.pdf'));
    const page1 = await paintedSize(page, 0);
    const page2 = await paintedSize(page, 1);

    expect(page1.w).toBeLessThan(page1.h);
    expect(page2.w).toBeGreaterThan(page2.h);
  });

  test('interactive rotation composes with (does not replace) intrinsic rotation', async ({ page }) => {
    await openFile(page, fixture('rotated.pdf'));
    const page1Baseline = await paintedSize(page, 0);
    const baselineRatio = page1Baseline.w / page1Baseline.h;

    await page.locator('button[aria-label="Next page"]').click();
    await expect(page.locator('.dv-page-input')).toHaveValue('2');

    const before = await paintedSize(page, 1);

    await page.locator('button[aria-label="Rotate clockwise"]').click();
    const after180 = await paintedSize(page, 1, before);
    expect(after180.w).toBeLessThan(after180.h);
    expect(Math.abs(after180.w / after180.h - baselineRatio)).toBeLessThan(0.02);

    await page.locator('button[aria-label="Rotate clockwise"]').click();
    const after270 = await paintedSize(page, 1, after180);
    expect(after270.w).toBeGreaterThan(after270.h);
    expect(after270.w).toBe(before.w);
    expect(after270.h).toBe(before.h);
  });
});
