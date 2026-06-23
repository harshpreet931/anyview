/* ============================================================
 * useVirtualizer — wraps @tanstack/react-virtual with store state
 * ============================================================ */

import { type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useViewerStore } from './useDocViewer';

export function useVirtualizerHook(
  scrollRef: RefObject<HTMLDivElement | null>,
) {
  const document = useViewerStore((s) => s.document);
  const zoom = useViewerStore((s) => s.zoom);
  const rotation = useViewerStore((s) => s.rotation);
  const scrollMode = useViewerStore((s) => s.scrollMode);

  const pageCount = document?.pages.length ?? 0;

  const virtualizer = useVirtualizer({
    count: pageCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      if (!document) return 400;
      const page = document.pages[index];
      if (!page) return 400;
      const isSideways = rotation === 90 || rotation === 270;
      const dim = isSideways ? page.width : page.height;
      return dim * zoom;
    },
    overscan: 2,
    horizontal: scrollMode === 'horizontal',
  });

  return { virtualizer, pageCount };
}
