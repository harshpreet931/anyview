/* ============================================================
 * useDomSearch — search for reflowable formats (markdown, code,
 * docx, html, csv, text) whose content is real DOM text.
 *
 * Finds query occurrences in a container, reports the match count
 * back to the store, paints highlights with the CSS Custom
 * Highlight API (graceful no-op where unsupported), and scrolls
 * the active match into view.
 * ============================================================ */

import { useEffect, useId, useRef, type RefObject } from 'react';
import type { SearchMatch, SearchQuery } from '../core/types';
import { useViewerStore } from './useDocViewer';

interface CustomHighlightCtor {
  new (...ranges: Range[]): unknown;
}

function highlightRegistry(): Map<string, unknown> | null {
  const reg = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
  return reg ?? null;
}

function HighlightCtor(): CustomHighlightCtor | null {
  return (globalThis as unknown as { Highlight?: CustomHighlightCtor }).Highlight ?? null;
}

const searchOwners = new Map<string, Range[]>();
let currentHighlightRange: Range | null = null;

function rebuildHighlights(): void {
  const reg = highlightRegistry();
  const Ctor = HighlightCtor();
  if (!reg || !Ctor) return;
  reg.delete('dv-search');
  reg.delete('dv-search-current');
  const all: Range[] = [];
  for (const ranges of searchOwners.values()) all.push(...ranges);
  if (all.length > 0) reg.set('dv-search', new Ctor(...all) as unknown);
  if (currentHighlightRange) {
    reg.set('dv-search-current', new Ctor(currentHighlightRange) as unknown);
  }
}

function setOwnerHighlights(
  ownerId: string,
  ranges: Range[],
  currentIndex: number,
): void {
  searchOwners.set(ownerId, ranges);
  currentHighlightRange = ranges[currentIndex] ?? currentHighlightRange;
  rebuildHighlights();
}

function clearOwner(ownerId: string): void {
  searchOwners.delete(ownerId);
  if (searchOwners.size === 0) currentHighlightRange = null;
  rebuildHighlights();
}

// Guard against pathological queries: an over-long pattern (usually a paste
// accident) and unbounded match counts that would freeze the main thread —
// a user-supplied regex can be catastrophically slow or match endlessly.
const MAX_QUERY_LENGTH = 1000;
const MAX_MATCHES = 10_000;

/** Locate query occurrences in `container`, returning DOM ranges + match records. */
function findRanges(
  container: HTMLElement,
  query: SearchQuery,
): { ranges: Range[]; matches: SearchMatch[] } {
  if (query.text.length > MAX_QUERY_LENGTH) return { ranges: [], matches: [] };

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT;
      return node.nodeValue && node.nodeValue.length > 0
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  const nodes: Text[] = [];
  const starts: number[] = [];
  let full = '';
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n as Text;
    starts.push(full.length);
    nodes.push(text);
    full += text.nodeValue ?? '';
  }

  const ranges: Range[] = [];
  const matches: SearchMatch[] = [];
  if (!full) return { ranges, matches };

  const needle = query.text;
  const occurrences: Array<[number, number]> = [];

  if (query.regex) {
    try {
      const re = new RegExp(needle, query.caseSensitive ? 'g' : 'gi');
      for (let m = re.exec(full); m; m = re.exec(full)) {
        if (m[0].length === 0) {
          re.lastIndex++;
          continue;
        }
        occurrences.push([m.index, m.index + m[0].length]);
        if (occurrences.length >= MAX_MATCHES) break;
      }
    } catch {
      return { ranges, matches };
    }
  } else {
    const hay = query.caseSensitive ? full : full.toLowerCase();
    const ndl = query.caseSensitive ? needle : needle.toLowerCase();
    if (!ndl) return { ranges, matches };
    let from = 0;
    for (let idx = hay.indexOf(ndl, from); idx !== -1; idx = hay.indexOf(ndl, from)) {
      const end = idx + ndl.length;
      if (!query.wholeWord || isWholeWord(full, idx, end)) {
        occurrences.push([idx, end]);
        if (occurrences.length >= MAX_MATCHES) break;
      }
      from = end;
    }
  }

  const locate = (globalOffset: number): { node: Text; offset: number } => {
    // Binary search the node whose range contains globalOffset.
    let lo = 0;
    let hi = nodes.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid]! <= globalOffset) lo = mid;
      else hi = mid - 1;
    }
    return { node: nodes[lo]!, offset: globalOffset - starts[lo]! };
  };

  for (const [start, end] of occurrences) {
    try {
      const a = locate(start);
      const b = locate(end);
      const range = document.createRange();
      range.setStart(a.node, a.offset);
      range.setEnd(b.node, b.offset);
      ranges.push(range);
      matches.push({
        pageIndex: 0,
        text: full.slice(start, end),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      });
    } catch {
      /* skip ranges that cross unexpected boundaries */
    }
  }

  return { ranges, matches };
}

function isWholeWord(text: string, start: number, end: number): boolean {
  const before = start > 0 ? text[start - 1]! : ' ';
  const after = end < text.length ? text[end]! : ' ';
  return !/\w/.test(before) && !/\w/.test(after);
}

/**
 * @param contentKey changes whenever the container's rendered content changes,
 *   so the search re-runs against fresh DOM.
 */
export function useDomSearch(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  contentKey: unknown,
): void {
  const searchQuery = useViewerStore((s) => s.searchQuery);
  const currentMatchIndex = useViewerStore((s) => s.currentMatchIndex);
  const matchNonce = useViewerStore((s) => s.matchNonce);
  const applySearchMatches = useViewerStore((s) => s.applySearchMatches);
  const rangesRef = useRef<Range[]>([]);
  const ownerId = useId();

  // Reflowable formats (passed active=true by PageRenderer) are always searched
  // against their DOM text here — even when their adapter ships a search()
  // method — because only this path produces visible highlights for them.
  // Canvas formats (PDF) pass active=false and use the positioned layer.
  const enabled = active;

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    if (!searchQuery || !searchQuery.text.trim()) {
      rangesRef.current = [];
      clearOwner(ownerId);
      return;
    }

    const { ranges, matches } = findRanges(container, searchQuery);
    rangesRef.current = ranges;
    applySearchMatches(matches);

    return () => clearOwner(ownerId);
  }, [enabled, searchQuery, contentKey, applySearchMatches, containerRef, ownerId]);

  useEffect(() => {
    if (!enabled) return;
    if (rangesRef.current.length === 0) return;
    setOwnerHighlights(ownerId, rangesRef.current, currentMatchIndex);
    const range = rangesRef.current[currentMatchIndex];
    const el =
      range?.startContainer.parentElement ??
      (range?.startContainer as HTMLElement | null);
    el?.scrollIntoView({ block: 'center' });
  }, [enabled, currentMatchIndex, matchNonce, ownerId]);
}
