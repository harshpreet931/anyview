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
} from '../../core/types';
import { assertTransformSize } from '../../core/limits';
import { throwIfCancelled } from '../../core/errors';
import { escapeHtml } from '../../core/safe-html';
import { loadHighlighter } from '../../core/highlighter';
import { lineTextLayer, widestLine } from '../../core/line-text-layer';

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
  json: 'json', yaml: 'yaml', yml: 'yaml',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust',
  java: 'java', c: 'c', cpp: 'cpp', h: 'c',
  css: 'css', scss: 'scss', less: 'less',
  vue: 'vue', svelte: 'svelte', php: 'php',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  sql: 'sql', dockerfile: 'dockerfile',
};

export const codeManifest: AdapterManifest = {
  id: 'code',
  label: 'Source Code',
  extensions: Object.keys(LANGUAGE_BY_EXTENSION),
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
  return LANGUAGE_BY_EXTENSION[ext] ?? 'plaintext';
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

const lineWidth = (line: string) => columnCount(line) * CHAR_WIDTH;

const plainHtml = (code: string) => `<pre><code>${escapeHtml(code)}</code></pre>`;

export class CodeAdapter implements Adapter {
  readonly manifest = codeManifest;
  private lines: string[] = [];
  private highlightedHtml = '';

  async parse(
    source: FileSourceReader,
    signal: AbortSignal,
  ): Promise<DocumentModel> {
    const buffer = await source.arrayBuffer();
    throwIfCancelled(signal);
    assertTransformSize(buffer.byteLength);

    const code = decodeText(buffer, source.meta.mimeType);
    this.lines = code.split('\n');
    if (code.length > HIGHLIGHT_MAX_CHARS) {
      this.highlightedHtml = plainHtml(code);
    } else {
      const highlight = await loadHighlighter(detectLanguage(source.meta.name), plainHtml);
      this.highlightedHtml = highlight(code);
    }

    const page: PageRef = {
      index: 0,
      width: Math.max(Math.ceil(widestLine(this.lines, lineWidth)) + PADDING_X, 600),
      height: Math.max(this.lines.length * LINE_HEIGHT + PADDING_Y, 400),
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
    return lineTextLayer(this.lines, LINE_HEIGHT, lineWidth);
  }

  dispose(): void {
    this.lines = [];
    this.highlightedHtml = '';
  }
}
