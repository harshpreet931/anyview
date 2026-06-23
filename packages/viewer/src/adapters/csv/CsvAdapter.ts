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
import { ViewerError } from '../../core/errors';

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

export class CsvAdapter implements Adapter {
  readonly manifest = csvManifest;
  private rows: string[][] = [];
  private headers: string[] = [];
  private htmlContent = '';

  async parse(
    source: FileSourceReader,
    signal: AbortSignal,
  ): Promise<DocumentModel> {
    const buffer = await source.arrayBuffer();
    if (signal.aborted) throw new Error('Parse cancelled');

    const text = new TextDecoder('utf-8').decode(buffer);
    const delimiter = source.meta.name.endsWith('.tsv') ? '\t' : ',';

    try {
      const Papa = (await import('papaparse')).default;
      const result = Papa.parse<string[]>(text, {
        delimiter,
        skipEmptyLines: true,
      });

      this.rows = result.data;
      this.headers = this.rows.shift() ?? [];
      this.htmlContent = this.buildHtml();
    } catch (cause) {
      throw new ViewerError('PARSE_ERROR', 'Failed to parse CSV.', { cause });
    }

    const rowHeight = 32;
    const height = Math.max((this.rows.length + 1) * rowHeight + 48, 400);

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
    const target = ctx.target as HTMLElement;
    target.innerHTML = '';

    const container = document.createElement('div');
    container.style.padding = '16px';
    container.style.overflow = 'auto';
    container.style.fontSize = `${14 * ctx.scale}px`;
    container.innerHTML = this.htmlContent;

    target.appendChild(container);

    return {
      width: ctx.page.width * ctx.scale,
      height: container.scrollHeight || ctx.page.height * ctx.scale,
    };
  }

  async getTextLayer(
    _pageIndex: number,
    _signal?: AbortSignal,
  ): Promise<TextLayer> {
    const items: TextLayerItem[] = [];
    const rowHeight = 20;

    if (this.headers.length > 0) {
      items.push({
        str: this.headers.join('\t'),
        x: 0,
        y: 0,
        width: this.headers.join('\t').length * 8,
        height: rowHeight,
      });
    }

    this.rows.forEach((row, i) => {
      items.push({
        str: row.join('\t'),
        x: 0,
        y: (i + 1) * rowHeight,
        width: row.join('\t').length * 8,
        height: rowHeight,
      });
    });

    return { pageIndex: 0, items };
  }

  async search(
    query: SearchQuery,
    _signal: AbortSignal,
  ): Promise<SearchResult> {
    const matches: SearchMatch[] = [];
    const rowHeight = 20;

    const allRows = [this.headers, ...this.rows];
    for (let rowIdx = 0; rowIdx < allRows.length; rowIdx++) {
      for (let colIdx = 0; colIdx < allRows[rowIdx].length; colIdx++) {
        const cell = allRows[rowIdx][colIdx];
        if (this.matchText(cell, query)) {
          matches.push({
            pageIndex: 0,
            text: cell,
            x: colIdx / Math.max(allRows[rowIdx].length, 1),
            y: rowIdx / Math.max(allRows.length, 1),
            width: cell.length * 8 / 1000,
            height: rowHeight / 1000,
          });
        }
      }
    }

    return { query, matches, totalMatches: matches.length };
  }

  private matchText(text: string, query: SearchQuery): boolean {
    if (query.caseSensitive) {
      return text.includes(query.text);
    }
    return text.toLowerCase().includes(query.text.toLowerCase());
  }

  private buildHtml(): string {
    const escapeHtml = (s: string) => {
      const div = document.createElement('div');
      div.textContent = s;
      return div.innerHTML;
    };

    let html = '<table style="border-collapse:collapse;width:100%;font-family:monospace;">';

    if (this.headers.length > 0) {
      html += '<thead><tr>';
      for (const h of this.headers) {
        html += `<th style="border:1px solid #ddd;padding:6px 10px;text-align:left;background:#f5f5f5;font-weight:600;">${escapeHtml(h)}</th>`;
      }
      html += '</tr></thead>';
    }

    html += '<tbody>';
    for (const row of this.rows) {
      html += '<tr>';
      for (const cell of row) {
        html += `<td style="border:1px solid #ddd;padding:4px 10px;">${escapeHtml(cell)}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table>';

    return html;
  }

  dispose(): void {
    this.rows = [];
    this.headers = [];
    this.htmlContent = '';
  }
}
