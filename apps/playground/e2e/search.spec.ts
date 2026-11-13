import { test, expect, type Page } from '@playwright/test';

async function openPdfSearch(page: Page, query: string) {
  await page.goto('/');
  await expect(page.locator('.dv-root')).toBeVisible();
  await page.locator('.pg-sample-chip', { hasText: /^PDF$/ }).click();
  await page.waitForSelector('.dv-page canvas');
  await page.locator('.dv-root').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.locator('button[aria-label="Toggle search"]').click();
  const input = page.locator('.dv-search-input');
  await expect(input).toBeFocused();
  await input.fill(query);
  await expect(page.locator('.dv-search-count')).toContainText(/1 of \d/, { timeout: 15_000 });
  return input;
}

test.describe('search keyboard and scrolling', () => {
  test('Enter and Shift+Enter step through matches', async ({ page }) => {
    const input = await openPdfSearch(page, 'format');
    await input.press('Enter');
    await expect(page.locator('.dv-search-count')).toContainText(/^2 of/);
    await input.press('Shift+Enter');
    await expect(page.locator('.dv-search-count')).toContainText(/^1 of/);
  });

  test('moving between matches never scrolls the host page', async ({ page }) => {
    await openPdfSearch(page, 'format');
    await page.evaluate(() => {
      const top = document.querySelector('.dv-root')!.getBoundingClientRect().top + scrollY;
      scrollTo(0, top - innerHeight / 2);
    });
    await page.waitForTimeout(400);
    const before = await page.evaluate(() => scrollY);
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() =>
        document.querySelector<HTMLButtonElement>('button[aria-label="Next match"]')!.click(),
      );
      await page.waitForTimeout(500);
    }
    expect(await page.evaluate(() => scrollY)).toBe(before);
  });

  test('Escape closes search and keeps focus inside the viewer', async ({ page }) => {
    const input = await openPdfSearch(page, 'format');
    await input.press('Escape');
    await expect(page.locator('.dv-search-input')).toHaveCount(0);
    expect(await page.evaluate(() => !!document.activeElement?.closest('.dv-root'))).toBe(true);
    const toggle = page.locator('button[aria-label="Toggle sidebar"]');
    const was = await toggle.getAttribute('aria-expanded');
    await page.keyboard.press('s');
    await expect(toggle).not.toHaveAttribute('aria-expanded', was ?? '');
  });

  test('zooming with search open does not snap back to the match', async ({ page }) => {
    await openPdfSearch(page, 'format');
    const container = page.locator('.dv-viewer-container');
    await container.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await page.waitForTimeout(400);
    await page.locator('button[aria-label="Zoom in"]').click();
    await page.waitForTimeout(900);
    const visible = await page.evaluate(() => {
      const c = document.querySelector('.dv-viewer-container')!.getBoundingClientRect();
      const m = document.querySelector('.dv-search-highlight-current')?.getBoundingClientRect();
      return !!m && m.bottom > c.top && m.top < c.bottom;
    });
    expect(visible).toBe(false);
  });
});
