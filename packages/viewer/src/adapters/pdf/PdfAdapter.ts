/* ============================================================
 * PDF Adapter - main thread implementation
 * Uses Comlink to communicate with the worker.
 * ============================================================ */

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

  private worker: Worker | null = null;
  private remote: Comlink.Remote<PdfWorkerApi> | null = null;
  private docId: number | null = null;
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

    // Keep our own copy of the bytes (for password retries and download), and
    // always hand the worker a fresh copy to transfer. A buffer source returns
    // the consumer's own ArrayBuffer, so transferring it directly would detach
    // their buffer out from under them.
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
      // pdf.js raises a PasswordException; its message is "No password given"
      // (needs one) or "Incorrect Password" (wrong one). Match case-insensitively
      // since the message casing varies, and across Comlink only name/message survive.
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
      const bitmap = await this.remote.renderPage(
        this.docId,
        ctx.page.index,
        ctx.scale,
        ctx.rotation,
        ctx.devicePixelRatio,
      );

      const target = ctx.target as HTMLCanvasElement;

      const cssWidth = ctx.page.width * ctx.scale;
      const cssHeight = ctx.page.height * ctx.scale;
      const isSideways = ctx.rotation === 90 || ctx.rotation === 270;
      // A 90/270 rotation transposes the page, so the displayed box is the
      // page rotated. Keep the CSS box and the reported size in sync with the
      // (already rotated) bitmap, otherwise the page is stretched out of ratio.
      const outWidth = isSideways ? cssHeight : cssWidth;
      const outHeight = isSideways ? cssWidth : cssHeight;

      if (target instanceof HTMLCanvasElement) {
        const renderWidth = cssWidth * ctx.devicePixelRatio;
        const renderHeight = cssHeight * ctx.devicePixelRatio;

        target.width = isSideways ? renderHeight : renderWidth;
        target.height = isSideways ? renderWidth : renderHeight;

        target.style.width = `${outWidth}px`;
        target.style.height = `${outHeight}px`;

        const c = target.getContext('bitmaprenderer');
        if (c) {
          c.transferFromImageBitmap(bitmap);
        } else {
          const c2d = target.getContext('2d')!;
          c2d.drawImage(bitmap, 0, 0, target.width, target.height);
          bitmap.close();
        }
      }

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
    _signal?: AbortSignal,
  ): Promise<TextLayer> {
    if (!this.remote || this.docId == null) {
      return { pageIndex, items: [] };
    }

    try {
      const result = await this.remote.getTextContent(this.docId, pageIndex);

      const items: TextLayerItem[] = result.items.map((item) => ({
        str: item.str,
        x: item.x / result.viewportWidth,
        y: item.y / result.viewportHeight,
        width: item.width / result.viewportWidth,
        height: item.height / result.viewportHeight,
      }));

      return { pageIndex, items };
    } catch {
      return { pageIndex, items: [] };
    }
  }

  async search(
    query: SearchQuery,
    signal: AbortSignal,
  ): Promise<SearchResult> {
    if (!this.remote || this.docId == null || !this.parsedPdf) {
      return { query, matches: [], totalMatches: 0 };
    }

    const matches: SearchMatch[] = [];

    for (let pageIdx = 0; pageIdx < this.parsedPdf.pageCount; pageIdx++) {
      // Stop early when a newer query supersedes this one - the caller
      // discards an aborted result, so there's no point finishing the walk.
      if (signal.aborted) break;
      const textLayer = await this.getTextLayer(pageIdx, signal);
      for (const item of textLayer.items) {
        if (this.matchText(item.str, query)) {
          matches.push({
            pageIndex: pageIdx,
            text: item.str,
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
          });
        }
      }
    }

    return { query, matches, totalMatches: matches.length };
  }

  private matchText(text: string, query: SearchQuery): boolean {
    const flags = query.caseSensitive ? 'g' : 'gi';
    if (query.regex) {
      try {
        const re = new RegExp(query.text, flags);
        return re.test(text);
      } catch {
        return false;
      }
    }
    if (query.wholeWord) {
      const re = new RegExp(`\\b${escapeRegex(query.text)}\\b`, flags);
      return re.test(text);
    }
    return text.toLowerCase().includes(query.text.toLowerCase());
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

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
