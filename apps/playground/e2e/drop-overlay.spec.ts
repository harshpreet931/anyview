import { test, expect, type Page } from '@playwright/test';
import { openApp } from './helpers';

async function dragOver(page: Page, selector: string) {
  await page.locator(selector).first().evaluate((el) => {
    const dt = new DataTransfer();
    dt.items.add(new File(['# hi'], 'note.md', { type: 'text/markdown' }));
    el.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }));
    el.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    (window as unknown as { __dt: DataTransfer }).__dt = dt;
  });
}

test.describe('site drop overlay', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('clears after a file is dropped onto the viewer empty state', async ({ page }) => {
    await dragOver(page, '.dv-root');
    await expect(page.locator('.pg-drop-overlay')).toBeVisible();
    await page.locator('.dv-empty-dropzone').evaluate((el) => {
      const dt = (window as unknown as { __dt: DataTransfer }).__dt;
      el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    });
    await expect(page.locator('.pg-drop-overlay')).toHaveCount(0);
  });

  test('clears when the drag is cancelled or leaves the window', async ({ page }) => {
    await dragOver(page, '.pg-hero');
    await expect(page.locator('.pg-drop-overlay')).toBeVisible();
    await page.evaluate(() => {
      document.querySelector('.pg-drop-overlay')!.dispatchEvent(
        new DragEvent('dragleave', { bubbles: true, cancelable: true, relatedTarget: null }),
      );
    });
    await expect(page.locator('.pg-drop-overlay')).toHaveCount(0);
  });
});
