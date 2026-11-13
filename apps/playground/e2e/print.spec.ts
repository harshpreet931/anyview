import { test, expect } from '@playwright/test';

test('printing a reflowable document prints only the document', async ({ page }) => {
  await page.addInitScript(() => {
    const top = window.top as Window & { __printed?: string[] };
    window.print = () => {
      top.__printed = top.__printed ?? [];
      top.__printed.push(window === top ? 'HOST PAGE' : document.body.innerText);
    };
  });
  await page.goto('/');
  await page.locator('.pg-sample-chip', { hasText: /^Markdown$/ }).click();
  await page.locator('.dv-reflow-target').first().waitFor();
  await page.locator('.dv-root').evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.getByRole('button', { name: 'Print' }).click();
  await expect
    .poll(() => page.evaluate(() => (window as Window & { __printed?: string[] }).__printed ?? []))
    .toHaveLength(1);
  const [printed] = await page.evaluate(() => (window as Window & { __printed?: string[] }).__printed!);
  expect(printed).not.toBe('HOST PAGE');
  const docText = await page.locator('.dv-reflow-target').first().innerText();
  expect(printed).toContain(docText.split('\n').find((l) => l.trim().length > 12)!.trim());
  expect(printed).not.toContain('Zero iframes');
});
