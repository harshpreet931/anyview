import { useEffect, useId, type RefObject } from 'react';
import type { SearchMatch, SearchQuery } from '../core/types';
import { useViewerStore } from './useDocViewer';
import { revealMatch } from '../core/reveal-match';
import { findOccurrences } from './dom-search';

function supportsHighlights(): boolean {
  return 'highlights' in CSS && typeof Highlight !== 'undefined';
}

interface OwnerEntry {
  pageIndex: number;
  ranges: Range[];
  matches: SearchMatch[];
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

function orderedRanges(state: InstanceState): Range[] {
  return orderedOwners(state).flatMap((o) => o.ranges);
}

function orderedMatches(state: InstanceState): SearchMatch[] {
  return orderedOwners(state).flatMap((o) => o.matches);
}

function paintHighlights(): void {
  if (!supportsHighlights()) return;
  const reg = CSS.highlights;
  reg.delete('dv-search');
  reg.delete('dv-search-current');
  const all: Range[] = [];
  const current: Range[] = [];
  for (const state of instances.values()) {
    const ranges = orderedRanges(state);
    all.push(...ranges);
    const cur = ranges[state.currentIndex];
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
  schedulePublish(id);
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
  schedulePublish(id);
}

function collectText(container: HTMLElement): { nodes: Text[]; starts: number[]; full: string } {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT;
      return node.nodeValue ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
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
  return { nodes, starts, full };
}

function findRanges(
  container: HTMLElement,
  query: SearchQuery,
  pageIndex: number,
): { ranges: Range[]; matches: SearchMatch[] } {
  const ranges: Range[] = [];
  const matches: SearchMatch[] = [];
  const { nodes, starts, full } = collectText(container);

  const locate = (globalOffset: number): { node: Text; offset: number } => {
    let lo = 0;
    let hi = nodes.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid]! <= globalOffset) lo = mid;
      else hi = mid - 1;
    }
    return { node: nodes[lo]!, offset: globalOffset - starts[lo]! };
  };

  for (const [start, end] of findOccurrences(full, query)) {
    const a = locate(start);
    const b = locate(end);
    const range = document.createRange();
    try {
      range.setStart(a.node, a.offset);
      range.setEnd(b.node, b.offset);
    } catch {
      continue;
    }
    ranges.push(range);
    matches.push({ pageIndex, text: full.slice(start, end), x: 0, y: 0, width: 0, height: 0 });
  }

  return { ranges, matches };
}

export function useDomSearch(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  domVersion: unknown,
  pageIndex: number,
): void {
  const searchQuery = useViewerStore((s) => s.searchQuery);
  const currentMatchIndex = useViewerStore((s) => s.currentMatchIndex);
  const matchNonce = useViewerStore((s) => s.matchNonce);
  const applySearchMatches = useViewerStore((s) => s.applySearchMatches);
  const instanceId = useViewerStore((s) => s.instanceId);
  const ownerId = useId();

  useEffect(() => {
    if (!active) return;
    getInstance(instanceId).apply = applySearchMatches;
    const container = containerRef.current;
    if (!container) return;

    if (!searchQuery || !searchQuery.text.trim()) {
      clearOwner(instanceId, ownerId);
      return;
    }

    const { ranges, matches } = findRanges(container, searchQuery, pageIndex);
    setOwner(instanceId, ownerId, { pageIndex, ranges, matches });

    return () => clearOwner(instanceId, ownerId);
  }, [active, searchQuery, domVersion, applySearchMatches, containerRef, ownerId, pageIndex, instanceId]);

  useEffect(() => {
    if (!active) return;
    const state = getInstance(instanceId);
    state.currentIndex = currentMatchIndex;
    paintHighlights();
    const current = orderedRanges(state)[currentMatchIndex];
    const node = current?.startContainer;
    revealMatch(node instanceof Element ? node : node?.parentElement, matchNonce);
  }, [active, currentMatchIndex, matchNonce, instanceId]);
}
