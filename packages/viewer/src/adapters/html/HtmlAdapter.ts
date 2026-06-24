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
import { ViewerError } from '../../core/errors';

export const htmlManifest: AdapterManifest = {
  id: 'html',
  label: 'HTML Document',
  extensions: ['html', 'htm'],
  mimeTypes: ['text/html'],
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l-3 6 3 6h8l3-6-3-6H4zm1 2h6l2 4-2 4H5L3 8l2-4z"/></svg>`,
  features: {
    search: true,
    annotations: false,
    textSelection: true,
    print: true,
    thumbnails: false,
    outline: true,
    zoom: true,
    rotation: false,
    attachments: false,
    fullscreen: true,
    download: true,
  },
  priority: 90,
  protocolVersion: 1,
};

export class HtmlAdapter implements Adapter {
  readonly manifest = htmlManifest;
  private htmlContent = '';
  private textContent = '';

  async parse(
    source: FileSourceReader,
    signal: AbortSignal,
  ): Promise<DocumentModel> {
    const buffer = await source.arrayBuffer();
    if (signal.aborted) throw new Error('Parse cancelled');

    const rawHtml = new TextDecoder('utf-8').decode(buffer);

    try {
      const DOMPurify = (await import('dompurify')).default;
      this.htmlContent = DOMPurify.sanitize(rawHtml, {
        ALLOWED_TAGS: [
          'a', 'abbr', 'address', 'article', 'aside', 'b', 'bdi', 'bdo',
          'blockquote', 'br', 'caption', 'cite', 'code', 'col', 'colgroup',
          'data', 'dd', 'del', 'details', 'dfn', 'div', 'dl', 'dt', 'em',
          'figcaption', 'figure', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5',
          'h6', 'header', 'hr', 'i', 'img', 'ins', 'kbd', 'li', 'main', 'mark',
          'nav', 'ol', 'p', 'pre', 'q', 'rp', 'rt', 'ruby', 's', 'samp',
          'section', 'small', 'span', 'strong', 'sub', 'summary', 'sup',
          'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
          'var', 'wbr',
        ],
        ALLOWED_ATTR: [
          'href', 'src', 'alt', 'title', 'class', 'id', 'style', 'width',
          'height', 'colspan', 'rowspan', 'target', 'rel', 'data-*',
        ],
        ALLOW_DATA_ATTR: true,
      });
    } catch (cause) {
      throw new ViewerError('PARSE_ERROR', 'Failed to sanitize HTML.', { cause });
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
      format: 'html',
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
    container.className = 'dv-html-content';
    container.style.padding = '24px';
    container.style.maxWidth = '800px';
    container.style.margin = '0 auto';
    container.style.fontSize = `${16 * ctx.scale}px`;
    container.style.lineHeight = '1.6';
    container.style.color = 'var(--dv-page-ink)';
    container.style.background = 'var(--dv-page-bg)';
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
      outline.push({
        title: h.textContent ?? '',
        dest: {
          pageIndex: 0,
          scrollOffset: (h as HTMLElement).offsetTop,
        },
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
