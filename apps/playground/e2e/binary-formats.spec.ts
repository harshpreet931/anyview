import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) =>
  fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

async function openFile(page: Page, name: string) {
  await page.goto('/');
  await expect(page.locator('.dv-root')).toBeVisible();
  await page.locator('.pg-upload-btn input[type="file"]').setInputFiles(fixture(name));
}

async function reflowText(page: Page) {
  const target = page.locator('.dv-reflow-target').first();
  await target.waitFor({ state: 'attached' });
  await expect
    .poll(async () => (await target.innerText()).trim().length, { timeout: 20_000 })
    .toBeGreaterThan(0);
  return target;
}

test.describe('binary formats - native (no iframe) rendering', () => {
  test('DOCX renders real text via mammoth', async ({ page }) => {
    await openFile(page, 'sample.docx');
    const target = await reflowText(page);
    await expect(target).toContainText('Hello DOCX from Anyview');
    await expect(target).toContainText('quick brown fox');
  });

  test('DOCX is searchable (DOM highlight)', async ({ page }) => {
    await openFile(page, 'sample.docx');
    await reflowText(page);
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
    await openFile(page, 'sample.xlsx');
    const target = await reflowText(page);
    await expect(target).toContainText('Alice');
    await expect(target).toContainText('Engineer');
    await expect(target).toContainText('Carol');
  });

  test('PPTX renders slides via JSZip + XML', async ({ page }) => {
    await openFile(page, 'sample.pptx');
    const target = await reflowText(page);
    await expect(target).toContainText('Anyview Presentation');
    await expect(page.locator('.dv-page-count')).toContainText('2');
  });
});

test.describe('PDF - intrinsic /Rotate composes with interactive rotation', () => {
  // rotated.pdf: page 1 has no /Rotate; page 2 has /Rotate 90 (as many
  // scanner/mobile-captured PDFs do). The interactive rotation control must
  // compose with a page's own rotation, not replace it.
  async function pageBox(page: Page, index: number) {
    return page.locator(`.dv-page[data-page-index="${index}"] canvas`).evaluate(
      (c: HTMLCanvasElement) => ({ w: c.width, h: c.height }),
    );
  }

  test('intrinsic /Rotate 90 renders sideways by default (UI rotation 0)', async ({ page }) => {
    await openFile(page, 'rotated.pdf');
    await page.locator('.dv-page canvas').first().waitFor({ state: 'attached' });
    await page.waitForTimeout(500);

    const page1 = await pageBox(page, 0);
    const page2 = await pageBox(page, 1);

    // Page 1 (no intrinsic rotation): portrait.
    expect(page1.w).toBeLessThan(page1.h);
    // Page 2 (/Rotate 90, no UI rotation applied): landscape - the intrinsic
    // rotation must be applied even though the interactive control is at 0.
    expect(page2.w).toBeGreaterThan(page2.h);
  });

  test('interactive rotation composes with (does not replace) intrinsic rotation', async ({ page }) => {
    await openFile(page, 'rotated.pdf');
    await page.locator('.dv-page canvas').first().waitFor({ state: 'attached' });
    await page.waitForTimeout(500);

    // Capture page 1's baseline ratio before any rotation is applied -
    // rotation is a global/document-level control, so page 1 is affected by
    // the same clicks as page 2 and can't be re-measured later as a fixed
    // reference.
    const page1Baseline = await pageBox(page, 0);
    const baselineRatio = page1Baseline.w / page1Baseline.h;

    await page.locator('button[aria-label="Next page"]').click();
    await page.waitForTimeout(300);

    const before = await pageBox(page, 1); // intrinsic 90, UI 0 -> landscape

    // +90 interactively: total = 90 + 90 = 180 (portrait), NOT back to 0 and
    // NOT double-sideways - a naive "replace" implementation would either
    // ignore this click's effect on aspect or produce a distorted mid-state.
    await page.locator('button[aria-label="Rotate clockwise"]').click();
    await page.waitForTimeout(500);
    const after180 = await pageBox(page, 1);
    expect(after180.w).toBeLessThan(after180.h); // portrait again at total 180
    // Same aspect ratio as the unrotated baseline (within rounding), not a
    // distorted intermediate.
    expect(Math.abs(after180.w / after180.h - baselineRatio)).toBeLessThan(0.02);

    // +90 again: total = 90 + 180 = 270 (landscape again, same box dims as
    // total 90 - both are "sideways", only the rotation direction differs).
    await page.locator('button[aria-label="Rotate clockwise"]').click();
    await page.waitForTimeout(500);
    const after270 = await pageBox(page, 1);
    expect(after270.w).toBeGreaterThan(after270.h);
    expect(after270.w).toBe(before.w);
    expect(after270.h).toBe(before.h);
  });
});
