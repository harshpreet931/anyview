import { describe, it, expect, vi } from 'vitest';
import { DocxAdapter } from './DocxAdapter';
import type { FileSourceReader, SearchQuery } from '../../core/types';

const docHtml = vi.hoisted(() => ({ value: '' }));

vi.mock('mammoth', () => ({
  convertToHtml: async () => ({ value: docHtml.value, messages: [] }),
}));

function docxReader(): FileSourceReader {
  const bytes = new ArrayBuffer(8);
  return {
    meta: { name: 'doc.docx', size: bytes.byteLength, mimeType: '' },
    arrayBuffer: async () => bytes,
    stream: () => null,
  };
}

async function parsed(html: string): Promise<DocxAdapter> {
  docHtml.value = html;
  const adapter = new DocxAdapter();
  await adapter.parse(docxReader(), new AbortController().signal);
  return adapter;
}

function query(text: string, options: Partial<SearchQuery> = {}): SearchQuery {
  return { text, caseSensitive: false, wholeWord: false, regex: false, diacritics: false, ...options };
}

describe('DocxAdapter', () => {
  it('finds plain-text matches', async () => {
    const adapter = await parsed('<p>hello world</p><p>Hello again</p>');
    const result = await adapter.search(query('hello'), new AbortController().signal);
    expect(result.totalMatches).toBe(2);
  });

  it('returns no matches for a regex that does not compile', async () => {
    const adapter = await parsed('<p>hello world</p>');
    const result = await adapter.search(query('(', { regex: true }), new AbortController().signal);
    expect(result).toMatchObject({ matches: [], totalMatches: 0 });
  });

  it('lists every heading in the outline', async () => {
    docHtml.value = '<h1>Intro</h1><p>text</p><h2>Details</h2><h4>Deep</h4>';
    const model = await new DocxAdapter().parse(docxReader(), new AbortController().signal);
    expect(model.outline?.map((n) => n.title)).toEqual(['Intro', 'Details', 'Deep']);
  });

  it('renders tables with collapsed, bordered cells', async () => {
    const adapter = await parsed('<table><tr><td>a</td></tr></table>');
    const target = document.createElement('div');
    await adapter.renderPage({
      page: { index: 0, width: 800, height: 400, rotation: 0 },
      target,
      scale: 1,
      rotation: 0,
      devicePixelRatio: 1,
      signal: new AbortController().signal,
    });
    expect(target.querySelector('.dv-docx-content')).not.toBeNull();
    expect(target.querySelector('table')?.style.borderCollapse).toBe('collapse');
    expect(target.querySelector('td')?.style.padding).toBe('4px 8px');
  });
});
