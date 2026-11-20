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
import { throwIfCancelled } from '../../core/errors';
import { lineTextLayer, widestLine } from '../../core/line-text-layer';

export const textManifest: AdapterManifest = {
  id: 'text',
  label: 'Plain Text',
  extensions: ['txt', 'log'],
  mimeTypes: ['text/plain'],
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M2 3h12v2H2V3zm0 3h12v1H2V6zm0 3h8v1H2V9zm0 3h12v1H2v-1z"/></svg>`,
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
  priority: 50,
  protocolVersion: 1,
};

const LINE_HEIGHT = 20;

export class TextAdapter implements Adapter {
  readonly manifest = textManifest;
  private text = '';
  private lines: string[] = [];

  async parse(
    source: FileSourceReader,
    signal: AbortSignal,
  ): Promise<DocumentModel> {
    const buffer = await source.arrayBuffer();
    throwIfCancelled(signal);

    this.text = decodeText(buffer, source.meta.mimeType);
    this.lines = this.text.split('\n');

    const page: PageRef = {
      index: 0,
      width: Math.max(widestLine(this.lines), 400),
      height: Math.max(this.lines.length * LINE_HEIGHT, 400),
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
    target.innerHTML = '';

    const pre = document.createElement('pre');
    pre.textContent = this.text;
    pre.style.fontFamily = 'var(--dv-font-mono)';
    pre.style.fontSize = `${14 * ctx.scale}px`;
    pre.style.lineHeight = '1.5';
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.wordBreak = 'break-word';
    pre.style.padding = '16px';
    pre.style.margin = '0';
    pre.style.color = 'var(--dv-page-ink)';
    pre.style.background = 'transparent';

    target.appendChild(pre);

    return {
      width: ctx.page.width * ctx.scale,
      height: ctx.page.height * ctx.scale,
    };
  }

  async getTextLayer(
    _pageIndex: number,
    _signal?: AbortSignal,
  ): Promise<TextLayer> {
    return lineTextLayer(this.lines, LINE_HEIGHT);
  }

  dispose(): void {
    this.text = '';
    this.lines = [];
  }
}
