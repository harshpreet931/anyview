import { describe, it, expect } from 'vitest';
import { HtmlAdapter } from './HtmlAdapter';
import { textReader } from '../test-reader';

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
    const model = await adapter.parse(textReader(html, 'doc.html', 'text/html'), new AbortController().signal);

    const o = offsets(model.outline);
    expect(o).toHaveLength(3);
    expect(o[0]).toBe(0);
    expect(o[1]).toBeGreaterThan(0);
    expect(o[2]).toBeGreaterThan(o[1]!);
  });
});

describe('HtmlAdapter search', () => {
  it('returns no matches for a regex that does not compile', async () => {
    const adapter = new HtmlAdapter();
    await adapter.parse(textReader('<p>hello (world</p>', 'doc.html', 'text/html'), new AbortController().signal);
    const query = { text: '(unclosed', caseSensitive: false, regex: true, wholeWord: false, diacritics: false };
    const result = await adapter.search(query, new AbortController().signal);
    expect(result).toEqual({ query, matches: [], totalMatches: 0 });
  });
});
