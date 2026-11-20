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
import { searchUnits, type SearchUnit } from '../../core/search-units';
import { gridLayout, renderGrid, type GridLayout, type GridSource } from '../../core/rows/grid';
import { MergeIndex } from '../../core/rows/merges';
import type { RowList } from '../../core/rows/virtual-rows';
import { readSheets, type SheetCells } from './read-sheets';
import { xlsxManifest } from './manifest';

interface Sheet extends SheetCells {
  index: MergeIndex;
  layout: GridLayout;
}

type WorkerReply = { sheets: SheetCells[] } | { error: string };

/** Reads the workbook off the main thread; null when no worker can run here, so the caller reads it itself. */
function readInWorker(data: ArrayBuffer, signal: AbortSignal): Promise<SheetCells[] | null> {
  if (typeof Worker === 'undefined') return Promise.resolve(null);
  let worker: Worker;
  try {
    worker = new Worker(new URL('./xlsx.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return Promise.resolve(null);
  }
  return new Promise((resolve, reject) => {
    const finish = () => {
      worker.terminate();
      signal.removeEventListener('abort', cancel);
    };
    const cancel = () => {
      finish();
      reject(new Error('Parse cancelled'));
    };
    signal.addEventListener('abort', cancel);
    worker.onmessage = ({ data: reply }: MessageEvent<WorkerReply>) => {
      finish();
      if ('error' in reply) reject(new Error(reply.error));
      else resolve(reply.sheets);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      finish();
      resolve(null);
    };
    worker.postMessage(data);
  });
}

const NUMBER = /^[-+]?[$€£¥]?\(?\d[\d,]*(\.\d+)?\)?%?$/;

function columnName(col: number): string {
  let name = '';
  for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

/** A unit is a sheet row and a cell its column, both counted from A1; the gutter shows the sheet's row numbers. */
function sheetGrid(sheet: Omit<Sheet, 'layout'>): GridSource {
  const { text, rows, cells, firstRow, firstCol } = sheet;
  const cell = (r: number, c: number) => {
    const i = rows[r]! + c;
    return i < rows[r + 1]! ? text.slice(cells[i], cells[i + 1]) : '';
  };
  return {
    rowCount: sheet.rowCount,
    columnCount: sheet.columnCount,
    header: (c) => columnName(firstCol + c),
    cell,
    numeric: (r, c) => NUMBER.test(cell(r, c)),
    rowUnit: (r) => firstRow + r,
    rowLabel: (r) => String(firstRow + r + 1),
    cellId: (c) => firstCol + c,
    merges: sheet.index,
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
      const sheets = (await readInWorker(buffer, signal)) ?? readSheets(await loadParser('xlsx', () => import('xlsx')), buffer);
      this.sheets = sheets.map((cells) => {
        const sheet = { ...cells, index: new MergeIndex(cells.merges) };
        return { ...sheet, layout: gridLayout(sheetGrid(sheet)) };
      });
    } catch (cause) {
      throwIfCancelled(signal);
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
      const { text, rows, cells, firstRow, firstCol, rowCount } = this.sheets[pageIndex]!;
      for (let r = 0; r < rowCount; r++) {
        for (let i = rows[r]!; i < rows[r + 1]!; i++) {
          if (cells[i]! < cells[i + 1]!) {
            yield { pageIndex, unit: firstRow + r, cell: firstCol + i - rows[r]!, text: text.slice(cells[i], cells[i + 1]) };
          }
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
