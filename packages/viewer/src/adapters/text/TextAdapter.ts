import { decodeText } from '../../core/text-decode';
import type {
  Adapter,
  DocumentModel,
  FileSourceReader,
  PageRef,
  RenderContext,
  RenderResult,
  SearchMatch,
  SearchQuery,
  SearchResult,
  TextLayer,
} from '../../core/types';
import { throwIfCancelled } from '../../core/errors';
import { lineTextLayer } from '../../core/line-text-layer';
import { searchUnits } from '../../core/search-units';
import { CHAR_WIDTH, LINE_HEIGHT, LineIndex, lineUnits, mountLines } from '../../core/rows/lines';
import { listHeight, type RowList } from '../../core/rows/virtual-rows';
import { textManifest } from './manifest';

const PADDING = 16;

export class TextAdapter implements Adapter {
  readonly manifest = textManifest;
  private lines = new LineIndex('');
  private readonly lists = new WeakMap<HTMLElement, RowList>();

  async parse(
    source: FileSourceReader,
    signal: AbortSignal,
  ): Promise<DocumentModel> {
    const buffer = await source.arrayBuffer();
    throwIfCancelled(signal);

    this.lines = new LineIndex(decodeText(buffer, source.meta.mimeType));

    const page: PageRef = {
      index: 0,
      width: Math.max(Math.ceil(this.lines.columns * CHAR_WIDTH) + 2 * PADDING, 400),
      height: listHeight(this.lines.count, LINE_HEIGHT) + 2 * PADDING,
      rotation: 0,
    };

    return {
      format: 'text',
      meta: source.meta,
      pageCount: 1,
      pages: [page],
    };
  }

  async renderPage(ctx: RenderContext): Promise<RenderResult> {
    const target = ctx.target as HTMLElement;
    const root = document.createElement('div');
    root.className = 'dv-text';
    const pre = root.appendChild(document.createElement('pre'));
    target.replaceChildren(root);

    const { lines } = this;
    const rows = mountLines(pre, lines.count, (i) => lines.line(i), ctx.signal, ctx.print);
    this.lists.set(target, rows);
    if (ctx.print && rows.to < lines.count) {
      const note = root.appendChild(document.createElement('p'));
      note.textContent = `Printed the first ${rows.to.toLocaleString()} of ${lines.count.toLocaleString()} lines.`;
    }

    return {
      width: ctx.page.width * ctx.scale,
      height: ctx.page.height * ctx.scale,
    };
  }

  async getTextLayer(
    _pageIndex: number,
    _signal?: AbortSignal,
  ): Promise<TextLayer> {
    return lineTextLayer(this.lines.all(), LINE_HEIGHT);
  }

  /** Each line is a unit, so a locator's offsets index that line. */
  async search(query: SearchQuery, signal: AbortSignal): Promise<SearchResult> {
    return searchUnits(lineUnits(this.lines), query, signal);
  }

  revealMatch(match: SearchMatch, target: HTMLElement): void {
    if (match.locator) this.lists.get(target)?.scrollToRow(match.locator.unit);
  }

  dispose(): void {
    this.lines = new LineIndex('');
  }
}
