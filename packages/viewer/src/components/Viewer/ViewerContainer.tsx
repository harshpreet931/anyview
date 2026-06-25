/* ============================================================
 * ViewerContainer — scrollable container with virtualization
 * ============================================================ */

import { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useViewerStore } from '../../hooks/useDocViewer';
import { PageRenderer } from './PageRenderer';
import { EmptyState, LoadingState, ErrorState } from '../States';

const PAGE_VERTICAL_GAP = 48;

export function ViewerContainer() {
  const document = useViewerStore((s) => s.document);
  const loadState = useViewerStore((s) => s.loadState);
  const loadError = useViewerStore((s) => s.loadError);
  const zoom = useViewerStore((s) => s.zoom);
  const rotation = useViewerStore((s) => s.rotation);
  const scrollMode = useViewerStore((s) => s.scrollMode);
  const currentPage = useViewerStore((s) => s.currentPage);
  const setCurrentPage = useViewerStore((s) => s.setCurrentPage);
  const setZoom = useViewerStore((s) => s.setZoom);
  const fitMode = useViewerStore((s) => s.fitMode);
  const applyFitZoom = useViewerStore((s) => s._applyFitZoom);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);
  // Mirror the latest zoom so the imperative wheel listener reads it fresh.
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const isHorizontal = scrollMode === 'horizontal';
  const pageCount = document?.pages.length ?? 0;

  const virtualizer = useVirtualizer({
    count: pageCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const gap = scrollMode === 'horizontal' ? 0 : PAGE_VERTICAL_GAP;
      if (!document) return 400 + gap;
      const page = document.pages[index];
      if (!page) return 400 + gap;
      const isSideways = rotation === 90 || rotation === 270;
      const main = (isSideways ? page.width : page.height) * zoom;
      return main + gap;
    },
    overscan: 2,
    horizontal: scrollMode === 'horizontal',
  });

  useEffect(() => {
    if (currentPage < 0 || currentPage >= pageCount) return;
    const virtualItems = virtualizer.getVirtualItems();
    const firstVisible = virtualItems.length > 0 ? virtualItems[0].index : -1;
    const lastVisible = virtualItems.length > 0 ? virtualItems[virtualItems.length - 1].index : -1;
    if (firstVisible < 0 || (currentPage < firstVisible || currentPage > lastVisible)) {
      isProgrammaticScroll.current = true;
      virtualizer.scrollToIndex(currentPage, { align: 'start' });
    }
  }, [currentPage, pageCount, virtualizer]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || pageCount === 0) return;

    let ticking = false;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      if (isProgrammaticScroll.current) {
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
          isProgrammaticScroll.current = false;
        }, 150);
        return;
      }
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const offset = isHorizontal ? scrollEl.scrollLeft : scrollEl.scrollTop;
        const items = virtualizer.getVirtualItems();
        let current = items.length > 0 ? items[0].index : 0;
        for (const it of items) {
          if (it.start <= offset + 1) current = it.index;
          else break;
        }
        setCurrentPage(current);
        ticking = false;
      });
    };

    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scrollEl.removeEventListener('scroll', onScroll);
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, [virtualizer, pageCount, setCurrentPage, isHorizontal]);

  // Ctrl/Cmd + wheel zoom, anchored at the cursor. On macOS Chrome a trackpad
  // pinch is delivered as a wheel event with ctrlKey set, so this covers pinch
  // too. Listener is non-passive so we can preventDefault the browser page zoom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const old = zoomRef.current;
      // MIN/MAX mirror viewportSlice's clamp so the focal-point math matches.
      const next = Math.max(0.1, Math.min(old * Math.exp(-e.deltaY * 0.0015), 5));
      if (Math.abs(next - old) < 1e-4) return;

      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const contentX = el.scrollLeft + cx;
      const contentY = el.scrollTop + cy;
      const ratio = next / old;

      isProgrammaticScroll.current = true;
      zoomRef.current = next; // update now so a same-frame burst accumulates
      setZoom(next);
      // After the page boxes re-measure at the new zoom, keep the same content
      // point under the cursor.
      requestAnimationFrame(() => {
        el.scrollLeft = contentX * ratio - cx;
        el.scrollTop = contentY * ratio - cy;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setZoom]);

  // Fit modes: derive a zoom from the container size + first page dims and keep
  // it in sync as the container resizes. Based on the first page so scrolling
  // between differently-sized pages doesn't jump the zoom.
  useEffect(() => {
    if (fitMode === 'custom') return;
    const el = scrollRef.current;
    const page = document?.pages[0];
    if (!el || !page) return;

    const recompute = () => {
      const isSideways = rotation === 90 || rotation === 270;
      const pw = isSideways ? page.height : page.width;
      const ph = isSideways ? page.width : page.height;
      const availW = el.clientWidth - PAGE_VERTICAL_GAP;
      const availH = el.clientHeight - PAGE_VERTICAL_GAP;
      if (availW <= 0 || availH <= 0 || pw <= 0 || ph <= 0) return;
      let z = 1;
      if (fitMode === 'page-width') z = availW / pw;
      else if (fitMode === 'page-fit') z = Math.min(availW / pw, availH / ph);
      else if (fitMode === 'actual-size') z = 1;
      if (Number.isFinite(z) && z > 0) applyFitZoom(z);
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitMode, document, rotation, applyFitZoom]);

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
          style={{
            height: isHorizontal ? '100%' : `${virtualizer.getTotalSize()}px`,
            width: isHorizontal ? `${virtualizer.getTotalSize()}px` : '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => (
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
              <PageRenderer pageIndex={virtualItem.index} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
