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
import { ViewerError, asParseError, throwIfCancelled } from '../../core/errors';
import { loadSanitizer, DOCUMENT_HTML_CONFIG, type Sanitizer } from '../../core/sanitizer';
import { EMPTY_HTML, escapeHtml, markSanitized, type SafeHtml } from '../../core/safe-html';
import { assertTransformSize } from '../../core/limits';
import { loadMarkdownRenderer, MARKDOWN_HEADING } from '../../core/markdown-render';
import { loadHighlighter } from '../../core/highlighter';
import { renderReflowPage } from '../../core/reflow-page';
import { lineTextLayer } from '../../core/line-text-layer';
import { blockTexts, markBlockUnits, searchUnits } from '../../core/search-units';

export const ipynbManifest: AdapterManifest = {
  id: 'ipynb',
  label: 'Jupyter Notebook',
  extensions: ['ipynb'],
  mimeTypes: ['application/x-ipynb+json'],
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M3 1h10v14H3V1zm1 1v12h8V2H4zm1 2h6v1H5V4zm0 3h6v1H5V7zm0 3h4v1H5v-1z"/></svg>`,
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
  priority: 100,
  protocolVersion: 1,
};

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

export class IpynbAdapter implements Adapter {
  readonly manifest = ipynbManifest;
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
      this.htmlContent = await this.buildHtml(cells, language);
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
    const outline = this.buildOutline(cells);

    return {
      format: 'ipynb',
      meta: source.meta,
      pageCount: 1,
      pages: [page],
      ...(outline ? { outline } : {}),
    };
  }

  private async buildHtml(cells: NbCell[], language: string): Promise<SafeHtml> {
    const [renderMarkdown, DOMPurify, highlight] = await Promise.all([
      loadMarkdownRenderer(),
      loadSanitizer(),
      loadHighlighter(language, plainCode),
    ]);

    let html = '<div class="dv-ipynb">';
    for (const cell of cells) {
      const src = joinSource(cell.source);
      if (cell.cell_type === 'markdown') {
        html += `<div class="dv-ipynb-md">${renderMarkdown(src)}</div>`;
      } else if (cell.cell_type === 'code') {
        html += `<div class="dv-ipynb-cell"><div class="dv-ipynb-input">${highlight(src)}</div>`;
        for (const out of cell.outputs ?? []) {
          html += this.renderOutput(out, DOMPurify);
        }
        html += '</div>';
      } else {
        html += `<pre class="dv-ipynb-raw">${escapeHtml(src)}</pre>`;
      }
    }
    html += '</div>';
    return markSanitized(html);
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

  private buildOutline(cells: NbCell[]): OutlineNode[] | undefined {
    const outline: OutlineNode[] = [];
    for (const cell of cells) {
      if (cell.cell_type !== 'markdown') continue;
      for (const line of joinSource(cell.source).split('\n')) {
        const m = MARKDOWN_HEADING.exec(line);
        if (m) {
          outline.push({ title: m[2]!.trim(), dest: { pageIndex: 0 } });
          break;
        }
      }
    }
    return outline.length > 0 ? outline : undefined;
  }

  async renderPage(ctx: RenderContext): Promise<RenderResult> {
    const result = renderReflowPage(ctx, this.htmlContent, {
      className: 'dv-ipynb-content',
      maxWidth: 900,
      fontSize: 15,
    });
    markBlockUnits(ctx.target.firstElementChild!);
    return result;
  }

  async search(query: SearchQuery, signal: AbortSignal): Promise<SearchResult> {
    this.blocks ??= blockTexts(this.htmlContent);
    return searchUnits(this.blocks.map((text, unit) => ({ pageIndex: 0, unit, text })), query, signal);
  }

  async getTextLayer(
    _pageIndex: number,
    _signal?: AbortSignal,
  ): Promise<TextLayer> {
    return lineTextLayer(this.textContent.split('\n'), 22);
  }

  dispose(): void {
    this.htmlContent = EMPTY_HTML;
    this.textContent = '';
    this.blocks = null;
  }
}
