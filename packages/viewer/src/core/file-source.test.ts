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
