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
import { ViewerError, asParseError, throwIfCancelled } from '../../core/errors';
import { loadSanitizer, DOCUMENT_HTML_CONFIG, type Sanitizer } from '../../core/sanitizer';
import { escapeHtml, markSanitized, type SafeHtml } from '../../core/safe-html';
import { assertTransformSize } from '../../core/limits';
import { loadMarkdownRenderer } from '../../core/markdown-render';
import { loadHighlighter } from '../../core/highlighter';
import {
  detachedReflow,
  EMPTY_REFLOW,
  reflowBlockTexts,
  renderReflowPage,
  timeSlices,
  type ReflowContent,
} from '../../core/reflow-page';
import { HEADINGS, HeadingOutline } from '../../core/reflow-outline';
import { lineTextLayer } from '../../core/line-text-layer';
import { searchUnits } from '../../core/search-units';
import { ipynbManifest } from './manifest';

interface NbOutput {
  output_type: string;
  name?: string;
  text?: string | string[];
  data?: Record<string, string | string[]>;
  ename?: string;
  evalue?: string;
  traceback?: string[];
}

interface NbCell {
  cell_type: string;
  source: string | string[];
  outputs?: NbOutput[];
}

interface NbMetadata {
  language_info?: { name?: string };
  kernelspec?: { language?: string };
}

interface Notebook {
  cells?: NbCell[];
  metadata?: NbMetadata;
}

function joinSource(s: string | string[] | undefined): string {
  if (Array.isArray(s)) return s.join('');
  return s ?? '';
}

// Strip non-base64 chars: the value is interpolated into a data: URI src, so a quote would break out and inject markup (XSS).
function safeBase64(s: string): string {
  return s.replace(/[^A-Za-z0-9+/=]/g, '');
}

function utf8ToBase64(s: string): string {
  let bin = '';
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b);
  return btoa(bin);
}

const ANSI = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g");

const BASE64_IMAGE_TYPES = ['image/png', 'image/jpeg'];

const plainCode = (code: string) => `<pre class="dv-ipynb-code"><code>${escapeHtml(code)}</code></pre>`;

const NOTEBOOK_SHELL = markSanitized('<div class="dv-ipynb"></div>');
const PIECE_CHARS = 32 * 1024;

/** The first heading of each markdown cell: the notebook's outline. */
const cellHeadings = (root: ParentNode): Element[] =>
  Array.from(root.querySelectorAll('.dv-ipynb-md'), (cell) => cell.querySelector(HEADINGS)).filter((h) => h !== null);

export class IpynbAdapter implements Adapter {
  readonly manifest = ipynbManifest;
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

    let nb: Notebook;
    try {
      nb = JSON.parse(decodeText(buffer, source.meta.mimeType));
    } catch (cause) {
      throw new ViewerError('PARSE_ERROR', 'Notebook is not valid JSON.', { cause });
    }
    if (!nb || !Array.isArray(nb.cells)) {
      throw new ViewerError('PARSE_ERROR', 'Not a valid Jupyter notebook.');
    }

    const language =
      nb.metadata?.language_info?.name || nb.metadata?.kernelspec?.language || 'python';

    const cells = nb.cells;
    this.textContent = cells
      .map((c) => joinSource(c.source))
      .join('\n\n');

    try {
      this.content = await this.buildContent(cells, language, signal);
      this.blocks = null;
    } catch (cause) {
      throw asParseError(cause, 'Failed to render notebook.');
    }

    const estimatedHeight = Math.max(this.textContent.length / 4 + 400, 600);
    const page: PageRef = {
      index: 0,
      width: 900,
      height: estimatedHeight,
      rotation: 0,
    };
    this.outline = new HeadingOutline(cellHeadings(await detachedReflow(this.content, signal)));

