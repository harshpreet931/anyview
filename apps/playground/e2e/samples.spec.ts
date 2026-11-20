import { test, expect } from '@playwright/test';
import { openApp, pickSample, waitForReflow } from './helpers';

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
      await openApp(page);
      await pickSample(page, label);
      await expect
        .poll(async () => page.locator('.dv-root').innerText(), { timeout: 20_000 })
        .toContain(text);
    });
  }

  test('no sample claims a bundle size or an outdated format count', async ({ page }) => {
    await openApp(page);
    await pickSample(page, 'Markdown');
    const target = await waitForReflow(page);
    const body = await target.innerText();
    expect(body).not.toMatch(/kB gzip/i);
    expect(body).not.toMatch(/\b10 formats\b/i);
  });
});
