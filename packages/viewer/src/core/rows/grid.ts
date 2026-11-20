import { CHAR_WIDTH } from './lines';
import { listHeight, mountRows, type RowList } from './virtual-rows';
import { mergeAt, type GridMerge, type MergeIndex } from './merges';

export const GRID_ROW_HEIGHT = 28;
export const GRID_HEADER_HEIGHT = 32;
const PADDING = 16;
const CELL_PADDING = 10;
const MIN_COLUMN = 56;
const MAX_COLUMN = 360;
const MIN_WIDTH = 1000;
/** Column widths come from the header and a sample of rows from the start, end and middle, so they never change while scrolling. */
const SAMPLE_ROWS = 100;

function sampleRows(count: number): number[] {
  if (count <= 3 * SAMPLE_ROWS) return Array.from({ length: count }, (_, i) => i);
  const step = (count - 2 * SAMPLE_ROWS) / SAMPLE_ROWS;
  return Array.from({ length: 3 * SAMPLE_ROWS }, (_, i) =>
    i < SAMPLE_ROWS ? i : i < 2 * SAMPLE_ROWS ? count - 1 - (i - SAMPLE_ROWS) : SAMPLE_ROWS + Math.floor((i - 2 * SAMPLE_ROWS) * step),
  );
}

/** A table, read a cell at a time, as the grid shows it. */
export interface GridSource {
  readonly rowCount: number;
  readonly columnCount: number;
  header(col: number): string;
  /** The search unit of the header row, when the header is part of the data. */
  readonly headerUnit?: number;
  cell(row: number, col: number): string;
  numeric?(row: number, col: number): boolean;
  rowUnit(row: number): number;
  rowLabel(row: number): string;
  cellId(col: number): number;
  /** Blocks of cells drawn as one cell, holding the text of their first cell. */
  readonly merges?: MergeIndex;
}

export interface GridLayout {
  readonly widths: readonly number[];
  readonly gutter: number;
  readonly tableWidth: number;
  /** The page the grid fills, at 100%. */
  readonly width: number;
  readonly height: number;
}

const textWidth = (text: string) => text.length * CHAR_WIDTH + 2 * CELL_PADDING + 1;

export function gridLayout(source: GridSource): GridLayout {
  const widths: number[] = [];
  const sample = sampleRows(source.rowCount);
  // Text that spans several columns does not widen the first of them.
  const spanned = sample.map((r) => source.merges?.within(r, r + 1).filter((m) => m.right > m.left) ?? []);
  for (let c = 0; c < source.columnCount; c++) {
    let widest = textWidth(source.header(c));
    sample.forEach((r, i) => {
      if (!mergeAt(spanned[i]!, c)) widest = Math.max(widest, textWidth(source.cell(r, c)));
    });
    widths.push(Math.ceil(Math.min(Math.max(widest, MIN_COLUMN), MAX_COLUMN)));
  }
  const gutter = Math.ceil(textWidth(source.rowLabel(Math.max(0, source.rowCount - 1))));
  const natural = gutter + widths.reduce((a, b) => a + b, 0);
  const room = MIN_WIDTH - 2 * PADDING;
  const stretch = natural < room && natural > gutter ? (room - gutter) / (natural - gutter) : 1;
  const stretched = widths.map((w) => Math.floor(w * stretch));
  const tableWidth = gutter + stretched.reduce((a, b) => a + b, 0);
  return {
    widths: stretched,
    gutter,
    tableWidth,
    width: Math.max(MIN_WIDTH, tableWidth + 2 * PADDING),
    height: 2 * PADDING + GRID_HEADER_HEIGHT + listHeight(source.rowCount, GRID_ROW_HEIGHT),
  };
}

function table(layout: GridLayout, className: string): HTMLTableElement {
  const el = document.createElement('table');
  el.className = className;
  el.style.width = `${layout.tableWidth}px`;
  const cols = el.appendChild(document.createElement('colgroup'));
  for (const w of [layout.gutter, ...layout.widths]) {
    const col = cols.appendChild(document.createElement('col'));
    col.style.width = `${w}px`;
  }
  return el;
}

/**
 * Renders a table into `target` with a header that stays in view and the rows in view, numbered in a gutter.
 * Every row is one search unit and every cell a `data-dv-cell` of it.
 */
