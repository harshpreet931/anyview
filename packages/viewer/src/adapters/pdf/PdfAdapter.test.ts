import { describe, it, expect, vi } from 'vitest';
import { PdfAdapter } from './PdfAdapter';
import type { RenderContext, SearchQuery } from '../../core/types';

describe('PdfAdapter.renderPage', () => {
  it('does not paint a render that finished after it was cancelled', async () => {
    let finish!: (b: unknown) => void;
    const bitmap = { width: 10, height: 10, close: vi.fn() };
    const adapter = new PdfAdapter();
    Object.assign(adapter, {
      docId: 1,
      remote: { renderPage: () => new Promise((r) => (finish = r)), cancelRender: vi.fn() },
    });

    const canvas = document.createElement('canvas');
    canvas.width = 123;
    const draw = vi.fn();
    vi.spyOn(canvas, 'getContext').mockReturnValue({ drawImage: draw } as unknown as CanvasRenderingContext2D);

    const controller = new AbortController();
    const ctx: RenderContext = {
      page: { index: 0, width: 600, height: 800, rotation: 0 },
      target: canvas,
      scale: 2,
      rotation: 0,
      devicePixelRatio: 1,
      signal: controller.signal,
    };
    const pending = adapter.renderPage(ctx);
    controller.abort();
    finish(bitmap);
    await pending.catch(() => {});

    expect(canvas.width).toBe(123);
    expect(draw).not.toHaveBeenCalled();
    expect(bitmap.close).toHaveBeenCalled();
  });

  it('cancels the worker render when the page render is aborted', async () => {
    const cancelRender = vi.fn();
    let renderId: number | undefined;
    const adapter = new PdfAdapter();
    Object.assign(adapter, {
      docId: 1,
      remote: {
        renderPage: (...args: unknown[]) => {
          renderId = args[5] as number;
          return new Promise(() => {});
        },
        cancelRender,
      },
    });
    const controller = new AbortController();
    const pending = adapter.renderPage({
      page: { index: 0, width: 600, height: 800, rotation: 0 },
      target: document.createElement('canvas'),
      scale: 1,
      rotation: 0,
      devicePixelRatio: 1,
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toThrow();
    expect(renderId).toBeTypeOf('number');
    expect(cancelRender).toHaveBeenCalledWith(renderId);
  });

  it('hands the rendered bitmap back for caching instead of closing it', async () => {
    const bitmap = { width: 600, height: 800, close: vi.fn() };
    const adapter = new PdfAdapter();
    Object.assign(adapter, {
      docId: 1,
      remote: { renderPage: () => Promise.resolve(bitmap), cancelRender: vi.fn() },
    });
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    const result = await adapter.renderPage({
      page: { index: 0, width: 600, height: 800, rotation: 0 },
      target: canvas,
      scale: 1,
      rotation: 0,
      devicePixelRatio: 1,
      signal: new AbortController().signal,
    });
    expect(result.bitmap).toBe(bitmap);
    expect(bitmap.close).not.toHaveBeenCalled();
  });
});

describe('PdfAdapter.search', () => {
  const run = (str: string, x: number, y: number, width: number) => ({ str, transform: [], width, height: 10, x, y, angle: 0 });
  const searchable = (items: ReturnType<typeof run>[]) => {
    const adapter = new PdfAdapter();
    Object.assign(adapter, {
      docId: 1,
      parsedPdf: { pageCount: 1, pages: [], docId: 1 },
      remote: { getTextContent: async () => ({ items, viewportWidth: 1000, viewportHeight: 1000 }) },
    });
    return adapter;
  };
  const q = (text: string, opts: Partial<SearchQuery> = {}): SearchQuery => ({
    text, caseSensitive: false, wholeWord: false, regex: false, diacritics: false, ...opts,
  });

  it('counts every occurrence in a run and boxes only the matched characters', async () => {
    const adapter = searchable([run('revenue up, revenue down', 100, 200, 240)]);
    const result = await adapter.search(q('Revenue'), new AbortController().signal);
    expect(result.totalMatches).toBe(2);
    expect(result.matches.map((m) => m.text)).toEqual(['revenue', 'revenue']);
    const [a, b] = result.matches;
    expect(a!.x).toBeCloseTo(0.1);
    expect(a!.width).toBeCloseTo(0.07);
    expect(b!.x).toBeCloseTo(0.22);
    expect(b!.width).toBeCloseTo(0.07);
    expect(a!.y).toBeCloseTo(0.2);
    expect(a!.height).toBeCloseTo(0.01);
    expect(a).toMatchObject({ runIndex: 0, start: 0, end: 7 });
    expect(b).toMatchObject({ runIndex: 0, start: 12, end: 19 });
  });

  it('keeps whole-word and regex matching per occurrence', async () => {
    const adapter = searchable([run('cat catalog cat', 0, 0, 150), run('scatter', 0, 20, 70)]);
    const words = await adapter.search(q('cat', { wholeWord: true }), new AbortController().signal);
    expect(words.matches.map((m) => m.start)).toEqual([0, 12]);
    const re = await adapter.search(q('c.t', { regex: true }), new AbortController().signal);
    expect(re.totalMatches).toBe(4);
    const empty = await adapter.search(q('(', { regex: true }), new AbortController().signal);
    expect(empty.totalMatches).toBe(0);
  });
});
