/* ============================================================
 * Image Adapter
 * Native browser image rendering — no worker needed.
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
} from '../../core/types';

export const imageManifest: AdapterManifest = {
  id: 'image',
  label: 'Image',
  extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'],
  mimeTypes: [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/svg+xml',
    'image/avif',
  ],
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M2.5 3.5h11v9h-11v-9zm-.5-1a.5.5 0 0 0-.5.5v10a.5.5 0 0 0 .5.5h12a.5.5 0 0 0 .5-.5V3a.5.5 0 0 0-.5-.5h-12zM5 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-1.5 4l2.5-3 2 2.5L11 7l2.5 4h-10z"/></svg>`,
  features: {
    search: false,
    annotations: true,
    textSelection: false,
    print: true,
    thumbnails: false,
    outline: false,
    zoom: true,
    rotation: true,
    attachments: false,
    fullscreen: true,
    download: true,
  },
  priority: 100,
  protocolVersion: 1,
};

export class ImageAdapter implements Adapter {
  readonly manifest = imageManifest;
  private objectUrl: string | null = null;
  private naturalWidth = 0;
  private naturalHeight = 0;

  async parse(
    source: FileSourceReader,
    signal: AbortSignal,
  ): Promise<DocumentModel> {
    const buffer = await source.arrayBuffer();
    if (signal.aborted) throw new Error('Parse cancelled');

    const blob = new Blob([buffer], { type: source.meta.mimeType });
    this.objectUrl = URL.createObjectURL(blob);

    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.naturalWidth = img.naturalWidth;
        this.naturalHeight = img.naturalHeight;
        resolve();
      };
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.src = this.objectUrl!;
    });

    if (signal.aborted) throw new Error('Parse cancelled');

    const page: PageRef = {
      index: 0,
      width: this.naturalWidth,
      height: this.naturalHeight,
      rotation: 0,
    };

    return {
      format: 'image',
      meta: source.meta,
      pageCount: 1,
      pages: [page],
    };
  }

  async renderPage(ctx: RenderContext): Promise<RenderResult> {
    const target = ctx.target as HTMLElement;
    target.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.style.width = `${ctx.page.width * ctx.scale}px`;
    wrapper.style.height = `${ctx.page.height * ctx.scale}px`;
    wrapper.style.overflow = 'hidden';

    const img = document.createElement('img');
    img.src = this.objectUrl!;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.transform = `rotate(${ctx.rotation}deg)`;
    img.alt = ctx.page.label || 'Image';
    img.draggable = false;

    wrapper.appendChild(img);
    target.appendChild(wrapper);

    return {
      width: ctx.page.width * ctx.scale,
      height: ctx.page.height * ctx.scale,
    };
  }

  async getTextLayer(
    _pageIndex: number,
    _signal?: AbortSignal,
  ): Promise<TextLayer> {
    return { pageIndex: 0, items: [] };
  }

  dispose(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
