import { test, expect, type Page } from '@playwright/test';
import { openApp, pickSample, revealViewer } from './helpers';

async function open(page: Page, label: string) {
  await openApp(page);
  await pickSample(page, label);
  await revealViewer(page);
}

test.describe('keyboard', () => {
  test('arrow keys move between sidebar tabs', async ({ page }) => {
    await open(page, 'Jupyter');
    const thumbs = page.getByRole('tab', { name: 'Thumbnails' });
    const outline = page.getByRole('tab', { name: 'Outline' });
    await expect(outline).toBeVisible();
    await thumbs.focus();
    await page.keyboard.press('ArrowRight');
    await expect(outline).toBeFocused();
    await expect(outline).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(thumbs).toBeFocused();
    await expect(thumbs).toHaveAttribute('aria-selected', 'true');
  });

  test('End and Home scroll a single-page document', async ({ page }) => {
    await open(page, 'Markdown');
    await page.locator('.dv-reflow-target').first().waitFor();
    const container = page.locator('.dv-viewer-container');
    await expect.poll(() => container.evaluate((el) => el.scrollHeight > el.clientHeight + 50)).toBe(true);
    await container.focus();
    await page.keyboard.press('End');
    await expect.poll(() => container.evaluate((el) => el.scrollTop)).toBeGreaterThan(50);
    await page.keyboard.press('Home');
    await expect.poll(() => container.evaluate((el) => el.scrollTop)).toBe(0);
  });

  test('arrow keys pan zoomed content instead of turning the page', async ({ page }) => {
    await open(page, 'PDF');
    await page.waitForSelector('.dv-page canvas');
    await page.getByLabel('Zoom level').selectOption('3');
    const container = page.locator('.dv-viewer-container');
    await expect.poll(() => container.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    await container.evaluate((el) => el.scrollTo({ left: 0 }));
    await container.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => container.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    await expect(page.getByLabel('Page number')).toHaveValue('1');
  });

  test('closing a dialog opened from the More menu keeps focus in the viewer', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 800 });
    await open(page, 'PDF');
    await page.waitForSelector('.dv-page canvas');
    const more = page.getByRole('button', { name: 'More options' });
    await more.click();
    await page.getByRole('button', { name: 'Document properties' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(() => !!document.activeElement?.closest('.dv-root'))).toBe(true);
  });

  test('picking a thumbnail in a narrow viewer moves focus to the document', async ({ page }) => {
    await page.setViewportSize({ width: 560, height: 800 });
    await open(page, 'PDF');
    await page.waitForSelector('.dv-page canvas');
    const toggle = page.getByRole('button', { name: 'Toggle sidebar' });
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    const thumb = page.getByRole('button', { name: 'Page 2' });
    await thumb.focus();
    await page.keyboard.press('Enter');
    await expect(thumb).toHaveCount(0);
    expect(await page.evaluate(() => !!document.activeElement?.closest('.dv-viewer-container'))).toBe(true);
  });
});
