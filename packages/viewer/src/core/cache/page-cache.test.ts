import { describe, it, expect } from 'vitest';
import { estimateBitmapByteSize, makeCacheKey } from './page-cache';

describe('estimateBitmapByteSize', () => {
  it('counts the dpr-scaled backing store (dpr on both axes)', () => {
    // 100x100 CSS px at dpr 2 -> 200x200 device px -> 200*200*4 bytes.
    expect(estimateBitmapByteSize(100, 100, 2)).toBe(200 * 200 * 4);
    // dpr 1 is just the CSS pixels.
    expect(estimateBitmapByteSize(100, 100, 1)).toBe(100 * 100 * 4);
  });
});

describe('makeCacheKey', () => {
  it('includes dpr so high-DPI renders are not confused with 1x', () => {
    expect(makeCacheKey('pdf', 0, 1, 0, 1)).not.toBe(makeCacheKey('pdf', 0, 1, 0, 2));
  });
});
