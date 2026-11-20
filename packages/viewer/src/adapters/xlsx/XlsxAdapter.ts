import type {
  Adapter,
  AdapterManifest,
  DocumentModel,
  FileSourceReader,
  OutlineNode,
  PageRef,
  RenderContext,
  RenderResult,
  SearchMatch,
  SearchQuery,
  SearchResult,
  TextLayer,
  TextLayerItem,
} from '../../core/types';
import { ViewerError, asParseError, throwIfCancelled } from '../../core/errors';
import { loadParser } from '../../core/load-parser';
import { loadSanitizer, type Sanitizer } from '../../core/sanitizer';
import { markSanitized, setSafeHtml, type SafeHtml } from '../../core/safe-html';
import { searchUnits, type SearchUnit } from '../../core/search-units';

export const xlsxManifest: AdapterManifest = {
  id: 'xlsx',
  label: 'Spreadsheet',
  extensions: ['xlsx', 'xls'],
  mimeTypes: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ],
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M3 1h10v14H3V1zm2 2v2h2V3H5zm3 0v2h2V3H8zm3 0v2h1V3h-1zM5 6v2h2V6H5zm3 0v2h2V6H8zm3 0v2h1V6h-1zM5 9v2h2V9H5zm3 0v2h2V9H8zm3 0v2h1V9h-1zM5 12v2h2v-2H5zm3 0v2h2v-2H8zm3 0v2h1v-2h-1z"/></svg>`,
  features: {
    search: true,
    annotations: false,
    textSelection: true,
    print: false,
    thumbnails: false,
    outline: true,
    zoom: true,
    rotation: false,
    attachments: false,
    fullscreen: true,
    download: true,
  },
  priority: 100,
  protocolVersion: 1,
};

const SHEET_ROW_LIMIT = 5000;

interface Sheet {
  name: string;
  html: SafeHtml;
  /** Every row of the sheet as displayed text, starting at sheet row `firstRow`, column `firstCol`. */
  rows: string[][];
  firstRow: number;
  firstCol: number;
}

export class XlsxAdapter implements Adapter {
  readonly manifest = xlsxManifest;
  private sheets: Sheet[] = [];

