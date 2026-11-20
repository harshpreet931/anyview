import { describe, it, expect } from 'vitest';
import type { SearchMatch, SearchQuery } from './types';
import { markSanitized } from './safe-html';
import { MAX_MATCHES } from './search-pattern';
import {
  blockTexts,
  locateMatch,
  markBlockUnits,
  matchRanges,
  searchUnits,
  unitText,
} from './search-units';

const q = (text: string): SearchQuery => ({ text, caseSensitive: false, wholeWord: false, regex: false, diacritics: false });
const signal = new AbortController().signal;

function html(markup: string): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = markup;
  return div;
}

describe('unitText', () => {
  it('keeps table cells and blocks apart so a match cannot run across them', () => {
    const el = html('<table><tr><td>name200</td><td>1400</td></tr></table><p>a<br>b</p>');
    expect(unitText(el).text).toBe('name200\n1400\na\nb');
  });

  it('reads one text node as is', () => {
    const pre = html('<pre>line one\nline two</pre>').firstElementChild!;
    expect(unitText(pre).text).toBe('line one\nline two');
  });
});

describe('searchUnits', () => {
  it('returns each match with its unit, cell and offsets', async () => {
    const result = await searchUnits(
      [
        { pageIndex: 0, unit: 0, cell: 1, text: 'an apple' },
        { pageIndex: 2, unit: 5, text: 'Apple pie' },
      ],
      q('apple'),
      signal,
    );
    expect(result.matches.map((m) => [m.pageIndex, m.text, m.locator])).toEqual([
      [0, 'apple', { unit: 0, cell: 1, start: 3, end: 8 }],
      [2, 'Apple', { unit: 5, start: 0, end: 5 }],
    ]);
    expect(result.truncated).toBeUndefined();
  });

  it('does not match across units', async () => {
    const units = [
      { pageIndex: 0, unit: 0, cell: 0, text: 'name200' },
      { pageIndex: 0, unit: 0, cell: 1, text: '1400' },
    ];
    expect((await searchUnits(units, q('name2001'), signal)).matches).toHaveLength(0);
  });

  it('stops at the match limit and says the list is cut short', async () => {
    const units = Array.from({ length: MAX_MATCHES + 5 }, (_, unit) => ({ pageIndex: 0, unit, text: 'x' }));
    const result = await searchUnits(units, q('x'), signal);
    expect(result.matches).toHaveLength(MAX_MATCHES);
    expect(result.truncated).toBe(true);
  });

  it('does not report a cut when the matches end exactly at the limit', async () => {
    const units = Array.from({ length: MAX_MATCHES }, (_, unit) => ({ pageIndex: 0, unit, text: 'x' }));
    expect((await searchUnits(units, q('x'), signal)).truncated).toBeUndefined();
  });
});

describe('block units', () => {
  const markup = markSanitized('<div><h1>Title</h1><p>first apple</p><table><tr><td>ab</td><td>cd</td></tr></table></div>');

  it('reads the same blocks from markup as it marks in the rendered page', () => {
    const page = html(markup);
    markBlockUnits(page);
    const marked = Array.from(page.querySelectorAll('[data-dv-unit]'), (el) => unitText(el).text);
    expect(blockTexts(markup)).toEqual(marked);
    expect(marked).toEqual(['Title', 'first apple', 'ab\ncd']);
  });

  it('treats loose top-level text as part of one block', () => {
    const page = html('loose <b>bold</b>');
    markBlockUnits(page);
    expect(page.getAttribute('data-dv-unit')).toBe('0');
    expect(blockTexts(markSanitized('loose <b>bold</b>'))).toEqual(['loose bold']);
  });
});

describe('locating matches in the rendered page', () => {
  const match = (unit: number, start: number, end: number, text: string, cell?: number): SearchMatch => ({
    pageIndex: 0,
    text,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    locator: { unit, start, end, ...(cell == null ? {} : { cell }) },
  });

  const page = html(
    '<table><tr data-dv-unit="0"><td data-dv-cell="0">id</td><td data-dv-cell="1">an apple</td></tr>' +
      '<tr data-dv-unit="7"><td data-dv-cell="0">7</td><td data-dv-cell="1">apple <b>apple</b></td></tr></table>',
  );

  it('builds a range over exactly the matched text', () => {
    const range = locateMatch(page, match(7, 6, 11, 'apple', 1));
    expect(range).toBeInstanceOf(Range);
    expect((range as Range).toString()).toBe('apple');
    expect((range as Range).startContainer.parentElement?.tagName).toBe('B');
  });

  it('returns nothing for a unit that is not rendered', () => {
    expect(locateMatch(page, match(3, 0, 5, 'apple', 1))).toBeNull();
  });

  it('falls back to the cell when the rendered text differs from the model', () => {
    expect(locateMatch(page, match(0, 0, 5, 'zzzzz', 1))).toBe(page.querySelector('[data-dv-unit="0"] [data-dv-cell="1"]'));
  });

  it('maps every rendered match of a page to its index in the result', () => {
    const matches = [match(0, 3, 8, 'apple', 1), match(3, 0, 5, 'apple', 1), match(7, 0, 5, 'apple', 1)];
    const ranges = matchRanges(page, matches, 0);
    expect([...ranges.keys()]).toEqual([0, 2]);
    expect(ranges.get(2)!.toString()).toBe('apple');
  });
});
