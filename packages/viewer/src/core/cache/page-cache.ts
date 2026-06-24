/* ============================================================
 * Page Cache
 * Byte-budgeted LRU cache for rendered page bitmaps.
 * ============================================================ */

import type { RenderResult } from '../types';

export interface CachedPage extends RenderResult {
  readonly key: string;
  readonly bitmap: ImageBitmap | HTMLCanvasElement;
  readonly byteSize: number;
  lastAccessed: number;
}

export class PageCache {
  private cache = new Map<string, CachedPage>();
  private totalBytes = 0;
  private readonly maxBytes: number;

  constructor(maxBytes: number = 256 * 1024 * 1024) {
    this.maxBytes = maxBytes;
  }

  get(key: string): CachedPage | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    this.cache.delete(key);
    entry.lastAccessed = Date.now();
    this.cache.set(key, entry);
    return entry;
  }

  set(key: string, page: CachedPage): void {
    const existing = this.cache.get(key);
    if (existing) {
      this.totalBytes -= existing.byteSize;
      this.cache.delete(key);
    }

    while (
      this.totalBytes + page.byteSize > this.maxBytes &&
      this.cache.size > 0
    ) {
      const entry = this.cache.entries().next();
      if (!entry || entry.done || !entry.value) break;
      const [oldestKey, oldest] = entry.value;
      this.dispose(oldest);
      this.cache.delete(oldestKey);
      this.totalBytes -= oldest.byteSize;
    }

    this.cache.set(key, page);
    this.totalBytes += page.byteSize;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): void {
    const entry = this.cache.get(key);
    if (!entry) return;
    this.dispose(entry);
    this.cache.delete(key);
    this.totalBytes -= entry.byteSize;
  }

  clear(): void {
    for (const page of this.cache.values()) this.dispose(page);
    this.cache.clear();
    this.totalBytes = 0;
  }

  get bytes(): number {
    return this.totalBytes;
  }

  get size(): number {
    return this.cache.size;
  }

  shrinkTo(targetBytes: number): void {
    while (this.totalBytes > targetBytes && this.cache.size > 0) {
      const entry = this.cache.entries().next();
      if (!entry || entry.done || !entry.value) break;
      const [oldestKey, oldest] = entry.value;
      this.dispose(oldest);
      this.cache.delete(oldestKey);
      this.totalBytes -= oldest.byteSize;
    }
  }

  /**
   * Drop least-recently-used pages down to a fraction of the budget. Called
   * under memory pressure (e.g. when the tab is backgrounded); the evicted
   * pages re-render lazily on return.
   */
  trim(fraction: number = 0.25): void {
    this.shrinkTo(Math.floor(this.maxBytes * fraction));
  }

  private dispose(page: CachedPage): void {
    if (page.bitmap instanceof ImageBitmap) {
      page.bitmap.close();
    } else if (page.bitmap instanceof HTMLCanvasElement) {
      page.bitmap.width = 0;
      page.bitmap.height = 0;
    }
  }
}

/**
 * Build a cache key for a rendered page.
 */
export function makeCacheKey(
  format: string,
  pageIndex: number,
  zoom: number,
  rotation: number,
  dpr: number = 1,
): string {
  return `${format}:${pageIndex}:${zoom}:${rotation}:${dpr}`;
}

/**
 * Estimate the byte size of an ImageBitmap or canvas.
 */
export function estimateBitmapByteSize(
  width: number,
  height: number,
  dpr: number = 1,
): number {
  return Math.round(width * height * dpr * 4);
}
