import { describe, it, expect } from 'vitest';
import { TextAdapter } from './TextAdapter';
import { textReader } from '../test-reader';

describe('TextAdapter', () => {
  it('parses a small file into one page sized to its content', async () => {
    const adapter = new TextAdapter();
    const model = await adapter.parse(
      textReader('hello\nworld!!\n', 'big.txt', 'text/plain'),
      new AbortController().signal,
    );
    expect(model.format).toBe('text');
    expect(model.pageCount).toBe(1);
    expect(model.pages[0]!.width).toBeGreaterThanOrEqual(400);
  });

  it('parses a file with 150k lines without a call-stack RangeError', async () => {
    const adapter = new TextAdapter();
    const text = Array.from({ length: 150_000 }, (_, i) => `line ${i}`).join('\n');
    const model = await adapter.parse(textReader(text, 'big.txt', 'text/plain'), new AbortController().signal);
    expect(model.pageCount).toBe(1);
    expect(model.pages[0]!.height).toBeGreaterThan(150_000);
  });
});
