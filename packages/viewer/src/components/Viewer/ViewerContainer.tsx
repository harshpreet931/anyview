import { useRef, useEffect, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useViewerStore } from '../../hooks/useDocViewer';
import { useStrings } from '../../i18n/I18nProvider';
import { useZoomGestures } from '../../hooks/useZoomGestures';
import { displayedPageSize } from '../../core/rotation';
import { rowAtOffset } from '../../core/current-row';
import { groupRows } from '../../core/group-rows';
import { PageRenderer } from './PageRenderer';
import { EmptyState, LoadingState, ErrorState } from '../States';
import { PAGE_SPREAD_GAP, PAGE_VERTICAL_GAP } from './layout';
import { useFitZoom } from './useFitZoom';
import { rowInView, useTrackCurrentPage } from './useTrackCurrentPage';

function pageInRow(
  content: HTMLElement | null,
  row: number,
  cross: number,
  horizontal: boolean,
): HTMLElement | null {
  const rowEl = content?.querySelector<HTMLElement>(`[data-index="${row}"]`);
  if (!rowEl) return null;
  let best: HTMLElement | null = null;
  let bestDist = Infinity;
  for (const p of rowEl.querySelectorAll<HTMLElement>('.dv-page')) {
    const { cross: from } = pageOffset(p, horizontal);
    const to = from + (horizontal ? p.offsetHeight : p.offsetWidth);
    const dist = cross < from ? from - cross : cross > to ? cross - to : 0;
    if (dist < bestDist) {
      best = p;
      bestDist = dist;
    }
  }
  return best;
}

function pageOffset(p: HTMLElement, horizontal: boolean): { main: number; cross: number } {
  const rowEl = p.closest<HTMLElement>('[data-index]');
  if (!rowEl) return { main: 0, cross: 0 };
  const content = rowEl.parentElement;
  const scale = content && content.offsetWidth > 0 ? content.getBoundingClientRect().width / content.offsetWidth : 1;
  const pr = p.getBoundingClientRect();
  const rr = rowEl.getBoundingClientRect();
  const dx = (pr.left - rr.left) / scale;
  const dy = (pr.top - rr.top) / scale;
  return horizontal ? { main: dx, cross: dy } : { main: dy, cross: dx };
}

