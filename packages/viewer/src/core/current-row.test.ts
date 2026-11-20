import { describe, it, expect } from 'vitest';
import { currentRow } from './current-row';

const items = [
  { index: 0, start: 0 },
  { index: 1, start: 900 },
  { index: 2, start: 1800 },
];

describe('currentRow', () => {
  it('picks the row whose start has reached the top of the scroller', () => {
    expect(currentRow(items, 0, { viewport: 600, total: 2700, count: 3 })).toBe(0);
    expect(currentRow(items, 899, { viewport: 600, total: 2700, count: 3 })).toBe(1);
    expect(currentRow(items, 1200, { viewport: 600, total: 2700, count: 3 })).toBe(1);
  });

  it('is the last row once scrolled to the end, even if its start never reaches the top', () => {
    expect(currentRow(items, 2100, { viewport: 600, total: 2700, count: 3 })).toBe(2);
    expect(currentRow(items, 1500, { viewport: 1200, total: 2700, count: 3 })).toBe(2);
  });

  it('treats a sub-pixel or 2px gap from the end as the end', () => {
    expect(currentRow(items, 1498, { viewport: 1200, total: 2700, count: 3 })).toBe(2);
    expect(currentRow(items, 1490, { viewport: 1200, total: 2700, count: 3 })).toBe(1);
  });

  it('stays on the first row when nothing scrolls', () => {
    expect(currentRow(items, 0, { viewport: 3000, total: 2700, count: 3 })).toBe(0);
  });

  it('moves to the next row once the previous page has left the view, though the gap above it shows', () => {
    const opts = { viewport: 600, total: 2700, count: 3, gap: 48 };
    expect(currentRow(items, 900 - 30, opts)).toBe(0);
    expect(currentRow(items, 900 - 20, opts)).toBe(1);
  });

  it('handles an empty list', () => {
    expect(currentRow([], 0, { viewport: 600, total: 0, count: 0 })).toBe(0);
  });
});
