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
  SearchMatch,
  TextLayer,
  TextLayerItem,
} from '../../core/types';
import { ViewerError, isViewerError } from '../../core/errors';
import { loadParser } from '../../core/load-parser';
import { loadSanitizer } from '../../core/sanitizer';
import { assertTransformSize } from '../../core/limits';

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

export class DocxAdapter implements Adapter {
  readonly manifest = docxManifest;
  private htmlContent = '';
  private textContent = '';

  async parse(
    source: FileSourceReader,
    signal: AbortSignal,
  ): Promise<DocumentModel> {
    const buffer = await source.arrayBuffer();
    if (signal.aborted) throw new Error('Parse cancelled');
    assertTransformSize(buffer.byteLength);

    try {
      const mammoth = await loadParser('mammoth', () => import('mammoth'));
      const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
      const DOMPurify = await loadSanitizer();
      this.htmlContent = DOMPurify.sanitize(result.value, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'a', 'ul', 'ol',
          'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead',
          'tbody', 'tr', 'td', 'th', 'img', 'blockquote', 'pre', 'code',
          'span', 'div', 'hr', 'sub', 'sup', 'dl', 'dt', 'dd',
        ],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'colspan', 'rowspan', 'style', 'class', 'id', 'width', 'height'],
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data:image):|#)/i,
      });
    } catch (cause) {
      if (isViewerError(cause)) throw cause;
      throw new ViewerError('PARSE_ERROR', 'Failed to parse DOCX.', { cause });
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(this.htmlContent, 'text/html');
    this.textContent = doc.body.textContent ?? '';

    const charCount = this.textContent.length;
    const estimatedHeight = Math.ceil(charCount / 80) * 24 + 200;

    const page: PageRef = {
      index: 0,
      width: 800,
      height: Math.max(estimatedHeight, 400),
      rotation: 0,
    };

    const outline = this.extractOutline(doc);

    return {
      format: 'docx',
      meta: source.meta,
      pageCount: 1,
      pages: [page],
      ...(outline ? { outline } : {}),
    };
  }

  async renderPage(ctx: RenderContext): Promise<RenderResult> {
    const target = ctx.target as HTMLElement;
    target.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'dv-docx-content';
    container.style.padding = '48px 24px';
    container.style.maxWidth = '800px';
    container.style.margin = '0 auto';
    container.style.fontSize = `${16 * ctx.scale}px`;
    container.style.lineHeight = '1.6';
    container.style.color = 'var(--dv-page-ink)';
    container.style.background = 'var(--dv-page-bg)';
    container.innerHTML = this.htmlContent;

    const tables = container.querySelectorAll('table');
    tables.forEach((t) => {
      (t as HTMLElement).style.borderCollapse = 'collapse';
      t.querySelectorAll('td, th').forEach((c) => {
        (c as HTMLElement).style.border = '1px solid #ddd';
        (c as HTMLElement).style.padding = '4px 8px';
      });
    });

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
    const items: TextLayerItem[] = this.textContent
      .split('\n')
      .filter((l) => l.trim())
      .map((line, i) => ({
        str: line,
        x: 0,
        y: i * 24,
        width: line.length * 8,
        height: 24,
      }));

    return { pageIndex: 0, items };
  }

  async search(
    query: SearchQuery,
    _signal: AbortSignal,
  ): Promise<SearchResult> {
    const matches: SearchMatch[] = [];
    const text = this.textContent;
    const flags = query.caseSensitive ? 'g' : 'gi';
    const pattern = query.regex ? query.text : escapeRegex(query.text);
    const re = new RegExp(pattern, flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const before = text.slice(0, m.index);
      const line = before.split('\n').length - 1;
      matches.push({
        pageIndex: 0,
        text: m[0],
        x: 0,
        y: line * 24,
        width: m[0].length * 8,
        height: 24,
      });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    return { query, matches, totalMatches: matches.length };
  }

  private extractOutline(doc: Document): OutlineNode[] | undefined {
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (headings.length === 0) return undefined;

    const outline: OutlineNode[] = [];
    headings.forEach((h) => {
      const level = parseInt(h.tagName.charAt(1));
      outline.push({
        title: h.textContent ?? '',
        dest: {
          pageIndex: 0,
          scrollOffset: (h as HTMLElement).offsetTop,
        },
        ...(level < 3 ? { children: [] as OutlineNode[] } : {}),
      });
    });

    return outline;
  }

  dispose(): void {
    this.htmlContent = '';
    this.textContent = '';
  }
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
