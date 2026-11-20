import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';
import type { VirtualItem, Virtualizer } from '@tanstack/react-virtual';

/** The scroll position as `offset` pixels into `row`, and the position it was taken at. */
type Anchor = { row: number; offset: number; at: number };

function anchorIn(items: ReadonlyArray<VirtualItem>, at: number): Anchor | null {
  const item = items.find((it) => it.start <= at && at < it.end);
  return item ? { row: item.index, offset: at - item.start, at } : null;
}

/**
 * Keeps what is at the scroll position in place while the rows above it change size (flowing pages taking
 * their real height after a jump, pages remounting), like the browser's own scroll anchoring.
 * The virtualizer's own scroll adjustment must be off.
 * A commit that changes anything in `layout` re-lays out every row, so it is left to the code that changed it.
 */
export function useScrollAnchor(
  scrollRef: RefObject<HTMLElement | null>,
  virtualizer: Virtualizer<HTMLDivElement, Element>,
  layout: ReadonlyArray<unknown>,
) {
  const anchor = useRef<Anchor | null>(null);
  const shown = useRef<ReadonlyArray<VirtualItem>>([]);
  const laidOut = useRef(layout);
  const horizontal = !!virtualizer.options.horizontal;

  const position = useCallback((el: HTMLElement) => (horizontal ? el.scrollLeft : el.scrollTop), [horizontal]);
  const scrollTo = useCallback(
    (el: HTMLElement, at: number) => {
      if (horizontal) el.scrollLeft = at;
      else el.scrollTop = at;
    },
    [horizontal],
  );

  useLayoutEffect(() => {
    const items = virtualizer.getVirtualItems();
    const before = shown.current;
    shown.current = items;
    const relaid = layout.length !== laidOut.current.length || layout.some((v, i) => v !== laidOut.current[i]);
    laidOut.current = layout;
    const el = scrollRef.current;
    if (!el || relaid) {
      anchor.current = null;
      return;
    }
    const now = position(el);
    // A scroll since the last commit moved over the rows as they were on screen then.
    const at = anchor.current && Math.abs(anchor.current.at - now) < 1 ? anchor.current : anchorIn(before, now);
    const start = at && virtualizer.measurementsCache[at.row]?.start;
    if (at && start != null && Math.abs(start + at.offset - now) >= 1) scrollTo(el, start + at.offset);
    anchor.current = at ? { ...at, at: position(el) } : anchorIn(items, now);
  });

  /** Scrolls to `offset` pixels into `row` and keeps it there while the rows above are measured. */
  const scrollToRow = useCallback(
    (row: number, offset = 0) => {
      const el = scrollRef.current;
      if (!el) return;
      // getVirtualItems() is called for its side effect: it brings the measurements up to date.
      virtualizer.getVirtualItems();
      scrollTo(el, (virtualizer.measurementsCache[row]?.start ?? 0) + offset);
      anchor.current = { row, offset, at: position(el) };
    },
    [scrollRef, virtualizer, position, scrollTo],
  );

  /** Keeps what is at the current scroll position in place, after a scroll computed for the latest measurements. */
  const holdScrollPosition = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const at = position(el);
    const item = virtualizer.getVirtualItemForOffset(at);
    anchor.current = item ? { row: item.index, offset: at - item.start, at } : null;
  }, [scrollRef, virtualizer, position]);

  return { scrollToRow, holdScrollPosition };
}
