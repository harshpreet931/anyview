import type { SearchUnit } from '../search-units';
import { mountRows, type RowList } from './virtual-rows';

export const LINE_HEIGHT = 20;
export const FONT_SIZE = 14;
/** Common monospace fonts advance 0.55-0.61em per character; sizing lines at 0.61em keeps them inside the page. */
export const CHAR_WIDTH = FONT_SIZE * 0.61;
const TAB_SIZE = 4;

function columnCount(line: string): number {
  let columns = 0;
  for (const ch of line) columns = ch === '\t' ? columns + TAB_SIZE - (columns % TAB_SIZE) : columns + 1;
  return columns;
}

/** The lines of a text, found once as offsets so a huge file is not split into a string per line up front. */
export class LineIndex {
  readonly count: number;
  /** The widest line in columns, with tabs expanded. */
  readonly columns: number;
  private readonly starts: Float64Array;

  constructor(private readonly text: string) {
    let count = 1;
    for (let at = text.indexOf('\n'); at >= 0; at = text.indexOf('\n', at + 1)) count++;
    const starts = new Float64Array(count + 1);
    let widest = 0;
    let tab = text.indexOf('\t');
    for (let i = 0, start = 0; i < count; i++) {
      starts[i] = start;
      const newline = text.indexOf('\n', start);
      const end = newline < 0 ? text.length : newline;
      if (tab >= 0 && tab < end) {
        widest = Math.max(widest, columnCount(text.slice(start, end)));
        tab = text.indexOf('\t', end);
      } else {
        widest = Math.max(widest, end - start);
      }
      start = end + 1;
    }
    starts[count] = text.length + 1;
    this.count = count;
    this.columns = widest;
    this.starts = starts;
  }

  line(i: number): string {
    const line = this.text.slice(this.starts[i], this.starts[i + 1]! - 1);
    return line.endsWith('\r') ? line.slice(0, -1) : line;
  }

  all(): string[] {
    return Array.from({ length: this.count }, (_, i) => this.line(i));
  }
}

/** Each line is a search unit, as {@link mountLines} marks it. */
export function* lineUnits(lines: LineIndex): Generator<SearchUnit> {
  for (let unit = 0; unit < lines.count; unit++) yield { pageIndex: 0, unit, text: lines.line(unit) };
}

/**
 * Lists `count` lines in `pre`, rendering only those in view. Each line is one search unit, `LINE_HEIGHT` px
 * tall, and never wraps.
 */
export function mountLines(
  pre: HTMLElement,
  count: number,
  content: (index: number) => string | Node,
  signal: AbortSignal,
  print = false,
  onWindow?: (from: number, to: number) => void,
): RowList {
  const spacer = document.createElement('div');
  spacer.className = 'dv-rows';
  const layer = document.createElement('code');
  layer.className = 'dv-rows-layer';
  spacer.appendChild(layer);
  pre.replaceChildren(spacer);
  const renderRow = (index: number) => {
    const line = document.createElement('span');
    line.className = 'line dv-line';
    line.dataset.dvUnit = String(index);
    const body = content(index);
    if (typeof body === 'string') line.textContent = body;
    else line.appendChild(body);
    return line;
  };
  return mountRows({ count, rowHeight: LINE_HEIGHT, spacer, layer, renderRow, ...(onWindow ? { onWindow } : {}) }, signal, print);
}
