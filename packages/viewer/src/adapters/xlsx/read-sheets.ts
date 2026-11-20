import type * as Xlsx from 'xlsx';
import type { CellObject, WorkSheet } from 'xlsx';
import { MergeIndex, mergeAt, type GridMerge } from '../../core/rows/merges';

/**
 * A sheet's displayed text, packed into one string and two offset arrays, so a worker hands it over in a few
 * copies instead of one string per cell. Rows and columns count from the sheet's first row and column.
 */
export interface SheetCells {
  readonly name: string;
  /** The first row and column of the sheet's range, counted from A1. */
  readonly firstRow: number;
  readonly firstCol: number;
  readonly rowCount: number;
  readonly columnCount: number;
  readonly text: string;
  /** Where each row's cells start in `cells`, plus the end of the last row. A row holds cells up to its last one. */
  readonly rows: Uint32Array;
  /** Where each cell's text starts in `text`, plus the end of the last cell. */
  readonly cells: Uint32Array;
  readonly merges: readonly GridMerge[];
}

const cellText = (cell: CellObject | null | undefined) => (cell == null ? '' : (cell.w ?? (cell.v == null ? '' : String(cell.v))));

/** Reads only the displayed text of each cell: dense cells, and no HTML, formulas or styles. */
export function readSheets(XLSX: typeof Xlsx, data: ArrayBuffer): SheetCells[] {
  const workbook = XLSX.read(data, { type: 'array', dense: true, cellHTML: false, cellFormula: false, cellStyles: false });
  return workbook.SheetNames.map((name) => packSheet(XLSX, name, workbook.Sheets[name]));
}

/** The buffers of `sheets` that can be moved to another thread instead of copied. */
export const sheetBuffers = (sheets: readonly SheetCells[]) => sheets.flatMap((s) => [s.rows.buffer, s.cells.buffer]);

function packSheet(XLSX: typeof Xlsx, name: string, sheet: WorkSheet | undefined): SheetCells {
  const range = sheet?.['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : null;
  if (!sheet || !range) {
    return { name, firstRow: 0, firstCol: 0, rowCount: 0, columnCount: 0, text: '', rows: new Uint32Array(1), cells: new Uint32Array(1), merges: [] };
  }
  const firstRow = range.s.r;
  const firstCol = range.s.c;
  const rowCount = range.e.r - firstRow + 1;
  const columnCount = range.e.c - firstCol + 1;
  const merges = (sheet['!merges'] ?? [])
    .map((m) => ({
      top: Math.max(m.s.r, firstRow) - firstRow,
      left: Math.max(m.s.c, firstCol) - firstCol,
      bottom: Math.min(m.e.r, range.e.r) - firstRow,
      right: Math.min(m.e.c, range.e.c) - firstCol,
    }))
    .filter((m) => m.top <= m.bottom && m.left <= m.right && (m.top < m.bottom || m.left < m.right));
  const index = new MergeIndex(merges);

  const dense = sheet['!data'] ?? [];
  const width = (r: number) => Math.max(0, Math.min(dense[firstRow + r]?.length ?? 0, firstCol + columnCount) - firstCol);
  let total = 0;
  for (let r = 0; r < rowCount; r++) total += width(r);
  const rows = new Uint32Array(rowCount + 1);
  const cells = new Uint32Array(total + 1);
  const parts: string[] = [];
  let i = 0;
  let length = 0;
  for (let r = 0; r < rowCount; r++) {
    rows[r] = i;
    const row = dense[firstRow + r];
    const covering = merges.length ? index.within(r, r + 1) : [];
    for (let c = 0, n = width(r); c < n; c++) {
      cells[i++] = length;
      // A merge shows only its first cell; text left in the cells it covers is hidden, as in Excel.
      const merge = mergeAt(covering, c);
      const text = merge && (merge.top !== r || merge.left !== c) ? '' : cellText(row![firstCol + c]);
      parts.push(text);
      length += text.length;
    }
  }
  rows[rowCount] = i;
  cells[i] = length;
  return { name, firstRow, firstCol, rowCount, columnCount, text: parts.join(''), rows, cells, merges };
}
