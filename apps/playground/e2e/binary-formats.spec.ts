import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) =>
  fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

async function openFile(page: Page, name: string) {
  await page.goto('/');
  await expect(page.locator('.dv-root')).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(fixture(name));
}

async function reflowText(page: Page) {
  const target = page.locator('.dv-reflow-target').first();
  await target.waitFor({ state: 'attached' });
  await expect
    .poll(async () => (await target.innerText()).trim().length, { timeout: 20_000 })
    .toBeGreaterThan(0);
  return target;
}

test.describe('binary formats — native (no iframe) rendering', () => {
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
