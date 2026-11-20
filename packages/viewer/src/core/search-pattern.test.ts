import { describe, expect, it } from 'vitest';
import { searchPattern } from './search-pattern';
import type { SearchQuery } from './types';

const q = (text: string, extra: Partial<SearchQuery> = {}): SearchQuery => ({
  text,
  caseSensitive: false,
  wholeWord: false,
  regex: false,
  diacritics: false,
  ...extra,
});

describe('searchPattern', () => {
  it('escapes plain text', () => {
    expect(searchPattern(q('a.b'))!.test('axb')).toBe(false);
    expect(searchPattern(q('a.b'))!.test('a.b')).toBe(true);
  });

  it('returns null for an empty query', () => {
    expect(searchPattern(q(''))).toBeNull();
  });

  it('returns null for a regex that does not compile', () => {
    expect(searchPattern(q('(', { regex: true }))).toBeNull();
  });

  it('matches whole words only when asked', () => {
    expect(searchPattern(q('cat', { wholeWord: true }))!.test('concatenate')).toBe(false);
    expect(searchPattern(q('cat', { wholeWord: true }))!.test('a cat sat')).toBe(true);
  });
});
