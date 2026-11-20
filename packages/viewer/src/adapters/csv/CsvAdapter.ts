import { decodeText } from '../../core/text-decode';
import type {
  Adapter,
  AdapterManifest,
  DocumentModel,
  FileSourceReader,
  PageRef,
  RenderContext,
  RenderResult,
  TextLayer,
  TextLayerItem,
  SearchQuery,
  SearchResult,
  SearchMatch,
} from '../../core/types';
import { asParseError, throwIfCancelled } from '../../core/errors';
import { loadParser } from '../../core/load-parser';

export const csvManifest: AdapterManifest = {
  id: 'csv',
  label: 'CSV Data',
  extensions: ['csv', 'tsv'],
  mimeTypes: ['text/csv', 'text/tab-separated-values'],
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h12v12H2V2zm1 1v3h3V3H3zm4 0v3h3V3H7zm4 0v3h2V3h-2zM3 7v3h3V7H3zm4 0v3h3V7H7zm4 0v3h2V7h-2zM3 11v2h3v-2H3zm4 0v2h3v-2H7zm4 0v2h2v-2h-2z"/></svg>`,
  features: {
    search: true,
    annotations: false,
    textSelection: true,
    print: true,
    thumbnails: false,
    outline: false,
    zoom: true,
    rotation: false,
    attachments: false,
    fullscreen: true,
    download: true,
  },
  priority: 90,
  protocolVersion: 1,
};

const ROW_CHUNK = 2000;
const TABLE_ROW_HEIGHT = 32;
const TEXT_ROW_HEIGHT = 20;
const CHAR_WIDTH = 8;

export class CsvAdapter implements Adapter {
  readonly manifest = csvManifest;
  private rows: string[][] = [];
  private headers: string[] = [];

  async parse(
    source: FileSourceReader,
    signal: AbortSignal,
  ): Promise<DocumentModel> {
    const buffer = await source.arrayBuffer();
    throwIfCancelled(signal);

    const text = decodeText(buffer, source.meta.mimeType);
    const delimiter = source.meta.name.toLowerCase().endsWith('.tsv') ? '\t' : '';

    try {
      const Papa = (await loadParser('papaparse', () => import('papaparse'))).default;
      const result = Papa.parse<string[]>(text, {
        delimiter,
        skipEmptyLines: true,
      });

      this.rows = result.data;
      this.headers = this.rows.shift() ?? [];
    } catch (cause) {
      throw asParseError(cause, 'Failed to parse CSV.');
    }

    const height = Math.max((Math.min(this.rows.length, ROW_CHUNK) + 2) * TABLE_ROW_HEIGHT + 48, 400);

    const page: PageRef = {
      index: 0,
      width: 1000,
      height,
      rotation: 0,
    };

    return {
      format: 'csv',
      meta: source.meta,
      pageCount: 1,
      pages: [page],
    };
  }

  async renderPage(ctx: RenderContext): Promise<RenderResult> {
    const container = document.createElement('div');
    container.style.padding = '16px';
    container.style.overflow = 'auto';
    container.style.fontSize = `${14 * ctx.scale}px`;

    const table = document.createElement('table');
    table.className = 'dv-csv-table';
    if (this.headers.length > 0) {
      const head = table.createTHead().insertRow();
      for (const h of this.headers) {
        const th = document.createElement('th');
        th.textContent = h;
        head.appendChild(th);
      }
    }
    const body = table.createTBody();
    container.appendChild(table);

    const rows = this.rows;
    let shown = 0;
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'dv-csv-more';
    const appendChunk = () => {
      const end = Math.min(rows.length, shown + ROW_CHUNK);
      const frag = document.createDocumentFragment();
      for (let i = shown; i < end; i++) {
        const tr = document.createElement('tr');
        for (const cell of rows[i]!) {
          const td = document.createElement('td');
          td.textContent = cell;
          tr.appendChild(td);
        }
        frag.appendChild(tr);
      }
      body.appendChild(frag);
      shown = end;
      const left = rows.length - shown;
      if (left > 0) more.textContent = `Show ${Math.min(left, ROW_CHUNK).toLocaleString()} more rows (${left.toLocaleString()} remaining)`;
      else more.remove();
    };
    more.addEventListener('click', appendChunk);
    appendChunk();
    if (shown < rows.length) container.appendChild(more);

    ctx.target.replaceChildren(container);

    return {
      width: ctx.page.width * ctx.scale,
      height: container.scrollHeight || ctx.page.height * ctx.scale,
    };
  }

  async getTextLayer(
    _pageIndex: number,
    _signal?: AbortSignal,
  ): Promise<TextLayer> {
    const line = (row: string[], y: number): TextLayerItem => {
      const str = row.join('\t');
      return { str, x: 0, y, width: str.length * CHAR_WIDTH, height: TEXT_ROW_HEIGHT };
    };
    const items = this.rows.map((row, i) => line(row, (i + 1) * TEXT_ROW_HEIGHT));
    if (this.headers.length > 0) items.unshift(line(this.headers, 0));

    return { pageIndex: 0, items };
  }

  async search(
    query: SearchQuery,
    _signal: AbortSignal,
  ): Promise<SearchResult> {
    const needle = query.caseSensitive ? query.text : query.text.toLowerCase();
    const allRows = [this.headers, ...this.rows];
    const matches: SearchMatch[] = [];
    allRows.forEach((row, rowIdx) => {
      row.forEach((cell, colIdx) => {
        const haystack = query.caseSensitive ? cell : cell.toLowerCase();
        if (!haystack.includes(needle)) return;
        matches.push({
          pageIndex: 0,
          text: cell,
          x: colIdx / row.length,
          y: rowIdx / allRows.length,
          width: cell.length * CHAR_WIDTH / 1000,
          height: TEXT_ROW_HEIGHT / 1000,
        });
      });
    });

    return { query, matches, totalMatches: matches.length };
  }

  dispose(): void {
    this.rows = [];
    this.headers = [];
  }
}
