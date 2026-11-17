/// <reference types="vite/client" />

import * as Comlink from 'comlink';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import type { ParsedPdf, PdfOutlineItem, PdfMetadata, PdfWorkerApi } from './types';
import { totalRotation, type Rotation } from '../../core/rotation';
import { loadParser } from '../../core/load-parser';

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

function loadPdfjs() {
  pdfjsPromise ??= loadParser('pdfjs-dist', async () => {
    const [lib, worker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs'),
    ]);
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
    return lib;
  }).catch((err) => {
    pdfjsPromise = null;
    throw err;
  });
  return pdfjsPromise;
}

class OffscreenCanvasFactory {
  create(width: number, height: number) {
    if (width <= 0 || height <= 0) throw new Error('Invalid canvas size');
    const canvas = new OffscreenCanvas(width, height);
    return { canvas, context: canvas.getContext('2d') };
  }
  reset(
    cc: { canvas: OffscreenCanvas | null },
    width: number,
    height: number,
  ) {
    if (!cc.canvas) throw new Error('Canvas is not specified');
    if (width <= 0 || height <= 0) throw new Error('Invalid canvas size');
    cc.canvas.width = width;
    cc.canvas.height = height;
  }
  destroy(cc: { canvas: OffscreenCanvas | null; context: unknown }) {
    if (!cc.canvas) throw new Error('Canvas is not specified');
    cc.canvas.width = 0;
    cc.canvas.height = 0;
    cc.canvas = null;
    cc.context = null;
  }
}

declare const __ANYVIEW_PDF_ASSETS__: Record<string, string> | undefined;

const BUNDLED_ASSETS =
  typeof __ANYVIEW_PDF_ASSETS__ === 'undefined' ? null : __ANYVIEW_PDF_ASSETS__;

// Resolves relative to this worker's own emitted location, not the host app's routing base.
const DEFAULT_ASSET_BASE = new URL('../pdfjs/', import.meta.url).href;

const ASSET_DIRS = {
  cMapUrl: 'cmaps/',
  standardFontDataUrl: 'standard_fonts/',
  wasmUrl: 'wasm/',
} as const;

type AssetKind = keyof typeof ASSET_DIRS;

function createBinaryDataFactory(assetBase: string | undefined) {
  return class {
    async fetch({ kind, filename }: { kind: AssetKind; filename: string }) {
      const dir = ASSET_DIRS[kind];
      const url =
        (!assetBase && BUNDLED_ASSETS?.[dir + filename]) ||
        `${assetBase || DEFAULT_ASSET_BASE}${dir}${filename}`;
      if (url.startsWith('data:')) {
        const bin = atob(url.slice(url.indexOf(',') + 1));
        return Uint8Array.from(bin, (c) => c.charCodeAt(0));
      }
      const res = await fetch(url);
      if (!res.ok || res.headers.get('content-type')?.includes('text/html')) {
        throw new Error(`Unable to load PDF ${dir.slice(0, -1)} data at: ${url}`);
      }
      return new Uint8Array(await res.arrayBuffer());
    }
  };
}

function buildPdfAssets(assetBase: string | undefined) {
  const base = assetBase || DEFAULT_ASSET_BASE;
  return {
    cMapUrl: `${base}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}standard_fonts/`,
    wasmUrl: `${base}wasm/`,
    iccUrl: `${base}iccs/`,
    disableFontFace: true,
    useSystemFonts: false,
    useWorkerFetch: false,
    BinaryDataFactory: createBinaryDataFactory(assetBase),
    CanvasFactory: OffscreenCanvasFactory,
  } as const;
}

const docs = new Map<number, PDFDocumentProxy>();
let nextDocId = 1;
const active = new Set<number>();
const cancelled = new Set<number>();
const tasks = new Map<number, RenderTask>();

function getDoc(docId: number): PDFDocumentProxy {
  const doc = docs.get(docId);
  if (!doc) throw new Error(`PDF document ${docId} not found (already disposed?).`);
  return doc;
}

async function destToPageIndex(
  doc: PDFDocumentProxy,
  dest: string | readonly unknown[] | null,
): Promise<number | null> {
  try {
    const explicit =
      typeof dest === 'string' ? await doc.getDestination(dest) : dest;
    if (!Array.isArray(explicit) || explicit.length === 0) return null;
    const ref = explicit[0];
    if (ref && typeof ref === 'object') {
      return await doc.getPageIndex(ref as { num: number; gen: number });
    }
    if (typeof ref === 'number') return ref;
    return null;
  } catch {
    return null;
  }
}

type RawOutlineItem = {
  title: string;
  dest: string | readonly unknown[] | null;
  items?: readonly RawOutlineItem[];
};

