import { describe, it, expect, vi } from 'vitest';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import type { Adapter, FileSourceReader, SearchQuery } from '../core/types';
import { locateMatch } from '../core/search-units';
import { textReader } from './test-reader';
import { CsvAdapter } from './csv/CsvAdapter';
import { XlsxAdapter } from './xlsx/XlsxAdapter';
import { PptxAdapter } from './pptx/PptxAdapter';
import { TextAdapter } from './text/TextAdapter';
import { CodeAdapter } from './code/CodeAdapter';
import { MarkdownAdapter } from './markdown/MarkdownAdapter';
import { HtmlAdapter } from './html/HtmlAdapter';
import { DocxAdapter } from './docx/DocxAdapter';
import { IpynbAdapter } from './ipynb/IpynbAdapter';

vi.mock('mammoth', () => ({
  convertToHtml: async () => ({
    value: '<h1>Plan apple</h1><p>one apple, two <b>apple</b>s</p><table><tr><td>apple</td><td>pear</td></tr></table>',
    messages: [],
  }),
}));

const query = (text: string): SearchQuery => ({ text, caseSensitive: false, wholeWord: false, regex: false, diacritics: false });

function bytesReader(bytes: ArrayBuffer, name: string): FileSourceReader {
  return { meta: { name, size: bytes.byteLength, mimeType: '' }, arrayBuffer: async () => bytes, stream: () => null };
}

function xlsxReader(): FileSourceReader {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['fruit'], ['apple'], ['an apple']]), 'One');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['apple pie', 'apple']]), 'Two');
  return bytesReader(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer, 'book.xlsx');
}

async function pptxReader(): Promise<FileSourceReader> {
  const zip = new JSZip();
  const slide = (texts: string[]) =>
    `<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody>${texts
      .map((t) => `<a:p><a:r><a:t>${t}</a:t></a:r></a:p>`)
      .join('')}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
  zip.file('ppt/slides/slide1.xml', slide(['Apple deck', 'no fruit here']));
  zip.file('ppt/slides/slide2.xml', slide(['Second', 'apple and apple']));
  return bytesReader(await zip.generateAsync({ type: 'arraybuffer' }), 'deck.pptx');
}

const notebook = JSON.stringify({
  cells: [
    { cell_type: 'markdown', source: ['# Apple notes\n', '\n', 'an apple a day'] },
    { cell_type: 'code', source: ['print("apple")'], outputs: [{ output_type: 'stream', name: 'stdout', text: ['apple\n'] }] },
  ],
  metadata: { language_info: { name: 'python' } },
  nbformat: 4,
});

const cases: Array<[string, () => Adapter, () => FileSourceReader | Promise<FileSourceReader>]> = [
  ['csv', () => new CsvAdapter(), () => textReader('name,fruit\nann,apple\nbob,"apple, pear"\n', 'f.csv', 'text/csv')],
  ['xlsx', () => new XlsxAdapter(), xlsxReader],
  ['pptx', () => new PptxAdapter(), pptxReader],
  ['text', () => new TextAdapter(), () => textReader('first apple\nnone\n\tapple apple\n', 'f.log', 'text/plain')],
  ['code', () => new CodeAdapter(), () => textReader('const apple = 1;\n// apple\n\tapple();\n', 'f.js')],
  ['markdown', () => new MarkdownAdapter(), () => textReader('# Apple\n\nan *apple* a day\n\n| a | b |\n|---|---|\n| apple | pear |\n', 'f.md', 'text/markdown')],
  ['html', () => new HtmlAdapter(), () => textReader('<h1>Apple</h1><div><p>an apple</p><ul><li>apple</li></ul></div>', 'f.html', 'text/html')],
  ['docx', () => new DocxAdapter(), () => bytesReader(new ArrayBuffer(8), 'f.docx')],
  ['ipynb', () => new IpynbAdapter(), () => textReader(notebook, 'f.ipynb', 'application/x-ipynb+json')],
];

describe('model search on flowing and tabular formats', () => {
  it.each(cases)('%s: every match is located in the rendered page', async (_format, make, source) => {
    const adapter = make();
    const model = await adapter.parse(await source(), new AbortController().signal);
    const result = await adapter.search!(query('apple'), new AbortController().signal);
    expect(result.matches.length).toBeGreaterThan(1);

    for (const page of model.pages) {
      const target = document.createElement('div');
      await adapter.renderPage({
        page,
        target,
        scale: 1,
        rotation: 0,
        devicePixelRatio: 1,
        signal: new AbortController().signal,
      });
      for (const match of result.matches.filter((m) => m.pageIndex === page.index)) {
        const found = locateMatch(target, match);
        expect(found, `${match.text} at ${JSON.stringify(match.locator)}`).toBeInstanceOf(Range);
        expect((found as Range).toString().toLowerCase()).toBe('apple');
      }
    }
  });
});
