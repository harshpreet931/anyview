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
  TextLayer,
} from '../../core/types';
import { assertTransformSize } from '../../core/limits';
import { throwIfCancelled } from '../../core/errors';
import { EMPTY_HTML, type SafeHtml } from '../../core/safe-html';
import { loadMarkdownRenderer, MARKDOWN_HEADING } from '../../core/markdown-render';
import { renderReflowPage } from '../../core/reflow-page';
import { lineTextLayer } from '../../core/line-text-layer';
import { estimatedReflowHeight } from '../../core/reflow-height';

export const markdownManifest: AdapterManifest = {
  id: 'markdown',
  label: 'Markdown',
  extensions: ['md', 'markdown', 'mdx'],
  mimeTypes: ['text/markdown', 'text/x-markdown'],
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M1 3.5h14v9H1v-9zm1 1v7h12v-7H2zm2 5V6h1l1.5 2L8 6h1v3.5H8V7.5L6.5 9.5 5 7.5v2H4zm7 0V6h1v3.5h-1zm0-1.5V6h2v1h-2z"/></svg>`,
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

const LINE_HEIGHT = 24;

export class MarkdownAdapter implements Adapter {
  readonly manifest = markdownManifest;
  private markdownText = '';
  private htmlContent: SafeHtml = EMPTY_HTML;

  async parse(
    source: FileSourceReader,
    signal: AbortSignal,
  ): Promise<DocumentModel> {
    const buffer = await source.arrayBuffer();
    throwIfCancelled(signal);
    assertTransformSize(buffer.byteLength);

    this.markdownText = decodeText(buffer, source.meta.mimeType);
    const renderMarkdown = await loadMarkdownRenderer();
    this.htmlContent = renderMarkdown(this.markdownText);

    const page: PageRef = {
      index: 0,
      width: 800,
      height: estimatedReflowHeight(this.markdownText.length),
      rotation: 0,
    };

    const outline = extractOutline(this.markdownText.split('\n'));

    return {
      format: 'markdown',
      meta: source.meta,
      pageCount: 1,
      pages: [page],
      ...(outline ? { outline } : {}),
    };
  }

  async renderPage(ctx: RenderContext): Promise<RenderResult> {
    return renderReflowPage(ctx, this.htmlContent, { className: 'dv-markdown-content' });
  }

  async getTextLayer(
    _pageIndex: number,
    _signal?: AbortSignal,
  ): Promise<TextLayer> {
    return lineTextLayer(this.markdownText.split('\n'), LINE_HEIGHT);
  }

  dispose(): void {
    this.markdownText = '';
    this.htmlContent = EMPTY_HTML;
  }
}

function extractOutline(lines: string[]): OutlineNode[] | undefined {
  const outline: OutlineNode[] = [];
  lines.forEach((line, index) => {
    const match = MARKDOWN_HEADING.exec(line);
    if (match) {
      outline.push({
        title: match[2]!.trim(),
        dest: { pageIndex: 0, scrollOffset: index * LINE_HEIGHT },
      });
    }
  });
  return outline.length > 0 ? outline : undefined;
}
