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
import { assertTransformSize } from '../../core/limits';
import { throwIfCancelled } from '../../core/errors';
import { EMPTY_HTML, type SafeHtml } from '../../core/safe-html';
import { loadMarkdownRenderer, markdownPieces } from '../../core/markdown-render';
import { detachedReflow, EMPTY_REFLOW, reflowBlockTexts, renderReflowPage, timeSlices, type ReflowContent } from '../../core/reflow-page';
import { HeadingOutline, headingsIn } from '../../core/reflow-outline';
import { lineTextLayer } from '../../core/line-text-layer';
import { estimatedReflowHeight } from '../../core/reflow-height';
import { searchUnits } from '../../core/search-units';
import { markdownManifest } from './manifest';

const LINE_HEIGHT = 24;

export class MarkdownAdapter implements Adapter {
  readonly manifest = markdownManifest;
  private markdownText = '';
  private content: ReflowContent = EMPTY_REFLOW;
  private outline = new HeadingOutline([]);
  private blocks: string[] | null = null;

  async parse(
    source: FileSourceReader,
    signal: AbortSignal,
  ): Promise<DocumentModel> {
    const buffer = await source.arrayBuffer();
    throwIfCancelled(signal);
    assertTransformSize(buffer.byteLength);

    this.markdownText = decodeText(buffer, source.meta.mimeType);
    const renderMarkdown = await loadMarkdownRenderer();
    const next = timeSlices(signal);
    const pieces: SafeHtml[] = [];
    for (const piece of markdownPieces(this.markdownText)) {
      pieces.push(renderMarkdown(piece));
      await next();
    }
    this.content = { shell: EMPTY_HTML, pieces };
    this.blocks = null;
    this.outline = new HeadingOutline(headingsIn(await detachedReflow(this.content, signal)));

    const page: PageRef = {
      index: 0,
      width: 800,
      height: estimatedReflowHeight(this.markdownText.length),
      rotation: 0,
    };

    return {
      format: 'markdown',
      meta: source.meta,
      pageCount: 1,
      pages: [page],
      ...(this.outline.nodes.length > 0 ? { outline: this.outline.nodes } : {}),
    };
  }

  async renderPage(ctx: RenderContext): Promise<RenderResult> {
    if (!ctx.print) this.outline.attach(ctx.target, () => headingsIn(ctx.target));
    const result = await renderReflowPage(ctx, this.content, { className: 'dv-markdown-content' });
    return result;
  }

  async search(query: SearchQuery, signal: AbortSignal): Promise<SearchResult> {
    this.blocks ??= await reflowBlockTexts(this.content, signal);
    return searchUnits(this.blocks.map((text, unit) => ({ pageIndex: 0, unit, text })), query, signal);
  }

  async getTextLayer(
    _pageIndex: number,
    _signal?: AbortSignal,
  ): Promise<TextLayer> {
    return lineTextLayer(this.markdownText.split('\n'), LINE_HEIGHT);
  }

  dispose(): void {
    this.markdownText = '';
    this.content = EMPTY_REFLOW;
    this.outline = new HeadingOutline([]);
    this.blocks = null;
  }
}
