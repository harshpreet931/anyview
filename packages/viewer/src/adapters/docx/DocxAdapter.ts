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
  TextLayerItem,
} from '../../core/types';
import { asParseError, throwIfCancelled } from '../../core/errors';
import { loadParser } from '../../core/load-parser';
import { sanitizeInPieces } from '../../core/sanitizer';
import { assertTransformSize } from '../../core/limits';
import { HeadingOutline, headingsIn } from '../../core/reflow-outline';
import { detachedReflow, EMPTY_REFLOW, reflowBlockTexts, renderReflowPage } from '../../core/reflow-page';
import { searchUnits } from '../../core/search-units';
import { docxManifest } from './manifest';

const CHARS_PER_LINE = 80;
const LINE_HEIGHT = 24;
const CHAR_WIDTH = 8;

export class DocxAdapter implements Adapter {
  readonly manifest = docxManifest;
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

    try {
      const mammoth = await loadParser('mammoth', () => import('mammoth'));
      const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
      this.content = await sanitizeInPieces(result.value, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'a', 'ul', 'ol',
          'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead',
          'tbody', 'tr', 'td', 'th', 'img', 'blockquote', 'pre', 'code',
          'span', 'div', 'hr', 'sub', 'sup', 'dl', 'dt', 'dd',
        ],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'colspan', 'rowspan', 'style', 'class', 'id', 'width', 'height'],
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data:image):|#)/i,
        SANITIZE_NAMED_PROPS: true,
      }, signal);
      this.blocks = null;
    } catch (cause) {
      throw asParseError(cause, 'Failed to parse DOCX.');
    }

    const root = await detachedReflow(this.content, signal);
    this.textContent = root.textContent ?? '';
    this.outline = new HeadingOutline(headingsIn(root));

    const estimatedHeight = Math.ceil(this.textContent.length / CHARS_PER_LINE) * LINE_HEIGHT + 200;

    const page: PageRef = {
      index: 0,
      width: 800,
      height: Math.max(estimatedHeight, 400),
      rotation: 0,
    };

    return {
      format: 'docx',
      meta: source.meta,
      pageCount: 1,
      pages: [page],
      ...(this.outline.nodes.length > 0 ? { outline: this.outline.nodes } : {}),
    };
  }

  async renderPage(ctx: RenderContext): Promise<RenderResult> {
    if (!ctx.print) this.outline.attach(ctx.target, () => headingsIn(ctx.target));
    const result = await renderReflowPage(ctx, this.content, { className: 'dv-docx-content', padding: '48px 24px' });
    const container = ctx.target.firstElementChild!;
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
