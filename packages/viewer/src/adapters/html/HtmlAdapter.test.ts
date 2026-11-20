import { describe, it, expect } from 'vitest';
import { HtmlAdapter } from './HtmlAdapter';
import { textReader } from '../test-reader';
import type { PageDestination } from '../../core/types';

describe('HtmlAdapter outline', () => {
  it('lands each heading at its rendered position', async () => {
    const filler = `<p>${'word '.repeat(400)}</p>`;
    const html = `<h1>First</h1>${filler}<div><h2>Second</h2></div>${filler}<h3>Third</h3>`;
    const adapter = new HtmlAdapter();
    const model = await adapter.parse(textReader(html, 'doc.html', 'text/html'), new AbortController().signal);
    const target = document.body.appendChild(document.createElement('div'));
    await adapter.renderPage({
      page: model.pages[0]!,
      target,
      scale: 1,
      rotation: 0,
      devicePixelRatio: 1,
      signal: new AbortController().signal,
    });
    target.querySelectorAll('h1, h2, h3').forEach((h, i) => {
      h.getBoundingClientRect = () => ({ top: [0, 812, 1650][i] }) as DOMRect;
    });
    expect(model.outline?.map((n) => [n.title, (n.dest as PageDestination).scrollOffset])).toEqual([
      ['First', 0],
      ['Second', 812],
      ['Third', 1650],
    ]);
    target.remove();
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
