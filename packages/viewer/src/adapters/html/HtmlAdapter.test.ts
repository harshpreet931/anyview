import { describe, it, expect } from 'vitest';
import { HtmlAdapter } from './HtmlAdapter';
import type { FileSourceReader } from '../../core/types';

function reader(html: string): FileSourceReader {
  const buffer = new TextEncoder().encode(html).buffer;
  return {
    meta: { name: 'doc.html', size: buffer.byteLength, mimeType: 'text/html' },
    arrayBuffer: async () => buffer,
    stream: () => null,
  };
}

function offsets(outline: unknown): number[] {
  return (outline as { dest: { scrollOffset: number } }[]).map(
    (n) => n.dest.scrollOffset,
  );
}

describe('HtmlAdapter outline offsets', () => {
  it('produces non-zero, increasing offsets for later headings', async () => {
    const filler = `<p>${'word '.repeat(400)}</p>`;
    const html = `<h1>First</h1>${filler}<h2>Second</h2>${filler}<h3>Third</h3>`;
    const adapter = new HtmlAdapter();
    const model = await adapter.parse(reader(html), new AbortController().signal);

    const o = offsets(model.outline);
    expect(o).toHaveLength(3);
    expect(o[0]).toBe(0);
    expect(o[1]).toBeGreaterThan(0);
    expect(o[2]).toBeGreaterThan(o[1]!);
  });
});
