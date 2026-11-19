import { decodeText } from '../../core/text-decode';
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
import { CODE_THEME } from '../../core/code-theme';

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

const HIGHLIGHT_MAX_CHARS = 300_000;
const FONT_SIZE = 14;
const LINE_HEIGHT = 20;
const CHAR_WIDTH = FONT_SIZE * 0.61;
const TAB_SIZE = 4;
const PADDING_X = 64;
const PADDING_Y = 64;

function columnCount(line: string): number {
  let columns = 0;
  for (const ch of line) columns = ch === '\t' ? columns + TAB_SIZE - (columns % TAB_SIZE) : columns + 1;
  return columns;
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

    this.codeText = decodeText(buffer, source.meta.mimeType);
    this.language = detectLanguage(source.meta.name);

    const plain = () => `<pre><code>${this.escapeHtml(this.codeText)}</code></pre>`;
    if (this.codeText.length > HIGHLIGHT_MAX_CHARS) {
      this.highlightedHtml = plain();
    } else {
      try {
        const shiki = await import('shiki');
        const highlighter = await shiki.createHighlighter({
          themes: [CODE_THEME],
          langs: [this.language],
        });

        this.highlightedHtml = highlighter.codeToHtml(this.codeText, {
          lang: this.language,
          theme: CODE_THEME,
        });
      } catch {
        this.highlightedHtml = plain();
      }
    }

    const lines = this.codeText.split('\n');
    // Loop instead of Math.max(...spread): spreading a huge array overflows the call-stack arg limit.
    let maxColumns = 0;
    for (const line of lines) {
      const columns = columnCount(line);
      if (columns > maxColumns) maxColumns = columns;
    }
    const maxWidth = Math.ceil(maxColumns * CHAR_WIDTH);
    const totalHeight = lines.length * LINE_HEIGHT;

    const page: PageRef = {
      index: 0,
      width: Math.max(maxWidth + PADDING_X, 600),
      height: Math.max(totalHeight + PADDING_Y, 400),
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
    container.className = 'dv-code';
    container.style.fontSize = `${FONT_SIZE * ctx.scale}px`;
    container.innerHTML = this.highlightedHtml;
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
        y: i * LINE_HEIGHT,
        width: columnCount(line) * CHAR_WIDTH,
        height: LINE_HEIGHT,
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
