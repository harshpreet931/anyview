import { useEffect, type RefObject } from 'react';
import type { Virtualizer } from '@tanstack/react-virtual';
import { useViewerStore } from '../../hooks/useDocViewer';
import { currentRow } from '../../core/current-row';

export function rowInView(
  el: HTMLElement,
  items: { index: number; start: number }[],
  horizontal: boolean,
  count: number,
): number {
  return currentRow(items, horizontal ? el.scrollLeft : el.scrollTop, {
    viewport: horizontal ? el.clientWidth : el.clientHeight,
    total: horizontal ? el.scrollWidth : el.scrollHeight,
    count,
  });
}

export function useTrackCurrentPage(
  scrollRef: RefObject<HTMLElement | null>,
  virtualizer: Virtualizer<HTMLDivElement, Element>,
  rows: number[][],
  isHorizontal: boolean,
  isProgrammaticScrollRef: RefObject<boolean>,
): void {
  const setCurrentPage = useViewerStore((s) => s.setCurrentPage);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || rows.length === 0) return;

    let ticking = false;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const track = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const row = rowInView(scrollEl, virtualizer.getVirtualItems(), isHorizontal, rows.length);
        setCurrentPage(rows[row]?.[0] ?? 0);
        ticking = false;
      });
    };
    // Scrolls we caused are ignored for a fixed window from the first one, not one that re-arms on every
    // event, or a user who keeps scrolling straight after a zoom would never get the page number back.
    const onScroll = () => {
      if (isProgrammaticScrollRef.current) {
        settleTimer ??= setTimeout(() => {
          settleTimer = undefined;
          isProgrammaticScrollRef.current = false;
          track();
        }, 150);
        return;
      }
      track();
    };

    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scrollEl.removeEventListener('scroll', onScroll);
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, [scrollRef, virtualizer, rows, isHorizontal, isProgrammaticScrollRef, setCurrentPage]);
}
