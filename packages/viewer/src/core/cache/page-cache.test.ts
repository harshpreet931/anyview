import { describe, it, expect, vi, beforeAll } from 'vitest';
import { PageCache, estimateBitmapByteSize, makeCacheKey, type CachedPage } from './page-cache';

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

describe('PageCache', () => {
  beforeAll(() => {
    if (typeof ImageBitmap === 'undefined') vi.stubGlobal('ImageBitmap', class {});
  });

  const MB = 1024 * 1024;
  const entry = (key: string, byteSize = MB) => {
    const bitmap = Object.assign(Object.create(ImageBitmap.prototype) as ImageBitmap, { close: vi.fn() });
    const page: CachedPage = { key, bitmap, byteSize, width: 10, height: 10, lastAccessed: 0 };
    return { page, close: bitmap.close };
  };

  it('closes the bitmap it replaces under the same key', () => {
    const cache = new PageCache();
    const a = entry('k');
    const b = entry('k');
    cache.set('k', a.page);
    cache.set('k', b.page);
    expect(a.close).toHaveBeenCalled();
    expect(b.close).not.toHaveBeenCalled();
    expect(cache.bytes).toBe(MB);
  });

  it('keeps a bitmap that is set again under its own key', () => {
    const cache = new PageCache();
    const a = entry('k');
    cache.set('k', a.page);
    cache.set('k', a.page);
    expect(a.close).not.toHaveBeenCalled();
    expect(cache.size).toBe(1);
  });

  it('by default holds a few pages beyond the live canvases, not hundreds of megabytes', () => {
    const cache = new PageCache();
    const pages = Array.from({ length: 40 }, (_, i) => entry(`p${i}`, 8 * MB));
    for (const { page } of pages) cache.set(page.key, page);
    expect(cache.bytes).toBeLessThanOrEqual(64 * MB);
    expect(cache.size).toBeGreaterThanOrEqual(6);
    expect(pages[0]!.close).toHaveBeenCalled();
  });
});
