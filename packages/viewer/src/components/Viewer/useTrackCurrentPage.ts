import { useEffect, type RefObject } from 'react';
import type { Virtualizer } from '@tanstack/react-virtual';
import { useViewerStoreApi } from '../../hooks/useDocViewer';
import { currentRow } from '../../core/current-row';
import { PAGE_GAP } from './layout';

type RowSpan = { index: number; start: number; end: number };

export function rowInView(el: HTMLElement, items: RowSpan[], horizontal: boolean, count: number): number {
  return currentRow(items, horizontal ? el.scrollLeft : el.scrollTop, {
    viewport: horizontal ? el.clientWidth : el.clientHeight,
    total: horizontal ? el.scrollWidth : el.scrollHeight,
    count,
    gap: PAGE_GAP,
  });
}

function isRowShown(el: HTMLElement, items: RowSpan[], row: number, horizontal: boolean): boolean {
  const item = items.find((it) => it.index === row);
  const from = horizontal ? el.scrollLeft : el.scrollTop;
  const to = from + (horizontal ? el.clientWidth : el.clientHeight);
  return !!item && item.end > from && item.start < to;
}

export function useTrackCurrentPage(
  scrollRef: RefObject<HTMLElement | null>,
  virtualizer: Virtualizer<HTMLDivElement, Element>,
  rows: number[][],
  pageToRow: number[],
  isHorizontal: boolean,
  isProgrammaticScrollRef: RefObject<boolean>,
): void {
  const store = useViewerStoreApi();

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || rows.length === 0) return;

    let ticking = false;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const track = (afterJump: boolean) => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const items = virtualizer.getVirtualItems();
        const row = rowInView(scrollEl, items, isHorizontal, rows.length);
        const { currentPage, setCurrentPage } = store.getState();
        const shownRow = pageToRow[currentPage];
        // Either page of a spread can be the current one.
        if (shownRow === row) return;
        // A jump near the end can't bring its page to the top, and the end counts as the last page;
        // the page that was asked for stays current while it is in view.
        const atEnd = row === rows.length - 1;
        if (afterJump && atEnd && shownRow !== undefined && isRowShown(scrollEl, items, shownRow, isHorizontal)) return;
        setCurrentPage(rows[row]?.[0] ?? 0);
      });
    };
    // Scrolls we caused are ignored for a fixed window from the first one, not one that re-arms on every
    // event, or a user who keeps scrolling straight after a zoom would never get the page number back.
    const onScroll = () => {
      if (isProgrammaticScrollRef.current) {
        settleTimer ??= setTimeout(() => {
          settleTimer = undefined;
          isProgrammaticScrollRef.current = false;
          track(true);
        }, 150);
        return;
      }
      track(false);
    };

    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scrollEl.removeEventListener('scroll', onScroll);
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, [scrollRef, virtualizer, rows, pageToRow, isHorizontal, isProgrammaticScrollRef, store]);
}
