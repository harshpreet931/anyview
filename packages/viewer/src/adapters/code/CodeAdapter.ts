/* ============================================================
 * Code Adapter
 * Uses Shiki for syntax highlighting (dynamic import).
 * ============================================================ */

import type {
  Adapter,
  AdapterManifest,
  DocumentModel,
  FileSourceReader,
  PageRef,
  RenderContext,
  RenderResult,
  TextLayer,
  TextLayerItem,
} from '../../core/types';
import { assertTransformSize } from '../../core/limits';

export const codeManifest: AdapterManifest = {
  id: 'code',
  label: 'Source Code',
  extensions: [
    'ts', 'tsx', 'js', 'jsx', 'json', 'yaml', 'yml',
    'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h',
    'css', 'scss', 'less', 'vue', 'svelte', 'php',
    'sh', 'bash', 'zsh', 'sql', 'dockerfile',
  ],
  mimeTypes: [
    'text/typescript', 'text/javascript', 'application/json',
    'text/yaml', 'text/x-yaml', 'text/python',
    'text/x-shellscript', 'text/sql',
  ],
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M5 7l-3 3 3 3-1 1L0 10l4-4 1 1zm6 0l3 3-3 3 1 1 4-4-4-4-1 1zm-2.5-5L7 14l-1-.2L8.5 2l1 .2z"/></svg>`,
  features: {
    search: true,
    annotations: false,
    textSelection: true,
    print: true,
    thumbnails: false,
    outline: false,
    zoom: true,
    rotation: false,
    attachments: false,
    fullscreen: true,
    download: true,
  },
  priority: 80,
  protocolVersion: 1,
};

function detectLanguage(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    json: 'json', yaml: 'yaml', yml: 'yaml',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust',
    java: 'java', c: 'c', cpp: 'cpp', h: 'c',
    css: 'css', scss: 'scss', less: 'less',
    vue: 'vue', svelte: 'svelte', php: 'php',
    sh: 'bash', bash: 'bash', zsh: 'bash',
    sql: 'sql', dockerfile: 'dockerfile',
  };
  return map[ext] || 'plaintext';
}

export class CodeAdapter implements Adapter {
  readonly manifest = codeManifest;
  private codeText = '';
  private highlightedHtml = '';
  private language = 'plaintext';

  async parse(
    source: FileSourceReader,
    signal: AbortSignal,
  ): Promise<DocumentModel> {
    const buffer = await source.arrayBuffer();
    if (signal.aborted) throw new Error('Parse cancelled');
    assertTransformSize(buffer.byteLength);

    this.codeText = new TextDecoder('utf-8').decode(buffer);
    this.language = detectLanguage(source.meta.name);

    try {
      const shiki = await import('shiki');
      const highlighter = await shiki.createHighlighter({
        themes: ['github-dark', 'github-light'],
        langs: [this.language],
      });

      this.highlightedHtml = highlighter.codeToHtml(this.codeText, {
        lang: this.language,
        themes: { light: 'github-light', dark: 'github-dark' },
      });
    } catch {
      this.highlightedHtml = `<pre><code>${this.escapeHtml(this.codeText)}</code></pre>`;
    }

    const lines = this.codeText.split('\n');
    const lineHeight = 20;
    const charWidth = 8;
    // Compute the longest line with a loop, not Math.max(...spread): spreading
    // a 125k+ element array overflows the call-stack argument limit and crashes
    // parse() on large minified/generated files.
    let maxLineLength = 0;
    for (const line of lines) {
      if (line.length > maxLineLength) maxLineLength = line.length;
    }
    const maxWidth = maxLineLength * charWidth;
    const totalHeight = lines.length * lineHeight;

    const page: PageRef = {
      index: 0,
      width: Math.max(maxWidth + 48, 600),
      height: Math.max(totalHeight + 48, 400),
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
    target.innerHTML = '';

    const container = document.createElement('div');
    container.style.padding = '16px';
    container.style.overflow = 'auto';
    container.style.fontSize = `${14 * ctx.scale}px`;
    container.innerHTML = this.highlightedHtml;

    const codeElement = container.querySelector('pre');
    if (codeElement) {
      (codeElement as HTMLElement).style.margin = '0';
      (codeElement as HTMLElement).style.padding = '16px';
      (codeElement as HTMLElement).style.borderRadius = '4px';
    }

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
    const items: TextLayerItem[] = this.codeText
      .split('\n')
      .map((line, i) => ({
        str: line,
        x: 0,
        y: i * 20,
        width: line.length * 8,
        height: 20,
      }));

    return { pageIndex: 0, items };
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  dispose(): void {
    this.codeText = '';
    this.highlightedHtml = '';
  }
}
