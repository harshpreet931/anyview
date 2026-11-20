import { expect, type Locator, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

type FilePayload = { name: string; mimeType: string; buffer: Buffer };

export const QUIET_WINDOW_MS = 500;

export const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

export async function openApp(page: Page, path = '/') {
  await page.goto(path);
  await expect(page.locator('.dv-root')).toBeVisible();
}

export const sampleChip = (page: Page, label: string) =>
  page.getByRole('group', { name: 'Sample documents' }).getByRole('button', { name: label, exact: true });

export async function pickSample(page: Page, label: string) {
  await sampleChip(page, label).click();
}

export async function openFile(page: Page, file: string | FilePayload) {
  await openApp(page);
  await page.locator('.pg-upload-btn input[type="file"]').setInputFiles(file);
}

// The live demo sits below the hero; bring it on screen so pointer gestures at
// page-relative coordinates land on the document.
export async function revealViewer(page: Page, block: ScrollLogicalPosition = 'start') {
  await page.locator('.dv-root').first().evaluate((el, block) => el.scrollIntoView({ block, behavior: 'instant' }), block);
}

export async function waitForReflow(page: Page) {
  const target = page.locator('.dv-reflow-target').first();
  await target.waitFor({ state: 'attached' });
  await expect.poll(async () => (await target.innerText()).trim().length, { timeout: 20_000 }).toBeGreaterThan(0);
  return target;
}

export async function waitForCanvas(page: Page) {
  const canvas = page.locator('.dv-page canvas').first();
  await canvas.waitFor({ state: 'attached' });
  await expect.poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.width), { timeout: 20_000 }).toBeGreaterThan(0);
  return canvas;
}

export async function waitForStable(read: () => Promise<unknown>, interval = 150) {
  let last: string | undefined;
  await expect
    .poll(
      async () => {
        const now = JSON.stringify(await read());
        const stable = now !== undefined && now !== 'null' && now === last;
        last = now;
        return stable;
      },
      { intervals: [interval] },
    )
    .toBe(true);
}

export const waitForStableLayout = (target: Locator) => waitForStable(() => target.boundingBox());

export async function settleAnimations(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const oneShot = document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity);
    await Promise.all(oneShot.map((a) => a.finished.catch(() => undefined)));
  });
}

export async function waitForZoom(page: Page, timeout?: number) {
  const content = page.locator('.dv-viewer-container > div').first();
  await expect
    .poll(() =>
      content.evaluate((el) => {
        const s = getComputedStyle(el);
        return s.willChange === 'auto' && s.transform === 'none' && el.getAnimations().length === 0;
      }),
      timeout === undefined ? undefined : { timeout },
    )
    .toBe(true);
  await waitForStableLayout(content);
}
