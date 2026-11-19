import * as Comlink from 'comlink';
import type {
  Adapter,
  AdapterManifest,
  DocumentModel,
  DocumentMetadata,
  FileSourceReader,
  OutlineNode,
  PageRef,
  RenderContext,
  RenderResult,
  TextLayer,
  TextLayerItem,
  SearchQuery,
  SearchResult,
  SearchMatch,
  ParseOptions,
} from '../../core/types';
import { ViewerError } from '../../core/errors';
import { canvasPixelRatio } from '../../core/limits';
import { totalRotation, isSidewaysRotation, type Rotation } from '../../core/rotation';
import type { ParsedPdf, PdfWorkerApi, PdfOutlineItem } from './types';

export const pdfManifest: AdapterManifest = {
  id: 'pdf',
  label: 'PDF Document',
  extensions: ['pdf'],
  mimeTypes: ['application/pdf'],
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M3 1h7l4 4v10H3V1zm7 0v4h4l-4-4zM5 7v1h6V7H5zm0 3v1h6v-1H5zm0 3v1h6v-1H5z"/></svg>`,
  features: {
    search: true,
    annotations: true,
    textSelection: true,
    print: true,
    thumbnails: true,
    outline: true,
    zoom: true,
    rotation: true,
    attachments: true,
    fullscreen: true,
    download: true,
  },
  priority: 100,
  protocolVersion: 1,
};

export class PdfAdapter implements Adapter {
  readonly manifest = pdfManifest;

  static pdfAssetBase: string | undefined;
  static configureAssets(baseUrl: string): void {
    PdfAdapter.pdfAssetBase = baseUrl;
  }

  private worker: Worker | null = null;
  private remote: Comlink.Remote<PdfWorkerApi> | null = null;
  private docId: number | null = null;
  private renderSeq = 0;
  private parsedPdf: ParsedPdf | null = null;
  private originalBuffer: ArrayBuffer | null = null;

