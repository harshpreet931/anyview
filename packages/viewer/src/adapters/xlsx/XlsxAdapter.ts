import type {
  Adapter,
  AdapterManifest,
  DocumentModel,
  FileSourceReader,
  OutlineNode,
  PageRef,
  RenderContext,
  RenderResult,
  TextLayer,
  TextLayerItem,
} from '../../core/types';
import { ViewerError, asParseError, throwIfCancelled } from '../../core/errors';
import { loadParser } from '../../core/load-parser';
import { loadSanitizer, type Sanitizer } from '../../core/sanitizer';
import { markSanitized, setSafeHtml, type SafeHtml } from '../../core/safe-html';

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
  text: string;
  totalRows: number | null;
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
        const hasCells = !!sheet?.['!ref'];
        let shown = sheet;
        let totalRows: number | null = null;
        if (hasCells) {
          const range = XLSX.utils.decode_range(sheet['!ref']!);
          const rows = range.e.r - range.s.r + 1;
          if (rows > SHEET_ROW_LIMIT) {
            totalRows = rows;
            shown = {
              ...sheet,
              '!ref': XLSX.utils.encode_range({
                s: range.s,
                e: { r: range.s.r + SHEET_ROW_LIMIT - 1, c: range.e.c },
              }),
            };
          }
        }
        const html = hasCells
          ? XLSX.utils.sheet_to_html(shown, { id: `sheet-${name}` })
          : '<table></table>';
        this.sheets.push({
          name,
          html: buildSheetHtml(html, DOMPurify),
          text: hasCells ? XLSX.utils.sheet_to_csv(sheet) : '',
          totalRows,
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
    if (sheet.totalRows) {
      const note = document.createElement('p');
      note.className = 'dv-sheet-truncated';
      note.textContent = `Showing the first ${SHEET_ROW_LIMIT.toLocaleString()} of ${sheet.totalRows.toLocaleString()} rows.`;
      container.appendChild(note);
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
    const text = this.sheets[pageIndex]?.text ?? '';
    const items: TextLayerItem[] = text
      .split('\n')
      .map((line, i) => ({
        str: line,
        x: 0,
        y: i * 20,
        width: line.length * 8,
        height: 20,
      }));

    return { pageIndex, items };
  }

  dispose(): void {
    this.sheets = [];
  }
}

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
      cell.style.border = '1px solid #ddd';
      cell.style.padding = '4px 8px';
      cell.style.whiteSpace = 'nowrap';
    });
  }
  return markSanitized(doc.body.innerHTML);
}
