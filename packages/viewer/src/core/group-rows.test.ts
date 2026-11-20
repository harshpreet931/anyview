import { describe, it, expect } from 'vitest';
import { groupRows } from './group-rows';

describe('groupRows', () => {
  it('has no rows for an empty document', () => {
    expect(groupRows(0, 'none', false)).toEqual([]);
    expect(groupRows(0, 'odd', false)).toEqual([]);
    expect(groupRows(0, 'even', false)).toEqual([]);
  });

  it('puts one page per row without spreads', () => {
    expect(groupRows(3, 'none', false)).toEqual([[0], [1], [2]]);
  });

  it('pairs pages from the first one in even spreads', () => {
    expect(groupRows(5, 'even', false)).toEqual([[0, 1], [2, 3], [4]]);
    expect(groupRows(4, 'even', false)).toEqual([[0, 1], [2, 3]]);
  });

  it('keeps the first page alone in odd spreads', () => {
    expect(groupRows(4, 'odd', false)).toEqual([[0], [1, 2], [3]]);
    expect(groupRows(1, 'odd', false)).toEqual([[0]]);
  });

  it('ignores spreads when scrolling horizontally', () => {
    expect(groupRows(3, 'even', true)).toEqual([[0], [1], [2]]);
    expect(groupRows(3, 'odd', true)).toEqual([[0], [1], [2]]);
  });
});
