import { CHAR_WIDTH } from './lines';
import { listHeight, mountRows, type RowList } from './virtual-rows';

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
  for (let c = 0; c < source.columnCount; c++) {
    let widest = textWidth(source.header(c));
    for (const r of sample) widest = Math.max(widest, textWidth(source.cell(r, c)));
    widths.push(Math.ceil(Math.min(Math.max(widest, MIN_COLUMN), MAX_COLUMN)));
  }
  const gutter = Math.ceil(textWidth(source.rowLabel(Math.max(0, source.rowCount - 1))));
  const natural = gutter + widths.reduce((a, b) => a + b, 0);
  const room = MIN_WIDTH - 2 * PADDING - 1;
  const stretch = natural < room && natural > gutter ? (room - gutter) / (natural - gutter) : 1;
  const stretched = widths.map((w) => Math.floor(w * stretch));
  const tableWidth = gutter + stretched.reduce((a, b) => a + b, 0) + 1;
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

  const body = spacer.appendChild(table(layout, 'dv-grid-table dv-rows-layer'));
  const tbody = body.createTBody();
  const capacity = layout.widths.map((w) => (w - 2 * CELL_PADDING) / CHAR_WIDTH);
  const renderRow = (r: number) => {
    const tr = document.createElement('tr');
    tr.dataset.dvUnit = String(source.rowUnit(r));
    const num = tr.appendChild(document.createElement('th'));
    num.className = 'dv-grid-num';
    num.scope = 'row';
    num.textContent = source.rowLabel(r);
    for (let c = 0; c < source.columnCount; c++) {
      const td = tr.appendChild(document.createElement('td'));
      const text = source.cell(r, c);
      td.textContent = text;
      td.dataset.dvCell = String(source.cellId(c));
      if (text.length > capacity[c]!) td.title = text;
      if (source.numeric?.(r, c)) td.className = 'dv-grid-number';
    }
    return tr;
  };

  target.replaceChildren(root);
  const rows = mountRows(
    {
      count: source.rowCount,
      rowHeight: GRID_ROW_HEIGHT,
      spacer,
      layer: body,
      parent: tbody,
      header: head,
      headerHeight: GRID_HEADER_HEIGHT,
      renderRow,
    },
    signal,
    print,
  );
  return { root, rows };
}
