/* ============================================================
 * Jupyter Notebook (.ipynb) Adapter
 * Renders markdown cells (react-markdown), code cells (Shiki), and
 * saved outputs (text, HTML, images, tracebacks) — no kernel, no Python,
 * no server. A notebook is just JSON; every dependency is already shipped.
 * ============================================================ */

import type {
  Adapter,
  AdapterManifest,
  DocumentModel,
  FileSourceReader,
  OutlineNode,
  PageRef,
  RenderContext,
  RenderResult,
  TextLayer,
  TextLayerItem,
} from '../../core/types';
import { ViewerError, isViewerError } from '../../core/errors';
import { loadSanitizer } from '../../core/sanitizer';

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
  data?: Record<string, unknown>;
  ename?: string;
  evalue?: string;
  traceback?: string[];
}

interface NbCell {
  cell_type: string;
  source: string | string[];
  outputs?: NbOutput[];
}

function joinSource(s: string | string[] | undefined): string {
  if (Array.isArray(s)) return s.join('');
  return s ?? '';
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ANSI SGR escape codes (ESC[...m) in tracebacks; built via RegExp so no
// literal ESC control char sits in source.
const ANSI = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g");

export class IpynbAdapter implements Adapter {
  readonly manifest = ipynbManifest;
  private htmlContent = '';
  private textContent = '';
  private language = 'python';

  async parse(
    source: FileSourceReader,
    signal: AbortSignal,
  ): Promise<DocumentModel> {
    const buffer = await source.arrayBuffer();
    if (signal.aborted) throw new Error('Parse cancelled');

    let nb: { cells?: NbCell[]; metadata?: Record<string, unknown> };
    try {
      nb = JSON.parse(new TextDecoder('utf-8').decode(buffer));
    } catch (cause) {
      throw new ViewerError('PARSE_ERROR', 'Notebook is not valid JSON.', { cause });
    }
    if (!nb || !Array.isArray(nb.cells)) {
      throw new ViewerError('PARSE_ERROR', 'Not a valid Jupyter notebook.');
    }

    const meta = nb.metadata as
      | { language_info?: { name?: string }; kernelspec?: { language?: string } }
      | undefined;
    this.language =
      meta?.language_info?.name || meta?.kernelspec?.language || 'python';

    const cells = nb.cells;
    this.textContent = cells
      .map((c) => joinSource(c.source))
      .join('\n\n');

    try {
      this.htmlContent = await this.buildHtml(cells);
    } catch (cause) {
      if (isViewerError(cause)) throw cause;
      throw new ViewerError('PARSE_ERROR', 'Failed to render notebook.', { cause });
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

  private async buildHtml(cells: NbCell[]): Promise<string> {
    const React = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const ReactMarkdown = (await import('react-markdown')).default;
    const remarkGfm = (await import('remark-gfm')).default;
    const DOMPurify = await loadSanitizer();

    let codeToHtml: ((src: string) => string) | null = null;
    try {
      const shiki = await import('shiki');
      const highlighter = await shiki.createHighlighter({
        themes: ['github-dark', 'github-light'],
        langs: [this.language],
      });
      codeToHtml = (src: string) =>
        highlighter.codeToHtml(src, {
          lang: this.language,
          themes: { light: 'github-light', dark: 'github-dark' },
        });
    } catch {
      codeToHtml = null;
    }

    const renderMd = (src: string) =>
      renderToStaticMarkup(
        React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, src),
      );
    const renderCode = (src: string) => {
      if (codeToHtml) {
        try {
          return codeToHtml(src);
        } catch {
          /* fall through */
        }
      }
      return `<pre class="dv-ipynb-code"><code>${escapeHtml(src)}</code></pre>`;
    };

    let html = '<div class="dv-ipynb">';
    for (const cell of cells) {
      const src = joinSource(cell.source);
      if (cell.cell_type === 'markdown') {
        html += `<div class="dv-ipynb-md">${renderMd(src)}</div>`;
      } else if (cell.cell_type === 'code') {
        html += `<div class="dv-ipynb-cell"><div class="dv-ipynb-input">${renderCode(src)}</div>`;
        for (const out of cell.outputs ?? []) {
          html += this.renderOutput(out, DOMPurify);
        }
        html += '</div>';
      } else {
        html += `<pre class="dv-ipynb-raw">${escapeHtml(src)}</pre>`;
      }
    }
    html += '</div>';
    return html;
  }

  private renderOutput(
    out: NbOutput,
    DOMPurify: { sanitize: (s: string, c?: Record<string, unknown>) => string },
  ): string {
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
      const png = data['image/png'];
      if (typeof png === 'string') {
        return `<img class="dv-ipynb-img" alt="output" src="data:image/png;base64,${png.replace(/\s/g, '')}" />`;
      }
      const jpg = data['image/jpeg'];
      if (typeof jpg === 'string') {
        return `<img class="dv-ipynb-img" alt="output" src="data:image/jpeg;base64,${jpg.replace(/\s/g, '')}" />`;
      }
      const svg = data['image/svg+xml'];
      if (svg !== undefined) {
        return `<div class="dv-ipynb-html">${DOMPurify.sanitize(joinSource(svg as string | string[]))}</div>`;
      }
      const htmlOut = data['text/html'];
      if (htmlOut !== undefined) {
        return `<div class="dv-ipynb-html">${DOMPurify.sanitize(joinSource(htmlOut as string | string[]))}</div>`;
      }
      const plain = data['text/plain'];
      if (plain !== undefined) {
        return `<pre class="dv-ipynb-result">${escapeHtml(joinSource(plain as string | string[]))}</pre>`;
      }
    }
    return '';
  }

  private buildOutline(cells: NbCell[]): OutlineNode[] | undefined {
    const outline: OutlineNode[] = [];
    for (const cell of cells) {
      if (cell.cell_type !== 'markdown') continue;
      for (const line of joinSource(cell.source).split('\n')) {
        const m = /^(#{1,6})\s+(.+)$/.exec(line);
        if (m) {
          outline.push({ title: m[2]!.trim(), dest: { pageIndex: 0 } });
          break; // one entry per markdown cell (its first heading)
        }
      }
    }
    return outline.length > 0 ? outline : undefined;
  }

  async renderPage(ctx: RenderContext): Promise<RenderResult> {
    const target = ctx.target as HTMLElement;
    target.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'dv-ipynb-content';
    container.style.padding = '24px';
    container.style.maxWidth = '900px';
    container.style.margin = '0 auto';
    container.style.fontSize = `${15 * ctx.scale}px`;
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
      .map((line, i) => ({ str: line, x: 0, y: i * 22, width: line.length * 8, height: 22 }));
    return { pageIndex: 0, items };
  }

  dispose(): void {
    this.htmlContent = '';
    this.textContent = '';
  }
}
