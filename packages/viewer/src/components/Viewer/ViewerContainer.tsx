import { useRef, useEffect, useLayoutEffect, useCallback, useState } from 'react';
import { useViewerStore, useViewerStoreApi } from '../../hooks/useDocViewer';
import { useStrings } from '../../i18n/I18nProvider';
import { useZoomGestures } from '../../hooks/useZoomGestures';
import { usePageVirtualizer } from '../../hooks/useVirtualizer';
import { rowAtOffset } from '../../core/current-row';
import type { Rotation } from '../../core/rotation';
import { PageRenderer } from './PageRenderer';
import { EmptyState, LoadingState, ErrorState } from '../States';
import { PAGE_GAP, PAGE_SPREAD_GAP } from './layout';
import { PinPageContext } from './pinned-pages';
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
  const isHorizontal = useViewerStore((s) => s.scrollMode === 'horizontal');
  const currentPage = useViewerStore((s) => s.currentPage);
  const navigationNonce = useViewerStore((s) => s.navigationNonce);
  const scrollOffset = useViewerStore((s) => s.scrollOffset);
  const isScrolling = useViewerStore((s) => s.isScrolling);
  const setScrolling = useViewerStore((s) => s.setScrolling);
  const setVisiblePages = useViewerStore((s) => s.setVisiblePages);
  const cursorMode = useViewerStore((s) => s.cursorMode);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef(false);
  const store = useViewerStoreApi();

  const [pinnedPages, setPinnedPages] = useState<number[]>([]);
  const pinPage = useCallback((page: number) => {
    setPinnedPages((pages) => [...pages, page]);
    return () => setPinnedPages((pages) => pages.filter((p) => p !== page));
  }, []);

  const { virtualizer, pageCount, rows, pageToRow, holdScrollPosition } = usePageVirtualizer(scrollRef, pinnedPages);

  const scrollProgrammatically = useCallback((move: (el: HTMLElement) => void) => {
    const el = scrollRef.current;
    if (!el) return;
    const at = [el.scrollLeft, el.scrollTop];
    const pending = isProgrammaticScrollRef.current;
    isProgrammaticScrollRef.current = true;
    move(el);
    // A scroll that didn't move fires no event to end the suppression, which would swallow the user's next scroll.
    if (el.scrollLeft === at[0] && el.scrollTop === at[1]) isProgrammaticScrollRef.current = pending;
  }, []);

  const scrollToRow = useCallback(
    (row: number) => scrollProgrammatically(() => virtualizer.scrollToIndex(row, { align: 'start' })),
    [scrollProgrammatically, virtualizer],
  );

  // The scroll can't go past the content's rendered size, which still has the old layout until the next render.
  const fitContent = () => {
    const content = contentRef.current;
    if (!content) return;
    const total = `${virtualizer.getTotalSize()}px`;
    if (isHorizontal) content.style.width = total;
    else content.style.height = total;
  };

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
        layout: { document, rotation, rows },
        // Only the rows whose real size differs from the estimate; the estimate already follows the zoom.
        sizes: [...virtualizer.itemSizeCache].filter(
          ([index, size]) => size !== virtualizer.options.estimateSize(index as number),
        ),
      };
    },
    restore: (at, ratio, viewX, viewY) => {
      const el = scrollRef.current;
      if (!el) return;
      holdScrollPosition();
      virtualizer.measure();
      // getVirtualItems() is called for its side effect: it makes the virtualizer recompute its measurements.
      virtualizer.getVirtualItems();
      const { layout } = at;
      if (layout.document === document && layout.rotation === rotation && layout.rows === rows) {
        for (const [key, size] of at.sizes) {
          if (typeof key === 'number') {
            virtualizer.resizeItem(key, Math.round(Math.max(0, size - PAGE_GAP) * ratio) + PAGE_GAP);
          }
        }
        virtualizer.getVirtualItems();
      }
      fitContent();
      const content = contentRef.current;
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

  // A new rotation, spread or scroll axis moves every page, so bring the current one back to the top.
  const laidOut = useRef<{ rotation: Rotation; rows: number[][] } | null>(null);
  useLayoutEffect(() => {
    const before = laidOut.current;
    laidOut.current = { rotation, rows };
    if (!before || (before.rotation === rotation && before.rows === rows)) return;
    fitContent();
    scrollToRow(pageToRow[store.getState().currentPage] ?? 0);
  });

  const handledNonce = useRef(navigationNonce);
  useEffect(() => {
    if (currentPage < 0 || currentPage >= pageCount) return;
    const el = scrollRef.current;
    if (!el) return;
    const targetRow = pageToRow[currentPage] ?? 0;
    const requested = handledNonce.current !== navigationNonce;
    handledNonce.current = navigationNonce;
    if (requested || rowInView(el, virtualizer.getVirtualItems(), isHorizontal, rows.length) !== targetRow) {
      scrollToRow(targetRow);
    }
  }, [currentPage, navigationNonce, pageCount, virtualizer, pageToRow, isHorizontal, rows.length, scrollToRow]);

  useEffect(() => {
    if (!isScrolling) return;
    const el = scrollRef.current;
    if (!el) {
      setScrolling(false);
      return;
    }
    const targetRow = pageToRow[currentPage] ?? 0;
    scrollToRow(targetRow);
    const frame = requestAnimationFrame(() => {
      const start = virtualizer.measurementsCache[targetRow]?.start ?? 0;
      const down = scrollOffset * zoom;
      scrollProgrammatically((view) =>
        view.scrollTo(isHorizontal ? { left: start, top: down } : { top: start + down }),
      );
      setScrolling(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [isScrolling, scrollOffset, zoom, currentPage, virtualizer, pageToRow, setScrolling, isHorizontal, scrollToRow, scrollProgrammatically]);

  useTrackCurrentPage(scrollRef, virtualizer, rows, pageToRow, isHorizontal, isProgrammaticScrollRef);

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
      data-horizontal={isHorizontal || undefined}
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
        <PinPageContext.Provider value={pinPage}>
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
        </PinPageContext.Provider>
      )}
      <div ref={sizerRef} className="dv-zoom-sizer" aria-hidden="true" />
    </div>
  );
}
