import { describe, it, expect } from 'vitest';
import { LRUCache } from './lru-cache';

describe('LRUCache', () => {
  it('stores and retrieves values', () => {
    const c = new LRUCache<string, number>();
    c.set('a', 1, 10);
    expect(c.get('a')).toBe(1);
    expect(c.get('missing')).toBeNull();
  });

  it('evicts by byte budget', () => {
    const c = new LRUCache<string, number>(100, 1000);
    c.set('a', 1, 60);
    c.set('b', 2, 60); // total would be 120 > 100 → evict 'a'
    expect(c.get('a')).toBeNull();
    expect(c.get('b')).toBe(2);
    expect(c.bytes).toBe(60);
  });

  it('evicts by max entries', () => {
    const c = new LRUCache<string, number>(1e9, 2);
    c.set('a', 1, 1);
    c.set('b', 2, 1);
    c.set('c', 3, 1); // exceeds 2 entries → evict oldest 'a'
    expect(c.get('a')).toBeNull();
    expect(c.size).toBe(2);
  });

  it('promotes recency on get so the LRU victim is the truly-oldest', () => {
    const c = new LRUCache<string, number>(1e9, 2);
    c.set('a', 1, 1);
    c.set('b', 2, 1);
    c.get('a'); // 'a' now most-recent
    c.set('c', 3, 1); // evicts least-recent → 'b'
    expect(c.get('b')).toBeNull();
    expect(c.get('a')).toBe(1);
    expect(c.get('c')).toBe(3);
  });

  it('shrinkTo drops entries down to a byte target', () => {
    const c = new LRUCache<string, number>(1e9, 1000);
    c.set('a', 1, 40);
    c.set('b', 2, 40);
    c.set('c', 3, 40);
    c.shrinkTo(50);
    expect(c.bytes).toBeLessThanOrEqual(50);
  });
});
