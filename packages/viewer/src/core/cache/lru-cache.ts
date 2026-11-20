export interface LRUEntry<K, V> {
  readonly key: K;
  readonly value: V;
  readonly byteSize: number;
  lastAccessed: number;
}

export class LRUCache<K, V> {
  private cache = new Map<K, LRUEntry<K, V>>();
  private totalBytes = 0;
  private readonly maxBytes: number;
  private readonly maxEntries: number;

  constructor(
    maxBytes: number = 256 * 1024 * 1024,
    maxEntries: number = 100,
  ) {
    this.maxBytes = maxBytes;
    this.maxEntries = maxEntries;
  }

  get(key: K): V | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    this.cache.delete(key);
    entry.lastAccessed = Date.now();
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V, byteSize: number): void {
    const existing = this.cache.get(key);
    if (existing) {
      this.totalBytes -= existing.byteSize;
      this.cache.delete(key);
    }

    while (
      (this.totalBytes + byteSize > this.maxBytes || this.cache.size >= this.maxEntries) &&
      this.cache.size > 0
    ) {
      this.evictOldest();
    }

    const newEntry: LRUEntry<K, V> = {
      key,
      value,
      byteSize,
      lastAccessed: Date.now(),
    };
    this.cache.set(key, newEntry);
    this.totalBytes += byteSize;
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): V | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    this.cache.delete(key);
    this.totalBytes -= entry.byteSize;
    return entry.value;
  }

  clear(): void {
    this.cache.clear();
    this.totalBytes = 0;
  }

  get size(): number {
    return this.cache.size;
  }

  get bytes(): number {
    return this.totalBytes;
  }

  get capacity(): number {
    return this.maxBytes;
  }

  shrinkTo(targetBytes: number): void {
    while (this.totalBytes > targetBytes && this.cache.size > 0) {
      this.evictOldest();
    }
  }

  private evictOldest(): void {
    const oldest = this.cache.values().next().value;
    if (!oldest) return;
    this.cache.delete(oldest.key);
    this.totalBytes -= oldest.byteSize;
  }
}
