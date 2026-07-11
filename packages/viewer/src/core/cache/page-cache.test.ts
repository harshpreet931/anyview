import { describe, it, expect } from 'vitest';
import { estimateBitmapByteSize, makeCacheKey } from './page-cache';

describe('estimateBitmapByteSize', () => {
  it('counts the dpr-scaled backing store (dpr on both axes)', () => {
    expect(estimateBitmapByteSize(100, 100, 2)).toBe(200 * 200 * 4);
    expect(estimateBitmapByteSize(100, 100, 1)).toBe(100 * 100 * 4);
  });
});

describe('makeCacheKey', () => {
  it('includes dpr so high-DPI renders are not confused with 1x', () => {
    expect(makeCacheKey('pdf', 0, 1, 0, 1)).not.toBe(makeCacheKey('pdf', 0, 1, 0, 2));
  });
});
