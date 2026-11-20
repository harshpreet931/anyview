import type { SpreadMode } from './types';

export function groupRows(pageCount: number, spreadMode: SpreadMode, horizontal: boolean): number[][] {
  if (horizontal || spreadMode === 'none') {
    return Array.from({ length: pageCount }, (_, i) => [i]);
  }
  const rows: number[][] = [];
  let i = 0;
  if (spreadMode === 'odd' && pageCount > 0) {
    rows.push([0]);
    i = 1;
  }
  for (; i < pageCount; i += 2) {
    rows.push(i + 1 < pageCount ? [i, i + 1] : [i]);
  }
  return rows;
}
