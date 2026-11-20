import type {
  Adapter,
  DocumentModel,
  FileSourceReader,
  OutlineNode,
  PageRef,
  RenderContext,
  RenderResult,
  SearchMatch,
  SearchQuery,
  SearchResult,
  TextLayer,
  TextLayerItem,
} from '../../core/types';
import { ViewerError, asParseError, throwIfCancelled } from '../../core/errors';
import { loadParser } from '../../core/load-parser';
import type { CellObject } from 'xlsx';
import { searchUnits, type SearchUnit } from '../../core/search-units';
import { gridLayout, renderGrid, type GridLayout, type GridSource } from '../../core/rows/grid';
import type { RowList } from '../../core/rows/virtual-rows';
import { xlsxManifest } from './manifest';

interface Sheet {
  name: string;
  /** The displayed text of each cell, indexed by sheet row and column from A1; empty rows are left out. */
  cells: ReadonlyArray<readonly string[] | undefined>;
  firstRow: number;
  firstCol: number;
  rowCount: number;
  columnCount: number;
  layout: GridLayout;
}

const cellText = (cell: CellObject | null | undefined) => (cell == null ? '' : (cell.w ?? (cell.v == null ? '' : String(cell.v))));
const NUMBER = /^[-+]?[$€£¥]?\(?\d[\d,]*(\.\d+)?\)?%?$/;

/** Keeps only the text of each cell, so the workbook's cell objects can be freed. */
function cellTexts(dense: ReadonlyArray<ReadonlyArray<CellObject | null | undefined> | null | undefined>): Array<string[] | undefined> {
  return Array.from(dense, (row) => (row ? Array.from(row, cellText) : undefined));
}

function columnName(col: number): string {
  let name = '';
  for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

/** A unit is a sheet row and a cell its column, both counted from A1; the gutter shows the sheet's row numbers. */
function sheetGrid(sheet: Omit<Sheet, 'layout'>): GridSource {
  const { cells, firstRow, firstCol } = sheet;
  const cell = (r: number, c: number) => cells[firstRow + r]?.[firstCol + c] ?? '';
  return {
    rowCount: sheet.rowCount,
    columnCount: sheet.columnCount,
    header: (c) => columnName(firstCol + c),
    cell,
    numeric: (r, c) => NUMBER.test(cell(r, c)),
    rowUnit: (r) => firstRow + r,
    rowLabel: (r) => String(firstRow + r + 1),
    cellId: (c) => firstCol + c,
  };
}

export class XlsxAdapter implements Adapter {
  readonly manifest = xlsxManifest;
  private sheets: Sheet[] = [];
  private readonly lists = new WeakMap<HTMLElement, RowList>();

  async parse(
    source: FileSourceReader,
    signal: AbortSignal,
  ): Promise<DocumentModel> {
    const buffer = await source.arrayBuffer();
    throwIfCancelled(signal);

    try {
      const XLSX = await loadParser('xlsx', () => import('xlsx'));
      // Dense cells and no HTML, formulas or styles: only the displayed text is read.
      const workbook = XLSX.read(buffer, { type: 'array', dense: true, cellHTML: false, cellFormula: false, cellStyles: false });

      this.sheets = workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        const ref = sheet?.['!ref'];
        const range = ref ? XLSX.utils.decode_range(ref) : null;
        const shape = {
          name,
          cells: range && sheet?.['!data'] ? cellTexts(sheet['!data']) : [],
          firstRow: range?.s.r ?? 0,
          firstCol: range?.s.c ?? 0,
          rowCount: range ? range.e.r - range.s.r + 1 : 0,
          columnCount: range ? range.e.c - range.s.c + 1 : 0,
        };
        return { ...shape, layout: gridLayout(sheetGrid(shape)) };
      });
    } catch (cause) {
      throw asParseError(cause, 'Failed to parse spreadsheet.');
    }

    const pages: PageRef[] = this.sheets.map(({ layout }, i) => ({
      index: i,
      width: layout.width,
      height: layout.height,
      rotation: 0,
    }));

    const outline: OutlineNode[] = this.sheets.map(({ name }, i) => ({
      title: name,
      dest: { pageIndex: i },
    }));

    return {
      format: 'xlsx',
      meta: source.meta,
      pageCount: this.sheets.length,
      pages,
      outline,
    };
  }

  async renderPage(ctx: RenderContext): Promise<RenderResult> {
    const sheet = this.sheets[ctx.page.index];
    if (!sheet) {
      throw new ViewerError('RENDER_ERROR', `Sheet ${ctx.page.index} not found.`);
    }

    const target = ctx.target as HTMLElement;
    const { root, rows } = renderGrid(target, sheetGrid(sheet), sheet.layout, ctx.signal, ctx.print);
    this.lists.set(target, rows);
    if (ctx.print && rows.to < sheet.rowCount) {
      const note = root.appendChild(document.createElement('p'));
      note.textContent = `Printed the first ${rows.to.toLocaleString()} of ${sheet.rowCount.toLocaleString()} rows.`;
    }

    return {
      width: ctx.page.width * ctx.scale,
      height: target.offsetHeight || ctx.page.height * ctx.scale,
    };
  }

  async getTextLayer(
    pageIndex: number,
    _signal?: AbortSignal,
  ): Promise<TextLayer> {
    const sheet = this.sheets[pageIndex];
    const items: TextLayerItem[] = [];
    if (sheet) {
      const grid = sheetGrid(sheet);
      for (let r = 0; r < sheet.rowCount; r++) {
        const line = Array.from({ length: sheet.columnCount }, (_, c) => grid.cell(r, c)).join(',');
        items.push({ str: line, x: 0, y: r * 20, width: line.length * 8, height: 20 });
      }
    }

    return { pageIndex, items };
  }

  async search(query: SearchQuery, signal: AbortSignal): Promise<SearchResult> {
    return searchUnits(this.units(), query, signal);
  }

  private *units(): Generator<SearchUnit> {
    for (let pageIndex = 0; pageIndex < this.sheets.length; pageIndex++) {
      const { cells, firstRow, firstCol, rowCount, columnCount } = this.sheets[pageIndex]!;
      for (let r = firstRow; r < firstRow + rowCount; r++) {
        const row = cells[r];
        if (!row) continue;
        for (let c = firstCol; c < Math.min(row.length, firstCol + columnCount); c++) {
          const text = row[c];
          if (text) yield { pageIndex, unit: r, cell: c, text };
        }
      }
    }
  }

  revealMatch(match: SearchMatch, target: HTMLElement): void {
    const sheet = this.sheets[match.pageIndex];
    if (sheet && match.locator) this.lists.get(target)?.scrollToRow(match.locator.unit - sheet.firstRow);
  }

  dispose(): void {
    this.sheets = [];
  }
}
