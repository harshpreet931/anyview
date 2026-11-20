import { decodeText } from '../../core/text-decode';
import type {
  Adapter,
  DocumentModel,
  FileSourceReader,
  PageRef,
  RenderContext,
  RenderResult,
  SearchQuery,
  SearchResult,
  TextLayer,
} from '../../core/types';
import { ViewerError, throwIfCancelled } from '../../core/errors';
import { DOCUMENT_HTML_CONFIG, sanitizeInPieces } from '../../core/sanitizer';
import { assertTransformSize } from '../../core/limits';
import { HeadingOutline, headingsIn } from '../../core/reflow-outline';
import { detachedReflow, EMPTY_REFLOW, reflowBlockTexts, renderReflowPage } from '../../core/reflow-page';
import { lineTextLayer } from '../../core/line-text-layer';
import { estimatedReflowHeight } from '../../core/reflow-height';
import { searchUnits } from '../../core/search-units';
import { htmlManifest } from './manifest';

export class HtmlAdapter implements Adapter {
  readonly manifest = htmlManifest;
  private content = EMPTY_REFLOW;
  private outline = new HeadingOutline([]);
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
      this.content = await sanitizeInPieces(rawHtml, DOCUMENT_HTML_CONFIG, signal);
      this.blocks = null;
    } catch (cause) {
      throw new ViewerError('PARSE_ERROR', 'Failed to sanitize HTML.', { cause });
    }

    const root = await detachedReflow(this.content, signal);
    this.textContent = root.textContent ?? '';
    this.outline = new HeadingOutline(headingsIn(root));

    const page: PageRef = {
      index: 0,
      width: 800,
      height: estimatedReflowHeight(this.textContent.length),
      rotation: 0,
    };

    return {
      format: 'html',
      meta: source.meta,
      pageCount: 1,
      pages: [page],
      ...(this.outline.nodes.length > 0 ? { outline: this.outline.nodes } : {}),
    };
  }

  async renderPage(ctx: RenderContext): Promise<RenderResult> {
    if (!ctx.print) this.outline.attach(ctx.target, () => headingsIn(ctx.target));
    const result = await renderReflowPage(ctx, this.content, { className: 'dv-html-content' });
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
    this.blocks ??= await reflowBlockTexts(this.content, signal);
    return searchUnits(this.blocks.map((text, unit) => ({ pageIndex: 0, unit, text })), query, signal);
  }

  dispose(): void {
    this.content = EMPTY_REFLOW;
    this.outline = new HeadingOutline([]);
    this.textContent = '';
    this.blocks = null;
  }
}
