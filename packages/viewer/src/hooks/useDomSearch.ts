import { useEffect, useId, useState, type RefObject } from 'react';
import type { SearchMatch, SearchQuery } from '../core/types';
import { useViewerStore } from './useDocViewer';
import { isRevealed, revealMatch } from '../core/reveal-match';
import { findOccurrences } from '../core/search-pattern';
import { locateMatch, matchRanges, textRange, unitText } from '../core/search-units';

function supportsHighlights(): boolean {
  return 'highlights' in CSS && typeof Highlight !== 'undefined';
}

interface OwnerEntry {
  pageIndex: number;
  /** Ranges by match index, or in page order when the page found its own matches. */
  ranges: Map<number, Range> | Range[];
  /** Matches the page found in its DOM, for an adapter that cannot search its model. */
  matches: SearchMatch[] | null;
}

interface InstanceState {
  owners: Map<string, OwnerEntry>;
  currentIndex: number;
  apply: ((matches: SearchMatch[]) => void) | null;
}

const instances = new Map<string, InstanceState>();
const dirty = new Set<string>();
let publishScheduled = false;

function getInstance(id: string): InstanceState {
  let s = instances.get(id);
  if (!s) {
    s = { owners: new Map(), currentIndex: 0, apply: null };
    instances.set(id, s);
  }
  return s;
}

function orderedOwners(state: InstanceState): OwnerEntry[] {
  return Array.from(state.owners.values()).sort((a, b) => a.pageIndex - b.pageIndex);
}

function indexedRanges(state: InstanceState): Map<number, Range> {
  const indexed = new Map<number, Range>();
  let next = 0;
  for (const owner of orderedOwners(state)) {
    if (owner.ranges instanceof Map) owner.ranges.forEach((range, i) => indexed.set(i, range));
    else for (const range of owner.ranges) indexed.set(next++, range);
  }
  return indexed;
}

function orderedMatches(state: InstanceState): SearchMatch[] {
  return orderedOwners(state).flatMap((o) => o.matches ?? []);
}

function paintHighlights(): void {
  if (!supportsHighlights()) return;
  const reg = CSS.highlights;
  reg.delete('dv-search');
  reg.delete('dv-search-current');
  const all: Range[] = [];
  const current: Range[] = [];
  for (const state of instances.values()) {
    const ranges = indexedRanges(state);
    all.push(...ranges.values());
    const cur = ranges.get(state.currentIndex);
    if (cur) current.push(cur);
  }
  if (all.length > 0) reg.set('dv-search', new Highlight(...all));
  if (current.length > 0) reg.set('dv-search-current', new Highlight(...current));
}

function schedulePublish(id: string): void {
  dirty.add(id);
  if (publishScheduled) return;
  publishScheduled = true;
  queueMicrotask(() => {
    publishScheduled = false;
    const ids = Array.from(dirty);
    dirty.clear();
    for (const did of ids) {
      const s = instances.get(did);
      s?.apply?.(orderedMatches(s));
    }
  });
}

function setOwner(id: string, ownerId: string, entry: OwnerEntry): void {
  const s = getInstance(id);
  s.owners.set(ownerId, entry);
  paintHighlights();
  if (s.apply) schedulePublish(id);
}

function clearOwner(id: string, ownerId: string): void {
  const s = instances.get(id);
  if (!s || !s.owners.delete(ownerId)) return;
  if (s.owners.size === 0) {
    const apply = s.apply;
    instances.delete(id);
    paintHighlights();
    apply?.([]);
    return;
  }
  paintHighlights();
  if (s.apply) schedulePublish(id);
}

function findRanges(
  container: HTMLElement,
  query: SearchQuery,
  pageIndex: number,
): { ranges: Range[]; matches: SearchMatch[] } {
  const unit = unitText(container);
  const ranges: Range[] = [];
  const matches: SearchMatch[] = [];
  for (const [start, end] of findOccurrences(unit.text, query)) {
    const range = textRange(unit, start, end);
    if (!range) continue;
    ranges.push(range);
    matches.push({ pageIndex, text: unit.text.slice(start, end), x: 0, y: 0, width: 0, height: 0 });
  }
  return { ranges, matches };
}

/**
 * Paints and reveals search matches on a flowing page. Matches come from the adapter's model search and are
 * located by their `locator`; an adapter that cannot search has the page's DOM searched instead.
 */
export function useDomSearch(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  domVersion: unknown,
  pageIndex: number,
): void {
  const adapter = useViewerStore((s) => s.adapter);
  const searchQuery = useViewerStore((s) => s.searchQuery);
  const searchResult = useViewerStore((s) => s.searchResult);
  const currentMatchIndex = useViewerStore((s) => s.currentMatchIndex);
  const matchNonce = useViewerStore((s) => s.matchNonce);
  const applySearchMatches = useViewerStore((s) => s.applySearchMatches);
  const instanceId = useViewerStore((s) => s.instanceId);
  const ownerId = useId();
  const [mutations, setMutations] = useState(0);
  const modelSearch = !!adapter?.search;
  const modelResult = modelSearch ? searchResult : null;
  const searching = !!searchQuery?.text.trim();

  // Units that mount later (more rows, virtualized lines) need painting too.
  useEffect(() => {
    const el = containerRef.current;
    if (!active || !searching || !el) return;
    const observer = new MutationObserver(() => setMutations((n) => n + 1));
    observer.observe(el, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [active, searching, containerRef]);

  useEffect(() => {
    if (!active) return;
    getInstance(instanceId).apply = modelSearch ? null : applySearchMatches;
    const container = containerRef.current;
    if (!container) return;

    if (!searchQuery || !searching) {
      clearOwner(instanceId, ownerId);
      return;
    }

    if (modelResult) {
      setOwner(instanceId, ownerId, { pageIndex, ranges: matchRanges(container, modelResult.matches, pageIndex), matches: null });
    } else if (!modelSearch) {
      setOwner(instanceId, ownerId, { pageIndex, ...findRanges(container, searchQuery, pageIndex) });
    }

    return () => clearOwner(instanceId, ownerId);
  }, [active, modelSearch, modelResult, searchQuery, searching, domVersion, mutations, applySearchMatches, containerRef, ownerId, pageIndex, instanceId]);

  useEffect(() => {
    if (!active) return;
    const state = getInstance(instanceId);
    state.currentIndex = currentMatchIndex;
    paintHighlights();
    const container = containerRef.current;
    if (!container || isRevealed(container, matchNonce)) return;
    if (!modelSearch) {
      revealMatch(indexedRanges(state).get(currentMatchIndex), matchNonce, true);
      return;
    }
    const match = searchResult?.matches[currentMatchIndex];
    if (!match || match.pageIndex !== pageIndex) return;
    let cancelled = false;
    const reveal = () => {
      if (!cancelled) revealMatch(locateMatch(container, match), matchNonce, true);
    };
    const rendering = adapter?.revealMatch?.(match, container);
    if (rendering) rendering.then(reveal, () => {});
    else reveal();
    return () => {
      cancelled = true;
    };
  }, [active, modelSearch, adapter, searchResult, currentMatchIndex, matchNonce, domVersion, mutations, instanceId, containerRef, pageIndex]);
}