  async parse(
    source: FileSourceReader,
    signal: AbortSignal,
  ): Promise<DocumentModel> {
    const buffer = await source.arrayBuffer();
    throwIfCancelled(signal);

    try {
      const XLSX = await loadParser('xlsx', () => import('xlsx'));
      const workbook = XLSX.read(buffer, { type: 'array' });
      const DOMPurify = await loadSanitizer();

      this.sheets = [];

      for (const name of workbook.SheetNames) {
        const sheet = workbook.Sheets[name];
        if (!sheet?.['!ref']) {
          this.sheets.push({ name, html: markSanitized('<table></table>'), rows: [], firstRow: 0, firstCol: 0 });
          continue;
        }
        const range = XLSX.utils.decode_range(sheet['!ref']);
        const shown = range.e.r - range.s.r + 1 > SHEET_ROW_LIMIT
          ? {
              ...sheet,
              '!ref': XLSX.utils.encode_range({
                s: range.s,
                e: { r: range.s.r + SHEET_ROW_LIMIT - 1, c: range.e.c },
              }),
            }
          : sheet;
        this.sheets.push({
          name,
          html: buildSheetHtml(XLSX.utils.sheet_to_html(shown, { id: `sheet-${name}` }), DOMPurify),
          rows: XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '', blankrows: true }),
          firstRow: range.s.r,
          firstCol: range.s.c,
        });
      }
    } catch (cause) {
      throw asParseError(cause, 'Failed to parse spreadsheet.');
    }

    const pages: PageRef[] = this.sheets.map((_, i) => ({
      index: i,
      width: 1000,
      height: 800,
      rotation: 0,
    }));

    const outline: OutlineNode[] = this.sheets.map(({ name }, i) => ({
      title: name,
      dest: { pageIndex: i },
    }));

    return {
      format: 'xlsx',
      meta: source.meta,
      pageCount: this.sheets.length,
      pages,
      outline,
    };
  }

  async renderPage(ctx: RenderContext): Promise<RenderResult> {
    ctx.target.replaceChildren();

    const sheet = this.sheets[ctx.page.index];
    if (!sheet) {
      throw new ViewerError('RENDER_ERROR', `Sheet ${ctx.page.index} not found.`);
    }

    const container = document.createElement('div');
    container.style.padding = '16px';
    container.style.overflow = 'auto';
    container.style.fontSize = `${14 * ctx.scale}px`;
    setSafeHtml(container, sheet.html);
    if (sheet.rows.length > SHEET_ROW_LIMIT) {
      const note = document.createElement('p');
      note.className = 'dv-sheet-truncated';
      container.appendChild(note);
      showTruncation(note, SHEET_ROW_LIMIT, sheet.rows.length);
    }

    ctx.target.appendChild(container);

    return {
      width: ctx.page.width * ctx.scale,
      height: container.scrollHeight || ctx.page.height * ctx.scale,
    };
  }

  async getTextLayer(
    pageIndex: number,
    _signal?: AbortSignal,
  ): Promise<TextLayer> {
    const rows = this.sheets[pageIndex]?.rows ?? [];
    const items: TextLayerItem[] = rows.map((row, i) => {
      const line = row.join(',');
      return { str: line, x: 0, y: i * 20, width: line.length * 8, height: 20 };
    });

    return { pageIndex, items };
  }

  async search(query: SearchQuery, signal: AbortSignal): Promise<SearchResult> {
    return searchUnits(this.units(), query, signal);
  }

  /** A unit is a sheet row and a cell its column, both counted from A1 as the rendered cells' ids give them. */
  private *units(): Generator<SearchUnit> {
    for (let pageIndex = 0; pageIndex < this.sheets.length; pageIndex++) {
      const { rows, firstRow, firstCol } = this.sheets[pageIndex]!;
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r]!;
        for (let c = 0; c < row.length; c++) {
          if (row[c]) yield { pageIndex, unit: firstRow + r, cell: firstCol + c, text: row[c]! };
        }
      }
    }
  }

  /** Rows past the render cap are added as plain cells, up to and including the match's row. */
  revealMatch(match: SearchMatch, target: HTMLElement): void {
    const sheet = this.sheets[match.pageIndex];
    const body = target.querySelector('tbody');
    const rows = body?.rows;
    if (!sheet || !match.locator || !body || !rows) return;
    const last = rows[rows.length - 1]?.getAttribute('data-dv-unit');
    const from = last == null ? 0 : Number(last) - sheet.firstRow + 1;
    const to = Math.min(sheet.rows.length, match.locator.unit - sheet.firstRow + 1);
    if (to <= from) return;
    const frag = document.createDocumentFragment();
    for (let r = from; r < to; r++) {
      const tr = document.createElement('tr');
      tr.dataset.dvUnit = String(sheet.firstRow + r);
      sheet.rows[r]!.forEach((text, c) => {
        const td = document.createElement('td');
        td.textContent = text;
        td.dataset.dvCell = String(sheet.firstCol + c);
        styleCell(td);
        tr.appendChild(td);
      });
      frag.appendChild(tr);
    }
    body.appendChild(frag);
    const note = target.querySelector('.dv-sheet-truncated');
    if (note) showTruncation(note, to, sheet.rows.length);
  }

  dispose(): void {
    this.sheets = [];
  }
}

function showTruncation(note: Element, shown: number, total: number): void {
  note.textContent = shown < total ? `Showing the first ${shown.toLocaleString()} of ${total.toLocaleString()} rows.` : '';
}

function styleCell(cell: HTMLElement): void {
  cell.style.border = '1px solid #ddd';
  cell.style.padding = '4px 8px';
  cell.style.whiteSpace = 'nowrap';
}

const CELL_REF = /-([A-Z]+)(\d+)$/;

function buildSheetHtml(
  rawHtml: string,
  DOMPurify: Sanitizer,
): SafeHtml {
  const sanitized = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'col',
      'colgroup', 'a', 'span', 'div', 'br', 'b', 'i', 'em', 'strong',
    ],
    ALLOWED_ATTR: ['href', 'colspan', 'rowspan', 'style', 'class', 'id'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|#)/i,
    SANITIZE_NAMED_PROPS: true,
  });

  const doc = new DOMParser().parseFromString(sanitized, 'text/html');
  const table = doc.querySelector('table');
  if (table) {
    table.style.borderCollapse = 'collapse';
    table.style.width = '100%';
    table.querySelectorAll<HTMLElement>('td, th').forEach((cell) => {
      styleCell(cell);
      const ref = CELL_REF.exec(cell.id);
      if (!ref) return;
      let col = 0;
      for (const ch of ref[1]!) col = col * 26 + ch.charCodeAt(0) - 64;
      cell.dataset.dvCell = String(col - 1);
      cell.parentElement!.dataset.dvUnit = String(Number(ref[2]) - 1);
    });
  }
  return markSanitized(doc.body.innerHTML);
}
