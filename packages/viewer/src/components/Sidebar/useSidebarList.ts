import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { defaultRangeExtractor, useVirtualizer, type Range } from '@tanstack/react-virtual';

const clamp = (i: number, count: number) => Math.max(0, Math.min(i, count - 1));

/**
 * A virtualized list inside the sidebar's scrolling panel, with one tab stop that arrow keys move.
 * The item holding the tab stop always stays mounted, so focus never drops to <body> when it is
 * scrolled out of view. With `restingIndex`, the tab stop returns there once focus leaves the list.
 */
export function useSidebarList({
  count,
  scrollElement,
  estimateSize,
  paddingEnd,
  gap = 0,
  restingIndex,
}: {
  count: number;
  scrollElement: HTMLElement;
  estimateSize: (index: number) => number;
  paddingEnd: number;
  gap?: number;
  restingIndex?: number;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const focusPendingRef = useRef(false);
  const active = clamp(focused ?? restingIndex ?? 0, count);

  const rangeExtractor = useCallback(
    (range: Range) => {
      const indexes = defaultRangeExtractor(range);
      if (active >= range.count || indexes.includes(active)) return indexes;
      return active < indexes[0]! ? [active, ...indexes] : [...indexes, active];
    },
    [active],
  );

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollElement,
    estimateSize,
    rangeExtractor,
    overscan: 4,
    paddingStart: 8,
    paddingEnd,
    gap,
  });

  useLayoutEffect(() => {
    if (!focusPendingRef.current) return;
    focusPendingRef.current = false;
    const at = `[data-index="${active}"]`;
    listRef.current?.querySelector<HTMLElement>(`${at}[tabindex], ${at} [tabindex]`)?.focus({ preventScroll: true });
  }, [active]);

  const moveFocus = (index: number) => {
    const next = clamp(index, count);
    virtualizer.scrollToIndex(next, { align: 'auto' });
    if (next === active) return;
    focusPendingRef.current = true;
    setFocused(next);
  };

  const listProps = {
    onFocus: (e: React.FocusEvent) => {
      const index = (e.target as HTMLElement).closest('[data-index]')?.getAttribute('data-index');
      if (index != null) setFocused(Number(index));
    },
    onBlur: (e: React.FocusEvent) => {
      if (restingIndex !== undefined && !e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(null);
    },
    style: { height: `${virtualizer.getTotalSize()}px` },
  };

  return { virtualizer, active, moveFocus, listRef, listProps };
}
