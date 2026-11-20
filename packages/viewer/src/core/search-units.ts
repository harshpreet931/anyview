import type { SearchMatch, SearchQuery, SearchResult } from './types';
import type { SafeHtml } from './safe-html';
import { throwIfCancelled } from './errors';
import { MAX_MATCHES, occurrenceFinder } from './search-pattern';

/** One searchable piece of a page's model: a table cell, a line, a block. See {@link MatchLocator}. */
export interface SearchUnit {
  readonly pageIndex: number;
  readonly unit: number;
  readonly cell?: number;
  readonly text: string;
}

export interface UnitText {
  readonly text: string;
  readonly nodes: Text[];
  readonly starts: number[];
}

const YIELD_EVERY = 20_000;

/** Searches units in order, stopping at {@link MAX_MATCHES}. A match never spans two units. */
export async function searchUnits(
  units: Iterable<SearchUnit>,
  query: SearchQuery,
  signal: AbortSignal,
): Promise<SearchResult> {
  const find = occurrenceFinder(query);
  const matches: SearchMatch[] = [];
  let truncated = false;
  let seen = 0;
  if (find) {
    for (const { pageIndex, unit, cell, text } of units) {
      for (const [start, end] of find(text, MAX_MATCHES + 1 - matches.length)) {
        if (matches.length === MAX_MATCHES) {
          truncated = true;
          break;
        }
        const locator = cell == null ? { unit, start, end } : { unit, cell, start, end };
        matches.push({ pageIndex, text: text.slice(start, end), x: 0, y: 0, width: 0, height: 0, locator });
      }
      if (truncated) break;
      if (++seen % YIELD_EVERY === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        throwIfCancelled(signal);
      }
    }
  }
  return { query, matches, totalMatches: matches.length, ...(truncated ? { truncated } : {}) };
}

const BLOCK =
  'address,article,aside,blockquote,dd,details,div,dl,dt,figcaption,figure,footer,h1,h2,h3,h4,h5,h6,header,li,main,nav,ol,p,pre,section,summary,table,td,th,tr,ul';

/** The text of a unit as search sees it: text nodes in order, with a "\n" at each `<br>` and between blocks or cells. */
export function unitText(el: Element): UnitText {
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n instanceof Element && (n.tagName === 'SCRIPT' || n.tagName === 'STYLE')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  const nodes: Text[] = [];
  const starts: number[] = [];
  let text = '';
  let block: Element | null = null;
  let pendingBreak = false;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n instanceof Element) {
      if (n.tagName === 'BR') pendingBreak = true;
      continue;
    }
    const node = n as Text;
    if (!node.data) continue;
    const found = node.parentElement!.closest(BLOCK);
    const nodeBlock = found && el.contains(found) ? found : el;
    if (text && (pendingBreak || nodeBlock !== block)) text += '\n';
    block = nodeBlock;
    pendingBreak = false;
    nodes.push(node);
    starts.push(text.length);
    text += node.data;
  }
  return { text, nodes, starts };
}

/** The blocks of a flowing page: the top-level elements, under any lone wrapper. Loose text makes the root one block. */
export function blockUnits(root: Element): Element[] {
  let el = root;
  while (el.children.length === 1 && !hasLooseText(el)) el = el.children[0]!;
  return hasLooseText(el) ? [el] : Array.from(el.children);
}

function hasLooseText(el: Element): boolean {
  return Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && !!n.nodeValue?.trim());
}

export function markBlockUnits(root: Element): void {
  blockUnits(root).forEach((el, i) => el.setAttribute('data-dv-unit', String(i)));
}

/** The text of each block that {@link markBlockUnits} marks when the same markup is rendered. */
export function blockTexts(html: SafeHtml): string[] {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  return blockUnits(body).map((el) => unitText(el).text);
}

/** Where a match is in a rendered page: its exact range, the unit or cell element when the text differs, or null. */
export function locateMatch(container: Element, match: SearchMatch): Range | Element | null {
  const el = unitElement(container, match);
  if (!el) return null;
  return rangeIn(unitText(el), match) ?? el;
}

/** Ranges of the rendered matches on one page, keyed by the match's index in `matches`. */
export function matchRanges(container: Element, matches: ReadonlyArray<SearchMatch>, pageIndex: number): Map<number, Range> {
  const ranges = new Map<number, Range>();
  const units = new Map<string, Element>();
  container.querySelectorAll('[data-dv-unit]').forEach((el) => {
    const unit = el.getAttribute('data-dv-unit')!;
    if (!units.has(unit)) units.set(unit, el);
  });
  const texts = new Map<Element, UnitText>();
  matches.forEach((match, i) => {
    const loc = match.locator;
    if (match.pageIndex !== pageIndex || !loc) return;
    const unitEl = units.get(String(loc.unit));
    const el = unitEl && (loc.cell == null ? unitEl : cellElement(unitEl, loc.cell));
    if (!el) return;
    let text = texts.get(el);
    if (!text) texts.set(el, (text = unitText(el)));
    const range = rangeIn(text, match);
    if (range) ranges.set(i, range);
  });
  return ranges;
}

function unitElement(container: Element, match: SearchMatch): Element | null {
  const loc = match.locator;
  if (!loc) return null;
  const unitEl = container.querySelector(`[data-dv-unit="${loc.unit}"]`);
  if (!unitEl || loc.cell == null) return unitEl;
  return cellElement(unitEl, loc.cell);
}

function cellElement(unitEl: Element, cell: number): Element | null {
  return unitEl.querySelector(`[data-dv-cell="${cell}"]`);
}

function rangeIn(unit: UnitText, match: SearchMatch): Range | null {
  const { start, end } = match.locator!;
  return unit.text.slice(start, end) === match.text ? textRange(unit, start, end) : null;
}

/** The DOM range over `[start, end)` of a unit's search text. */
export function textRange({ nodes, starts }: UnitText, start: number, end: number): Range | null {
  if (nodes.length === 0) return null;
  // A boundary offset belongs to the node it starts for a range start, and to the node it ends for a range end.
  const at = (offset: number, isStart: boolean) => {
    let lo = 0;
    let hi = nodes.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (isStart ? starts[mid]! <= offset : starts[mid]! < offset) lo = mid;
      else hi = mid - 1;
    }
    return { node: nodes[lo]!, offset: Math.min(Math.max(offset - starts[lo]!, 0), nodes[lo]!.length) };
  };
  const a = at(start, true);
  const b = at(end, false);
  const range = a.node.ownerDocument.createRange();
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  return range;
}
