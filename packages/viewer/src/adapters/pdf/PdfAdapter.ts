import * as Comlink from 'comlink';
import type {
  Adapter,
  AdapterManifest,
  DocumentModel,
  FileSourceReader,
  OutlineNode,
  RenderContext,
  RenderResult,
  TextLayer,
  TextLayerItem,
  SearchQuery,
  SearchResult,
  SearchMatch,
  ParseOptions,
} from '../../core/types';
import { ViewerError, throwIfCancelled } from '../../core/errors';
import { canvasPixelRatio } from '../../core/limits';
import { displayedPageSize, type Rotation } from '../../core/rotation';
import { searchPattern } from '../../core/search-pattern';
import type { PdfTextRun, PdfWorkerApi } from './types';

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
  private pageCount = 0;
  private renderSeq = 0;
  private originalBuffer: ArrayBuffer | null = null;

  private ensureWorker(): Comlink.Remote<PdfWorkerApi> {
    if (!this.remote) {
      this.worker = new Worker(
        new URL('./pdf.worker.ts', import.meta.url),
        { type: 'module' },
      );
      this.remote = Comlink.wrap(this.worker);
    }
    return this.remote;
  }

  private parsedDoc(): { remote: Comlink.Remote<PdfWorkerApi>; docId: number } | null {
    return this.remote && this.docId != null ? { remote: this.remote, docId: this.docId } : null;
  }

  async parse(
    source: FileSourceReader,
    signal: AbortSignal,
    options?: ParseOptions,
  ): Promise<DocumentModel> {
    const remote = this.ensureWorker();

    if (!this.originalBuffer) {
      const src = await source.arrayBuffer();
      throwIfCancelled(signal);
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
      this.pageCount = result.pageCount;

      const outline = await this.buildOutline(remote, result.docId);
      const metadata = await remote.getMetadata(result.docId).catch(() => null);

      return {
        format: 'pdf',
        meta: source.meta,
        pageCount: result.pageCount,
        pages: result.pages,
        ...(outline ? { outline } : {}),
        ...(metadata ? { metadata } : {}),
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
    const parsed = this.parsedDoc();
    if (!parsed) throw new ViewerError('RENDER_ERROR', 'PDF not parsed.');
    const { remote, docId } = parsed;

    try {
      const { width, height } = displayedPageSize(
        ctx.page.width,
        ctx.page.height,
        ctx.page.rotation,
        ctx.rotation,
        ctx.scale,
      );
      const dpr = canvasPixelRatio(width, height, ctx.devicePixelRatio);
      const renderId = ++this.renderSeq;
      const job = remote.renderPage(docId, ctx.page.index, ctx.scale, ctx.rotation, dpr, renderId);
      const bitmap = await new Promise<ImageBitmap>((resolve, reject) => {
        const onAbort = () => {
          remote.cancelRender(renderId).catch(() => {});
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

      const target = ctx.target;
      if (target instanceof HTMLCanvasElement) {
        target.width = width * dpr;
        target.height = height * dpr;
        target.getContext('2d')?.drawImage(bitmap, 0, 0, target.width, target.height);
        return { width, height, bitmap };
      }
      bitmap.close();
      return { width, height };
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
    const parsed = this.parsedDoc();
    if (!parsed || signal?.aborted) return [];
    try {
      const result = await parsed.remote.getTextContent(parsed.docId, pageIndex, rotation as Rotation);
      const vw = result.viewportWidth;
      const vh = result.viewportHeight;
      return result.items.map((run) => {
        const degrees = Math.round((run.angle * 180) / Math.PI * 100) / 100;
        return {
          item: {
            str: run.str,
            x: run.x / vw,
            y: run.y / vh,
            width: run.width / vw,
            height: run.height / vh,
            ...(degrees ? { angle: degrees } : {}),
          },
          slice: (from: number, to: number) => boundingBox(run, from, to, vw, vh),
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
    const none = { query, matches: [], totalMatches: 0 };
    const pattern = searchPattern(query);
    if (!pattern || !this.parsedDoc()) return none;

    const pages = await Promise.all(
      Array.from({ length: this.pageCount }, (_, pageIdx) =>
        this.textRuns(pageIdx, signal, rotation),
      ),
    );
    if (signal.aborted) return none;

    const matches: SearchMatch[] = [];
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
    docId: number,
  ): Promise<readonly OutlineNode[] | undefined> {
    try {
      const outline = await remote.getOutline(docId);
      return outline?.length ? outline : undefined;
    } catch {
      return undefined;
    }
  }

  async exportDocument(_format: 'original' | 'pdf'): Promise<Blob> {
    return new Blob(this.originalBuffer ? [this.originalBuffer] : [], { type: 'application/pdf' });
  }

  dispose(): void {
    if (this.docId != null && this.remote) {
      this.remote.dispose(this.docId).catch(() => {});
    }
    this.worker?.terminate();
    this.worker = null;
    this.remote = null;
    this.docId = null;
    this.pageCount = 0;
    this.originalBuffer = null;
  }
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function boundingBox(run: PdfTextRun, from: number, to: number, vw: number, vh: number): Box {
  const length = run.str.length || 1;
  const cos = Math.cos(run.angle);
  const sin = Math.sin(run.angle);
  const x = run.x + cos * run.width * (from / length);
  const y = run.y + sin * run.width * (from / length);
  const width = run.width * ((to - from) / length);
  const height = run.height;
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
