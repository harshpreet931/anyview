import { useRef, useEffect, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useViewerStore } from '../../hooks/useDocViewer';
import { useZoomGestures } from '../../hooks/useZoomGestures';
import {
  totalRotation,
  isSidewaysRotation,
  displayedPageSize,
  type Rotation,
} from '../../core/rotation';
import { PageRenderer } from './PageRenderer';
import { EmptyState, LoadingState, ErrorState } from '../States';

const PAGE_VERTICAL_GAP = 48;
const PAGE_SPREAD_GAP = 16;

/** The row whose start is at or above the scroll offset (the top-most row in view). */
function rowAtOffset(items: { index: number; start: number }[], offset: number): number {
  let row = items.length > 0 ? items[0].index : 0;
  for (const it of items) {
    if (it.start <= offset + 1) row = it.index;
    else break;
  }
  return row;
}

export function ViewerContainer() {
  const document = useViewerStore((s) => s.document);
  const loadState = useViewerStore((s) => s.loadState);
  const loadError = useViewerStore((s) => s.loadError);
  const zoom = useViewerStore((s) => s.zoom);
  const rotation = useViewerStore((s) => s.rotation);
  const scrollMode = useViewerStore((s) => s.scrollMode);
  const spreadMode = useViewerStore((s) => s.spreadMode);
  const currentPage = useViewerStore((s) => s.currentPage);
  const setCurrentPage = useViewerStore((s) => s.setCurrentPage);
  const scrollOffset = useViewerStore((s) => s.scrollOffset);
  const isScrolling = useViewerStore((s) => s.isScrolling);
  const setScrolling = useViewerStore((s) => s.setScrolling);
  const setVisiblePages = useViewerStore((s) => s.setVisiblePages);
  const fitMode = useViewerStore((s) => s.fitMode);
  const applyFitZoom = useViewerStore((s) => s._applyFitZoom);
  const cursorMode = useViewerStore((s) => s.cursorMode);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef(false);

  const { marquee } = useZoomGestures(scrollRef, contentRef, isProgrammaticScrollRef);

  const isHorizontal = scrollMode === 'horizontal';
  const pageCount = document?.pages.length ?? 0;

  const rows = useMemo<number[][]>(() => {
    if (pageCount === 0) return [];
    if (isHorizontal || spreadMode === 'none') {
      return Array.from({ length: pageCount }, (_, i) => [i]);
    }
    const out: number[][] = [];
    let i = 0;
    if (spreadMode === 'odd') {
      out.push([0]);
      i = 1;
    }
    for (; i < pageCount; i += 2) {
      out.push(i + 1 < pageCount ? [i, i + 1] : [i]);
    }
    return out;
  }, [pageCount, isHorizontal, spreadMode]);

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
      const row = document ? rows[rowIndex] : undefined;
      if (!row) return 400 + gap;
      let main = 0;
      for (const p of row) {
        const page = document!.pages[p];
        if (!page) continue;
        const size = displayedPageSize(
          page.width,
          page.height,
          page.rotation as Rotation,
          rotation as Rotation,
          zoom,
        );
        const m = isHorizontal ? size.width : size.height;
        if (m > main) main = m;
      }
      return (main || 400) + gap;
    },
    overscan: 2,
    horizontal: isHorizontal,
  });

  // Bring the current page to the top whenever it changes for a reason other
  // than the user scrolling. "Already there" uses the same rule as the scroll
  // listener below (the row at the top edge of the viewport), so a page change
  // that came from scrolling never triggers a programmatic scroll. Using
  // getVirtualItems() for this was wrong: it includes overscan rows that are
  // rendered but off-screen, so Next/Prev within two rows never moved.
  useEffect(() => {
    if (currentPage < 0 || currentPage >= pageCount) return;
    const el = scrollRef.current;
    if (!el) return;
    const targetRow = pageToRow[currentPage] ?? 0;
    const offset = isHorizontal ? el.scrollLeft : el.scrollTop;
    if (rowAtOffset(virtualizer.getVirtualItems(), offset) !== targetRow) {
      isProgrammaticScrollRef.current = true;
      virtualizer.scrollToIndex(targetRow, { align: 'start' });
    }
  }, [currentPage, pageCount, virtualizer, pageToRow, isHorizontal]);

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

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || pageCount === 0) return;

    let ticking = false;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      if (isProgrammaticScrollRef.current) {
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 150);
        return;
      }
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const offset = isHorizontal ? scrollEl.scrollLeft : scrollEl.scrollTop;
        const topRow = rowAtOffset(virtualizer.getVirtualItems(), offset);
        setCurrentPage(rows[topRow]?.[0] ?? 0);
        ticking = false;
      });
    };

    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scrollEl.removeEventListener('scroll', onScroll);
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, [virtualizer, pageCount, setCurrentPage, isHorizontal, rows]);

  useEffect(() => {
    const pages = virtualizer
      .getVirtualItems()
      .flatMap((it) => rows[it.index] ?? []);
    setVisiblePages(pages);
  });

  useEffect(() => {
    if (fitMode === 'custom') return;
    const el = scrollRef.current;
    const page = document?.pages[0];
    if (!el || !page) return;

    const recompute = () => {
      const isSideways = isSidewaysRotation(
        totalRotation(page.rotation as Rotation, rotation as Rotation),
      );
      const pw = isSideways ? page.height : page.width;
      const ph = isSideways ? page.width : page.height;
      const cols = spreadMode !== 'none' && !isHorizontal ? 2 : 1;
      const rowWidth = cols * pw;
      const availW = el.clientWidth - PAGE_VERTICAL_GAP - (cols - 1) * PAGE_SPREAD_GAP;
      const availH = el.clientHeight - PAGE_VERTICAL_GAP;
      if (availW <= 0 || availH <= 0 || rowWidth <= 0 || ph <= 0) return;
      let z = 1;
      if (fitMode === 'page-width') z = availW / rowWidth;
      else if (fitMode === 'page-fit') z = Math.min(availW / rowWidth, availH / ph);
      else if (fitMode === 'actual-size') z = 1;
      if (Number.isFinite(z) && z > 0) applyFitZoom(z);
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitMode, document, rotation, spreadMode, isHorizontal, applyFitZoom]);

  const showState =
    loadState === 'idle' ||
    loadState === 'loading' ||
    loadState === 'error' ||
    !document;

  return (
    <div
      className="dv-viewer-container"
      ref={scrollRef}
      tabIndex={0}
      role="region"
      aria-label="Document content"
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
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'flex-start',
                      gap: `${PAGE_SPREAD_GAP}px`,
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
    </div>
  );
}
