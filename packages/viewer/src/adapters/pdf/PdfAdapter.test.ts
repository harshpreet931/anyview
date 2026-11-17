import { describe, it, expect, vi } from 'vitest';
import { PdfAdapter } from './PdfAdapter';
import type { RenderContext } from '../../core/types';

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
});
