import { useCallback, useLayoutEffect, useMemo, type RefObject } from 'react';
import { defaultRangeExtractor, useVirtualizer, type Range } from '@tanstack/react-virtual';
import { useViewerStore } from './useDocViewer';
import { groupRows } from '../core/group-rows';
import { isFixedPageFormat, rowSize } from '../components/Viewer/layout';
import { useScrollAnchor } from '../components/Viewer/useScrollAnchor';

const NO_PAGES: ReadonlyArray<number> = [];

/**
 * The viewer's virtualizer: one item per row of pages (a spread is one row), sized from the page geometry.
 * `pinnedPages` stay mounted wherever the scroll is.
 */
export function usePageVirtualizer(
  scrollRef: RefObject<HTMLDivElement | null>,
  pinnedPages: ReadonlyArray<number> = NO_PAGES,
) {
  const doc = useViewerStore((s) => s.document);
  const zoom = useViewerStore((s) => s.zoom);
  const rotation = useViewerStore((s) => s.rotation);
  const horizontal = useViewerStore((s) => s.scrollMode === 'horizontal');
  const spreadMode = useViewerStore((s) => s.spreadMode);

  const pageCount = doc?.pages.length ?? 0;
  const flowing = !!doc && !isFixedPageFormat(doc.format);
  const rows = useMemo(() => groupRows(pageCount, spreadMode, horizontal), [pageCount, spreadMode, horizontal]);
  const pageToRow = useMemo(() => {
    const map: number[] = [];
    rows.forEach((row, r) => row.forEach((p) => (map[p] = r)));
    return map;
  }, [rows]);

  const rangeExtractor = useCallback(
    (range: Range) => {
      const indexes = defaultRangeExtractor(range);
      const pinned = pinnedPages.map((p) => pageToRow[p]).filter((r) => r !== undefined);
      return pinned.length ? [...new Set([...indexes, ...pinned])].sort((a, b) => a - b) : indexes;
    },
    [pinnedPages, pageToRow],
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => rowSize(doc?.pages, rows[index], rotation, zoom, horizontal, flowing),
    overscan: 2,
    horizontal,
    rangeExtractor,
  });

  // Measured sizes are cached by row index and the estimate is only re-read on measure(),
  // so any change to the page geometry starts the layout over.
  useLayoutEffect(() => {
    virtualizer.measure();
  }, [virtualizer, doc, zoom, rotation, horizontal, spreadMode]);

  // The library's own correction compares positions from before a batch of measurements with a scroll it has
  // already corrected, so it overshoots, and it can't scroll past content that hasn't grown yet.
  useLayoutEffect(() => {
    virtualizer.shouldAdjustScrollPositionOnItemSizeChange = () => false;
  }, [virtualizer]);
  const { scrollToRow, holdScrollPosition } = useScrollAnchor(scrollRef, virtualizer, [doc, zoom, rotation, horizontal, spreadMode]);

  return { virtualizer, pageCount, rows, pageToRow, scrollToRow, holdScrollPosition };
}

/** The page virtualizer the viewer uses, for custom page views. */
export function useVirtualizerHook(scrollRef: RefObject<HTMLDivElement | null>) {
  return usePageVirtualizer(scrollRef);
}
