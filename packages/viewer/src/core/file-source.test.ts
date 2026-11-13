import { describe, it, expect } from 'vitest';
import { isSameSource } from './file-source';
import type { FileSource } from './types';

describe('isSameSource', () => {
  const buf = new ArrayBuffer(8);
  const file = new File(['x'], 'a.txt', { type: 'text/plain' });

  it('treats structurally equal inline objects as the same document', () => {
    expect(isSameSource({ kind: 'url', url: '/a.pdf' }, { kind: 'url', url: '/a.pdf' })).toBe(true);
    expect(
      isSameSource(
        { kind: 'url', url: '/a.pdf', filename: 'A.pdf' },
        { kind: 'url', url: '/a.pdf', filename: 'A.pdf' },
      ),
    ).toBe(true);
    expect(isSameSource({ kind: 'file', file }, { kind: 'file', file })).toBe(true);
    expect(
      isSameSource(
        { kind: 'buffer', buffer: buf, name: 'a.txt', type: 'text/plain' },
        { kind: 'buffer', buffer: buf, name: 'a.txt', type: 'text/plain' },
      ),
    ).toBe(true);
  });

  it('detects a real change', () => {
    expect(isSameSource({ kind: 'url', url: '/a.pdf' }, { kind: 'url', url: '/b.pdf' })).toBe(false);
    expect(
      isSameSource({ kind: 'url', url: '/a.pdf' }, { kind: 'url', url: '/a.pdf', filename: 'x.pdf' }),
    ).toBe(false);
    const other = new File(['x'], 'a.txt', { type: 'text/plain' });
    expect(isSameSource({ kind: 'file', file }, { kind: 'file', file: other })).toBe(false);
    expect(
      isSameSource(
        { kind: 'buffer', buffer: buf, name: 'a.txt', type: 'text/plain' },
        { kind: 'buffer', buffer: new ArrayBuffer(8), name: 'a.txt', type: 'text/plain' },
      ),
    ).toBe(false);
    expect(
      isSameSource({ kind: 'url', url: '/a.pdf' }, { kind: 'file', file } as FileSource),
    ).toBe(false);
  });

  it('handles undefined', () => {
    expect(isSameSource(undefined, undefined)).toBe(true);
    expect(isSameSource(undefined, { kind: 'url', url: '/a' })).toBe(false);
  });
});

describe('readHead', () => {
  it('reads only the leading bytes from a stream', async () => {
    const { readHead } = await import('./file-source');
    const big = new Uint8Array(200_000).fill(7);
    big[0] = 1;
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        const at = pulls++ * 600;
        if (at >= big.length) c.close();
        else c.enqueue(big.subarray(at, at + 600));
      },
    });
    const head = await readHead({
      meta: { name: 'x', size: big.byteLength, mimeType: '' },
      arrayBuffer: () => Promise.reject(new Error('should stream')),
      stream: () => stream,
    }, 1000);
    expect(head.byteLength).toBe(1000);
    expect(head[0]).toBe(1);
    expect(pulls).toBeLessThan(5);
  });

  it('falls back to the buffer when there is no stream', async () => {
    const { readHead } = await import('./file-source');
    const head = await readHead({
      meta: { name: 'x', size: 3, mimeType: '' },
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      stream: () => null,
    });
    expect(Array.from(head)).toEqual([1, 2, 3]);
  });
});
