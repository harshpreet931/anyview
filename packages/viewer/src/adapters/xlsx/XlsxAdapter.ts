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
import { ViewerError } from '../../core/errors';

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
    search: false,
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

export class XlsxAdapter implements Adapter {
  readonly manifest = xlsxManifest;
  private sheetHtmls: string[] = [];
  private sheetNames: string[] = [];
  private sheetTexts: string[] = [];

  async parse(
    source: FileSourceReader,
    signal: AbortSignal,
  ): Promise<DocumentModel> {
    const buffer = await source.arrayBuffer();
    if (signal.aborted) throw new Error('Parse cancelled');

    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'array' });

      this.sheetNames = workbook.SheetNames;
      this.sheetHtmls = [];
      this.sheetTexts = [];

      for (const name of this.sheetNames) {
        const sheet = workbook.Sheets[name];
        const html = XLSX.utils.sheet_to_html(sheet, { id: `sheet-${name}` });
        this.sheetHtmls.push(html);

        const csv = XLSX.utils.sheet_to_csv(sheet);
        this.sheetTexts.push(csv);
      }
    } catch (cause) {
      throw new ViewerError('PARSE_ERROR', 'Failed to parse spreadsheet.', { cause });
    }

    const pages: PageRef[] = this.sheetNames.map((_, i) => ({
      index: i,
      width: 1000,
      height: 800,
      rotation: 0,
    }));

    const outline: OutlineNode[] = this.sheetNames.map((name, i) => ({
      title: name,
      dest: { pageIndex: i },
    }));

    return {
      format: 'xlsx',
      meta: source.meta,
      pageCount: this.sheetNames.length,
      pages,
      outline,
    };
  }

  async renderPage(ctx: RenderContext): Promise<RenderResult> {
    const target = ctx.target as HTMLElement;
    target.innerHTML = '';

    const html = this.sheetHtmls[ctx.page.index];
    if (!html) {
      throw new ViewerError('RENDER_ERROR', `Sheet ${ctx.page.index} not found.`);
    }

    const DOMPurify = (await import('dompurify')).default;
    const sanitizedHtml = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'col',
        'colgroup', 'a', 'span', 'div', 'br', 'b', 'i', 'em', 'strong',
      ],
      ALLOWED_ATTR: ['href', 'colspan', 'rowspan', 'style', 'class', 'id'],
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|#)/i,
    });

    const container = document.createElement('div');
    container.style.padding = '16px';
    container.style.overflow = 'auto';
    container.style.fontSize = `${14 * ctx.scale}px`;
    container.innerHTML = sanitizedHtml;

    const table = container.querySelector('table');
    if (table) {
      (table as HTMLElement).style.borderCollapse = 'collapse';
      (table as HTMLElement).style.width = '100%';
      table.querySelectorAll('td, th').forEach((cell) => {
        (cell as HTMLElement).style.border = '1px solid #ddd';
        (cell as HTMLElement).style.padding = '4px 8px';
        (cell as HTMLElement).style.whiteSpace = 'nowrap';
      });
    }

    target.appendChild(container);

    return {
      width: ctx.page.width * ctx.scale,
      height: container.scrollHeight || ctx.page.height * ctx.scale,
    };
  }

  async getTextLayer(
    pageIndex: number,
    _signal?: AbortSignal,
  ): Promise<TextLayer> {
    const text = this.sheetTexts[pageIndex] ?? '';
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
    this.sheetHtmls = [];
    this.sheetNames = [];
    this.sheetTexts = [];
  }
}
