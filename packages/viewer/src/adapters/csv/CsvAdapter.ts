import { decodeText } from '../../core/text-decode';
import type {
  Adapter,
  DocumentModel,
  FileSourceReader,
  PageRef,
  RenderContext,
  RenderResult,
  TextLayer,
  TextLayerItem,
  SearchQuery,
  SearchResult,
  SearchMatch,
} from '../../core/types';
import { asParseError, throwIfCancelled } from '../../core/errors';
import { loadParser } from '../../core/load-parser';
import { searchUnits, type SearchUnit } from '../../core/search-units';
import { gridLayout, renderGrid, type GridLayout, type GridSource } from '../../core/rows/grid';
import type { RowList } from '../../core/rows/virtual-rows';
import { csvManifest } from './manifest';

const PARSE_SLICE = 1 << 20;
const TEXT_ROW_HEIGHT = 20;
const CHAR_WIDTH = 8;

/**
 * Cuts CSV text into slices of about `size` characters, each ending at a line break outside quotes (an even
 * number of quote marks so far), so no row is split. Slices share the text's memory.
 */
function* slices(text: string, size: number): Generator<string> {
  let quote = text.indexOf('"');
  let quotes = 0;
  const countQuotes = (to: number) => {
    for (; quote >= 0 && quote < to; quote = text.indexOf('"', quote + 1)) quotes++;
  };
  for (let start = 0; start < text.length; ) {
    let end = Math.min(text.length, start + size);
    countQuotes(end);
    while (end < text.length) {
      const newline = text.indexOf('\n', end);
      end = newline < 0 ? text.length : newline + 1;
      countQuotes(end);
      if (quotes % 2 === 0) break;
    }
    yield text.slice(start, end);
    start = end;
  }
}

export class CsvAdapter implements Adapter {
  readonly manifest = csvManifest;
  private rows: string[][] = [];
  private headers: string[] = [];
  private layout: GridLayout | null = null;
  private readonly lists = new WeakMap<HTMLElement, RowList>();

  async parse(
    source: FileSourceReader,
    signal: AbortSignal,
  ): Promise<DocumentModel> {
    const buffer = await source.arrayBuffer();
    throwIfCancelled(signal);

    const text = decodeText(buffer, source.meta.mimeType);
    const delimiter = source.meta.name.toLowerCase().endsWith('.tsv') ? '\t' : '';

    try {
      const Papa = (await loadParser('papaparse', () => import('papaparse'))).default;
      const rows: string[][] = [];
      let found = delimiter;
      // A slice at a time, yielding in between, so a big file never blocks the page for long.
      for (const slice of slices(text, PARSE_SLICE)) {
        const result = Papa.parse<string[]>(slice, { delimiter: found, skipEmptyLines: true });
        found = result.meta.delimiter;
        for (const row of result.data) rows.push(row);
        await new Promise((resolve) => setTimeout(resolve, 0));
        throwIfCancelled(signal);
      }
      throwIfCancelled(signal);
      this.headers = rows.shift() ?? [];
      this.rows = rows;
    } catch (cause) {
      throw asParseError(cause, 'Failed to parse CSV.');
    }

    this.layout = gridLayout(this.grid());
    const page: PageRef = {
      index: 0,
      width: this.layout.width,
      height: this.layout.height,
      rotation: 0,
    };

    return {
      format: 'csv',
      meta: source.meta,
      pageCount: 1,
      pages: [page],
    };
  }

  /** The header is unit 0 and data row `i` is unit `i + 1`, numbered `i + 1` in the gutter. */
  private grid(): GridSource {
    const { rows, headers } = this;
    let columnCount = headers.length;
    for (const row of rows) if (row.length > columnCount) columnCount = row.length;
    return {
      rowCount: rows.length,
      columnCount,
      headerUnit: 0,
      header: (c) => headers[c] ?? '',
      cell: (r, c) => rows[r]![c] ?? '',
      rowUnit: (r) => r + 1,
      rowLabel: (r) => String(r + 1),
      cellId: (c) => c,
    };
  }

  async renderPage(ctx: RenderContext): Promise<RenderResult> {
    const target = ctx.target as HTMLElement;
    const layout = this.layout ?? gridLayout(this.grid());
    const { root, rows } = renderGrid(target, this.grid(), layout, ctx.signal, ctx.print);
    this.lists.set(target, rows);
    if (ctx.print && rows.to < this.rows.length) {
      const note = root.appendChild(document.createElement('p'));
      note.textContent = `Printed the first ${rows.to.toLocaleString()} of ${this.rows.length.toLocaleString()} rows.`;
    }

    return {
      width: ctx.page.width * ctx.scale,
      height: target.offsetHeight || ctx.page.height * ctx.scale,
    };
  }

  async getTextLayer(
    _pageIndex: number,
    _signal?: AbortSignal,
  ): Promise<TextLayer> {
    const line = (row: string[], y: number): TextLayerItem => {
      const str = row.join('\t');
      return { str, x: 0, y, width: str.length * CHAR_WIDTH, height: TEXT_ROW_HEIGHT };
    };
    const items = this.rows.map((row, i) => line(row, (i + 1) * TEXT_ROW_HEIGHT));
    if (this.headers.length > 0) items.unshift(line(this.headers, 0));

    return { pageIndex: 0, items };
  }

  async search(query: SearchQuery, signal: AbortSignal): Promise<SearchResult> {
    return searchUnits(this.units(), query, signal);
  }

  /** Unit 0 is the header row and unit `i + 1` is data row `i`, as the rendered table marks them. */
  private *units(): Generator<SearchUnit> {
    const tables = [this.headers, ...this.rows];
    for (let unit = 0; unit < tables.length; unit++) {
      const row = tables[unit]!;
      for (let cell = 0; cell < row.length; cell++) yield { pageIndex: 0, unit, cell, text: row[cell]! };
    }
  }

  revealMatch(match: SearchMatch, target: HTMLElement): void {
    const unit = match.locator?.unit ?? 0;
    if (unit > 0) this.lists.get(target)?.scrollToRow(unit - 1);
  }

  dispose(): void {
    this.rows = [];
    this.headers = [];
    this.layout = null;
  }
}
