import { describe, expect, it } from 'vitest';
import { gridLayout, type GridSource } from './grid';

function source(rows: string[][]): GridSource {
  return {
    rowCount: rows.length,
    columnCount: rows[0]?.length ?? 0,
    header: () => 'h',
    cell: (r, c) => rows[r]![c]!,
    rowUnit: (r) => r,
    rowLabel: (r) => String(r + 1),
    cellId: (c) => c,
  };
}

describe('gridLayout', () => {
  it('sizes a column for its widest values anywhere in the table, not just the first rows', () => {
    const rows = Array.from({ length: 100_000 }, (_, i) => [String(i), i >= 50_000 ? 'x'.repeat(30) : 'short', 'abc']);
    const [ids, notes, same] = gridLayout(source(rows)).widths as [number, number, number];
    expect(ids).toBeGreaterThan(same);
    expect(notes).toBeGreaterThan(3 * same);
  });

  it('stretches a narrow table across the page', () => {
    const layout = gridLayout(source([['a', 'b']]));
    expect(layout.width).toBe(1000);
    expect(layout.tableWidth).toBeLessThanOrEqual(1000 - 32);
    expect(layout.tableWidth).toBeGreaterThan(1000 - 32 - 4);
  });

  it('makes the table exactly as wide as its columns, so the browser adds no width to any of them', () => {
    const layout = gridLayout(source([['a', 'b'], ['ccc', 'dddd']]));
    expect(layout.tableWidth).toBe(layout.gutter + layout.widths.reduce((a, b) => a + b, 0));
  });
});
