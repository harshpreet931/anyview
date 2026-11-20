import { decodeText } from '../../core/text-decode';
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
} from '../../core/types';
import { ViewerError, throwIfCancelled } from '../../core/errors';
import { loadSanitizer, DOCUMENT_HTML_CONFIG } from '../../core/sanitizer';
import { EMPTY_HTML, markSanitized, type SafeHtml } from '../../core/safe-html';
import { assertTransformSize } from '../../core/limits';
import { headingScrollOffsets } from '../../core/reflow-outline';
import { renderReflowPage } from '../../core/reflow-page';
import { searchPattern } from '../../core/search-pattern';
import { lineTextLayer } from '../../core/line-text-layer';
import { estimatedReflowHeight } from '../../core/reflow-height';

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
  private htmlContent: SafeHtml = EMPTY_HTML;
  private textContent = '';

  async parse(
    source: FileSourceReader,
    signal: AbortSignal,
  ): Promise<DocumentModel> {
    const buffer = await source.arrayBuffer();
    throwIfCancelled(signal);
    assertTransformSize(buffer.byteLength);

    const rawHtml = decodeText(buffer, source.meta.mimeType);

    try {
      const DOMPurify = await loadSanitizer();
      this.htmlContent = markSanitized(DOMPurify.sanitize(rawHtml, DOCUMENT_HTML_CONFIG));
    } catch (cause) {
      throw new ViewerError('PARSE_ERROR', 'Failed to sanitize HTML.', { cause });
    }

    const doc = new DOMParser().parseFromString(this.htmlContent, 'text/html');
    this.textContent = doc.body.textContent ?? '';

    const page: PageRef = {
      index: 0,
      width: 800,
      height: estimatedReflowHeight(this.textContent.length),
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
    return renderReflowPage(ctx, this.htmlContent, { className: 'dv-html-content' });
  }

  async getTextLayer(
    _pageIndex: number,
    _signal?: AbortSignal,
  ): Promise<TextLayer> {
    const lines = this.textContent.split('\n').filter((line) => line.trim());
    return lineTextLayer(lines, 24);
  }

  async search(
    query: SearchQuery,
    _signal: AbortSignal,
  ): Promise<SearchResult> {
    const matches: SearchMatch[] = [];
    const re = searchPattern(query);
    if (!re) return { query, matches, totalMatches: 0 };
    const text = this.textContent;
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

    const list = Array.from(headings);
    const offsets = headingScrollOffsets(doc, list);
    return list.map((h, i) => ({
      title: h.textContent ?? '',
      dest: { pageIndex: 0, scrollOffset: offsets[i]! },
    }));
  }

  dispose(): void {
    this.htmlContent = EMPTY_HTML;
    this.textContent = '';
  }
}
