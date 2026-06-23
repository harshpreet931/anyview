/* ============================================================
 * ViewerContainer — scrollable container with virtualization
 * ============================================================ */

import { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useViewerStore } from '../../hooks/useDocViewer';
import { PageRenderer } from './PageRenderer';
import { EmptyState, LoadingState, ErrorState } from '../States';

export function ViewerContainer() {
  const document = useViewerStore((s) => s.document);
  const loadState = useViewerStore((s) => s.loadState);
  const loadError = useViewerStore((s) => s.loadError);
  const zoom = useViewerStore((s) => s.zoom);
  const rotation = useViewerStore((s) => s.rotation);
  const scrollMode = useViewerStore((s) => s.scrollMode);
  const currentPage = useViewerStore((s) => s.currentPage);
  const setCurrentPage = useViewerStore((s) => s.setCurrentPage);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);

  const isHorizontal = scrollMode === 'horizontal';
  const pageCount = document?.pages.length ?? 0;

  const virtualizer = useVirtualizer({
    count: pageCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      if (!document) return 400;
      const page = document.pages[index];
      if (!page) return 400;
      const scaledHeight = page.height * zoom;
      const isSideways = rotation === 90 || rotation === 270;
      return isSideways ? page.width * zoom : scaledHeight;
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
    const onScroll = () => {
      if (isProgrammaticScroll.current) {
        isProgrammaticScroll.current = false;
        return;
      }
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const virtualItems = virtualizer.getVirtualItems();
        if (virtualItems.length > 0) {
          setCurrentPage(virtualItems[0].index);
        }
        ticking = false;
      });
    };

    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollEl.removeEventListener('scroll', onScroll);
  }, [virtualizer, pageCount, setCurrentPage]);

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
