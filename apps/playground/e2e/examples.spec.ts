import { test, expect } from '@playwright/test';

test.describe('examples page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Built into');
  });

  test('a chat attachment opens in a modal and closes with Escape', async ({ page }) => {
    await page.getByRole('button', { name: /q3-report\.pdf/ }).click();
    const modal = page.getByRole('dialog', { name: 'q3-report.pdf' });
    await expect(modal.locator('.dv-page canvas').first()).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });

  test('the upload form previews a file and enables submit', async ({ page }) => {
    const section = page.locator('#upload-preview');
    const submit = section.getByRole('button', { name: 'Submit expense' });
    await expect(submit).toBeDisabled();
    await section.getByRole('button', { name: 'line-items.csv' }).click();
    await expect(section.locator('.ex-status')).toContainText('CSV · 1 page');
    await expect(submit).toBeEnabled();
  });

  test('review comments list annotations and export them', async ({ page }) => {
    const section = page.locator('#contract-review');
    await section.scrollIntoViewIfNeeded();
    await section.locator('.dv-page canvas').first().waitFor({ timeout: 15_000 });
    await section.getByRole('button', { name: 'Highlight', exact: true }).click();
    const box = (await section.locator('.dv-page').first().boundingBox())!;
    await page.mouse.move(box.x + 40, box.y + 80);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 110, { steps: 6 });
    await page.mouse.up();
    await expect(section.locator('.ex-review-panel li')).toHaveCount(1);
    await section.getByRole('button', { name: 'Export JSON' }).click();
    await expect(section.locator('.ex-json')).toContainText('"type": "highlight"');
  });

  test('custom controls drive the viewer through hooks', async ({ page }) => {
    const section = page.locator('#custom-controls');
    await section.scrollIntoViewIfNeeded();
    await expect(section.locator('.ex-controls')).toContainText('1 / 2', { timeout: 15_000 });
    await section.getByRole('button', { name: 'Next slide' }).click();
    await expect(section.locator('.ex-controls')).toContainText('2 / 2');
    const before = await section.locator('.ex-controls').innerText();
    await section.getByRole('button', { name: 'Zoom in' }).click();
    await expect(section.locator('.ex-controls')).not.toHaveText(before);
  });

  test('the code tab shows the demo source', async ({ page }) => {
    const section = page.locator('#custom-controls');
    await section.getByRole('tab', { name: 'Code' }).click();
    await expect(section.locator('.ex-code')).toContainText('useNavigation()');
  });
});

test('the home page links to the examples', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /See it inside four small apps/ }).click();
  await expect(page).toHaveURL(/\/examples\/$/);
});