  private ensureWorker(): Comlink.Remote<PdfWorkerApi> {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('./pdf.worker.ts', import.meta.url),
        { type: 'module' },
      );
      this.remote = Comlink.wrap(this.worker);
    }
    return this.remote!;
  }

  async parse(
    source: FileSourceReader,
    signal: AbortSignal,
    options?: ParseOptions,
  ): Promise<DocumentModel> {
    const remote = this.ensureWorker();

    if (!this.originalBuffer) {
      const src = await source.arrayBuffer();
      if (signal.aborted) throw new Error('Parse cancelled');
      this.originalBuffer = src.slice(0);
    }
    const buffer = this.originalBuffer.slice(0);

    try {
      const result = await remote.parse(
        Comlink.transfer(buffer, [buffer]),
        options?.password,
        PdfAdapter.pdfAssetBase,
      );
      this.docId = result.docId;
      this.parsedPdf = result;

      const outline = await this.buildOutline(remote);
      const metadata = await remote.getMetadata(this.docId).catch(() => null);

      return {
        format: 'pdf',
        meta: source.meta,
        pageCount: result.pageCount,
        pages: result.pages as readonly PageRef[],
        ...(outline ? { outline } : {}),
        ...(metadata ? { metadata: metadata as unknown as DocumentMetadata } : {}),
        permissions: {
          canPrint: true,
          canCopy: true,
          canAnnotate: true,
          canEdit: false,
          canFillForms: false,
        },
      };
    } catch (cause) {
      const name = (cause as { name?: string })?.name ?? '';
      const message = (cause as { message?: string })?.message ?? '';
      const isPasswordIssue =
        name === 'PasswordException' || /password/i.test(message);
      if (isPasswordIssue) {
        const incorrect = /incorrect/i.test(message);
        throw new ViewerError(
          incorrect ? 'PASSWORD_INCORRECT' : 'PASSWORD_REQUIRED',
          incorrect
            ? 'The password is incorrect.'
            : 'This PDF is password-protected.',
          { cause },
        );
      }
      throw new ViewerError('PARSE_ERROR', 'Failed to parse PDF.', { cause });
    }
  }

  async renderPage(ctx: RenderContext): Promise<RenderResult> {
    if (!this.remote || this.docId == null) {
      throw new ViewerError('RENDER_ERROR', 'PDF not parsed.');
    }

    try {
      const dpr = canvasPixelRatio(
        ctx.page.width * ctx.scale,
        ctx.page.height * ctx.scale,
        ctx.devicePixelRatio,
      );
      const remote = this.remote;
      const renderId = ++this.renderSeq;
      const job = remote.renderPage(this.docId, ctx.page.index, ctx.scale, ctx.rotation, dpr, renderId);
      const bitmap = await new Promise<ImageBitmap>((resolve, reject) => {
        const onAbort = () => {
          void Promise.resolve(remote.cancelRender(renderId)).catch(() => {});
          void job.then((b) => b.close(), () => {});
          reject(new DOMException('Render cancelled', 'AbortError'));
        };
        if (ctx.signal.aborted) return onAbort();
        ctx.signal.addEventListener('abort', onAbort, { once: true });
        job.then(
          (b) => {
            ctx.signal.removeEventListener('abort', onAbort);
            resolve(b);
          },
          (e: unknown) => {
            ctx.signal.removeEventListener('abort', onAbort);
            reject(e);
          },
        );
      });
      if (ctx.signal.aborted) {
        bitmap.close();
        throw new DOMException('Render cancelled', 'AbortError');
      }

      const target = ctx.target as HTMLCanvasElement;

      const cssWidth = ctx.page.width * ctx.scale;
      const cssHeight = ctx.page.height * ctx.scale;
      const isSideways = isSidewaysRotation(
        totalRotation(ctx.page.rotation as Rotation, ctx.rotation as Rotation),
      );
      const outWidth = isSideways ? cssHeight : cssWidth;
      const outHeight = isSideways ? cssWidth : cssHeight;

      if (target instanceof HTMLCanvasElement) {
        const renderWidth = cssWidth * dpr;
        const renderHeight = cssHeight * dpr;

        target.width = isSideways ? renderHeight : renderWidth;
        target.height = isSideways ? renderWidth : renderHeight;

        const c2d = target.getContext('2d');
        if (c2d) {
          c2d.drawImage(bitmap, 0, 0, target.width, target.height);
        }
        return { width: outWidth, height: outHeight, bitmap };
      }
      bitmap.close();

      return {
        width: outWidth,
        height: outHeight,
      };
    } catch (cause) {
      throw new ViewerError('RENDER_ERROR', 'Failed to render PDF page.', {
        cause,
      });
    }
  }

  async getTextLayer(
    pageIndex: number,
    signal?: AbortSignal,
    rotation = 0,
  ): Promise<TextLayer> {
    return { pageIndex, items: (await this.textRuns(pageIndex, signal, rotation)).map((r) => r.item) };
  }

  private async textRuns(
    pageIndex: number,
    signal: AbortSignal | undefined,
    rotation: number,
  ): Promise<Array<{ item: TextLayerItem; slice: (from: number, to: number) => Box }>> {
    if (!this.remote || this.docId == null || signal?.aborted) return [];
    try {
      const result = await this.remote.getTextContent(this.docId, pageIndex, rotation);
      const vw = result.viewportWidth;
      const vh = result.viewportHeight;
      return result.items.map((run) => {
        const angle = run.angle ?? 0;
        const degrees = Math.round((angle * 180) / Math.PI * 100) / 100;
        const length = run.str.length || 1;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const slice = (from: number, to: number) =>
          boundingBox(
            run.x + cos * run.width * (from / length),
            run.y + sin * run.width * (from / length),
            run.width * ((to - from) / length),
            run.height,
            angle,
            vw,
            vh,
          );
        return {
          item: {
            str: run.str,
            x: run.x / vw,
            y: run.y / vh,
            width: run.width / vw,
            height: run.height / vh,
            ...(degrees ? { angle: degrees } : {}),
          },
          slice,
        };
      });
    } catch {
      return [];
    }
  }

  async search(
    query: SearchQuery,
    signal: AbortSignal,
    rotation = 0,
  ): Promise<SearchResult> {
    if (!this.remote || this.docId == null || !this.parsedPdf) {
      return { query, matches: [], totalMatches: 0 };
    }

    const pages = await Promise.all(
      Array.from({ length: this.parsedPdf.pageCount }, (_, pageIdx) =>
        this.textRuns(pageIdx, signal, rotation),
      ),
    );
    if (signal.aborted) return { query, matches: [], totalMatches: 0 };

    const matches: SearchMatch[] = [];

    const pattern = searchPattern(query);
    if (!pattern) return { query, matches: [], totalMatches: 0 };
    pages.forEach((runs, pageIndex) => {
      runs.forEach(({ item, slice }, runIndex) => {
        for (const m of item.str.matchAll(pattern)) {
          if (!m[0]) continue;
          const start = m.index;
          const end = start + m[0].length;
          matches.push({ pageIndex, text: m[0], ...slice(start, end), runIndex, start, end });
        }
      });
    });

    return { query, matches, totalMatches: matches.length };
  }

  private async buildOutline(
    remote: Comlink.Remote<PdfWorkerApi>,
  ): Promise<readonly OutlineNode[] | undefined> {
    if (this.docId == null) return undefined;
    try {
      const outline = await remote.getOutline(this.docId);
      if (!outline || outline.length === 0) return undefined;

      return outline.map((item) => this.convertOutlineNode(item));
    } catch {
      return undefined;
    }
  }

  private convertOutlineNode(item: PdfOutlineItem): OutlineNode {
    return {
      title: item.title,
      dest: item.dest,
      ...(item.items ? { children: item.items.map((child) => this.convertOutlineNode(child)) } : {}),
    };
  }

  async exportDocument(_format: 'original' | 'pdf'): Promise<Blob> {
    if (this.originalBuffer) {
      return new Blob([this.originalBuffer], { type: 'application/pdf' });
    }
    return new Blob([], { type: 'application/pdf' });
  }

  dispose(): void {
    if (this.docId != null && this.remote) {
      this.remote.dispose(this.docId).catch(() => {});
    }
    this.worker?.terminate();
    this.worker = null;
    this.remote = null;
    this.docId = null;
    this.parsedPdf = null;
    this.originalBuffer = null;
  }
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function boundingBox(x: number, y: number, width: number, height: number, angle: number, vw: number, vh: number): Box {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const xs = [x, x + cos * width, x - sin * height, x + cos * width - sin * height];
  const ys = [y, y + sin * width, y + cos * height, y + sin * width + cos * height];
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return {
    x: left / vw,
    y: top / vh,
    width: (Math.max(...xs) - left) / vw,
    height: (Math.max(...ys) - top) / vh,
  };
}

function searchPattern(query: SearchQuery): RegExp | null {
  if (!query.text) return null;
  const flags = query.caseSensitive ? 'g' : 'gi';
  // query.regex is the caller opting into raw regex syntax, so their text is the pattern;
  // every other path escapes it. Matches how HtmlAdapter picks its pattern.
  const pattern = query.regex ? query.text : escapeRegex(query.text);
  try {
    return new RegExp(query.wholeWord && !query.regex ? `\\b${pattern}\\b` : pattern, flags);
  } catch {
    return null;
  }
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
