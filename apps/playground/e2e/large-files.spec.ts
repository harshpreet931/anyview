import { test, expect } from '@playwright/test';
import { QUIET_WINDOW_MS, openApp, openFile } from './helpers';

function bigCsv(rows: number): Buffer {
  const lines = ['id,name,email,city,amount'];
  for (let i = 0; i < rows; i++) lines.push(`${i},Person ${i},p${i}@example.com,City ${i % 97},${(i * 7) % 1000}.50`);
  return Buffer.from(lines.join('\n'));
}

test.describe('large inputs', () => {
  test('a 50,000-row CSV opens quickly and scrolls to its last row', async ({ page }) => {
    await openApp(page);
    const t0 = Date.now();
    await page.locator('.pg-upload-btn input[type="file"]').setInputFiles({
      name: 'big.csv',
      mimeType: 'text/csv',
      buffer: bigCsv(50_000),
    });
    await expect(page.locator('.dv-reflow-target td', { hasText: 'p0@example.com' })).toBeVisible({ timeout: 15_000 });
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(4000);

    expect(await page.locator('.dv-reflow-target tbody tr').count()).toBeLessThan(50_000);
    await page.locator('.dv-viewer-container').evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect(page.locator('.dv-reflow-target td', { hasText: 'p49999@example.com' })).toBeVisible();
  });

  test('a large text-only format does not render a second copy for its thumbnail', async ({ page }) => {
    await openFile(page, {
      name: 'big.csv',
      mimeType: 'text/csv',
      buffer: bigCsv(30_000),
    });
    await expect(page.locator('.dv-reflow-target td').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.dv-thumbnail-list .dv-thumbnail').first()).toBeAttached();
    await page.waitForTimeout(QUIET_WINDOW_MS);
    expect(await page.locator('.dv-thumbnail-list td').count()).toBe(0);
  });
});
