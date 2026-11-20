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
import { canvasPixelRatio } from '../../core/limits';
import { throwIfCancelled } from '../../core/errors';

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
    annotations: false,
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

const GENERIC_MIME = /^(|application\/octet-stream|text\/plain|text\/xml|application\/xml)$/i;

/** Browsers only render SVG from a blob typed image/svg+xml, so recover the type when it is missing. */
export function imageMimeType(name: string, mimeType: string, buffer: ArrayBuffer): string {
  const bare = mimeType.split(';')[0]!.trim();
  if (!GENERIC_MIME.test(bare)) return mimeType;
  const head = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 2048)));
  if (/\.svgz?$/i.test(name) || /<svg[\s>]/i.test(head)) return 'image/svg+xml';
  return mimeType;
}

export class ImageAdapter implements Adapter {
  readonly manifest = imageManifest;
  private objectUrl: string | null = null;
  private img: HTMLImageElement | null = null;
  private naturalWidth = 0;
  private naturalHeight = 0;

  async parse(
    source: FileSourceReader,
    signal: AbortSignal,
  ): Promise<DocumentModel> {
    const buffer = await source.arrayBuffer();
    throwIfCancelled(signal);

    const blob = new Blob([buffer], { type: imageMimeType(source.meta.name, source.meta.mimeType, buffer) });
    const objectUrl = URL.createObjectURL(blob);
    this.objectUrl = objectUrl;

    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // SVGs may report 0 intrinsic size; fall back to a sane default.
        this.naturalWidth = img.naturalWidth || 800;
        this.naturalHeight = img.naturalHeight || 600;
        this.img = img;
        resolve();
      };
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.src = objectUrl;
    });

    throwIfCancelled(signal);

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
    const cssW = ctx.page.width * ctx.scale;
    const cssH = ctx.page.height * ctx.scale;
    const isSideways = ctx.rotation === 90 || ctx.rotation === 270;
    const outW = isSideways ? cssH : cssW;
    const outH = isSideways ? cssW : cssH;

    const target = ctx.target;
    if (!(target instanceof HTMLCanvasElement) || !this.img) {
      return { width: outW, height: outH };
    }

    const dpr = canvasPixelRatio(outW, outH, ctx.devicePixelRatio || 1);
    target.width = Math.max(1, Math.round(outW * dpr));
    target.height = Math.max(1, Math.round(outH * dpr));

    const context = target.getContext('2d');
    if (!context) return { width: outW, height: outH };

    context.imageSmoothingQuality = 'high';
    context.clearRect(0, 0, target.width, target.height);
    context.save();
    context.translate(target.width / 2, target.height / 2);
    context.rotate((ctx.rotation * Math.PI) / 180);
    const dw = cssW * dpr;
    const dh = cssH * dpr;
    context.drawImage(this.img, -dw / 2, -dh / 2, dw, dh);
    context.restore();

    return { width: outW, height: outH };
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
    this.img = null;
  }
}
