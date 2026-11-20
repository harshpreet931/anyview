import { afterEach, describe, it, expect, vi } from 'vitest';
import { CodeAdapter } from './CodeAdapter';
import { textReader } from '../test-reader';
import { testViewer, type TestViewer } from '../../core/rows/test-viewer';

async function render(adapter: CodeAdapter, model: Awaited<ReturnType<CodeAdapter['parse']>>, target = document.createElement('div')) {
  await adapter.renderPage({
    page: model.pages[0]!,
    target,
    scale: 1,
    rotation: 0,
    devicePixelRatio: 1,
    signal: new AbortController().signal,
  });
  return target;
}

describe('CodeAdapter large files', () => {
  let viewer: TestViewer;
  afterEach(() => viewer?.dispose());

  it('highlights a very large file only where it is shown', async () => {
    const line = 'export const value: number = 42; // filler comment to make lines long\n';
    const text = line.repeat(Math.ceil(2_000_000 / line.length));
    const adapter = new CodeAdapter();
    const t0 = performance.now();
    const model = await adapter.parse(textReader(text, 'huge.ts'), new AbortController().signal);
    viewer = testViewer(600);
    const target = document.createElement('div');
    viewer.container.appendChild(target);
    await render(adapter, model, target);
    expect(performance.now() - t0).toBeLessThan(1500);
    expect(target.querySelector('.shiki')).not.toBeNull();
    expect(target.querySelectorAll('.dv-line').length).toBeLessThan(60);
    expect(target.querySelectorAll('[data-dv-unit="0"] span[style]').length).toBeGreaterThan(3);
    expect(target.textContent).toContain('export const value');
  });

  it('colours lines far into a big file at once, before the lines above them are done', async () => {
    const code = Array.from({ length: 40_000 }, (_, i) => `export const value${i}: number = ${i}; // line ${i}`).join('\n');
    const adapter = new CodeAdapter();
    const model = await adapter.parse(textReader(code, 'big.ts'), new AbortController().signal);
    viewer = testViewer(600);
    const target = document.createElement('div');
    viewer.container.appendChild(target);
    await render(adapter, model, target);
    const [match] = (await adapter.search({ text: 'value38000:', caseSensitive: true, wholeWord: false, regex: false, diacritics: false }, new AbortController().signal)).matches;
    await adapter.revealMatch(match!, target);
    await vi.waitFor(() => expect(target.querySelectorAll('[data-dv-unit="38000"] span[style]').length).toBeGreaterThan(3), { timeout: 2_000 });
  });

  it('highlights a line far down with the grammar state its earlier lines leave', async () => {
    const code = ['/*', ...Array.from({ length: 3_000 }, (_, i) => `still a comment ${i}`), '*/', 'const after = 1;'].join('\n');
    const adapter = new CodeAdapter();
    const model = await adapter.parse(textReader(code, 'long-comment.ts'), new AbortController().signal);
    viewer = testViewer(600);
    const target = document.createElement('div');
    viewer.container.appendChild(target);
    await render(adapter, model, target);
    const [match] = (await adapter.search({ text: 'still a comment 2500', caseSensitive: true, wholeWord: false, regex: false, diacritics: false }, new AbortController().signal)).matches;
    expect(match!.locator).toEqual({ unit: 2501, start: 0, end: 20 });
    await adapter.revealMatch(match!, target);
    const line = () => target.querySelector('[data-dv-unit="2501"]');
    expect(line()?.textContent).toBe('still a comment 2500');
    await vi.waitFor(() => expect(line()?.querySelector('span[style]')?.getAttribute('style')?.toLowerCase()).toContain('#756a5e'), { timeout: 4_000 });
  });
});

function coolColours(html: string): string[] {
  return [...html.matchAll(/#([0-9a-f]{6})\b/gi)]
    .map((m) => m[1]!)
    .filter((hex) => {
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const d = max - min;
      if (d < 0.08) return false;
      const hue = max === r ? 60 * (((g - b) / d + 6) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
      return hue >= 180 && hue <= 330;
    });
}

describe('CodeAdapter highlighting', () => {
  it('uses an on-brand theme with no blue or purple tokens', async () => {
    const src = [
      "import { readFile } from 'node:fs/promises';",
      'export class Store<T extends object> {',
      '  private items = new Map<string, T>();',
      '  async load(path: string): Promise<number> {',
      "    const raw = JSON.parse(await readFile(path, 'utf8')) as T[];",
      '    return raw.length * 2 + /x+/g.lastIndex; // count',
      '  }',
      '}',
    ].join('\n');
    const adapter = new CodeAdapter();
    const model = await adapter.parse(textReader(src, 'store.ts'), new AbortController().signal);
    const target = await render(adapter, model);
    expect(target.querySelector('.shiki')).not.toBeNull();
    expect(target.querySelectorAll('.shiki span[style]').length).toBeGreaterThan(10);
    expect(coolColours(target.innerHTML)).toEqual([]);
  });
});
