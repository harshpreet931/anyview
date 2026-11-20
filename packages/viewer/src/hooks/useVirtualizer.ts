import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { defaultRangeExtractor, useVirtualizer, type Range } from '@tanstack/react-virtual';
import { useViewerStore } from './useDocViewer';
import { groupRows } from '../core/group-rows';
import { rowSize } from '../components/Viewer/layout';

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
    estimateSize: (index) => rowSize(doc?.pages, rows[index], rotation, zoom, horizontal),
    overscan: 2,
    horizontal,
    rangeExtractor,
  });

  // Measured sizes are cached by row index and the estimate is only re-read on measure(),
  // so any change to the page geometry starts the layout over.
  useLayoutEffect(() => {
    virtualizer.measure();
  }, [virtualizer, doc, zoom, rotation, horizontal, spreadMode]);

  // Rows re-measured just after a zoom would otherwise each move the scroll that the zoom anchoring just set.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const holdScrollPosition = useCallback(() => {
    clearTimeout(holdTimer.current);
    virtualizer.shouldAdjustScrollPositionOnItemSizeChange = () => false;
    holdTimer.current = setTimeout(() => {
      holdTimer.current = undefined;
      virtualizer.shouldAdjustScrollPositionOnItemSizeChange = undefined;
    }, 500);
  }, [virtualizer]);
  useEffect(() => () => clearTimeout(holdTimer.current), []);

  return { virtualizer, pageCount, rows, pageToRow, holdScrollPosition };
}

/** The page virtualizer the viewer uses, for custom page views. */
export function useVirtualizerHook(scrollRef: RefObject<HTMLDivElement | null>) {
  return usePageVirtualizer(scrollRef);
}
