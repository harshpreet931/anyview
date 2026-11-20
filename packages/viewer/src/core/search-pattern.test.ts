import { describe, expect, it } from 'vitest';
import { findOccurrences, searchPattern } from './search-pattern';
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

describe('findOccurrences', () => {
  it('finds literal matches case-insensitively by default', () => {
    expect(findOccurrences('Cat cat CAT', q('cat'))).toEqual([[0, 3], [4, 7], [8, 11]]);
  });

  it('respects caseSensitive', () => {
    expect(findOccurrences('Cat cat CAT', q('cat', { caseSensitive: true }))).toEqual([[4, 7]]);
  });

  it('does not overlap literal matches', () => {
    expect(findOccurrences('aaaa', q('aa'))).toEqual([[0, 2], [2, 4]]);
  });

  it('skips matches inside words when wholeWord is set', () => {
    expect(findOccurrences('cat concat cat_x cat.', q('cat', { wholeWord: true }))).toEqual([
      [0, 3],
      [17, 20],
    ]);
  });

  it('matches a regex and skips empty matches', () => {
    expect(findOccurrences('a1b22', q('\\d*', { regex: true }))).toEqual([[1, 2], [3, 5]]);
  });

  it('returns nothing for an invalid regex', () => {
    expect(findOccurrences('abc', q('(', { regex: true }))).toEqual([]);
  });

  it('returns nothing for empty text or an overlong query', () => {
    expect(findOccurrences('', q('a'))).toEqual([]);
    expect(findOccurrences('aaa', q('a'.repeat(1001)))).toEqual([]);
  });

  it('caps the number of matches', () => {
    expect(findOccurrences('a'.repeat(20_000), q('a'))).toHaveLength(10_000);
  });
});