async function mapOutline(
  doc: PDFDocumentProxy,
  items: readonly RawOutlineItem[],
): Promise<PdfOutlineItem[]> {
  return Promise.all(
    items.map(async (item) => {
      const [pageIndex, children] = await Promise.all([
        destToPageIndex(doc, item.dest),
        item.items && item.items.length ? mapOutline(doc, item.items) : null,
      ]);
      return {
        title: item.title,
        dest: { pageIndex: pageIndex ?? 0 },
        ...(children ? { items: children } : {}),
      };
    }),
  );
}

async function renderInto(
  docId: number,
  pageIndex: number,
  scale: number,
  rotation: number,
  dpr: number,
  renderId?: number,
): Promise<ImageBitmap> {
  const page = await getDoc(docId).getPage(pageIndex + 1);
  if (renderId != null && cancelled.has(renderId)) throw new Error('Render cancelled');
  // Explicit rotation REPLACES page.rotate rather than composing, so combine the two.
  const total = totalRotation(page.rotate as Rotation, rotation as Rotation);
  const viewport = page.getViewport({ scale: scale * dpr, rotation: total });

  const canvas = new OffscreenCanvas(
    Math.ceil(viewport.width),
    Math.ceil(viewport.height),
  );
  const ctx = canvas.getContext('2d')!;

  const task = page.render({
    canvas: null,
    canvasContext: ctx as unknown as CanvasRenderingContext2D,
    viewport,
  });
  if (renderId != null) tasks.set(renderId, task);
  try {
    await task.promise;
  } finally {
    if (renderId != null) tasks.delete(renderId);
  }

  return canvas.transferToImageBitmap();
}

const api: PdfWorkerApi = {
  async parse(
    data: ArrayBuffer,
    password?: string,
    assetBase?: string,
  ): Promise<ParsedPdf> {
    const pdfjsLib = await loadPdfjs();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(data),
      password,
      ...buildPdfAssets(assetBase),
    });

    let doc;
    try {
      doc = await loadingTask.promise;
    } catch (err) {
      await loadingTask.destroy().catch(() => {});
      throw err;
    }
    const pageCount = doc.numPages;

    const pages = await Promise.all(
      Array.from({ length: pageCount }, async (_, i) => {
        const page = await doc.getPage(i + 1);
        // Explicit rotation:0 gives canonical dims - pdf.js only applies the page's /Rotate when rotation is omitted.
        const viewport = page.getViewport({ scale: 1, rotation: 0 });
        return {
          index: i,
          width: viewport.width,
          height: viewport.height,
          rotation: page.rotate as Rotation,
        };
      }),
    );

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
    renderId?: number,
  ): Promise<ImageBitmap> {
    if (renderId != null) active.add(renderId);
    try {
      return await renderInto(docId, pageIndex, scale, rotation, dpr, renderId);
    } finally {
      if (renderId != null) {
        active.delete(renderId);
        cancelled.delete(renderId);
      }
    }
  },

  cancelRender(renderId: number) {
    const task = tasks.get(renderId);
    if (task) task.cancel();
    else if (active.has(renderId)) cancelled.add(renderId);
  },


  async getTextContent(docId: number, pageIndex: number, rotation = 0) {
    const page = await getDoc(docId).getPage(pageIndex + 1);
    const total = totalRotation(page.rotate as Rotation, rotation as Rotation);
    const viewport = page.getViewport({ scale: 1, rotation: total });
    const content = await page.getTextContent();

    const vt = viewport.transform;

    const items = content.items
      .filter(
        (item): item is import('pdfjs-dist/types/src/display/api').TextItem =>
          'str' in item,
      )
      .map((item) => {
        const tm = item.transform as readonly number[];

        const c = vt[0] * tm[2] + vt[2] * tm[3];
        const d = vt[1] * tm[2] + vt[3] * tm[3];
        const e = vt[0] * tm[4] + vt[2] * tm[5] + vt[4];
        const f = vt[1] * tm[4] + vt[3] * tm[5] + vt[5];

        const fontHeight = Math.hypot(c, d) || item.height || 10;
        const angle = Math.atan2(
          vt[1] * tm[0] + vt[3] * tm[1],
          vt[0] * tm[0] + vt[2] * tm[1],
        );

        return {
          str: item.str,
          transform: tm,
          width: item.width || item.str.length * fontHeight * 0.5,
          height: fontHeight,
          x: e + fontHeight * Math.sin(angle),
          y: f - fontHeight * Math.cos(angle),
          angle,
        };
      });

    return {
      items,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
    };
  },

  async getOutline(docId: number): Promise<PdfOutlineItem[] | null> {
    const doc = getDoc(docId);
    const outline = (await doc.getOutline()) as RawOutlineItem[] | null;
    if (!outline) return null;
    return mapOutline(doc, outline);
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
      await doc.loadingTask.destroy();
    }
  },
};

Comlink.expose(api);
