import { describe, it, expect } from 'vitest';
import { CodeAdapter } from './CodeAdapter';
import { textReader } from '../test-reader';

async function render(adapter: CodeAdapter, model: Awaited<ReturnType<CodeAdapter['parse']>>) {
  const target = document.createElement('div');
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
  it('shows very large files as plain text instead of highlighting them', async () => {
    const line = 'export const value: number = 42; // filler comment to make lines long\n';
    const text = line.repeat(Math.ceil(400_000 / line.length));
    const adapter = new CodeAdapter();
    const t0 = performance.now();
    const model = await adapter.parse(textReader(text, 'huge.ts'), new AbortController().signal);
    expect(performance.now() - t0).toBeLessThan(1500);
    const target = await render(adapter, model);
    expect(target.querySelector('.shiki')).toBeNull();
    expect(target.textContent).toContain('export const value');
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
