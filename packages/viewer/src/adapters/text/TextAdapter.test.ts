import { describe, it, expect } from 'vitest';
import { TextAdapter } from './TextAdapter';
import type { FileSourceReader } from '../../core/types';

function reader(text: string): FileSourceReader {
  const buffer = new TextEncoder().encode(text).buffer;
  return {
    meta: { name: 'big.txt', size: buffer.byteLength, mimeType: 'text/plain' },
    arrayBuffer: async () => buffer,
    stream: () => null,
  };
}

describe('TextAdapter', () => {
  it('parses a small file into one page sized to its content', async () => {
    const adapter = new TextAdapter();
    const model = await adapter.parse(
      reader('hello\nworld!!\n'),
      new AbortController().signal,
    );
    expect(model.format).toBe('text');
    expect(model.pageCount).toBe(1);
    expect(model.pages[0]!.width).toBeGreaterThanOrEqual(400);
  });

  it('parses a file with 150k lines without a call-stack RangeError', async () => {
    const adapter = new TextAdapter();
    const text = Array.from({ length: 150_000 }, (_, i) => `line ${i}`).join('\n');
    const model = await adapter.parse(reader(text), new AbortController().signal);
    expect(model.pageCount).toBe(1);
    expect(model.pages[0]!.height).toBeGreaterThan(150_000);
  });
});
