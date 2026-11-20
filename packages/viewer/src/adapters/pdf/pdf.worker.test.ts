import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PdfWorkerApi } from './types';
import { workerSources } from '../test-worker-sources';

const worker = vi.hoisted(() => ({ api: null as unknown, doc: null as unknown }));

vi.mock('comlink', () => ({ expose: (api: unknown) => (worker.api = api) }));
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs', () => ({}));
vi.mock('pdfjs-dist', () => ({
  getDocument: () => ({ promise: Promise.resolve(worker.doc), destroy: async () => {} }),
  Util: { transform: (_viewport: number[], item: number[]) => item },
  PDFDateString: { toDateObject: () => null },
}));

describe('pdf worker bundle', () => {
  it('has no dynamic imports, so bundlers that emit classic workers can build it', () => {
    const entry = resolve(dirname(fileURLToPath(import.meta.url)), 'pdf.worker.ts');
    const sources = workerSources(entry);
    expect(sources.size).toBeGreaterThan(1);
    for (const [file, source] of sources) {
      expect(source, file).not.toMatch(/\bimport\s*\(/);
    }
  });
});

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function fakePage(index: number) {
  const size = index % 3 === 1 ? { width: 842, height: 595 } : { width: 612, height: 792 };
  return {
    rotate: index % 5 === 4 ? 90 : 0,
    renderDone: null as Promise<void> | null,
    textStream: null as ReadableStream | null,
    getViewport: () => ({ ...size, transform: [1, 0, 0, 1, 0, 0] }),
    render: vi.fn(function (this: { renderDone: Promise<void> | null }) {
      return { promise: this.renderDone ?? Promise.resolve(), cancel: vi.fn() };
    }),
    streamTextContent: vi.fn(function (this: { textStream: ReadableStream | null }) {
      return (
        this.textStream ??
        new ReadableStream({
          start(c) {
            c.enqueue({ items: [{ str: 'hi', transform: [10, 0, 0, 10, 5, 5], width: 20, height: 10 }] });
            c.close();
          },
        })
      );
    }),
    async getTextContent() {
      const items: unknown[] = [];
      for await (const chunk of this.streamTextContent()) items.push(...chunk.items);
      return { items };
    },
    cleanup: vi.fn(() => true),
  };
}

function fakeDoc(count: number) {
  const pages = Array.from({ length: count }, (_, i) => fakePage(i));
  const stats = { inFlight: 0, maxInFlight: 0 };
  return {
    pages,
    stats,
    doc: {
      numPages: count,
      async getPage(n: number) {
        stats.maxInFlight = Math.max(stats.maxInFlight, ++stats.inFlight);
        await flush();
        stats.inFlight--;
        return pages[n - 1];
      },
      loadingTask: { destroy: async () => {} },
    },
  };
}

describe('pdf worker', () => {
  let api: PdfWorkerApi;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        getContext() {
          return {};
        }
        transferToImageBitmap() {
          return {};
        }
      },
    );
    await import('./pdf.worker');
    api = worker.api as PdfWorkerApi;
  });

  afterEach(() => vi.unstubAllGlobals());

  async function open(count: number) {
    const fake = fakeDoc(count);
    worker.doc = fake.doc;
    const parsed = await api.parse(new ArrayBuffer(8));
    return { ...fake, parsed };
  }

  it('reads exact page sizes one page at a time, so a long document never has every page in flight', async () => {
    const { parsed, stats } = await open(12);
    expect(stats.maxInFlight).toBe(1);
    expect(parsed.pageCount).toBe(12);
    expect(parsed.pages[1]).toEqual({ index: 1, width: 842, height: 595, rotation: 0 });
    expect(parsed.pages[4]).toEqual({ index: 4, width: 842, height: 595, rotation: 90 });
    expect(parsed.pages[3]).toEqual({ index: 3, width: 612, height: 792, rotation: 0 });
    expect(parsed.pages.map((p) => p.index)).toEqual([...Array(12).keys()]);
  });

  it('releases the resources of pages that are no longer in use, keeping the recent ones', async () => {
    const { parsed, pages } = await open(20);
    for (let i = 0; i < 20; i++) await api.renderPage(parsed.docId, i, 1, 0, 1, i + 1);
    expect(pages[0]!.cleanup).toHaveBeenCalled();
    expect(pages[19]!.cleanup).not.toHaveBeenCalled();
    expect(pages[15]!.cleanup).not.toHaveBeenCalled();
  });

  it('holds text requests back while a page is rendering', async () => {
    const { parsed, pages } = await open(3);
    const render = deferred();
    pages[0]!.renderDone = render.promise;
    const rendering = api.renderPage(parsed.docId, 0, 1, 0, 1, 1);
    const text = api.getTextContent(parsed.docId, 1, 0, 1);
    await flush();
    await flush();
    expect(pages[1]!.streamTextContent).not.toHaveBeenCalled();

    render.resolve();
    await rendering;
    const result = await text;
    expect(result.items.map((i) => i.str)).toEqual(['hi']);
  });

  it('drops a queued text request when it is cancelled', async () => {
    const { parsed, pages } = await open(3);
    const render = deferred();
    pages[0]!.renderDone = render.promise;
    const rendering = api.renderPage(parsed.docId, 0, 1, 0, 1, 1);
    const text = api.getTextContent(parsed.docId, 2, 0, 7);
    const outcome = text.then(() => 'done', () => 'cancelled');
    await flush();
    api.cancelText(7);
    render.resolve();
    await rendering;
    expect(await outcome).toBe('cancelled');
    await flush();
    expect(pages[2]!.streamTextContent).not.toHaveBeenCalled();
  });

  it('stops reading a page’s text when the request is cancelled mid-way', async () => {
    const { parsed, pages } = await open(2);
    const cancel = vi.fn();
    pages[1]!.textStream = new ReadableStream({
      start(c) {
        c.enqueue({ items: [{ str: 'partial', transform: [1, 0, 0, 1, 0, 0], width: 1, height: 1 }] });
      },
      cancel,
    });
    const text = api.getTextContent(parsed.docId, 1, 0, 3);
    const outcome = text.then(() => 'done', () => 'cancelled');
    await flush();
    await flush();
    expect(pages[1]!.streamTextContent).toHaveBeenCalled();
    api.cancelText(3);
    expect(await outcome).toBe('cancelled');
    expect(cancel).toHaveBeenCalled();
  });
});