export function renderGrid(
  target: HTMLElement,
  source: GridSource,
  layout: GridLayout,
  signal: AbortSignal,
  print = false,
): { root: HTMLElement; rows: RowList } {
  const root = document.createElement('div');
  root.className = 'dv-grid';
  const spacer = root.appendChild(document.createElement('div'));
  spacer.className = 'dv-rows';
  spacer.style.width = `${layout.tableWidth}px`;

  const head = spacer.appendChild(table(layout, 'dv-grid-table dv-grid-head'));
  const headRow = head.createTHead().insertRow();
  if (source.headerUnit != null) headRow.dataset.dvUnit = String(source.headerUnit);
  headRow.appendChild(document.createElement('th')).className = 'dv-grid-num';
  for (let c = 0; c < source.columnCount; c++) {
    const th = headRow.appendChild(document.createElement('th'));
    th.textContent = source.header(c);
    if (source.headerUnit != null) th.dataset.dvCell = String(source.cellId(c));
  }

  const layer = spacer.appendChild(document.createElement('div'));
  layer.className = 'dv-rows-layer';
  const tbody = layer.appendChild(table(layout, 'dv-grid-table')).createTBody();
  const fill = (el: HTMLElement, r: number, c: number, width: number) => {
    const text = source.cell(r, c);
    el.textContent = text;
    el.dataset.dvCell = String(source.cellId(c));
    if (text.length * CHAR_WIDTH > width - 2 * CELL_PADDING) el.title = text;
    if (source.numeric?.(r, c)) el.classList.add('dv-grid-number');
  };
  const renderRow = (r: number) => {
    const tr = document.createElement('tr');
    tr.dataset.dvUnit = String(source.rowUnit(r));
    const num = tr.appendChild(document.createElement('th'));
    num.className = 'dv-grid-num';
    num.scope = 'row';
    num.textContent = source.rowLabel(r);
    const merges = source.merges?.within(r, r + 1) ?? [];
    for (let c = 0; c < source.columnCount; c++) {
      const td = tr.appendChild(document.createElement('td'));
      const merge = mergeAt(merges, c);
      if (merge) {
        td.colSpan = merge.right - c + 1;
        c = merge.right;
      } else {
        fill(td, r, c, layout.widths[c]!);
      }
    }
    return tr;
  };

  // A merge is drawn over the cells it covers, from its first rendered row, whichever rows are in view.
  const lefts = [layout.gutter];
  for (const w of layout.widths) lefts.push(lefts.at(-1)! + w);
  const blocks = layer.appendChild(document.createElement('div'));
  const drawMerge = (m: GridMerge, from: number, to: number) => {
    const first = Math.max(m.top, from);
    const box = document.createElement('div');
    box.className = 'dv-grid-merge';
    box.dataset.dvUnit = String(source.rowUnit(m.top));
    box.style.left = `${lefts[m.left]}px`;
    box.style.top = `${(first - from) * GRID_ROW_HEIGHT}px`;
    box.style.width = `${lefts[m.right + 1]! - lefts[m.left]!}px`;
    box.style.height = `${(Math.min(m.bottom + 1, to) - first) * GRID_ROW_HEIGHT}px`;
    const cell = box.appendChild(document.createElement('div'));
    cell.className = 'dv-grid-merge-cell';
    cell.style.top = `${((m.top + m.bottom + 1) / 2 - first) * GRID_ROW_HEIGHT - GRID_ROW_HEIGHT / 2}px`;
    fill(cell, m.top, m.left, lefts[m.right + 1]! - lefts[m.left]!);
    return box;
  };
  const drawMerges = (from: number, to: number) => {
    if (source.merges) blocks.replaceChildren(...source.merges.within(from, to).map((m) => drawMerge(m, from, to)));
  };

  target.replaceChildren(root);
  const rows = mountRows(
    {
      count: source.rowCount,
      rowHeight: GRID_ROW_HEIGHT,
      spacer,
      layer,
      parent: tbody,
      header: head,
      headerHeight: GRID_HEADER_HEIGHT,
      renderRow,
      onWindow: drawMerges,
    },
    signal,
    print,
  );
  // Static rows (print, thumbnails) never report a window.
  drawMerges(rows.from, rows.to);
  return { root, rows };
}
