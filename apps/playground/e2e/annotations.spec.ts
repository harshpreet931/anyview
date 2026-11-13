import { test, expect, type Page } from '@playwright/test';

async function openPdf(page: Page) {
  await page.goto('/');
  await expect(page.locator('.dv-root')).toBeVisible();
  await page.locator('.pg-sample-chip', { hasText: /^PDF$/ }).click();
  await page.waitForSelector('.dv-page canvas');
  await page.getByLabel('Zoom level').selectOption('1.25');
  await page.waitForTimeout(400);
  await page.locator('.dv-root').evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
  let last = '';
  await expect
    .poll(async () => {
      const b = await page.locator('.dv-page').first().boundingBox();
      const now = JSON.stringify(b);
      const stable = now === last;
      last = now;
      return stable;
    }, { intervals: [150] })
    .toBe(true);
  let dialogs = 0;
  page.on('dialog', (d) => {
    dialogs++;
    d.dismiss().catch(() => {});
  });
  return () => dialogs;
}

const annotations = (page: Page) => page.locator('.dv-annotation-layer g.dv-annotation');

async function spanBox(page: Page, text: RegExp) {
  const span = page.locator('.dv-text-layer span').filter({ hasText: text }).first();
  await span.waitFor();
  return (await span.boundingBox())!;
}

test.describe('annotations', () => {
  test('notes are written inline, not in a browser prompt, and stay readable', async ({ page }) => {
    const dialogs = await openPdf(page);
    await page.getByRole('radio', { name: 'Note' }).click();
    const box = (await page.locator('.dv-page').first().boundingBox())!;
    await page.mouse.click(box.x + 400, box.y + 120);
    const editor = page.getByRole('textbox', { name: 'Note' });
    await expect(editor).toBeFocused();
    await editor.fill('Ship it');
    await editor.press('Enter');
    await expect(annotations(page)).toHaveCount(1);
    expect(dialogs()).toBe(0);

    await page.getByRole('radio', { name: 'Note' }).click();
    await annotations(page).first().focus();
    await expect(page.locator('.dv-annotation-comment')).toHaveText('Ship it');
  });

  test('Escape cancels an inline note', async ({ page }) => {
    await openPdf(page);
    await page.getByRole('radio', { name: 'Text' }).click();
    const box = (await page.locator('.dv-page').first().boundingBox())!;
    await page.mouse.click(box.x + 400, box.y + 120);
    await page.keyboard.type('draft');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('textbox', { name: 'Text' })).toHaveCount(0);
    await expect(annotations(page)).toHaveCount(0);
  });

  test('a straight drag along a line of text highlights it', async ({ page }) => {
    await openPdf(page);
    const line = await spanBox(page, /Native rendering/);
    await page.getByRole('radio', { name: 'Highlight' }).click();
    const y = line.y + line.height / 2;
    await page.mouse.move(line.x, y);
    await page.mouse.down();
    await page.mouse.move(line.x + line.width / 2, y, { steps: 5 });
    await page.mouse.move(line.x + line.width, y, { steps: 5 });
    await page.mouse.up();
    await expect(annotations(page)).toHaveCount(1);
    const rect = (await annotations(page).first().locator('rect').first().boundingBox())!;
    expect(rect.height).toBeGreaterThan(line.height * 0.6);
    expect(rect.width).toBeGreaterThan(line.width * 0.8);
  });

  test('highlights can be deleted from the keyboard and undone', async ({ page }) => {
    await openPdf(page);
    const line = await spanBox(page, /Native rendering/);
    await page.getByRole('radio', { name: 'Highlight' }).click();
    await page.mouse.move(line.x, line.y);
    await page.mouse.down();
    await page.mouse.move(line.x + line.width, line.y + line.height, { steps: 6 });
    await page.mouse.up();
    await page.getByRole('radio', { name: 'Highlight' }).click();
    await expect(annotations(page)).toHaveCount(1);

    await annotations(page).first().focus();
    await page.keyboard.press('Delete');
    await expect(annotations(page)).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+z');
    await expect(annotations(page)).toHaveCount(1);
  });

  test('a two-finger pinch with Draw active leaves no stroke', async ({ page }) => {
    await openPdf(page);
    await page.getByRole('radio', { name: 'Draw' }).click();
    const box = (await page.locator('.dv-annotation-layer').first().boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: string, points: [number, number][]) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: points.map(([x, y], id) => ({ x: box.x + x, y: box.y + y, id })),
      });
    await touch('touchStart', [[200, 200]]);
    await touch('touchMove', [[210, 206]]);
    await touch('touchMove', [[222, 214]]);
    await touch('touchStart', [[222, 214], [300, 300]]);
    await touch('touchMove', [[200, 190], [330, 330]]);
    await touch('touchMove', [[180, 170], [360, 360]]);
    await touch('touchEnd', []);
    await page.waitForTimeout(200);
    await expect(annotations(page)).toHaveCount(0);
  });
});
