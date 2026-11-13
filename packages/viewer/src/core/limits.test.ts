import { describe, it, expect } from 'vitest';
import { assertTransformSize, canvasPixelRatio, MAX_CANVAS_AREA, MAX_CANVAS_SIDE, MAX_TRANSFORM_BYTES } from './limits';
import { isViewerError } from './errors';

describe('assertTransformSize', () => {
  it('allows documents within the budget', () => {
    expect(() => assertTransformSize(0)).not.toThrow();
    expect(() => assertTransformSize(MAX_TRANSFORM_BYTES)).not.toThrow();
  });

  it('rejects oversized documents with a MEMORY_LIMIT error', () => {
    try {
      assertTransformSize(MAX_TRANSFORM_BYTES + 1);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(isViewerError(e)).toBe(true);
      expect((e as { code: string }).code).toBe('MEMORY_LIMIT');
    }
  });
});

describe('canvasPixelRatio', () => {
  it('keeps the device ratio when the canvas fits', () => {
    expect(canvasPixelRatio(800, 600, 2)).toBe(2);
  });

  it('shrinks the ratio so area and side stay within browser limits', () => {
    const r = canvasPixelRatio(4032 * 3, 3024 * 3, 3);
    expect(4032 * 3 * r * 3024 * 3 * r).toBeLessThanOrEqual(MAX_CANVAS_AREA + 1);
    const tall = canvasPixelRatio(500, 40000, 2);
    expect(40000 * tall).toBeLessThanOrEqual(MAX_CANVAS_SIDE);
  });
});
