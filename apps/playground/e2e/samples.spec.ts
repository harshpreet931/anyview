import { test, expect } from '@playwright/test';

const OFFICE = [
  ['Word', 'Wholesale proposal'],
  ['Excel', 'Coldharbour'],
  ['PowerPoint', 'Slow bread, twelve bakeries'],
] as const;

test.describe('sample picker - every headline format has a sample', () => {
  test('the picker leads with PDF, Word, Excel and PowerPoint', async ({ page }) => {
    await page.goto('/');
    const chips = page.getByRole('group', { name: 'Sample documents' }).getByRole('button');
    await expect(chips.nth(0)).toHaveText('PDF');
    await expect(chips.nth(1)).toHaveText('Word');
    await expect(chips.nth(2)).toHaveText('Excel');
    await expect(chips.nth(3)).toHaveText('PowerPoint');
  });

  for (const [label, text] of OFFICE) {
    test(`the ${label} sample renders its real content`, async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.dv-root')).toBeVisible();
      await page.getByRole('group', { name: 'Sample documents' }).getByRole('button', { name: label, exact: true }).click();
      await expect
        .poll(async () => page.locator('.dv-root').innerText(), { timeout: 20_000 })
        .toContain(text);
    });
  }

  test('no sample claims a bundle size or an outdated format count', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('group', { name: 'Sample documents' }).getByRole('button', { name: 'Markdown', exact: true }).click();
    const target = page.locator('.dv-reflow-target').first();
    await expect.poll(async () => (await target.innerText()).trim().length, { timeout: 20_000 }).toBeGreaterThan(0);
    const body = await target.innerText();
    expect(body).not.toMatch(/kB gzip/i);
    expect(body).not.toMatch(/\b10 formats\b/i);
  });
});
