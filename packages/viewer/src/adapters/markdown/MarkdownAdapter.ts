/* ============================================================
 * Markdown Adapter
 * Uses react-markdown + remark-gfm (dynamic import).
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
import { makeSafeUrlTransform } from '../../core/markdown-url';

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

export class MarkdownAdapter implements Adapter {
  readonly manifest = markdownManifest;
  private markdownText = '';
  private htmlContent = '';

  async parse(
    source: FileSourceReader,
    signal: AbortSignal,
  ): Promise<DocumentModel> {
    const buffer = await source.arrayBuffer();
    if (signal.aborted) throw new Error('Parse cancelled');

    this.markdownText = new TextDecoder('utf-8').decode(buffer);

    // Dynamically import react-markdown + remark-gfm
    const React = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { default: ReactMarkdown, defaultUrlTransform } = await import('react-markdown');
    const remarkGfm = (await import('remark-gfm')).default;

    const element = React.createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkGfm],
        urlTransform: makeSafeUrlTransform(defaultUrlTransform),
      },
      this.markdownText,
    );

    this.htmlContent = renderToStaticMarkup(element);

    // Estimate dimensions
    const charCount = this.markdownText.length;
    const estimatedHeight = Math.ceil(charCount / 80) * 24 + 200;

    const page: PageRef = {
      index: 0,
      width: 800,
      height: Math.max(estimatedHeight, 400),
      rotation: 0,
    };

    const lines = this.markdownText.split('\n');
    const outline = this.extractOutline(lines);

    return {
      format: 'markdown',
      meta: source.meta,
      pageCount: 1,
      pages: [page],
      ...(outline ? { outline } : {}),
    };
  }

  async renderPage(ctx: RenderContext): Promise<RenderResult> {
    const target = ctx.target as HTMLElement;
    target.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'dv-markdown-content';
    container.style.padding = '24px';
    container.style.maxWidth = '800px';
    container.style.margin = '0 auto';
    container.style.fontSize = `${16 * ctx.scale}px`;
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
    const items: TextLayerItem[] = this.markdownText
      .split('\n')
      .map((line, i) => ({
        str: line,
        x: 0,
        y: i * 24,
        width: line.length * 8,
        height: 24,
      }));

    return { pageIndex: 0, items };
  }

  private extractOutline(lines: string[]): DocumentModel['outline'] {
    const outline: OutlineNode[] = [];

    for (const line of lines) {
      const match = /^(#{1,6})\s+(.+)$/.exec(line);
      if (match) {
        const level = match[1].length;
        const title = match[2].trim();
        outline.push({
          title,
          dest: {
            pageIndex: 0,
            scrollOffset: this.estimateScrollOffset(lines, line),
          },
          ...(level < 3 ? { children: [] } : {}),
        });
      }
    }

    return outline.length > 0 ? outline : undefined;
  }

  private estimateScrollOffset(lines: string[], targetLine: string): number {
    const index = lines.indexOf(targetLine);
    return index >= 0 ? index * 24 : 0;
  }

  dispose(): void {
    this.markdownText = '';
    this.htmlContent = '';
  }
}
