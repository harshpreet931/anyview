/* ============================================================
 * PDF Worker — runs in Web Worker via Comlink
 * Handles PDF.js parsing and page rendering off main thread.
 * ============================================================ */

import * as Comlink from 'comlink';
// IMPORTANT: use STATIC imports here. A top-level `await import(...)` would
// suspend this module's evaluation before `Comlink.expose()` registers its
// message listener, causing the very first RPC (parse) to be lost and hang.
import * as pdfjsLib from 'pdfjs-dist';
import PdfJsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { ParsedPdf, PdfOutlineItem, PdfMetadata, PdfWorkerApi } from './types';

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfJsWorkerUrl;

// The parsed documents live here, inside the worker. They are not
// serializable across Comlink, so the main thread references them by id.
const docs = new Map<number, PDFDocumentProxy>();
let nextDocId = 1;

function getDoc(docId: number): PDFDocumentProxy {
  const doc = docs.get(docId);
  if (!doc) throw new Error(`PDF document ${docId} not found (already disposed?).`);
  return doc;
}

const api: PdfWorkerApi = {
  async parse(data: ArrayBuffer, password?: string): Promise<ParsedPdf> {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(data),
      password,
    });

    const doc = await loadingTask.promise;
    const pageCount = doc.numPages;
    const pages = [];

    for (let i = 1; i <= pageCount; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1 });
      pages.push({
        index: i - 1,
        width: viewport.width,
        height: viewport.height,
        rotation: viewport.rotation as 0 | 90 | 180 | 270,
      });
    }

    const docId = nextDocId++;
    docs.set(docId, doc);

    return { pageCount, pages, docId };
  },

  async renderPage(
    docId: number,
    pageIndex: number,
    scale: number,
    rotation: number,
    dpr: number,
  ): Promise<ImageBitmap> {
    const page = await getDoc(docId).getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: scale * dpr, rotation });

    const canvas = new OffscreenCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height),
    );
    const ctx = canvas.getContext('2d')!;

    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    return canvas.transferToImageBitmap();
  },

  async getTextContent(docId: number, pageIndex: number) {
    const page = await getDoc(docId).getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const vt = viewport.transform;

    const items = content.items
      .filter(
        (item): item is import('pdfjs-dist/types/src/display/api').TextItem =>
          'str' in item,
      )
      .map((item) => {
        const tm = item.transform as readonly number[];

        // Compose the page viewport transform with the per-item text matrix
        // (Util.transform): maps PDF text space → top-left device space.
        const c = vt[0] * tm[2] + vt[2] * tm[3];
        const d = vt[1] * tm[2] + vt[3] * tm[3];
        const e = vt[0] * tm[4] + vt[2] * tm[5] + vt[4];
        const f = vt[1] * tm[4] + vt[3] * tm[5] + vt[5];

        // fontHeight = vertical scale magnitude of the composed matrix.
        const fontHeight = Math.hypot(c, d) || item.height || 10;

        // `transform[4..5]` (e,f) is the baseline origin; the box top is one
        // ascent above it. Emit a top-left box so the layer can position text
        // and search highlights without any further transform math.
        return {
          str: item.str,
          transform: tm,
          width: item.width || item.str.length * fontHeight * 0.5,
          height: fontHeight,
          x: e,
          y: f - fontHeight,
        };
      });

    return {
      items,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
    };
  },

  async getOutline(docId: number): Promise<PdfOutlineItem[] | null> {
    const outline = await getDoc(docId).getOutline();
    if (!outline) return null;

    return outline.map((item: { title: string; dest: string | readonly unknown[] | null; items?: readonly unknown[] }) => ({
      title: item.title,
      dest: item.dest ?? '',
      ...(item.items ? { items: (item.items as unknown[]).map((child: any) => ({
        title: child.title,
        dest: child.dest ?? '',
      })) } : {}),
    }));
  },

  async getMetadata(docId: number): Promise<PdfMetadata | null> {
    const meta = await getDoc(docId).getMetadata();
    const info = meta.info as Record<string, unknown>;

    const raw: Record<string, unknown> = {
      title: info.Title as string | undefined,
      author: info.Author as string | undefined,
      subject: info.Subject as string | undefined,
      keywords: info.Keywords as string | undefined,
      creator: info.Creator as string | undefined,
      producer: info.Producer as string | undefined,
      creationDate: info.CreationDate
        ? new Date(info.CreationDate as string)
        : undefined,
      modificationDate: info.ModDate
        ? new Date(info.ModDate as string)
        : undefined,
    };

    for (const key of Object.keys(raw)) {
      if (raw[key] === undefined) delete raw[key];
    }

    return raw as PdfMetadata;
  },

  async dispose(docId: number): Promise<void> {
    const doc = docs.get(docId);
    if (doc) {
      docs.delete(docId);
      await doc.destroy();
    }
  },
};

Comlink.expose(api);
