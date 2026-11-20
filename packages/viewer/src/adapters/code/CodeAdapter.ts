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
import { assertTransformSize } from '../../core/limits';
import { throwIfCancelled } from '../../core/errors';
import type { GrammarState, ThemedToken } from 'shiki';
import { loadTokenizer, type Tokenizer } from '../../core/highlighter';
import { lineTextLayer } from '../../core/line-text-layer';
import { searchUnits } from '../../core/search-units';
import { CHAR_WIDTH, FONT_SIZE, LINE_HEIGHT, LineIndex, lineUnits, mountLines } from '../../core/rows/lines';
import { listHeight, type RowList } from '../../core/rows/virtual-rows';
import { codeManifest, LANGUAGE_BY_EXTENSION } from './manifest';

function detectLanguage(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
  return LANGUAGE_BY_EXTENSION[ext] ?? 'plaintext';
}

const PADDING = 64;
/** Lines are highlighted in chunks, in file order, each continuing from the grammar state the one before left. */
const CHUNK = 100;
const KEEP_CHUNKS = 64;
const SLICE_MS = 8;

function tokenStyle(token: ThemedToken): string {
  const style: string[] = [];
  if (token.color) style.push(`color:${token.color}`);
  if (token.bgColor) style.push(`background-color:${token.bgColor}`);
  const font = token.fontStyle ?? 0;
  if (font > 0) {
    if (font & 1) style.push('font-style:italic');
    if (font & 2) style.push('font-weight:bold');
    const lines = [font & 4 ? 'underline' : '', font & 8 ? 'line-through' : ''].filter(Boolean);
    if (lines.length) style.push(`text-decoration:${lines.join(' ')}`);
  }
  return style.join(';');
}

function tokenNodes(tokens: ThemedToken[]): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const token of tokens) {
    const span = frag.appendChild(document.createElement('span'));
    span.textContent = token.content;
    const style = tokenStyle(token);
    if (style) span.setAttribute('style', style);
  }
  return frag;
}

interface Chunk {
  readonly lines: ThemedToken[][];
  /** Tokenized from the state the lines before it leave, rather than from a fresh state. */
  readonly exact: boolean;
}

/**
 * Highlights the lines on screen, a chunk at a time. A chunk far past the chunks done so far is first highlighted
 * from a fresh grammar state, which is right outside multi-line comments and strings, then again exactly once the
 * chunks before it are done, in slices.
 */
class Highlights {
  private readonly states: Array<GrammarState | undefined> = [undefined];
  private readonly chunks = new Map<number, Chunk>();
  private wanted: [number, number] = [0, -1];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private failed = false;

  constructor(
    private readonly tokenizer: Tokenizer,
    private readonly lines: LineIndex,
    private readonly onReady: (from: number, to: number) => void,
  ) {}

  tokens(line: number): ThemedToken[] | undefined {
    return this.chunks.get(Math.floor(line / CHUNK))?.lines[line % CHUNK];
  }

  /** Highlights lines [from, to): the chunks on screen right away if `now`, otherwise soon. */
  want(from: number, to: number, now = false): void {
    this.wanted = [Math.floor(from / CHUNK), Math.floor((to - 1) / CHUNK)];
    if (now) while ((this.next()?.chunk ?? -1) >= this.wanted[0] && this.step());
    this.schedule();
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.chunks.clear();
  }

  private next(): { chunk: number; exact: boolean } | null {
    if (this.failed) return null;
    const [first, last] = this.wanted;
    const done = this.states.length - 1;
    for (let k = first; k <= last; k++) if (!this.chunks.has(k)) return { chunk: k, exact: k <= done };
    for (let k = first; k <= last; k++) if (!this.chunks.get(k)!.exact) return { chunk: Math.min(k, done), exact: true };
    return null;
  }

