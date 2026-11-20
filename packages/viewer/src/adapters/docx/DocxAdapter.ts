import type {
  Adapter,
  AdapterManifest,
  DocumentModel,
  FileSourceReader,
  OutlineNode,
  PageRef,
  RenderContext,
  RenderResult,
  SearchQuery,
  SearchResult,
  TextLayer,
  TextLayerItem,
} from '../../core/types';
import { asParseError, throwIfCancelled } from '../../core/errors';
import { loadParser } from '../../core/load-parser';
import { loadSanitizer } from '../../core/sanitizer';
import { EMPTY_HTML, markSanitized, type SafeHtml } from '../../core/safe-html';
import { assertTransformSize } from '../../core/limits';
import { headingScrollOffsets } from '../../core/reflow-outline';
import { renderReflowPage } from '../../core/reflow-page';
import { blockTexts, markBlockUnits, searchUnits } from '../../core/search-units';

export const docxManifest: AdapterManifest = {
  id: 'docx',
  label: 'Word Document',
  extensions: ['docx'],
  mimeTypes: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M3 1h7l4 4v10H3V1zm7 0v4h4l-4-4zM5 7v1h6V7H5zm0 3v1h6v-1H5zm0 3v1h6v-1H5z"/></svg>`,
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

const CHARS_PER_LINE = 80;
const LINE_HEIGHT = 24;
const CHAR_WIDTH = 8;

export class DocxAdapter implements Adapter {
  readonly manifest = docxManifest;
  private htmlContent: SafeHtml = EMPTY_HTML;
  private textContent = '';
  private blocks: string[] | null = null;

  async parse(
    source: FileSourceReader,
    signal: AbortSignal,
  ): Promise<DocumentModel> {
    const buffer = await source.arrayBuffer();
    throwIfCancelled(signal);
    assertTransformSize(buffer.byteLength);

    try {
      const mammoth = await loadParser('mammoth', () => import('mammoth'));
      const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
      const DOMPurify = await loadSanitizer();
      this.htmlContent = markSanitized(DOMPurify.sanitize(result.value, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'a', 'ul', 'ol',
          'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead',
          'tbody', 'tr', 'td', 'th', 'img', 'blockquote', 'pre', 'code',
          'span', 'div', 'hr', 'sub', 'sup', 'dl', 'dt', 'dd',
        ],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'colspan', 'rowspan', 'style', 'class', 'id', 'width', 'height'],
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data:image):|#)/i,
        SANITIZE_NAMED_PROPS: true,
      }));
      this.blocks = null;
    } catch (cause) {
      throw asParseError(cause, 'Failed to parse DOCX.');
    }

    const doc = new DOMParser().parseFromString(this.htmlContent, 'text/html');
    this.textContent = doc.body.textContent ?? '';

    const estimatedHeight = Math.ceil(this.textContent.length / CHARS_PER_LINE) * LINE_HEIGHT + 200;

    const page: PageRef = {
      index: 0,
      width: 800,
      height: Math.max(estimatedHeight, 400),
      rotation: 0,
    };

    const outline = extractOutline(doc);

    return {
      format: 'docx',
      meta: source.meta,
      pageCount: 1,
      pages: [page],
      ...(outline ? { outline } : {}),
    };
  }

  async renderPage(ctx: RenderContext): Promise<RenderResult> {
    const result = renderReflowPage(ctx, this.htmlContent, { className: 'dv-docx-content', padding: '48px 24px' });
    const container = ctx.target.firstElementChild!;
    markBlockUnits(container);
    container.querySelectorAll('table').forEach((table) => {
      table.style.borderCollapse = 'collapse';
      table.querySelectorAll<HTMLElement>('td, th').forEach((cell) => {
        cell.style.border = '1px solid #ddd';
        cell.style.padding = '4px 8px';
      });
    });
    return { ...result, height: container.scrollHeight || result.height };
  }

  async getTextLayer(
    _pageIndex: number,
    _signal?: AbortSignal,
  ): Promise<TextLayer> {
    const items: TextLayerItem[] = this.textContent
      .split('\n')
      .filter((l) => l.trim())
      .map((line, i) => ({
        str: line,
        x: 0,
        y: i * LINE_HEIGHT,
        width: line.length * CHAR_WIDTH,
        height: LINE_HEIGHT,
      }));

    return { pageIndex: 0, items };
  }

  async search(query: SearchQuery, signal: AbortSignal): Promise<SearchResult> {
    this.blocks ??= blockTexts(this.htmlContent);
    return searchUnits(this.blocks.map((text, unit) => ({ pageIndex: 0, unit, text })), query, signal);
  }

  dispose(): void {
    this.htmlContent = EMPTY_HTML;
    this.textContent = '';
    this.blocks = null;
  }
}

function extractOutline(doc: Document): OutlineNode[] | undefined {
  const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  if (headings.length === 0) return undefined;

  const offsets = headingScrollOffsets(doc, headings);
  return headings.map((h, i) => ({
    title: h.textContent ?? '',
    dest: { pageIndex: 0, scrollOffset: offsets[i]! },
  }));
}