export function ViewerContainer() {
  const strings = useStrings();
  const document = useViewerStore((s) => s.document);
  const loadState = useViewerStore((s) => s.loadState);
  const loadError = useViewerStore((s) => s.loadError);
  const zoom = useViewerStore((s) => s.zoom);
  const rotation = useViewerStore((s) => s.rotation);
  const scrollMode = useViewerStore((s) => s.scrollMode);
  const spreadMode = useViewerStore((s) => s.spreadMode);
  const currentPage = useViewerStore((s) => s.currentPage);
  const scrollOffset = useViewerStore((s) => s.scrollOffset);
  const isScrolling = useViewerStore((s) => s.isScrolling);
  const setScrolling = useViewerStore((s) => s.setScrolling);
  const setVisiblePages = useViewerStore((s) => s.setVisiblePages);
  const cursorMode = useViewerStore((s) => s.cursorMode);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef(false);

  const isHorizontal = scrollMode === 'horizontal';
  const pageCount = document?.pages.length ?? 0;

  const rows = useMemo(
    () => groupRows(pageCount, spreadMode, isHorizontal),
    [pageCount, isHorizontal, spreadMode],
  );

  const pageToRow = useMemo<number[]>(() => {
    const map: number[] = [];
    rows.forEach((row, r) => row.forEach((p) => { map[p] = r; }));
    return map;
  }, [rows]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (rowIndex) => {
      const gap = isHorizontal ? 0 : PAGE_VERTICAL_GAP;
      const pages = document?.pages;
      const row = rows[rowIndex];
      if (!pages || !row) return 400 + gap;
      let main = 0;
      for (const p of row) {
        const page = pages[p];
        if (!page) continue;
        const size = displayedPageSize(page.width, page.height, page.rotation, rotation, zoom);
        const m = isHorizontal ? size.width : size.height;
        if (m > main) main = m;
      }
      return (main || 400) + gap;
    },
    overscan: 2,
    horizontal: isHorizontal,
  });

  const anchorHoldRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const holdAnchor = () => {
    if (anchorHoldRef.current) clearTimeout(anchorHoldRef.current);
    virtualizer.shouldAdjustScrollPositionOnItemSizeChange = () => false;
    anchorHoldRef.current = setTimeout(() => {
      anchorHoldRef.current = undefined;
      virtualizer.shouldAdjustScrollPositionOnItemSizeChange = undefined;
    }, 500);
  };
  useEffect(() => () => clearTimeout(anchorHoldRef.current), []);

  const { marquee } = useZoomGestures(scrollRef, contentRef, isProgrammaticScrollRef, {
    capture: (x, y) => {
      const main = isHorizontal ? x : y;
      const cross = isHorizontal ? y : x;
      const items = virtualizer.measurementsCache;
      const row = rowAtOffset(items, main);
      const start = items[row]?.start ?? 0;
      const pageEl = pageInRow(contentRef.current, row, cross, isHorizontal);
      const off = pageEl ? pageOffset(pageEl, isHorizontal) : { main: 0, cross: 0 };
      return {
        row,
        page: pageEl ? Number(pageEl.dataset.pageIndex) : -1,
        main: main - start - off.main,
        cross: cross - off.cross,
        atStart: main <= 0,
        sizes: new Map(virtualizer.itemSizeCache),
      };
    },
    restore: (at, ratio, viewX, viewY) => {
      const el = scrollRef.current;
      if (!el) return;
      holdAnchor();
      virtualizer.measure();
      // getVirtualItems() is called for its side effect: it makes the virtualizer recompute its measurements.
      virtualizer.getVirtualItems();
      const gap = isHorizontal ? 0 : PAGE_VERTICAL_GAP;
      for (const [key, size] of at.sizes) {
        if (typeof key === 'number') virtualizer.resizeItem(key, Math.max(0, size - gap) * ratio + gap);
      }
      virtualizer.getVirtualItems();
      const content = contentRef.current;
      if (content) {
        const total = `${virtualizer.getTotalSize()}px`;
        if (isHorizontal) content.style.width = total;
        else content.style.height = total;
      }
      const start = virtualizer.measurementsCache[at.row]?.start ?? 0;
      const pageEl =
        at.page >= 0
          ? content?.querySelector<HTMLElement>(`.dv-page[data-page-index="${at.page}"]`)
          : null;
      const off = pageEl ? pageOffset(pageEl, isHorizontal) : { main: 0, cross: 0 };
      const main = at.atStart ? 0 : start + off.main + at.main * ratio - (isHorizontal ? viewX : viewY);
      const cross = off.cross + at.cross * ratio - (isHorizontal ? viewY : viewX);
      const left = Math.max(0, isHorizontal ? main : cross);
      const top = Math.max(0, isHorizontal ? cross : main);
      if (Math.abs(el.scrollLeft - left) < 1 && Math.abs(el.scrollTop - top) < 1) return;
      const was = [el.scrollLeft, el.scrollTop];
      isProgrammaticScrollRef.current = true;
      el.scrollLeft = left;
      el.scrollTop = top;
      if (el.scrollLeft === was[0] && el.scrollTop === was[1]) isProgrammaticScrollRef.current = false;
    },
  }, sizerRef);

  useEffect(() => {
    if (currentPage < 0 || currentPage >= pageCount) return;
    const el = scrollRef.current;
    if (!el) return;
    const targetRow = pageToRow[currentPage] ?? 0;
    if (rowInView(el, virtualizer.getVirtualItems(), isHorizontal, rows.length) !== targetRow) {
      isProgrammaticScrollRef.current = true;
      virtualizer.scrollToIndex(targetRow, { align: 'start' });
    }
  }, [currentPage, pageCount, virtualizer, pageToRow, isHorizontal, rows.length]);

  useEffect(() => {
    if (!isScrolling) return;
    const el = scrollRef.current;
    if (!el) {
      setScrolling(false);
      return;
    }
    const targetRow = pageToRow[currentPage] ?? 0;
    isProgrammaticScrollRef.current = true;
    virtualizer.scrollToIndex(targetRow, { align: 'start' });
    requestAnimationFrame(() => {
      el.scrollTop += scrollOffset * zoom;
      setScrolling(false);
    });
  }, [isScrolling, scrollOffset, zoom, currentPage, virtualizer, pageToRow, setScrolling]);

  useTrackCurrentPage(scrollRef, virtualizer, rows, isHorizontal, isProgrammaticScrollRef);

  useEffect(() => {
    const pages = virtualizer
      .getVirtualItems()
      .flatMap((it) => rows[it.index] ?? []);
    setVisiblePages(pages);
  });

  useFitZoom(scrollRef);

  const showState = loadState !== 'loaded' || !document;

  return (
    <div
      className="dv-viewer-container"
      ref={scrollRef}
      tabIndex={0}
      role="region"
      aria-label={strings.viewer.content}
      data-marquee={cursorMode === 'marquee' || undefined}
    >
      {showState ? (
        <>
          {loadState === 'idle' && <EmptyState />}
          {loadState === 'loading' && <LoadingState />}
          {loadState === 'error' && (
            <ErrorState {...(loadError?.message ? { message: loadError.message } : {})} />
          )}
        </>
      ) : (
        <div
          ref={contentRef}
          style={{
            height: isHorizontal ? '100%' : `${virtualizer.getTotalSize()}px`,
            width: isHorizontal ? `${virtualizer.getTotalSize()}px` : '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const row = rows[virtualItem.index] ?? [];
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  ...(isHorizontal
                    ? { height: '100%', transform: `translateX(${virtualItem.start}px)` }
                    : { width: '100%', transform: `translateY(${virtualItem.start}px)` }),
                }}
              >
                {row.length > 1 ? (
                  <div
                    className="dv-spread"
                    style={{
                      display: 'flex',
                      justifyContent: 'safe center',
                      alignItems: 'flex-start',
                      gap: `${PAGE_SPREAD_GAP * zoom}px`,
                    }}
                  >
                    {row.map((p) => (
                      <PageRenderer key={p} pageIndex={p} />
                    ))}
                  </div>
                ) : (
                  <PageRenderer pageIndex={row[0]!} />
                )}
              </div>
            );
          })}

          {marquee && (
            <div
              className="dv-marquee-rect"
              style={{
                position: 'absolute',
                left: `${marquee.left}px`,
                top: `${marquee.top}px`,
                width: `${marquee.w}px`,
                height: `${marquee.h}px`,
              }}
            />
          )}
        </div>
      )}
      <div ref={sizerRef} className="dv-zoom-sizer" aria-hidden="true" />
    </div>
  );
}