  private step(): boolean {
    const next = this.next();
    if (!next) return false;
    const { chunk: k, exact } = next;
    const from = k * CHUNK;
    const to = Math.min(this.lines.count, from + CHUNK);
    const code = Array.from({ length: to - from }, (_, i) => this.lines.line(from + i)).join('\n');
    const result = this.tokenizer.tokenize(code, exact ? this.states[k] : undefined);
    if (!result) {
      this.failed = true;
      return false;
    }
    if (exact && k === this.states.length - 1) this.states.push(result.state);
    const [first, last] = this.wanted;
    if (k >= first && k <= last) {
      this.chunks.set(k, { lines: result.lines, exact });
      for (const key of this.chunks.keys()) {
        if (this.chunks.size <= KEEP_CHUNKS) break;
        if (key < first || key > last) this.chunks.delete(key);
      }
      this.onReady(from, to);
    }
    return true;
  }

  private schedule(): void {
    if (this.timer !== undefined || !this.next()) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      const end = performance.now() + SLICE_MS;
      while (performance.now() < end && this.step());
      this.schedule();
    }, 0);
  }
}

export class CodeAdapter implements Adapter {
  readonly manifest = codeManifest;
  private lines = new LineIndex('');
  private tokenizer: Tokenizer | null = null;
  private highlights: Highlights | null = null;
  private readonly lists = new Map<HTMLElement, RowList>();

  async parse(
    source: FileSourceReader,
    signal: AbortSignal,
  ): Promise<DocumentModel> {
    const buffer = await source.arrayBuffer();
    throwIfCancelled(signal);
    assertTransformSize(buffer.byteLength);

    const lines = new LineIndex(decodeText(buffer, source.meta.mimeType));
    this.lines = lines;
    this.highlights?.dispose();
    this.tokenizer = await loadTokenizer(detectLanguage(source.meta.name));
    this.highlights = this.tokenizer
      ? new Highlights(this.tokenizer, lines, (from, to) => this.lists.forEach((list) => list.refresh(from, to)))
      : null;

    const page: PageRef = {
      index: 0,
      width: Math.max(Math.ceil(lines.columns * CHAR_WIDTH) + PADDING, 600),
      height: listHeight(lines.count, LINE_HEIGHT) + PADDING,
      rotation: 0,
    };

    return {
      format: 'code',
      meta: source.meta,
      pageCount: 1,
      pages: [page],
    };
  }

  async renderPage(ctx: RenderContext): Promise<RenderResult> {
    const target = ctx.target as HTMLElement;
    const container = document.createElement('div');
    container.className = 'dv-code';
    container.style.fontSize = `${FONT_SIZE * ctx.scale}px`;
    const pre = container.appendChild(document.createElement('pre'));
    const { lines, tokenizer, highlights } = this;
    if (tokenizer) {
      pre.className = `shiki ${tokenizer.themeName ?? ''}`.trim();
      if (tokenizer.bg) pre.style.backgroundColor = tokenizer.bg;
      if (tokenizer.fg) pre.style.color = tokenizer.fg;
    }
    target.replaceChildren(container);

    const content = (i: number) => {
      const tokens = highlights?.tokens(i);
      return tokens ? tokenNodes(tokens) : lines.line(i);
    };
    const rows = mountLines(pre, lines.count, content, ctx.signal, ctx.print, (from, to) => highlights?.want(from, to));
    this.lists.set(target, rows);
    ctx.signal.addEventListener('abort', () => {
      if (this.lists.get(target) === rows) this.lists.delete(target);
    });
    highlights?.want(rows.from, rows.to, true);
    if (ctx.print && rows.to < lines.count) {
      const note = container.appendChild(document.createElement('p'));
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
    return lineTextLayer(this.lines.all(), LINE_HEIGHT, (line) => line.length * CHAR_WIDTH);
  }

  /** Each line is a unit, so a locator's offsets index that line of the source. */
  async search(query: SearchQuery, signal: AbortSignal): Promise<SearchResult> {
    return searchUnits(lineUnits(this.lines), query, signal);
  }

  revealMatch(match: SearchMatch, target: HTMLElement): void {
    if (match.locator) this.lists.get(target)?.scrollToRow(match.locator.unit);
  }

  dispose(): void {
    this.highlights?.dispose();
    this.highlights = null;
    this.tokenizer = null;
    this.lines = new LineIndex('');
    this.lists.clear();
  }
}
