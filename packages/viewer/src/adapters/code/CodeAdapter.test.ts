import { describe, it, expect } from 'vitest';
import { CodeAdapter } from './CodeAdapter';
import type { FileSourceReader } from '../../core/types';

function reader(text: string, name: string): FileSourceReader {
  const buffer = new TextEncoder().encode(text).buffer;
  return { meta: { name, size: buffer.byteLength, mimeType: '' }, arrayBuffer: async () => buffer, stream: () => null };
}

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
    const model = await adapter.parse(reader(text, 'huge.ts'), new AbortController().signal);
    expect(performance.now() - t0).toBeLessThan(1500);
    const target = await render(adapter, model);
    expect(target.querySelector('.shiki')).toBeNull();
    expect(target.textContent).toContain('export const value');
  });
});