    return {
      format: 'ipynb',
      meta: source.meta,
      pageCount: 1,
      pages: [page],
      ...(this.outline.nodes.length > 0 ? { outline: this.outline.nodes } : {}),
    };
  }

  private async buildContent(cells: NbCell[], language: string, signal: AbortSignal): Promise<ReflowContent> {
    const [renderMarkdown, DOMPurify, highlight] = await Promise.all([
      loadMarkdownRenderer(),
      loadSanitizer(),
      loadHighlighter(language, plainCode),
    ]);

    const next = timeSlices(signal);
    const pieces: SafeHtml[] = [];
    let piece = '';
    let previous = '';
    for (const cell of cells) {
      // Pieces split only between two code cells, where the gap is one cell margin either way.
      if (piece.length >= PIECE_CHARS && cell.cell_type === 'code' && previous === 'code') {
        pieces.push(markSanitized(piece));
        piece = '';
      }
      previous = cell.cell_type;
      const src = joinSource(cell.source);
      if (cell.cell_type === 'markdown') {
        piece += `<div class="dv-ipynb-md">${renderMarkdown(src)}</div>`;
      } else if (cell.cell_type === 'code') {
        piece += `<div class="dv-ipynb-cell"><div class="dv-ipynb-input">${highlight(src)}</div>`;
        for (const out of cell.outputs ?? []) {
          piece += this.renderOutput(out, DOMPurify);
        }
        piece += '</div>';
      } else {
        piece += `<pre class="dv-ipynb-raw">${escapeHtml(src)}</pre>`;
      }
      await next();
    }
    pieces.push(markSanitized(piece));
    return { shell: NOTEBOOK_SHELL, pieces };
  }

  private renderOutput(out: NbOutput, DOMPurify: Sanitizer): string {
    if (out.output_type === 'stream') {
      const cls =
        out.name === 'stderr' ? 'dv-ipynb-stream dv-ipynb-stderr' : 'dv-ipynb-stream';
      return `<pre class="${cls}">${escapeHtml(joinSource(out.text))}</pre>`;
    }
    if (out.output_type === 'error') {
      const tb = (out.traceback ?? []).join('\n').replace(ANSI, '');
      const text = tb || `${out.ename ?? 'Error'}: ${out.evalue ?? ''}`;
      return `<pre class="dv-ipynb-error">${escapeHtml(text)}</pre>`;
    }
    if (out.output_type === 'execute_result' || out.output_type === 'display_data') {
      const data = out.data ?? {};
      for (const mimeType of BASE64_IMAGE_TYPES) {
        const base64 = data[mimeType];
        if (typeof base64 === 'string') {
          return `<img class="dv-ipynb-img" alt="output" src="data:${mimeType};base64,${safeBase64(base64)}" />`;
        }
      }
      const svg = data['image/svg+xml'];
      if (svg !== undefined) {
        return `<img class="dv-ipynb-img" alt="output" src="data:image/svg+xml;base64,${utf8ToBase64(joinSource(svg))}" />`;
      }
      const htmlOut = data['text/html'];
      if (htmlOut !== undefined) {
        return `<div class="dv-ipynb-html">${DOMPurify.sanitize(joinSource(htmlOut), DOCUMENT_HTML_CONFIG)}</div>`;
      }
      const plain = data['text/plain'];
      if (plain !== undefined) {
        return `<pre class="dv-ipynb-result">${escapeHtml(joinSource(plain))}</pre>`;
      }
    }
    return '';
  }

  async renderPage(ctx: RenderContext): Promise<RenderResult> {
    if (!ctx.print) this.outline.attach(ctx.target, () => cellHeadings(ctx.target));
    const result = await renderReflowPage(ctx, this.content, {
      className: 'dv-ipynb-content',
      maxWidth: 900,
      fontSize: 15,
    });
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
    return lineTextLayer(this.textContent.split('\n'), 22);
  }

  dispose(): void {
    this.content = EMPTY_REFLOW;
    this.outline = new HeadingOutline([]);
    this.textContent = '';
    this.blocks = null;
  }
}
