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
  TextLayer,
} from '../../core/types';
import { ViewerError, throwIfCancelled } from '../../core/errors';
import { loadSanitizer, DOCUMENT_HTML_CONFIG } from '../../core/sanitizer';
import { EMPTY_HTML, markSanitized, type SafeHtml } from '../../core/safe-html';
import { assertTransformSize } from '../../core/limits';
import { headingScrollOffsets } from '../../core/reflow-outline';
import { renderReflowPage } from '../../core/reflow-page';
import { lineTextLayer } from '../../core/line-text-layer';
import { estimatedReflowHeight } from '../../core/reflow-height';
import { blockTexts, markBlockUnits, searchUnits } from '../../core/search-units';

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
  private blocks: string[] | null = null;

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
      this.blocks = null;
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
    const result = renderReflowPage(ctx, this.htmlContent, { className: 'dv-html-content' });
    markBlockUnits(ctx.target.firstElementChild!);
    return result;
  }

  async getTextLayer(
    _pageIndex: number,
    _signal?: AbortSignal,
  ): Promise<TextLayer> {
    const lines = this.textContent.split('\n').filter((line) => line.trim());
    return lineTextLayer(lines, 24);
  }

  async search(query: SearchQuery, signal: AbortSignal): Promise<SearchResult> {
    this.blocks ??= blockTexts(this.htmlContent);
    return searchUnits(this.blocks.map((text, unit) => ({ pageIndex: 0, unit, text })), query, signal);
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
    this.blocks = null;
  }
}
