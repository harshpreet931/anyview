import type {
  Adapter,
  DocumentModel,
  FileSourceReader,
  PageRef,
  RenderContext,
  RenderResult,
  TextLayer,
} from '../../core/types';
import { canvasPixelRatio } from '../../core/limits';
import { throwIfCancelled } from '../../core/errors';
import { imageManifest } from './manifest';

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
